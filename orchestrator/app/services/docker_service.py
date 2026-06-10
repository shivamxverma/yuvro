import subprocess
from app.config import DOCKER_IMAGE, RUNNER_INTERNAL_PORT, USER_INTERNAL_PORT
from app.services import command

def is_container_running(container_name: str) -> bool:
    """Check if the docker container is running."""
    try:
        cmd = command.get_inspect_running_cmd(container_name)
        res = subprocess.run(
            cmd,
            capture_output=True, text=True, timeout=5
        )
        return res.stdout.strip() == "true"
    except Exception:
        return False

def get_mapped_port(container_name: str, container_port: int) -> int:
    """Get the mapped host port for container_port."""
    try:
        cmd = command.get_inspect_port_cmd(container_name, container_port)
        res = subprocess.run(
            cmd,
            capture_output=True, text=True, timeout=5
        )
        port_str = res.stdout.strip()
        if port_str and port_str.isdigit():
            return int(port_str)
    except Exception as e:
        print(f"[DockerService] Failed to inspect port mapping: {e}")
    raise RuntimeError(f"Could not retrieve host port mapping for {container_name}")

def remove_container(container_name: str) -> None:
    """Stop and remove any docker container with container_name."""
    cmd = command.get_remove_container_cmd(container_name)
    subprocess.run(cmd, capture_output=True)

def start_container(container_name: str, host_workspace_dir: str, env_vars: dict) -> None:
    """Spawn the runner container mounting workspaces and exposing ports dynamically."""
    cmd = command.get_run_container_cmd(
        container_name,
        host_workspace_dir,
        RUNNER_INTERNAL_PORT,
        USER_INTERNAL_PORT,
        env_vars,
        DOCKER_IMAGE
    )
    
    try:
        subprocess.run(cmd, check=True, capture_output=True)
    except subprocess.CalledProcessError as e:
        stderr_msg = e.stderr.decode('utf-8') if e.stderr else "Unknown error"
        print(f"[DockerService] Failed to start Docker container: {stderr_msg}")
        raise RuntimeError(f"Failed to start project container: {stderr_msg}")

