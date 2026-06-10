import os
from dotenv import load_dotenv

RUNNER_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))

env_path = os.path.join(RUNNER_ROOT, ".env")
if os.path.exists(env_path):
    load_dotenv(env_path)

BASE_DIR = os.getenv("BASE_DIR", os.path.join(RUNNER_ROOT, "workspace"))

S3_BUCKET = os.getenv("S3_BUCKET", "")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
S3_ENDPOINT = os.getenv("S3_ENDPOINT")

RUNNER_LOG_PATH = os.getenv("RUNNER_LOG_PATH", os.path.join(RUNNER_ROOT, "runner.log"))

def log_to_file(msg: str):
    try:
        with open(RUNNER_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(msg + "\n")
    except Exception:
        pass
