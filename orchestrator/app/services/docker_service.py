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

def create_network(network_name: str) -> None:
    """Create a docker bridge network if it does not already exist."""
    # Check if network exists
    res = subprocess.run(["docker", "network", "inspect", network_name], capture_output=True)
    if res.returncode != 0:
        subprocess.run(["docker", "network", "create", network_name], capture_output=True)

def remove_container(container_name: str) -> None:
    """Stop and remove the workspace container and cascadingly remove associated DB container and network."""
    if container_name.startswith("yuvro-repl-"):
        repl_id = container_name.replace("yuvro-repl-", "")
        db_container = f"yuvro-db-{repl_id}"
        network_name = f"yuvro-net-{repl_id}"
        
        # Stop and remove database container
        subprocess.run(["docker", "rm", "-f", db_container], capture_output=True)
        # Remove docker network
        subprocess.run(["docker", "network", "rm", network_name], capture_output=True)

    cmd = command.get_remove_container_cmd(container_name)
    subprocess.run(cmd, capture_output=True)

def start_container(container_name: str, host_workspace_dir: str, env_vars: dict, network: str = None) -> None:
    """Spawn the runner container mounting workspaces and exposing ports dynamically."""
    cmd = command.get_run_container_cmd(
        container_name,
        host_workspace_dir,
        RUNNER_INTERNAL_PORT,
        USER_INTERNAL_PORT,
        env_vars,
        DOCKER_IMAGE,
        network
    )
    
    try:
        subprocess.run(cmd, check=True, capture_output=True)
    except subprocess.CalledProcessError as e:
        stderr_msg = e.stderr.decode('utf-8') if e.stderr else "Unknown error"
        print(f"[DockerService] Failed to start Docker container: {stderr_msg}")
        raise RuntimeError(f"Failed to start project container: {stderr_msg}")

def start_db_container(db_container_name: str, network_name: str, engine: str, host_workspace_dir: str) -> None:
    """Spawn a containerized database (postgres/mysql) on the specified network."""
    # Stop/Remove any existing container with this name first
    subprocess.run(["docker", "rm", "-f", db_container_name], capture_output=True)
    
    import os
    db_data_dir = os.path.abspath(os.path.join(host_workspace_dir, ".db_data"))
    os.makedirs(db_data_dir, exist_ok=True)

    if engine == "postgres":
        cmd = [
            "docker", "run", "-d",
            "--name", db_container_name,
            "--network", network_name,
            "-v", f"{db_data_dir}:/var/lib/postgresql/data",
            "-e", "POSTGRES_DB=yuvro_db",
            "-e", "POSTGRES_USER=postgres",
            "-e", "POSTGRES_PASSWORD=secret",
            "postgres:15-slim"
        ]
    elif engine == "mysql":
        cmd = [
            "docker", "run", "-d",
            "--name", db_container_name,
            "--network", network_name,
            "-v", f"{db_data_dir}:/var/lib/mysql",
            "-e", "MYSQL_DATABASE=yuvro_db",
            "-e", "MYSQL_ROOT_PASSWORD=secret",
            "mysql:8.0"
        ]
    else:
        raise ValueError(f"Unsupported database engine for orchestration: {engine}")

    try:
        subprocess.run(cmd, check=True, capture_output=True)
    except subprocess.CalledProcessError as e:
        stderr_msg = e.stderr.decode('utf-8') if e.stderr else "Unknown error"
        print(f"[DockerService] Failed to start Database container: {stderr_msg}")
        raise RuntimeError(f"Failed to start database container: {stderr_msg}")

