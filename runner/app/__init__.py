import os
from dotenv import load_dotenv

env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.env"))
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    print(f"[Warning] Env file not found at {env_path}")
