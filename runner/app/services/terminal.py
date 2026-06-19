import os
import pty
import asyncio
import shutil
from typing import Awaitable, Callable
from app.core.config import BASE_DIR, log_to_file

class TerminalManager:
    def __init__(self):
        self.sessions: dict[str, dict] = {}
        self.sid_to_repl: dict[str, str] = {}

    def attach_client(self, repl_id: str, sid: str, on_data: Callable[[str], Awaitable[None] | None]):
        log_to_file(f"[PTY Attach] Repl: {repl_id}, Sid: {sid}")
        session = self.sessions.get(repl_id)
        if session is None:
            self.create_pty(repl_id)
            session = self.sessions[repl_id]

        session["clients"][sid] = on_data
        self.sid_to_repl[sid] = repl_id

    def create_pty(self, repl_id: str):
        log_to_file(f"[PTY Create Start] Repl: {repl_id}")
        if repl_id in self.sessions:
            log_to_file(f"[PTY Create Info] Session already exists for Repl: {repl_id}")
            return

        pid, master_fd = pty.fork()

        if pid == 0:
            os.environ["TERM"] = "xterm-256color"
            os.chdir(BASE_DIR)
            os.environ["PATH"] = f"{BASE_DIR}/.venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
            bash_path = shutil.which("bash") or "/bin/bash"
            bash_args = ["bash"]
            try:
                os.execv(bash_path, bash_args)
            except Exception as e:
                log_to_file(f"[PTY Child Error] execv failed for bash inside container: {e}")
                os._exit(1)

        log_to_file(f"[PTY Parent Process] Forked Pid: {pid}, Master FD: {master_fd}")
        os.set_blocking(master_fd, False)

        self.sessions[repl_id] = {
            "pid": pid,
            "fd": master_fd,
            "clients": {},
        }

        loop = asyncio.get_running_loop()

        def read_callback():
            try:
                data = os.read(master_fd, 4096)
                if data:
                    decoded = data.decode("utf-8", errors="ignore")
                    log_to_file(f"[PTY Read] Repl: {repl_id}, Decoded: {decoded!r}")
                    session = self.sessions.get(repl_id)
                    if session is None:
                        return
                    for callback in list(session["clients"].values()):
                        if asyncio.iscoroutinefunction(callback):
                            loop.create_task(callback(decoded))
                        else:
                            callback(decoded)
            except OSError as e:
                log_to_file(f"[PTY Read Error] OSError: {e} for Repl: {repl_id}")
                self.clear_repl(repl_id)
        loop.add_reader(master_fd, read_callback)
    
    def write(self, sid: str, data: str):
        repl_id = self.sid_to_repl.get(sid)
        session = self.sessions.get(repl_id) if repl_id else None
        log_to_file(
            f"[PTY Write] Sid: {sid}, Repl: {repl_id}, session found: {session is not None}, data: {data!r}"
        )
        if session:
            try:
                written = os.write(session["fd"], data.encode("utf-8"))
                log_to_file(f"[PTY Write Success] Written {written} bytes: {data!r}")
            except OSError as e:
                log_to_file(f"[PTY Write Error] OSError: {e}")
                pass

    def detach_client(self, sid: str):
        repl_id = self.sid_to_repl.pop(sid, None)
        log_to_file(f"[PTY Detach] Sid: {sid}, Repl: {repl_id}")
        if not repl_id:
            return
        session = self.sessions.get(repl_id)
        if session:
            session["clients"].pop(sid, None)

    def clear_repl(self, repl_id: str):
        log_to_file(f"[PTY Clear] Repl: {repl_id}")
        session = self.sessions.pop(repl_id, None)
        if not session:
            return

        for sid, mapped_repl_id in list(self.sid_to_repl.items()):
            if mapped_repl_id == repl_id:
                self.sid_to_repl.pop(sid, None)

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
