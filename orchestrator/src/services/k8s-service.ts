import * as k8s from "@kubernetes/client-node";
import config, { generateSecretValue } from "../config";

const kc = new k8s.KubeConfig();
try {
  kc.loadFromCluster();
} catch (e) {
  if (config.K8S_CONTEXT) {
    kc.loadFromDefault();
    kc.setCurrentContext(config.K8S_CONTEXT);
  } else {
    kc.loadFromDefault();
  }
}

const coreApi = kc.makeApiClient(k8s.CoreV1Api);
const appsApi = kc.makeApiClient(k8s.AppsV1Api);
const networkingApi = kc.makeApiClient(k8s.NetworkingV1Api);

function safeName(prefix: string, value: string): string {
  let normalized = value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "");
  if (!normalized) normalized = "workspace";
  const candidate = `${prefix}-${normalized}`;
  if (candidate.length <= 63) return candidate;

  const crypto = require("crypto");
  const digest = crypto.createHash("sha1").update(value).digest("hex").substring(0, 8);
  const trimmed = candidate.substring(0, 63 - digest.length - 1).replace(/-+$/g, "");
  return `${trimmed}-${digest}`;
}

export function runnerResourceName(projectId: string): string {
  return safeName("runner", projectId);
}

export function dbResourceName(projectId: string, engine: string): string {
  return safeName(engine, projectId);
}

export function dbSecretName(projectId: string, engine: string): string {
  return safeName(`${engine}-secret`, projectId);
}

export function dbPvcName(projectId: string, engine: string): string {
  return safeName(`${engine}-data`, projectId);
}

export function runnerPublicHost(projectId: string): string {
  return `${runnerResourceName(projectId)}.${config.K8S_BASE_DOMAIN}`.replace(/^\.|\.$/g, "");
}

export function runnerPublicBaseUrl(projectId: string): string {
  const host = runnerPublicHost(projectId);
  if (
    (config.K8S_INGRESS_SCHEME === "http" && config.K8S_INGRESS_PORT === 80) ||
    (config.K8S_INGRESS_SCHEME === "https" && config.K8S_INGRESS_PORT === 443)
  ) {
    return `${config.K8S_INGRESS_SCHEME}://${host}`;
  }
  return `${config.K8S_INGRESS_SCHEME}://${host}:${config.K8S_INGRESS_PORT}`;
}

export function runnerInternalBaseUrl(projectId: string): string {
  const serviceName = runnerResourceName(projectId);
  return `http://${serviceName}.${config.K8S_NAMESPACE}.svc.cluster.local:${config.RUNNER_INTERNAL_PORT}`;
}

function workspaceSubpath(workspaceId: string, projectId: string): string {
  return `${workspaceId}/${projectId}`;
}

// Helper to create or patch resources
async function createOrPatchResource(
  readFn: () => Promise<any>,
  createFn: () => Promise<any>,
  patchFn: () => Promise<any>
): Promise<void> {
  try {
    await readFn();
    await patchFn();
  } catch (error: any) {
    if (error.response?.statusCode === 404 || error.statusCode === 404) {
      await createFn();
    } else {
      throw error;
    }
  }
}

export async function ensureRunnerResources(workspaceId: string, projectId: string, envVars: Record<string, string>): Promise<string> {
  const namespace = config.K8S_NAMESPACE;
  const resourceName = runnerResourceName(projectId);
  const labels = { app: resourceName, "project-id": projectId };

  const env = [
    { name: "BASE_DIR", value: "/workspace" },
    { name: "IS_CONTAINER", value: "true" },
    { name: "PORT", value: String(config.RUNNER_INTERNAL_PORT) },
  ];

  for (const [key, value] of Object.entries(envVars)) {
    env.push({ name: key, value });
  }

  // Define Deployment
  const deploymentBody: k8s.V1Deployment = {
    metadata: { name: resourceName, namespace, labels },
    spec: {
      replicas: 1,
      selector: { matchLabels: labels },
      template: {
        metadata: { labels },
        spec: {
          containers: [
            {
              name: "runner",
              image: config.RUNNER_IMAGE,
              imagePullPolicy: config.RUNNER_IMAGE_PULL_POLICY,
              ports: [{ containerPort: config.RUNNER_INTERNAL_PORT }],
              env,
              volumeMounts: [
                {
                  name: "workspace-root",
                  mountPath: "/workspace",
                  subPath: workspaceSubpath(workspaceId, projectId),
                },
              ],
            },
          ],
          volumes: [
            {
              name: "workspace-root",
              hostPath: {
                path: config.K8S_WORKSPACE_ROOT,
                type: "DirectoryOrCreate",
              },
            },
          ],
        },
      },
    },
  };

  // Define Service
  const serviceBody: k8s.V1Service = {
    metadata: { name: resourceName, namespace, labels },
    spec: {
      selector: labels,
      ports: [
        {
          name: "runner",
          port: config.RUNNER_INTERNAL_PORT,
          targetPort: config.RUNNER_INTERNAL_PORT,
        },
      ],
    },
  };

  // Define Ingress
  const ingressBody: k8s.V1Ingress = {
    metadata: {
      name: resourceName,
      namespace,
      annotations: {
        "nginx.ingress.kubernetes.io/proxy-body-size": "50m",
      },
    },
    spec: {
      ingressClassName: "nginx",
      rules: [
        {
          host: runnerPublicHost(projectId),
          http: {
            paths: [
              {
                path: "/",
                pathType: "Prefix",
                backend: {
                  service: {
                    name: resourceName,
                    port: { number: config.RUNNER_INTERNAL_PORT },
                  },
                },
              },
            ],
          },
        },
      ],
    },
  };

  // Deploy resources
  await createOrPatchResource(
    () => appsApi.readNamespacedDeployment(resourceName, namespace),
    () => appsApi.createNamespacedDeployment(namespace, deploymentBody),
    () => appsApi.replaceNamespacedDeployment(resourceName, namespace, deploymentBody)
  );

  await createOrPatchResource(
    () => coreApi.readNamespacedService(resourceName, namespace),
    () => coreApi.createNamespacedService(namespace, serviceBody),
    () => coreApi.replaceNamespacedService(resourceName, namespace, serviceBody)
  );

  await createOrPatchResource(
    () => networkingApi.readNamespacedIngress(resourceName, namespace),
    () => networkingApi.createNamespacedIngress(namespace, ingressBody),
    () => networkingApi.replaceNamespacedIngress(resourceName, namespace, ingressBody)
  );

  return runnerPublicBaseUrl(projectId);
}

async function ensureDbSecret(projectId: string, engine: string): Promise<string> {
  const namespace = config.K8S_NAMESPACE;
  const secretName = dbSecretName(projectId, engine);
  const resourceName = dbResourceName(projectId, engine);
  const labels = { app: resourceName, "project-id": projectId, engine };

  try {
    const res = await coreApi.readNamespacedSecret(secretName, namespace);
    const passwordEncoded = res.body.data?.password;
    if (!passwordEncoded) {
      throw new Error(`Database secret '${secretName}' is missing the password key.`);
    }
    return Buffer.from(passwordEncoded, "base64").toString("utf-8");
  } catch (error: any) {
    if (error.response?.statusCode !== 404 && error.statusCode !== 404) {
      throw error;
    }
  }

  const password = generateSecretValue();
  const secretBody: k8s.V1Secret = {
    metadata: { name: secretName, namespace, labels },
    type: "Opaque",
    stringData: { password },
  };

  await coreApi.createNamespacedSecret(namespace, secretBody);
  return password;
}

async function ensureDbPvc(projectId: string, engine: string): Promise<void> {
  const namespace = config.K8S_NAMESPACE;
  const pvcName = dbPvcName(projectId, engine);
  const resourceName = dbResourceName(projectId, engine);
  const labels = { app: resourceName, "project-id": projectId, engine };

  try {
    await coreApi.readNamespacedPersistentVolumeClaim(pvcName, namespace);
    return;
  } catch (error: any) {
    if (error.response?.statusCode !== 404 && error.statusCode !== 404) {
      throw error;
    }
  }

  const pvcSpec: k8s.V1PersistentVolumeClaimSpec = {
    accessModes: ["ReadWriteOnce"],
    resources: { requests: { storage: config.K8S_DB_STORAGE_SIZE } },
  };
  if (config.K8S_DB_STORAGE_CLASS) {
    pvcSpec.storageClassName = config.K8S_DB_STORAGE_CLASS;
  }

  const pvcBody: k8s.V1PersistentVolumeClaim = {
    metadata: { name: pvcName, namespace, labels },
    spec: pvcSpec,
  };

  await coreApi.createNamespacedPersistentVolumeClaim(namespace, pvcBody);
}

export async function ensureDatabaseResources(projectId: string, engine: string): Promise<any> {
  const namespace = config.K8S_NAMESPACE;
  const resourceName = dbResourceName(projectId, engine);
  const secretName = dbSecretName(projectId, engine);
  const pvcName = dbPvcName(projectId, engine);
  const labels = { app: resourceName, "project-id": projectId, engine };

  const password = await ensureDbSecret(projectId, engine);
  await ensureDbPvc(projectId, engine);

  let image = "";
  let env: k8s.V1EnvVar[] = [];
  let port = 0;
  let dataMountPath = "";
  let readinessProbe: k8s.V1Probe;

  if (engine === "postgres") {
    image = config.POSTGRES_IMAGE;
    env = [
      { name: "POSTGRES_DB", value: "yuvro_db" },
      { name: "POSTGRES_USER", value: "postgres" },
      {
        name: "POSTGRES_PASSWORD",
        valueFrom: {
          secretKeyRef: { name: secretName, key: "password" },
        },
      },
    ];
    port = 5432;
    dataMountPath = "/var/lib/postgresql/data";
    readinessProbe = {
      exec: {
        command: ["sh", "-c", "pg_isready -U postgres -d yuvro_db -h 127.0.0.1 -p 5432"],
      },
      initialDelaySeconds: 5,
      periodSeconds: 2,
      timeoutSeconds: 2,
      failureThreshold: 15,
    };
  } else {
    image = config.MYSQL_IMAGE;
    env = [
      { name: "MYSQL_DATABASE", value: "yuvro_db" },
      {
        name: "MYSQL_ROOT_PASSWORD",
        valueFrom: {
          secretKeyRef: { name: secretName, key: "password" },
        },
      },
    ];
    port = 3306;
    dataMountPath = "/var/lib/mysql";
    readinessProbe = {
      exec: {
        command: ["sh", "-c", 'mysqladmin ping -h 127.0.0.1 -uroot -p"$MYSQL_ROOT_PASSWORD" --silent'],
      },
      initialDelaySeconds: 5,
      periodSeconds: 2,
      timeoutSeconds: 2,
      failureThreshold: 15,
    };
  }

  const deploymentBody: k8s.V1Deployment = {
    metadata: { name: resourceName, namespace, labels },
    spec: {
      replicas: 1,
      selector: { matchLabels: labels },
      template: {
        metadata: { labels },
        spec: {
          containers: [
            {
              name: engine,
              image,
              ports: [{ containerPort: port }],
              env,
              readinessProbe,
              volumeMounts: [
                {
                  name: "db-data",
                  mountPath: dataMountPath,
                },
              ],
            },
          ],
          volumes: [
            {
              name: "db-data",
              persistentVolumeClaim: {
                claimName: pvcName,
              },
            },
          ],
        },
      },
    },
  };

  const serviceBody: k8s.V1Service = {
    metadata: { name: resourceName, namespace, labels },
    spec: {
      selector: labels,
      ports: [{ name: engine, port, targetPort: port }],
    },
  };

  await createOrPatchResource(
    () => appsApi.readNamespacedDeployment(resourceName, namespace),
    () => appsApi.createNamespacedDeployment(namespace, deploymentBody),
    () => appsApi.replaceNamespacedDeployment(resourceName, namespace, deploymentBody)
  );

  await createOrPatchResource(
    () => coreApi.readNamespacedService(resourceName, namespace),
    () => coreApi.createNamespacedService(namespace, serviceBody),
    () => coreApi.replaceNamespacedService(resourceName, namespace, serviceBody)
  );

  return {
    status: "started",
    engine,
    host: resourceName,
    port,
    user: engine === "postgres" ? "postgres" : "root",
    password,
    database: "yuvro_db",
  };
}

export async function waitForDatabaseResources(
  projectId: string,
  engine: string,
  timeoutSeconds: number = config.K8S_DB_READY_TIMEOUT_SECONDS
): Promise<void> {
  const namespace = config.K8S_NAMESPACE;
  const resourceName = dbResourceName(projectId, engine);
  const labelSelector = `app=${resourceName},project-id=${projectId},engine=${engine}`;
  const deadline = Date.now() + timeoutSeconds * 1000;
  let lastReason = "database pod has not reported readiness yet";

  while (Date.now() < deadline) {
    try {
      const podRes = await coreApi.listNamespacedPod(
        namespace,
        undefined,
        undefined,
        undefined,
        undefined,
        labelSelector
      );
      
      const pods = podRes.body.items || [];
      let readyPod: k8s.V1Pod | undefined;

      if (pods.length > 0) {
        for (const pod of pods) {
          const conditions = pod.status?.conditions || [];
          const isReady = conditions.some((c) => c.type === "Ready" && c.status === "True");
          if (isReady) {
            readyPod = pod;
            break;
          }
        }

        if (!readyPod) {
          const firstPod = pods[0];
          const statuses = firstPod.status?.containerStatuses || [];
          for (const s of statuses) {
            if (s.state?.waiting?.reason) {
              lastReason = `${s.state.waiting.reason}: ${s.state.waiting.message || ""}`;
              break;
            }
            if (s.state?.terminated?.reason) {
              lastReason = `${s.state.terminated.reason}: ${s.state.terminated.message || ""}`;
              break;
            }
          }
          if (firstPod.status?.phase) {
            lastReason = `${firstPod.status.phase}`;
          }
        }
      }

      if (readyPod) {
        let endpoints: k8s.V1Endpoints | undefined;
        try {
          const epRes = await coreApi.readNamespacedEndpoints(resourceName, namespace);
          endpoints = epRes.body;
        } catch (e: any) {
          if (e.response?.statusCode !== 404 && e.statusCode !== 404) {
            throw e;
          }
        }

        const subsets = endpoints?.subsets || [];
        const hasReadyEndpoint = subsets.some((s) => s.addresses && s.addresses.length > 0);
        if (hasReadyEndpoint) {
          return;
        }
        lastReason = "database service has no ready endpoints yet";
      }
    } catch (e: any) {
      lastReason = e.message || String(e);
    }

    // Sleep for 2 seconds
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error(
    `Timed out waiting for ${engine} database '${resourceName}' to become ready. Last observed state: ${lastReason}.`
  );
}
