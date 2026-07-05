export interface StartDatabaseInput {
  workspaceId: string;
  projectId: string;
  engine: "postgres" | "mysql";
}

export interface StartDatabaseResult {
  status: string;
  engine: "postgres" | "mysql" | string;
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
}
