import { Request, Response } from "express";
import { BASE_DIR } from "../../config";
import * as workspaceService from "./workspace-service";
import { resolveCppEntry, handleProxy } from "./workspace-helper";
import ApiResponse from "../../utils/ApiResponse";
import asyncHandler from "../../utils/asyncHandler";

export const startWorkspace = asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.body.projectId || "";
  const projectType = (req.body.projectType || "").toLowerCase();

  // Execute venv setup in the background
  workspaceService.setupVirtualenvBg(BASE_DIR, projectType);

  return res.status(200).json(
    new ApiResponse(200, "Workspace initializing", {
      status: "started",
      message: `Workspace initializing for ${projectId}`,
    })
  );
});

export const runCpp = asyncHandler(async (req: Request, res: Response) => {
  const entryPath = req.body.entryPath;
  const resolvedEntry = resolveCppEntry(entryPath);

  const result = await workspaceService.runCpp(resolvedEntry);
  
  return res.status(200).json(
    new ApiResponse(200, "C++ program execution completed", result)
  );
});

export const getPort = asyncHandler(async (req: Request, res: Response) => {
  const repl_id = req.params.repl_id;
  const container_port = parseInt(req.query.container_port as string, 10) || 8000;

  return res.status(200).json(
    new ApiResponse(200, "Port resolved successfully", {
      repl_id,
      container_port,
      host_port: container_port,
    })
  );
});

export const proxy = asyncHandler(async (req: Request, res: Response) => {
  const replId = typeof req.params.repl_id === "string" ? req.params.repl_id : "";
  const containerPort = typeof req.params.container_port === "string" ? parseInt(req.params.container_port, 10) : 8000;
  const reqPath = typeof req.params.path === "string" ? req.params.path : "";

  await handleProxy(replId, containerPort, reqPath, req, res);
});

export const proxyLegacy = asyncHandler(async (req: Request, res: Response) => {
  const replId = typeof req.params.repl_id === "string" ? req.params.repl_id : "";
  const reqPath = typeof req.params.path === "string" ? req.params.path : "";

  await handleProxy(replId, 8000, reqPath, req, res);
});
