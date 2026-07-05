import { Router } from "express";
import { validate } from "../../shared/middleware";
import {
  addConnectionSchema,
  deleteConnectionSchema,
  tablesSchema,
  schemaSchema,
  rowsSchema,
  runQuerySchema,
} from "./db-schema";
import * as dbController from "./db-controller";

const router = Router();

router.get(["/list", "/connections"], dbController.listConnections);
router.post("/connections", validate("body", addConnectionSchema), dbController.addConnection);
router.delete("/connections/:conn_id", validate("params", deleteConnectionSchema), dbController.deleteConnection);
router.get("/tables", validate("query", tablesSchema), dbController.getTables);
router.get("/schema", validate("query", schemaSchema), dbController.getSchema);
router.get("/rows", validate("query", rowsSchema), dbController.getRows);
router.post("/query", validate("body", runQuerySchema), dbController.runQuery);

export default router;
