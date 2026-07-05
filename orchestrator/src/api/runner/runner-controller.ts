import { Request, Response } from "express";
import * as runnerService from "./runner-service";
import asyncHandler from "../../utils/asyncHandler";
import ApiResponse from "../../utils/ApiResponse";

export const startRunner = asyncHandler(async (req: Request, res: Response) => {
  const { workspaceId, projectId, projectType } = req.body;
  const result = await runnerService.startRunner({ workspaceId, projectId, projectType });
  res.status(200).json(new ApiResponse(200, "Runner started successfully.", result));
});
