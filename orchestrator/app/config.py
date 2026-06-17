import os
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
WORKSPACES_DIR = os.path.abspath(
    os.getenv("WORKSPACES_DIR", os.path.join(BASE_DIR, "workspaces"))
)
RUNNER_ENV_PATH = os.path.abspath(
    os.getenv("RUNNER_ENV_PATH", os.path.join(BASE_DIR, "runner/.env"))
)

RUNNER_IMAGE = os.getenv("K8S_RUNNER_IMAGE", "yuvro-runner:latest")
RUNNER_IMAGE_PULL_POLICY = os.getenv("K8S_RUNNER_IMAGE_PULL_POLICY", "IfNotPresent")
RUNNER_INTERNAL_PORT = 3002
USER_INTERNAL_PORT = 8000
K8S_NAMESPACE = os.getenv("K8S_NAMESPACE", "yuvro")
K8S_CONTEXT = os.getenv("K8S_CONTEXT")
K8S_BASE_DOMAIN = os.getenv("K8S_BASE_DOMAIN", "127.0.0.1.nip.io")
K8S_INGRESS_SCHEME = os.getenv("K8S_INGRESS_SCHEME", "http")
K8S_INGRESS_PORT = int(os.getenv("K8S_INGRESS_PORT", "8080"))
K8S_WORKSPACE_ROOT = os.getenv("K8S_WORKSPACE_ROOT", "/workspaces-host")
POSTGRES_IMAGE = os.getenv("K8S_POSTGRES_IMAGE", "postgres:15-slim")
MYSQL_IMAGE = os.getenv("K8S_MYSQL_IMAGE", "mysql:8.0")

def get_runner_env() -> dict:
    """Read AWS and S3 env variables from runner/.env and process environment to propagate to container."""
    env_vars = {}
    
    if os.path.exists(RUNNER_ENV_PATH):
        try:
            with open(RUNNER_ENV_PATH, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if "=" in line and not line.startswith("#"):
                        key, val = line.split("=", 1)
                        env_vars[key.strip()] = val.strip()
        except Exception as e:
            print(f"[Config] Warning: Failed to read runner/.env: {e}")
            
    for key in ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "S3_BUCKET", "AWS_REGION", "S3_ENDPOINT"]:
        val = os.getenv(key)
        if val:
            env_vars[key] = val
            
    return env_vars
