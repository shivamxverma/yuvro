from typing import List

def get_inspect_running_cmd(container_name: str) -> List[str]:
    """Build command to check if a container is running."""
    return ["docker", "inspect", "-f", "{{.State.Running}}", container_name]

def get_inspect_port_cmd(container_name: str, container_port: int) -> List[str]:
    """Build command to inspect mapped port details."""
    return [
        "docker", "inspect", "-f",
        f'{{{{(index (index .NetworkSettings.Ports "{container_port}/tcp") 0).HostPort}}}}',
        container_name
    ]

def get_remove_container_cmd(container_name: str) -> List[str]:
    """Build command to stop and force remove a container."""
    return ["docker", "rm", "-f", container_name]

def get_run_container_cmd(
    container_name: str,
    host_workspace_dir: str,
    runner_port: int,
    user_port: int,
    env_vars: dict,
    image_name: str,
    network: str = None
) -> List[str]:
    """Build command to run a container with dynamic port bindings and environment injection."""
    cmd = [
        "docker", "run", "-d",
        "--name", container_name,
        "-v", f"{host_workspace_dir}:/workspace",
        "-p", f"0:{runner_port}",
        "-p", f"0:{user_port}",
    ]
    if network:
        cmd.extend(["--network", network])
    for key, val in env_vars.items():
        cmd.extend(["-e", f"{key}={val}"])
    cmd.append(image_name)
    return cmd
