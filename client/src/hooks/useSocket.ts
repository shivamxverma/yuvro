import { useEffect, useState } from "react";
import { type Socket, io } from "socket.io-client";

export function useSocket(replId: string, port: number | null): Socket | null {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!port) return;
    const s = io(`http://localhost:${port}`, { query: { replId } });
    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, [replId, port]);

  return socket;
}
