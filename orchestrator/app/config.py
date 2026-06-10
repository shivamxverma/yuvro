import os
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
WORKSPACES_DIR = os.path.abspath(os.path.join(BASE_DIR, "workspaces"))
RUNNER_ENV_PATH = os.path.abspath(os.path.join(BASE_DIR, "runner/.env"))

DOCKER_IMAGE = "yuvro-runner:latest"
RUNNER_INTERNAL_PORT = 3002
USER_INTERNAL_PORT = 8000

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
