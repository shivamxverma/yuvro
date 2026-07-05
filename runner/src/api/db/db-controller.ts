import { Request, Response } from "express";
import * as dbService from "./db-service";
import ApiResponse from "../../utils/ApiResponse";
import asyncHandler from "../../utils/asyncHandler";

export const listConnections = asyncHandler(async (req: Request, res: Response) => {
  const conns = dbService.getAllConnections();
  return res.status(200).json(
    new ApiResponse(200, "Database connections retrieved", { databases: conns })
  );
});

export const addConnection = asyncHandler(async (req: Request, res: Response) => {
  const connData = req.body;
  const saved = dbService.loadConnections();

  const connId = connData.id || crypto.randomUUID();
  connData.id = connId;

  if (!connData.name) {
    connData.name = `${(connData.type || "DB").toUpperCase()}: ${connData.database || "sqlite"}`;
  }

  const updated = saved.filter((c) => c.id !== connId);
  updated.push(connData);

  dbService.saveConnections(updated);

  return res.status(200).json(
    new ApiResponse(200, "Connection added successfully", { status: "success", connection: connData })
  );
});

export const deleteConnection = asyncHandler(async (req: Request, res: Response) => {
  const { conn_id } = req.params;
  const saved = dbService.loadConnections();
  
  const updated = saved.filter((c) => c.id !== conn_id);
  dbService.saveConnections(updated);

  return res.status(200).json(
    new ApiResponse(200, "Connection deleted successfully", { status: "success" })
  );
});

export const getTables = asyncHandler(async (req: Request, res: Response) => {
  const dbPath = req.query.db_path as string;

  const adapter = dbService.getAdapterForConnection(dbPath);
  const tables = await adapter.getTablesWithCounts();

  return res.status(200).json(
    new ApiResponse(200, "Tables retrieved successfully", { tables })
  );
});

export const getSchema = asyncHandler(async (req: Request, res: Response) => {
  const dbPath = req.query.db_path as string;
  const table = req.query.table as string;

  const adapter = dbService.getAdapterForConnection(dbPath);
  const schema = await adapter.getTableSchema(table);

  return res.status(200).json(
    new ApiResponse(200, "Schema retrieved successfully", { schema })
  );
});

export const getRows = asyncHandler(async (req: Request, res: Response) => {
  const dbPath = req.query.db_path as string;
  const table = req.query.table as string;
  const page = parseInt(req.query.page as string, 10) || 1;
  const pageSize = parseInt(req.query.page_size as string, 10) || 50;

  const adapter = dbService.getAdapterForConnection(dbPath);
  const { rows, columns, total } = await adapter.getTableRows(table, page, pageSize);

  return res.status(200).json(
    new ApiResponse(200, "Rows retrieved successfully", {
      rows,
      columns,
      total,
      page,
      page_size: pageSize,
    })
  );
});

export const runQuery = asyncHandler(async (req: Request, res: Response) => {
  const dbPath = req.body.db_path as string;
  const query = req.body.query as string;

  const adapter = dbService.getAdapterForConnection(dbPath);
  const { results, columns } = await adapter.runCustomQuery(query);

  return res.status(200).json(
    new ApiResponse(200, "Query executed successfully", { results, columns })
  );
});
