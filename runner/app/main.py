import os
import asyncio
import subprocess
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import socketio
import uvicorn
from app.ws import init_ws
from app.fs import BASE_DIR
from app.aws import download_from_s3

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class StartPayload(BaseModel):
    replId: str

def setup_virtualenv(base_dir: str):
    venv_dir = os.path.join(base_dir, ".venv")
    requirements_file = os.path.join(base_dir, "requirements.txt")
    try:
        if not os.path.exists(venv_dir):
            print(f"Creating virtual environment in {venv_dir}...")
            subprocess.run([sys.executable, "-m", "venv", venv_dir], check=True)
            print("Virtual environment created.")
            
        if os.path.exists(requirements_file):
            print(f"Installing dependencies from {requirements_file}...")
            pip_path = os.path.join(venv_dir, "bin", "pip")
            subprocess.run([pip_path, "install", "-r", requirements_file], check=True)
            print("Dependencies installed successfully.")
    except Exception as e:
        print(f"[setup_virtualenv Error] Failed: {e}")

@app.post("/start")
async def start_pod(payload: StartPayload):
    repl_id = payload.replId
    try:
        await download_from_s3(f"yuvro/code/{repl_id}", BASE_DIR)
        await asyncio.to_thread(setup_virtualenv, BASE_DIR)
        return {"status": "started", "message": f"Workspace initialized for {repl_id}"}
    except Exception as e:
        print(f"[Start Error] S3 download or virtualenv setup failed: {e}. Keeping current local files.")
        return {"status": "started", "message": f"Started with existing files (S3 error: {e})"}

sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')

init_ws(sio) 

socket_app = socketio.ASGIApp(sio, other_asgi_app=app)


if __name__ == "__main__":
    port = int(os.getenv("PORT", 3002))
    
    uvicorn.run("app.main:socket_app", host="0.0.0.0", port=port, reload=True)

