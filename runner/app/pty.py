import os
import pty
import asyncio
import shutil
import subprocess
import json
from typing import Dict, Callable, Optional
from app.fs import BASE_DIR

# Maps replId -> container_name for proxy lookups
container_registry: Dict[str, str] = {}

def log_to_file(msg: str):
    try:
        with open("/Users/shivamverma/Desktop/personal-work/replit/yuvro-assignment/runner/runner.log", "a", encoding="utf-8") as f:
            f.write(msg + "\n")
    except Exception:
        pass

def get_container_host_port(container_name: str, container_port: int = 8000) -> Optional[int]:
    """Ask Docker what host port maps to container_port for the given container."""
    try:
        result = subprocess.run(
            ["docker", "inspect", "--format",
             f'{{{{(index (index .NetworkSettings.Ports "{container_port}/tcp") 0).HostPort}}}}',
             container_name],
            capture_output=True, text=True, timeout=5
        )
        port_str = result.stdout.strip()
        if port_str and port_str.isdigit():
            return int(port_str)
    except Exception as e:
        log_to_file(f"[get_container_host_port] Error: {e}")
    return None


class TerminalManager:
    def __init__(self):
        self.sessions: Dict[str, Dict] = {}

    def create_pty(self, sid: str, on_data: Callable[[str], None], repl_id: str = ""):
        log_to_file(f"[PTY Create Start] Sid: {sid}")
        if sid in self.sessions:
            log_to_file(f"[PTY Create Info] Session already exists for Sid: {sid}")
            return

        pid, master_fd = pty.fork()

        if pid == 0:
            os.environ["TERM"] = "xterm-256color"
            os.chdir(BASE_DIR)
            
            is_container = os.getenv("IS_CONTAINER") == "true"
            if is_container:
                # Inside the container, run bash directly
                os.environ["PATH"] = f"{BASE_DIR}/.venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
                bash_path = shutil.which("bash") or "/bin/bash"
                bash_args = ["bash"]
                try:
                    os.execv(bash_path, bash_args)
                except Exception as e:
                    log_to_file(f"[PTY Child Error] execv failed for bash inside container: {e}")
                    os._exit(1)
            else:
                # Sanitize container name
                container_name = "".join(c for c in f"yuvro-repl-{sid}" if c.isalnum() or c in "_.-")
                # Store mapping so proxy can find it
                if repl_id:
                    container_registry[repl_id] = container_name
                docker_path = shutil.which("docker") or "/usr/local/bin/docker"
                
                docker_args = [
                    "docker", "run", "-it", "--rm",
                    "--name", container_name,
                    "-v", f"{BASE_DIR}:/workspace",
                    "-w", "/workspace",
                    "-e", "PATH=/workspace/.venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
                    "-p", "0:8000",
                    "-p", "0:8001",
                    "-p", "0:8002",
                    "-p", "0:8003",
                    "-p", "0:8004",
                    "-p", "0:8005",
                    "yuvro-runner:latest",
                    "/bin/bash"
                ]

                try:
                    os.execv(docker_path, docker_args)
                except Exception as e:
                    log_to_file(f"[PTY Child Error] execv failed: {e}")
                    os._exit(1)

        log_to_file(f"[PTY Parent Process] Forked Pid: {pid}, Master FD: {master_fd}")
        # Parent process logic
        os.set_blocking(master_fd, False)
        container_name = "".join(c for c in f"yuvro-repl-{sid}" if c.isalnum() or c in "_.-")
        if repl_id:
            container_registry[repl_id] = container_name
            log_to_file(f"[Container Registry] Registered replId={repl_id} -> {container_name}")

        self.sessions[sid] = {
            "pid": pid,
            "fd": master_fd,
            "repl_id": repl_id,
            "container_name": container_name,
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
            
            if os.getenv("IS_CONTAINER") != "true":
                try:
                    container_name = "".join(c for c in f"yuvro-repl-{sid}" if c.isalnum() or c in "_.-")
                    subprocess.run(["docker", "rm", "-f", container_name], capture_output=True)
                    log_to_file(f"[PTY Clear] Forced docker rm -f for: {container_name}")
                except Exception as e:
                    log_to_file(f"[PTY Clear Error] docker rm failed: {e}")
                    pass
        