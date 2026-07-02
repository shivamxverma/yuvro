import axios from "axios";

export async function waitForRunner(baseUrl: string): Promise<boolean> {
  const url = `${baseUrl.replace(/\/$/, "")}/docs`;

  for (let i = 0; i < 30; i++) {
    try {
      const response = await axios.get(url, { timeout: 1000 });
      if (response.status === 200) {
        return true;
      }
    } catch (error) {
      // Ignore request error and retry
    }
    // Sleep for 500ms
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return false;
}

export async function triggerRunnerStart(baseUrl: string, projectId: string, projectType: string): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, "")}/start`;
  console.log(`[RunnerService] Triggering runner workspace init for projectId=${projectId}, projectType=${projectType} via ${baseUrl}`);

  try {
    const response = await axios.post(
      url,
      { projectId, projectType },
      { timeout: 30000 }
    );
    if (response.status !== 200) {
      console.warn(`[RunnerService] Warning: Runner start returned status ${response.status}: ${JSON.stringify(response.data)}`);
    }
  } catch (error: any) {
    console.error(`[RunnerService] Error triggering runner start: ${error.message || error}`);
  }
}
