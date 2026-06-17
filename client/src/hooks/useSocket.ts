import { useEffect, useState } from "react";
import { type Socket, io } from "socket.io-client";

export function useSocket(projectId: string, runnerBaseUrl: string | null): Socket | null {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!runnerBaseUrl) return;
    const s = io(runnerBaseUrl, { query: { replId: projectId } });
    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, [projectId, runnerBaseUrl]);

  return socket;
}
