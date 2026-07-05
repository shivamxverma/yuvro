import * as k8sService from "../../services/k8s-service";
import { StartDatabaseInput, StartDatabaseResult } from "./database-types";

export async function startDatabase(input: StartDatabaseInput): Promise<StartDatabaseResult> {
  const { projectId, engine } = input;
  
  console.log(`[Orchestrator] Provisioning Kubernetes DB ${engine} for projectId=${projectId}...`);
  
  // Provision DB
  const connection = await k8sService.ensureDatabaseResources(projectId, engine);
  
  // Wait for DB to report ready
  await k8sService.waitForDatabaseResources(projectId, engine);

  return connection;
}
