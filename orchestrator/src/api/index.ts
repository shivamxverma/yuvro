import { Router } from "express";
import runnerRouter from "./runner/runner-route";
import databaseRouter from "./database/database-route";

export default (): Router => {
  const app = Router();

  app.use("/", runnerRouter);
  app.use("/", databaseRouter);

  return app;
};
