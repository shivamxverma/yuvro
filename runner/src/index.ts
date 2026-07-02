import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { initWs } from "./websocket/events";
import workspaceRouter, { handleProxy } from "./routes/workspace-route";
import dbRouter from "./routes/db-route";

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

// Register HTTP API routers
app.use(workspaceRouter);
app.use("/api/db", dbRouter);

// Wildcard 404 Handler for referer-based proxy forwarding
app.use(async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  const referer = req.headers.referer;
  if (referer) {
    try {
      const parsedUrl = new URL(referer);
      const pathname = parsedUrl.pathname;

      // Match /proxy/:replId/:port/...
      const match = pathname.match(/^\/proxy\/([^/]+)\/(\d+)/);
      if (match) {
        const replId = match[1];
        const containerPort = parseInt(match[2], 10);
        const reqPath = req.path.replace(/^\//, "");
        return await handleProxy(replId, containerPort, reqPath, req, res);
      }

      // Match legacy /proxy/:replId/...
      const matchLegacy = pathname.match(/^\/proxy\/([^/]+)/);
      if (matchLegacy) {
        const replId = matchLegacy[1];
        const containerPort = 8000;
        const reqPath = req.path.replace(/^\//, "");
        return await handleProxy(replId, containerPort, reqPath, req, res);
      }
    } catch (e) {
      // Ignore URL parsing errors
    }
  }

  res.status(404).json({ detail: "Not Found" });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Bind Socket.IO terminal events
initWs(io);

const port = Number(process.env.PORT) || 3002;
server.listen(port, "0.0.0.0", () => {
  console.log(`🛡️ Runner agent listening on port: ${port} 🛡️`);
});
