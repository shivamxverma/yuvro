export interface StartRunnerInput {
  workspaceId: string;
  projectId: string;
  projectType: string;
}

export interface StartRunnerResult {
  status: string;
  port: number;
  baseUrl: string;
}
