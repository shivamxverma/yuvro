import asyncio
import httpx

async def wait_for_runner(base_url: str) -> bool:
    """Wait for the runner FastAPI server to start responding."""
    url = f"{base_url.rstrip('/')}/docs"
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

async def trigger_runner_start(base_url: str, project_id: str) -> None:
    """Tell the runner to initialize the mounted project workspace."""
    print(f"[RunnerService] Triggering runner workspace init for projectId={project_id} via {base_url}")
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"{base_url.rstrip('/')}/start",
                json={"projectId": project_id},
                timeout=30.0
            )
            if resp.status_code != 200:
                print(f"[RunnerService] Warning: Runner start returned status {resp.status_code}: {resp.text}")
        except Exception as e:
            print(f"[RunnerService] Error triggering runner start: {e}")
