import fs from "fs";
import path from "path";
import axios from "axios";
import config, { getRunnerEnv } from "../../config";
import * as k8sService from "../../services/k8s-service";
import ApiError from "../../utils/ApiError";
import { StartRunnerInput, StartRunnerResult } from "./runner-types";

// Mutex locks for container starts
const startLocks = new Map<string, Promise<void> | null>();

async function withLock<T>(projectId: string, fn: () => Promise<T>): Promise<T> {
  while (startLocks.get(projectId)) {
    await startLocks.get(projectId);
  }

  let resolveLock: () => void;
  const lockPromise = new Promise<void>((resolve) => {
    resolveLock = resolve;
  });
  startLocks.set(projectId, lockPromise);

  try {
    return await fn();
  } finally {
    startLocks.delete(projectId);
    resolveLock!();
  }
}

async function waitForRunner(baseUrl: string): Promise<boolean> {
  const url = `${baseUrl.replace(/\/$/, "")}/docs`;

  for (let i = 0; i < 30; i++) {
    try {
      const response = await axios.get(url, { timeout: 1000 });
      if (response.status === 200) {
        return true;
      }
    } catch (error) {
      // Ignore request error and retry
    }
    // Sleep for 500ms
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return false;
}

async function triggerRunnerStart(baseUrl: string, projectId: string, projectType: string): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, "")}/start`;
  console.log(`[RunnerService] Triggering runner workspace init for projectId=${projectId}, projectType=${projectType} via ${baseUrl}`);

  try {
    const response = await axios.post(
      url,
      { projectId, projectType },
      { timeout: 30000 }
    );
    if (response.status !== 200) {
      console.warn(`[RunnerService] Warning: Runner start returned status ${response.status}: ${JSON.stringify(response.data)}`);
    }
  } catch (error: any) {
    console.error(`[RunnerService] Error triggering runner start: ${error.message || error}`);
  }
}

export async function startRunner(input: StartRunnerInput): Promise<StartRunnerResult> {
  const { workspaceId, projectId, projectType } = input;

  return await withLock(projectId, async () => {
    // Ensure host directory exists
    const hostWorkspaceDir = path.resolve(config.WORKSPACES_DIR, workspaceId, projectId);
    fs.mkdirSync(hostWorkspaceDir, { recursive: true });

    const envVars = getRunnerEnv();

    // Ensure resources in Kubernetes
    const publicBaseUrl = await k8sService.ensureRunnerResources(workspaceId, projectId, envVars);

    // Wait for runner health check
    const healthy = await waitForRunner(publicBaseUrl);
    if (!healthy) {
      throw new ApiError("Timeout: Runner service did not start in time.", 500);
    }

    // Initialize the runner
    await triggerRunnerStart(publicBaseUrl, projectId, projectType);

    return {
      status: "started",
      port: config.K8S_INGRESS_PORT,
      baseUrl: publicBaseUrl,
    };
  });
}
