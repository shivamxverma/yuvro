import * as k8s from "@kubernetes/client-node";
import config from "../../config";
import { coreApi, appsApi, networkingApi } from "./client";
import { createOrPatchResource } from "./helpers";
import { runnerResourceName, runnerPublicHost, runnerPublicBaseUrl, workspaceSubpath } from "./naming";

export async function ensureRunnerResources(
  workspaceId: string,
  projectId: string,
  envVars: Record<string, string>
): Promise<string> {
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
        "nginx.ingress.ingress.kubernetes.io/proxy-body-size": "50m",
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
    () => appsApi.readNamespacedDeployment({ name: resourceName, namespace }),
    () => appsApi.createNamespacedDeployment({ namespace, body: deploymentBody }),
    () => appsApi.replaceNamespacedDeployment({ name: resourceName, namespace, body: deploymentBody })
  );

  await createOrPatchResource(
    () => coreApi.readNamespacedService({ name: resourceName, namespace }),
    () => coreApi.createNamespacedService({ namespace, body: serviceBody }),
    () => coreApi.replaceNamespacedService({ name: resourceName, namespace, body: serviceBody })
  );

  await createOrPatchResource(
    () => networkingApi.readNamespacedIngress({ name: resourceName, namespace }),
    () => networkingApi.createNamespacedIngress({ namespace, body: ingressBody }),
    () => networkingApi.replaceNamespacedIngress({ name: resourceName, namespace, body: ingressBody })
  );

  return runnerPublicBaseUrl(projectId);
}
