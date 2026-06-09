import os
import asyncio
from typing import List, Dict

BASE_DIR = os.getenv("BASE_DIR",
os.path.abspath(os.path.join(os.path.dirname(__file__), "../workspace")))

os.makedirs(BASE_DIR, exist_ok=True)

def _fetch_dir_sync(dir_path: str, base_dir: str) -> List[Dict]:
    items = []
    for entry in os.scandir(dir_path):
        items.append({
            "type": "dir" if entry.is_dir() else "file",
            "name": entry.name,
            "path": f"{base_dir}/{entry.name}" if base_dir else entry.name
        })
    return items

async def fetch_dir(dir_path: str, base_dir: str) -> List[Dict]:
    return await asyncio.to_thread(_fetch_dir_sync, dir_path, base_dir)

def _read_file_sync(file_path: str) -> str:
    with open(file_path, "r", encoding="utf-8") as f:
        return f.read()

async def fetch_file_content(file_path: str) -> str:
    return await asyncio.to_thread(_read_file_sync, file_path)

def _write_file_sync(file_path: str, content: str) -> None:
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

async def save_file(file_path: str, content: str) -> None:
    await asyncio.to_thread(_write_file_sync, file_path, content)