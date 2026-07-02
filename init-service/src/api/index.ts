import { Router } from "express";
import authRouter from "./auth/auth-route";
import projectRouter from "./project/project-route";
import nodeRouter from "./node/node-route";
import adminRouter from "./admin/admin-route";

export default (): Router => {
  const app = Router();

  app.use("/auth", authRouter);
  app.use("/", projectRouter);
  app.use("/nodes", nodeRouter);
  app.use("/admin", adminRouter);

  return app;
};
