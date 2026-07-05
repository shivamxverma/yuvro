import * as pty from "node-pty";
import path from "path";
import fs from "fs";
import config, { logToFile } from "../config";

export class TerminalManager {
  private sessions = new Map<
    string,
    {
      pty: pty.IPty;
      clients: Map<string, (data: string) => void>;
    }
  >();
  private sidToRepl = new Map<string, string>();

  public attachClient(replId: string, sid: string, onData: (data: string) => void) {
    logToFile(`[PTY Attach] Repl: ${replId}, Sid: ${sid}`);
    let session = this.sessions.get(replId);
    if (!session) {
      this.createPty(replId);
      session = this.sessions.get(replId);
    }

    if (session) {
      session.clients.set(sid, onData);
      this.sidToRepl.set(sid, replId);
    }
  }

  private createPty(replId: string) {
    logToFile(`[PTY Create Start] Repl: ${replId}`);
    if (this.sessions.has(replId)) {
      logToFile(`[PTY Create Info] Session already exists for Repl: ${replId}`);
      return;
    }

    const shell = process.platform === "win32" ? "powershell.exe" : "bash";
    const venvBinPath = path.join(config.BASE_DIR, ".venv", "bin");
    
    // Set environment variables similar to python
    const env = {
      ...process.env,
      TERM: "xterm-256color",
      PATH: `${venvBinPath}:${process.env.PATH || ""}`,
    };

    const ptyProcess = pty.spawn(shell, [], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: config.BASE_DIR,
      env,
    });

    logToFile(`[PTY Parent Process] Forked Pid: ${ptyProcess.pid}`);

    this.sessions.set(replId, {
      pty: ptyProcess,
      clients: new Map(),
    });

    // Handle incoming PTY stdout data and broadcast to all attached clients
    ptyProcess.onData((data) => {
      logToFile(`[PTY Read] Repl: ${replId}, Decoded: ${JSON.stringify(data)}`);
      const activeSession = this.sessions.get(replId);
      if (!activeSession) return;

      for (const callback of activeSession.clients.values()) {
        try {
          callback(data);
        } catch (err) {
          logToFile(`[PTY Callback Error] Failed: ${err}`);
        }
      }
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      logToFile(`[PTY Exit] Repl: ${replId}, ExitCode: ${exitCode}, Signal: ${signal}`);
      this.clearRepl(replId);
    });
  }

  public write(sid: string, data: string) {
    const replId = this.sidToRepl.get(sid);
    const session = replId ? this.sessions.get(replId) : null;
    logToFile(`[PTY Write] Sid: ${sid}, Repl: ${replId}, session found: ${!!session}, data: ${JSON.stringify(data)}`);
    
    if (session) {
      try {
        session.pty.write(data);
      } catch (error) {
        logToFile(`[PTY Write Error] OSError: ${error}`);
      }
    }
  }

  public detachClient(sid: string) {
    const replId = this.sidToRepl.get(sid);
    logToFile(`[PTY Detach] Sid: ${sid}, Repl: ${replId}`);
    if (!replId) return;

    this.sidToRepl.delete(sid);
    const session = this.sessions.get(replId);
    if (session) {
      session.clients.delete(sid);
      if (session.clients.size === 0) {
        this.clearRepl(replId);
      }
    }
  }

  public clearRepl(replId: string) {
    logToFile(`[PTY Clear] Repl: ${replId}`);
    const session = this.sessions.get(replId);
    if (!session) return;

    this.sessions.delete(replId);

    // Remove mapping references
    for (const [sid, mappedReplId] of this.sidToRepl.entries()) {
      if (mappedReplId === replId) {
        this.sidToRepl.delete(sid);
      }
    }

    try {
      session.pty.kill();
    } catch (e) {
      // Ignore process termination errors
    }
  }

  public killAll() {
    logToFile(`[PTY Kill All] Cleaning up all active sessions`);
    const replIds = Array.from(this.sessions.keys());
    for (const replId of replIds) {
      this.clearRepl(replId);
    }
  }
}

export const terminalManager = new TerminalManager();
export default terminalManager;
