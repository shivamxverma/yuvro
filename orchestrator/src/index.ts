import express from "express";
import cors from "cors";
import router from "./api/routes";
import config from "./config";

const app = express();

app.use(express.json());
app.use(
  cors({
    origin: "*",
    credentials: true,
    methods: "*",
    allowedHeaders: "*",
  })
);

app.use(router);

const port = Number(config.PORT) || 3002;
app.listen(port, "0.0.0.0", () => {
  console.log(`🛡️ Orchestrator listening on port: ${port} 🛡️`);
});
