import { Response } from "express";
import * as workspaceService from "./workspace-service";
import asyncHandler from "../../utils/asyncHandler";
import ApiResponse from "../../utils/ApiResponse";

export const listWorkspaces = asyncHandler(async (req: any, res: Response) => {
  const result = await workspaceService.listWorkspaces(req.user.id);
  res.status(200).json(new ApiResponse(200, "Workspaces retrieved successfully.", result));
});

export const createTemplateProject = asyncHandler(async (req: any, res: Response) => {
  const { workspaceName, projectName, type } = req.body;
  const result = await workspaceService.createTemplateProject(req.user.id, workspaceName, projectName, type);
  res.status(201).json(new ApiResponse(201, "Template project created successfully.", result));
});

export const cloneProject = asyncHandler(async (req: any, res: Response) => {
  const { workspaceName, projectName, githubUrl } = req.body;
  const result = await workspaceService.cloneProject(req.user.id, workspaceName, projectName, githubUrl);
  res.status(201).json(new ApiResponse(201, "GitHub project cloned successfully.", result));
});

export const createProjectInWorkspace = asyncHandler(async (req: any, res: Response) => {
  const { workspace_id } = req.params;
  const { projectName, type } = req.body;
  const result = await workspaceService.createTemplateProjectInWorkspace(req.user.id, workspace_id, projectName, type);
  res.status(201).json(new ApiResponse(201, "Template project created in workspace.", result));
});

export const cloneProjectInWorkspace = asyncHandler(async (req: any, res: Response) => {
  const { workspace_id } = req.params;
  const { projectName, githubUrl } = req.body;
  const result = await workspaceService.cloneProjectInWorkspace(req.user.id, workspace_id, projectName, githubUrl);
  res.status(201).json(new ApiResponse(201, "GitHub project cloned in workspace.", result));
});

export const getProjectDetail = asyncHandler(async (req: any, res: Response) => {
  const { project_id } = req.params;
  const result = await workspaceService.getProjectDetail(req.user.id, project_id);
  res.status(200).json(new ApiResponse(200, "Project detail retrieved.", result));
});

export const getProjectNodes = asyncHandler(async (req: any, res: Response) => {
  const { project_id } = req.params;
  const result = await workspaceService.getProjectNodes(req.user.id, project_id);
  res.status(200).json(new ApiResponse(200, "Project nodes retrieved.", result));
});
