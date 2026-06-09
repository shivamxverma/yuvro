import os
import pty
import asyncio
from typing import Dict, Callable
from app.fs import BASE_DIR

class TerminalManager:
    def __init__(self):
        self.sessions: Dict[str, Dict] = {}

    def create_pty(self, sid: str, on_data: Callable[[str], None]):
        if sid in self.sessions:
            return

        pid, master_fd = pty.fork()

        if pid == 0:
            os.environ["TERM"] = "xterm-256color"
            os.chdir(BASE_DIR)

            try:
                os.execv("/bin/bash", ["/bin/bash", "-l"])

            except Exception:
                os._exit(1)

            else:
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
                        if asyncio.iscoroutinefunction(on_data):
                            loop.create_task(on_data(decoded))
                        else:
                            on_data(decoded)
                    except OSError:
                        self.clear(sid)
                loop.add_reader(master_fd, read_callback)
    
    def write(self, sid: str, data: str):
        session = self.sessions.get(sid)
        if session:
            try:
                os.write(session["fd"], data.encode("utf-8"))
            except OSError:
                pass
    
    def clear(self, sid: str):
        session = self.sessions.pop(sid, None)
        if session:
            fd = session["fd"]
            pid = session["pid"]
            
            try:
                loop = asyncio.get_event_loop()
                loop.remove_reader(fd)
            except Exception:
                pass
            
            try:
                os.close(fd)
            except Exception:
                pass
                
            try:
                os.kill(pid, 9)
                os.waitpid(pid, 0)
            except Exception:
                pass
        