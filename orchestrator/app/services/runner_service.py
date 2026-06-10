import asyncio
import httpx

async def wait_for_runner(port: int) -> bool:
    """Wait for the runner FastAPI server to start responding on the mapped port."""
    url = f"http://localhost:{port}/docs"
    async with httpx.AsyncClient() as client:
        for _ in range(30): 
            try:
                resp = await client.get(url, timeout=1.0)
                if resp.status_code == 200:
                    return True
            except httpx.RequestError:
                pass
            await asyncio.sleep(0.5)
    return False

async def trigger_runner_start(port: int, repl_id: str) -> None:
    """Tell the containerized runner to download files from S3 to /workspace."""
    print(f"[RunnerService] Triggering S3 workspace download for replId={repl_id} on port {port}")
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"http://localhost:{port}/start",
                json={"replId": repl_id},
                timeout=30.0
            )
            if resp.status_code != 200:
                print(f"[RunnerService] Warning: Runner start returned status {resp.status_code}: {resp.text}")
        except Exception as e:
            print(f"[RunnerService] Error triggering runner start: {e}")
