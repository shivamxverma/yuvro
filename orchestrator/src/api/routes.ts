import { Router, Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import config, { getRunnerEnv } from "../config";
import * as k8sService from "../services/k8s-service";
import * as runnerService from "../services/runner-service";

const router = Router();

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

router.post("/start", async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const workspaceId = (req.body.workspaceId || "").trim();
    const projectId = (req.body.projectId || "").trim();
    const projectType = (req.body.projectType || "").trim().toLowerCase();

    if (!workspaceId || !projectId) {
      return res.status(400).json({ detail: "workspaceId and projectId are required" });
    }
    if (!projectType) {
      return res.status(400).json({ detail: "projectType is required" });
    }

    const result = await withLock(projectId, async () => {
      // Ensure host directory exists
      const hostWorkspaceDir = path.resolve(config.WORKSPACES_DIR, workspaceId, projectId);
      fs.mkdirSync(hostWorkspaceDir, { recursive: true });

      const envVars = getRunnerEnv();

      // Ensure resources in Kubernetes
      const publicBaseUrl = await k8sService.ensureRunnerResources(workspaceId, projectId, envVars);

      // Wait for runner health check
      const healthy = await runnerService.waitForRunner(publicBaseUrl);
      if (!healthy) {
        throw new Error("Timeout: Runner service did not start in time.");
      }

      // Initialize the runner
      await runnerService.triggerRunnerStart(publicBaseUrl, projectId, projectType);

      return {
        status: "started",
        port: config.K8S_INGRESS_PORT,
        baseUrl: publicBaseUrl,
      };
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ detail: error.message || String(error) });
  }
});

router.post("/db/start", async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const projectId = (req.body.projectId || "").trim();
    const workspaceId = (req.body.workspaceId || "").trim();
    const engine = (req.body.engine || "").trim().toLowerCase();

    if (!workspaceId || !projectId) {
      return res.status(400).json({ detail: "workspaceId and projectId are required" });
    }
    if (engine !== "postgres" && engine !== "mysql") {
      return res.status(400).json({ detail: "engine must be 'postgres' or 'mysql'" });
    }

    console.log(`[Orchestrator] Provisioning Kubernetes DB ${engine} for projectId=${projectId}...`);
    
    // Provision DB
    const connection = await k8sService.ensureDatabaseResources(projectId, engine);
    
    // Wait for DB to report ready
    await k8sService.waitForDatabaseResources(projectId, engine);

    res.json(connection);
  } catch (error: any) {
    res.status(500).json({ detail: error.message || String(error) });
  }
});

export default router;
