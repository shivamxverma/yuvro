import { useEffect, useState } from "react";
import { type Socket, io } from "socket.io-client";

export function useSocket(projectId: string, port: number | null): Socket | null {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!port) return;
    const s = io(`http://localhost:${port}`, { query: { replId: projectId } });
    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, [projectId, port]);

  return socket;
}
