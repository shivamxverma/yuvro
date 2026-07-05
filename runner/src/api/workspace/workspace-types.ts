export interface StartWorkspaceBody {
  projectId?: string;
  projectType?: string;
}

export interface RunCppBody {
  entryPath: string;
}

export interface PortParams {
  repl_id: string;
}

export interface PortQuery {
  container_port?: string;
}

export interface RunCppResult {
  status: "ok" | "timeout" | "runtime_error" | "compile_error";
  exitCode: number | null;
  output: string;
}
