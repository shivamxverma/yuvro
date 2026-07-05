import * as k8s from "@kubernetes/client-node";
import config, { generateSecretValue } from "../../config";
import { coreApi, appsApi } from "./client";
import { createOrPatchResource } from "./helpers";
import { dbResourceName, dbSecretName, dbPvcName } from "./naming";

async function ensureDbSecret(projectId: string, engine: string): Promise<string> {
  const namespace = config.K8S_NAMESPACE;
  const secretName = dbSecretName(projectId, engine);
  const resourceName = dbResourceName(projectId, engine);
  const labels = { app: resourceName, "project-id": projectId, engine };

  try {
    const res = await coreApi.readNamespacedSecret({ name: secretName, namespace });
    const passwordEncoded = res.data?.password;
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

  await coreApi.createNamespacedSecret({ namespace, body: secretBody });
  return password;
}

async function ensureDbPvc(projectId: string, engine: string): Promise<void> {
  const namespace = config.K8S_NAMESPACE;
  const pvcName = dbPvcName(projectId, engine);
  const resourceName = dbResourceName(projectId, engine);
  const labels = { app: resourceName, "project-id": projectId, engine };

  try {
    await coreApi.readNamespacedPersistentVolumeClaim({ name: pvcName, namespace });
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

  await coreApi.createNamespacedPersistentVolumeClaim({ namespace, body: pvcBody });
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
    () => appsApi.readNamespacedDeployment({ name: resourceName, namespace }),
    () => appsApi.createNamespacedDeployment({ namespace, body: deploymentBody }),
    () => appsApi.replaceNamespacedDeployment({ name: resourceName, namespace, body: deploymentBody })
  );

  await createOrPatchResource(
    () => coreApi.readNamespacedService({ name: resourceName, namespace }),
    () => coreApi.createNamespacedService({ namespace, body: serviceBody }),
    () => coreApi.replaceNamespacedService({ name: resourceName, namespace, body: serviceBody })
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
      const podRes = await coreApi.listNamespacedPod({
        namespace,
        labelSelector,
      });

      const pods = podRes.items || [];
      let readyPod: k8s.V1Pod | undefined;

      if (pods.length > 0) {
        for (const pod of pods) {
          const conditions = pod.status?.conditions || [];
          const isReady = conditions.some((c: any) => c.type === "Ready" && c.status === "True");
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
          endpoints = await coreApi.readNamespacedEndpoints({ name: resourceName, namespace });
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
