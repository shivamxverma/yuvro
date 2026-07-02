import { Server, Socket } from "socket.io";
import { terminalManager } from "../services/terminal-service";
import { logToFile } from "../config";

export function initWs(io: Server): void {
  io.on("connection", (socket: Socket) => {
    const replId = (socket.handshake.query.replId as string) || "";
    socket.data.replId = replId;

    console.log(`[WS Connected] Session: ${socket.id}, Repl ID: ${replId}`);
    logToFile(`[WS Connected] Session: ${socket.id}, Repl ID: ${replId}`);

    socket.on("disconnect", () => {
      console.log(`[WS Disconnected] Session: ${socket.id}`);
      logToFile(`[WS Disconnected] Session: ${socket.id}`);
      terminalManager.detachClient(socket.id);
    });

    socket.on("requestTerminal", () => {
      logToFile(`[WS requestTerminal] Received for Sid: ${socket.id}`);
      const activeReplId = socket.data.replId;

      if (!activeReplId) {
        socket.emit("terminal", { data: "Project session is missing.\r\n" });
        return;
      }

      // Attach client callback to broadcast PTY output
      terminalManager.attachClient(activeReplId, socket.id, (decodedOutput: string) => {
        socket.emit("terminal", { data: decodedOutput });
      });

      socket.emit("terminalReady", { ready: true });
    });

    socket.on("terminalData", (data: any) => {
      logToFile(`[WS TerminalData Received] Session: ${socket.id}, Data: ${JSON.stringify(data)}`);
      const typedChar = typeof data === "object" && data !== null ? data.data || "" : data || "";
      logToFile(`[WS TerminalData Writing] Session: ${socket.id}, Char: ${JSON.stringify(typedChar)}`);
      terminalManager.write(socket.id, typedChar);
    });
  });
}
