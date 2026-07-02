import { Router, Request, Response } from "express";
import * as dbService from "../services/db-service";

const router = Router();

router.get(["/list", "/connections"], async (req: Request, res: Response) => {
  try {
    const conns = dbService.getAllConnections();
    res.json({ databases: conns });
  } catch (error: any) {
    res.status(500).send(error.message || String(error));
  }
});

router.post("/connections", async (req: Request, res: Response) => {
  try {
    const connData = req.body;
    const saved = dbService.loadConnections();
    
    // Generate unique ID if missing
    const connId = connData.id || crypto.randomUUID();
    connData.id = connId;

    if (!connData.name) {
      connData.name = `${(connData.type || "DB").toUpperCase()}: ${connData.database || "sqlite"}`;
    }

    // Replace if existing ID matches
    const updated = saved.filter((c) => c.id !== connId);
    updated.push(connData);

    dbService.saveConnections(updated);
    res.json({ status: "success", connection: connData });
  } catch (error: any) {
    res.status(500).send(error.message || String(error));
  }
});

router.delete("/connections/:conn_id", async (req: Request, res: Response) => {
  try {
    const { conn_id } = req.params;
    const saved = dbService.loadConnections();
    const updated = saved.filter((c) => c.id !== conn_id);
    dbService.saveConnections(updated);
    res.json({ status: "success" });
  } catch (error: any) {
    res.status(500).send(error.message || String(error));
  }
});

router.get("/tables", async (req: Request, res: Response) => {
  try {
    const dbPath = req.query.db_path as string;
    if (!dbPath) return res.status(400).send("db_path is required");

    const adapter = dbService.getAdapterForConnection(dbPath);
    const tables = await adapter.getTablesWithCounts();
    res.json({ tables });
  } catch (error: any) {
    res.status(500).send(error.message || String(error));
  }
});

router.get("/schema", async (req: Request, res: Response) => {
  try {
    const dbPath = req.query.db_path as string;
    const table = req.query.table as string;

    if (!dbPath || !table) {
      return res.status(400).send("db_path and table are required");
    }

    const adapter = dbService.getAdapterForConnection(dbPath);
    const schema = await adapter.getTableSchema(table);
    res.json({ schema });
  } catch (error: any) {
    res.status(500).send(error.message || String(error));
  }
});

router.get("/rows", async (req: Request, res: Response) => {
  try {
    const dbPath = req.query.db_path as string;
    const table = req.query.table as string;
    const page = parseInt(req.query.page as string, 10) || 1;
    const pageSize = parseInt(req.query.page_size as string, 10) || 50;

    if (!dbPath || !table) {
      return res.status(400).send("db_path and table are required");
    }

    const adapter = dbService.getAdapterForConnection(dbPath);
    const { rows, columns, total } = await adapter.getTableRows(table, page, pageSize);
    
    res.json({
      rows,
      columns,
      total,
      page,
      page_size: pageSize,
    });
  } catch (error: any) {
    res.status(500).send(error.message || String(error));
  }
});

router.post("/query", async (req: Request, res: Response) => {
  try {
    const dbPath = req.body.db_path as string;
    const query = req.body.query as string;

    if (!dbPath || !query) {
      return res.status(400).send("db_path and query are required");
    }

    const adapter = dbService.getAdapterForConnection(dbPath);
    const { results, columns } = await adapter.runCustomQuery(query);
    res.json({ results, columns });
  } catch (error: any) {
    res.status(400).send(error.message || String(error));
  }
});

export default router;
