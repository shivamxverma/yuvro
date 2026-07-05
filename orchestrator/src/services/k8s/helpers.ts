// Helper to create or patch resources
export async function createOrPatchResource(
  readFn: () => Promise<any>,
  createFn: () => Promise<any>,
  patchFn: () => Promise<any>
): Promise<void> {
  try {
    await readFn();
    await patchFn();
  } catch (error: any) {
    if (error.response?.statusCode === 404 || error.statusCode === 404) {
      await createFn();
    } else {
      throw error;
    }
  }
}
