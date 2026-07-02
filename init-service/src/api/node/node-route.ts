import { Router } from "express";
import { validate, verifyJWT } from "../../shared/middleware";
import {
  createNodeSchema,
  updateContentSchema,
  renameNodeSchema,
  moveNodeSchema,
} from "./node-schema";
import * as nodeController from "./node-controller";

const router = Router();

// Apply authentication globally to node routes
router.use(verifyJWT);

router.post("/", validate("body", createNodeSchema), nodeController.createNode);
router.get("/:node_id/children", nodeController.getChildren);
router.get("/:node_id/content", nodeController.getContent);
router.put("/:node_id/content", validate("body", updateContentSchema), nodeController.updateContent);
router.patch("/:node_id", validate("body", renameNodeSchema), nodeController.renameNode);
router.patch("/:node_id/move", validate("body", moveNodeSchema), nodeController.moveNode);
router.delete("/:node_id", nodeController.deleteNode);

export default router;
