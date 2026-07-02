import { Response } from "express";
import * as nodeService from "../../services/node_service";
import asyncHandler from "../../utils/asyncHandler";
import ApiResponse from "../../utils/ApiResponse";

export const getChildren = asyncHandler(async (req: any, res: Response) => {
  const { node_id } = req.params;
  const result = await nodeService.getChildren(req.user.id, node_id);
  res.status(200).json(new ApiResponse(200, "Node children retrieved.", result));
});

export const getContent = asyncHandler(async (req: any, res: Response) => {
  const { node_id } = req.params;
  const result = await nodeService.readContent(req.user.id, node_id);
  res.status(200).json(new ApiResponse(200, "Node content retrieved.", result));
});

export const createNode = asyncHandler(async (req: any, res: Response) => {
  const { parent_id, name, type } = req.body;
  const result = await nodeService.createNode(req.user.id, parent_id, name, type);
  res.status(201).json(new ApiResponse(201, "Node created successfully.", result));
});

export const updateContent = asyncHandler(async (req: any, res: Response) => {
  const { node_id } = req.params;
  const { content } = req.body;
  const result = await nodeService.updateContent(req.user.id, node_id, content);
  res.status(200).json(new ApiResponse(200, "Node content updated.", result));
});

export const renameNode = asyncHandler(async (req: any, res: Response) => {
  const { node_id } = req.params;
  const { name } = req.body;
  const result = await nodeService.renameNode(req.user.id, node_id, name);
  res.status(200).json(new ApiResponse(200, "Node renamed successfully.", result));
});

export const moveNode = asyncHandler(async (req: any, res: Response) => {
  const { node_id } = req.params;
  const { parent_id } = req.body;
  const result = await nodeService.moveNode(req.user.id, node_id, parent_id);
  res.status(200).json(new ApiResponse(200, "Node moved successfully.", result));
});

export const deleteNode = asyncHandler(async (req: any, res: Response) => {
  const { node_id } = req.params;
  const result = await nodeService.deleteNode(req.user.id, node_id);
  res.status(200).json(new ApiResponse(200, "Node deleted successfully.", result));
});
