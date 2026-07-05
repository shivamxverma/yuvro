import { Server as SocketServer } from "socket.io";
import http from "http";
import { initWs } from "../websocket/events";

export default async ({ httpServer }: { httpServer: http.Server }): Promise<void> => {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Bind Socket.IO terminal events
  initWs(io);
};
