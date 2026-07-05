import crypto from "crypto";
import config from "../../config";

function safeName(prefix: string, value: string): string {
  let normalized = value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "");
  if (!normalized) normalized = "workspace";
  const candidate = `${prefix}-${normalized}`;
  if (candidate.length <= 63) return candidate;

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

export function workspaceSubpath(workspaceId: string, projectId: string): string {
  return `${workspaceId}/${projectId}`;
}
