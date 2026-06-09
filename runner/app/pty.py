import os
import pty
import asyncio
from typing import Dict, Callable
from app.fs import BASE_DIR

def log_to_file(msg: str):
    try:
        with open("/Users/shivamverma/Desktop/personal-work/replit/yuvro-assignment/runner/runner.log", "a", encoding="utf-8") as f:
            f.write(msg + "\n")
    except Exception:
        pass

class TerminalManager:
    def __init__(self):
        self.sessions: Dict[str, Dict] = {}

    def create_pty(self, sid: str, on_data: Callable[[str], None]):
        log_to_file(f"[PTY Create Start] Sid: {sid}")
        if sid in self.sessions:
            log_to_file(f"[PTY Create Info] Session already exists for Sid: {sid}")
            return

        pid, master_fd = pty.fork()

        if pid == 0:
            os.environ["TERM"] = "xterm-256color"
            os.environ["BASH_SILENT"] = "1"
            venv_bin = os.path.join(BASE_DIR, ".venv", "bin")
            os.environ["PATH"] = f"{venv_bin}:{os.environ.get('PATH', '')}"
            os.chdir(BASE_DIR)

            try:
                os.execv("/bin/bash", ["/bin/bash"])
            except Exception as e:
                log_to_file(f"[PTY Child Error] execv failed: {e}")
                os._exit(1)

        log_to_file(f"[PTY Parent Process] Forked Pid: {pid}, Master FD: {master_fd}")
        # Parent process logic
        os.set_blocking(master_fd, False)
        self.sessions[sid] = {
            "pid": pid,
            "fd": master_fd
        }

        loop = asyncio.get_running_loop()

        def read_callback():
            try:
                data = os.read(master_fd, 4096)
                if data:
                    decoded = data.decode("utf-8", errors="ignore")
                    log_to_file(f"[PTY Read] Sid: {sid}, Decoded: {decoded!r}")
                    if asyncio.iscoroutinefunction(on_data):
                        loop.create_task(on_data(decoded))
                    else:
                        on_data(decoded)
            except OSError as e:
                log_to_file(f"[PTY Read Error] OSError: {e} for Sid: {sid}")
                self.clear(sid)
        loop.add_reader(master_fd, read_callback)
    
    def write(self, sid: str, data: str):
        session = self.sessions.get(sid)
        log_to_file(f"[PTY Write] Sessions keys: {list(self.sessions.keys())}, session found: {session is not None}, data: {data!r}")
        if session:
            try:
                written = os.write(session["fd"], data.encode("utf-8"))
                log_to_file(f"[PTY Write Success] Written {written} bytes: {data!r}")
            except OSError as e:
                log_to_file(f"[PTY Write Error] OSError: {e}")
                pass
    
    def clear(self, sid: str):
        log_to_file(f"[PTY Clear] Sid: {sid}")
        session = self.sessions.pop(sid, None)
        if session:
            fd = session["fd"]
            pid = session["pid"]
            
            try:
                loop = asyncio.get_event_loop()
                loop.remove_reader(fd)
                log_to_file(f"[PTY Clear] Removed reader for FD: {fd}")
            except Exception as e:
                log_to_file(f"[PTY Clear Error] failed to remove reader: {e}")
                pass
            
            try:
                os.close(fd)
            except Exception:
                pass
                
            try:
                os.kill(-pid, 9)
                os.waitpid(pid, 0)
            except Exception:
                try:
                    os.kill(pid, 9)
                    os.waitpid(pid, 0)
                except Exception:
                    pass
        