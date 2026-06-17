import hashlib
import base64
import re

from kubernetes import client, config
from kubernetes.client.rest import ApiException

from app.config import (
    K8S_BASE_DOMAIN,
    K8S_DB_STORAGE_CLASS,
    K8S_DB_STORAGE_SIZE,
    K8S_CONTEXT,
    K8S_INGRESS_PORT,
    K8S_INGRESS_SCHEME,
    K8S_NAMESPACE,
    K8S_WORKSPACE_ROOT,
    MYSQL_IMAGE,
    POSTGRES_IMAGE,
    RUNNER_IMAGE,
    RUNNER_IMAGE_PULL_POLICY,
    RUNNER_INTERNAL_PORT,
    generate_secret_value,
)


_clients: dict[str, object] | None = None


def _load_clients() -> dict[str, object]:
    global _clients
    if _clients is not None:
        return _clients

    try:
        config.load_incluster_config()
    except config.ConfigException:
        config.load_kube_config(context=K8S_CONTEXT)

    kube_client = client.ApiClient()
    _clients = {
        "apps": client.AppsV1Api(kube_client),
        "core": client.CoreV1Api(kube_client),
        "networking": client.NetworkingV1Api(kube_client),
    }
    return _clients


def _safe_name(prefix: str, value: str) -> str:
    normalized = re.sub(r"[^a-z0-9-]+", "-", value.strip().lower()).strip("-")
    normalized = re.sub(r"-{2,}", "-", normalized)
    if not normalized:
        normalized = "workspace"

    candidate = f"{prefix}-{normalized}"
    if len(candidate) <= 63:
        return candidate

    digest = hashlib.sha1(value.encode("utf-8")).hexdigest()[:8]
    trimmed = candidate[: 63 - len(digest) - 1].rstrip("-")
    return f"{trimmed}-{digest}"


def runner_resource_name(project_id: str) -> str:
    return _safe_name("runner", project_id)


def db_resource_name(project_id: str, engine: str) -> str:
    return _safe_name(engine, project_id)


def db_secret_name(project_id: str, engine: str) -> str:
    return _safe_name(f"{engine}-secret", project_id)


def db_pvc_name(project_id: str, engine: str) -> str:
    return _safe_name(f"{engine}-data", project_id)


def runner_public_host(project_id: str) -> str:
    return f"{runner_resource_name(project_id)}.{K8S_BASE_DOMAIN}".strip(".")


def runner_public_base_url(project_id: str) -> str:
    host = runner_public_host(project_id)
    if (
        (K8S_INGRESS_SCHEME == "http" and K8S_INGRESS_PORT == 80)
        or (K8S_INGRESS_SCHEME == "https" and K8S_INGRESS_PORT == 443)
    ):
        return f"{K8S_INGRESS_SCHEME}://{host}"
    return f"{K8S_INGRESS_SCHEME}://{host}:{K8S_INGRESS_PORT}"


def runner_internal_base_url(project_id: str) -> str:
    service_name = runner_resource_name(project_id)
    return f"http://{service_name}.{K8S_NAMESPACE}.svc.cluster.local:{RUNNER_INTERNAL_PORT}"


def _workspace_subpath(workspace_id: str, project_id: str) -> str:
    return f"{workspace_id}/{project_id}"


def _deployment_body(workspace_id: str, project_id: str, env_vars: dict[str, str]) -> client.V1Deployment:
    resource_name = runner_resource_name(project_id)
    labels = {"app": resource_name, "project-id": project_id}

    env = [
        client.V1EnvVar(name="BASE_DIR", value="/workspace"),
        client.V1EnvVar(name="IS_CONTAINER", value="true"),
        client.V1EnvVar(name="PORT", value=str(RUNNER_INTERNAL_PORT)),
    ]
    for key, value in sorted(env_vars.items()):
        env.append(client.V1EnvVar(name=key, value=value))

    return client.V1Deployment(
        metadata=client.V1ObjectMeta(name=resource_name, namespace=K8S_NAMESPACE, labels=labels),
        spec=client.V1DeploymentSpec(
            replicas=1,
            selector=client.V1LabelSelector(match_labels=labels),
            template=client.V1PodTemplateSpec(
                metadata=client.V1ObjectMeta(labels=labels),
                spec=client.V1PodSpec(
                    containers=[
                        client.V1Container(
                            name="runner",
                            image=RUNNER_IMAGE,
                            image_pull_policy=RUNNER_IMAGE_PULL_POLICY,
                            ports=[
                                client.V1ContainerPort(container_port=RUNNER_INTERNAL_PORT),
                            ],
                            env=env,
                            volume_mounts=[
                                client.V1VolumeMount(
                                    name="workspace-root",
                                    mount_path="/workspace",
                                    sub_path=_workspace_subpath(workspace_id, project_id),
                                )
                            ],
                        )
                    ],
                    volumes=[
                        client.V1Volume(
                            name="workspace-root",
                            host_path=client.V1HostPathVolumeSource(
                                path=K8S_WORKSPACE_ROOT,
                                type="DirectoryOrCreate",
                            ),
                        )
                    ],
                ),
            ),
        ),
    )


def _service_body(project_id: str) -> client.V1Service:
    resource_name = runner_resource_name(project_id)
    labels = {"app": resource_name, "project-id": project_id}
    return client.V1Service(
        metadata=client.V1ObjectMeta(name=resource_name, namespace=K8S_NAMESPACE, labels=labels),
        spec=client.V1ServiceSpec(
            selector=labels,
            ports=[
                client.V1ServicePort(
                    name="runner",
                    port=RUNNER_INTERNAL_PORT,
                    target_port=RUNNER_INTERNAL_PORT,
                )
            ],
        ),
    )


def _ingress_body(project_id: str) -> client.V1Ingress:
    resource_name = runner_resource_name(project_id)
    host = runner_public_host(project_id)
    return client.V1Ingress(
        metadata=client.V1ObjectMeta(name=resource_name, namespace=K8S_NAMESPACE),
        spec=client.V1IngressSpec(
            ingress_class_name="nginx",
            rules=[
                client.V1IngressRule(
                    host=host,
                    http=client.V1HTTPIngressRuleValue(
                        paths=[
                            client.V1HTTPIngressPath(
                                path="/",
                                path_type="Prefix",
                                backend=client.V1IngressBackend(
                                    service=client.V1IngressServiceBackend(
                                        name=resource_name,
                                        port=client.V1ServiceBackendPort(number=RUNNER_INTERNAL_PORT),
                                    )
                                ),
                            )
                        ]
                    ),
                )
            ],
        ),
    )


def _db_deployment_body(project_id: str, engine: str) -> client.V1Deployment:
    resource_name = db_resource_name(project_id, engine)
    secret_name = db_secret_name(project_id, engine)
    pvc_name = db_pvc_name(project_id, engine)
    labels = {"app": resource_name, "project-id": project_id, "engine": engine}

    if engine == "postgres":
        image = POSTGRES_IMAGE
        env = [
            client.V1EnvVar(name="POSTGRES_DB", value="yuvro_db"),
            client.V1EnvVar(name="POSTGRES_USER", value="postgres"),
            client.V1EnvVar(
                name="POSTGRES_PASSWORD",
                value_from=client.V1EnvVarSource(
                    secret_key_ref=client.V1SecretKeySelector(name=secret_name, key="password")
                ),
            ),
        ]
        port = 5432
        data_mount_path = "/var/lib/postgresql/data"
    else:
        image = MYSQL_IMAGE
        env = [
            client.V1EnvVar(name="MYSQL_DATABASE", value="yuvro_db"),
            client.V1EnvVar(
                name="MYSQL_ROOT_PASSWORD",
                value_from=client.V1EnvVarSource(
                    secret_key_ref=client.V1SecretKeySelector(name=secret_name, key="password")
                ),
            ),
        ]
        port = 3306
        data_mount_path = "/var/lib/mysql"

    return client.V1Deployment(
        metadata=client.V1ObjectMeta(name=resource_name, namespace=K8S_NAMESPACE, labels=labels),
        spec=client.V1DeploymentSpec(
            replicas=1,
            selector=client.V1LabelSelector(match_labels=labels),
            template=client.V1PodTemplateSpec(
                metadata=client.V1ObjectMeta(labels=labels),
                spec=client.V1PodSpec(
                    containers=[
                        client.V1Container(
                            name=engine,
                            image=image,
                            ports=[client.V1ContainerPort(container_port=port)],
                            env=env,
                            volume_mounts=[
                                client.V1VolumeMount(
                                    name="db-data",
                                    mount_path=data_mount_path,
                                )
                            ],
                        )
                    ],
                    volumes=[
                        client.V1Volume(
                            name="db-data",
                            persistent_volume_claim=client.V1PersistentVolumeClaimVolumeSource(
                                claim_name=pvc_name
                            ),
                        )
                    ],
                ),
            ),
        ),
    )


def _db_service_body(project_id: str, engine: str) -> client.V1Service:
    resource_name = db_resource_name(project_id, engine)
    labels = {"app": resource_name, "project-id": project_id, "engine": engine}
    port = 5432 if engine == "postgres" else 3306
    return client.V1Service(
        metadata=client.V1ObjectMeta(name=resource_name, namespace=K8S_NAMESPACE, labels=labels),
        spec=client.V1ServiceSpec(
            selector=labels,
            ports=[client.V1ServicePort(name=engine, port=port, target_port=port)],
        ),
    )


def _db_secret_body(project_id: str, engine: str, password: str) -> client.V1Secret:
    resource_name = db_resource_name(project_id, engine)
    labels = {"app": resource_name, "project-id": project_id, "engine": engine}
    return client.V1Secret(
        metadata=client.V1ObjectMeta(name=db_secret_name(project_id, engine), namespace=K8S_NAMESPACE, labels=labels),
        type="Opaque",
        string_data={"password": password},
    )


def _db_pvc_body(project_id: str, engine: str) -> client.V1PersistentVolumeClaim:
    resource_name = db_resource_name(project_id, engine)
    labels = {"app": resource_name, "project-id": project_id, "engine": engine}
    pvc_spec = client.V1PersistentVolumeClaimSpec(
        access_modes=["ReadWriteOnce"],
        resources=client.V1VolumeResourceRequirements(requests={"storage": K8S_DB_STORAGE_SIZE}),
    )
    if K8S_DB_STORAGE_CLASS:
        pvc_spec.storage_class_name = K8S_DB_STORAGE_CLASS

    return client.V1PersistentVolumeClaim(
        metadata=client.V1ObjectMeta(name=db_pvc_name(project_id, engine), namespace=K8S_NAMESPACE, labels=labels),
        spec=pvc_spec,
    )


def _create_or_patch_resource(read_fn, create_fn, patch_fn, name: str, body) -> None:
    try:
        read_fn(name=name, namespace=K8S_NAMESPACE)
        patch_fn(name=name, namespace=K8S_NAMESPACE, body=body)
    except ApiException as exc:
        if exc.status != 404:
            raise
        create_fn(namespace=K8S_NAMESPACE, body=body)


def _ensure_db_secret(project_id: str, engine: str) -> str:
    clients = _load_clients()
    secret_name = db_secret_name(project_id, engine)
    try:
        secret = clients["core"].read_namespaced_secret(name=secret_name, namespace=K8S_NAMESPACE)
        encoded_password = (secret.data or {}).get("password")
        if not encoded_password:
            raise ValueError(f"Database secret '{secret_name}' is missing the password key.")
        return base64.b64decode(encoded_password).decode("utf-8")
    except ApiException as exc:
        if exc.status != 404:
            raise

    password = generate_secret_value()
    clients["core"].create_namespaced_secret(
        namespace=K8S_NAMESPACE,
        body=_db_secret_body(project_id, engine, password),
    )
    return password


def _ensure_db_pvc(project_id: str, engine: str) -> None:
    clients = _load_clients()
    pvc_name = db_pvc_name(project_id, engine)
    try:
        clients["core"].read_namespaced_persistent_volume_claim(name=pvc_name, namespace=K8S_NAMESPACE)
    except ApiException as exc:
        if exc.status != 404:
            raise
        clients["core"].create_namespaced_persistent_volume_claim(
            namespace=K8S_NAMESPACE,
            body=_db_pvc_body(project_id, engine),
        )


def ensure_runner_resources(workspace_id: str, project_id: str, env_vars: dict[str, str]) -> str:
    clients = _load_clients()
    resource_name = runner_resource_name(project_id)

    _create_or_patch_resource(
        clients["apps"].read_namespaced_deployment,
        clients["apps"].create_namespaced_deployment,
        clients["apps"].patch_namespaced_deployment,
        resource_name,
        _deployment_body(workspace_id, project_id, env_vars),
    )
    _create_or_patch_resource(
        clients["core"].read_namespaced_service,
        clients["core"].create_namespaced_service,
        clients["core"].patch_namespaced_service,
        resource_name,
        _service_body(project_id),
    )
    _create_or_patch_resource(
        clients["networking"].read_namespaced_ingress,
        clients["networking"].create_namespaced_ingress,
        clients["networking"].patch_namespaced_ingress,
        resource_name,
        _ingress_body(project_id),
    )

    return runner_public_base_url(project_id)


def ensure_database_resources(project_id: str, engine: str) -> dict:
    clients = _load_clients()
    resource_name = db_resource_name(project_id, engine)
    password = _ensure_db_secret(project_id, engine)
    _ensure_db_pvc(project_id, engine)

    _create_or_patch_resource(
        clients["apps"].read_namespaced_deployment,
        clients["apps"].create_namespaced_deployment,
        clients["apps"].patch_namespaced_deployment,
        resource_name,
        _db_deployment_body(project_id, engine),
    )
    _create_or_patch_resource(
        clients["core"].read_namespaced_service,
        clients["core"].create_namespaced_service,
        clients["core"].patch_namespaced_service,
        resource_name,
        _db_service_body(project_id, engine),
    )

    return {
        "status": "started",
        "engine": engine,
        "host": resource_name,
        "port": 5432 if engine == "postgres" else 3306,
        "user": "postgres" if engine == "postgres" else "root",
        "password": password,
        "database": "yuvro_db",
    }
