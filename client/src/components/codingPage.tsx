import { useEffect, useState, useRef } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { type File, type RemoteFile, Type } from "./external/editor/utils/file-manager";
import { Editor } from "./editor";
import { useSocket } from "../hooks/useSocket";
import { useResize } from "../hooks/useResize";
import { Sidebar } from "./ide/Sidebar";
import { TopNavbar } from "./ide/TopNavbar";
import { BottomPanel } from "./ide/BottomPanel";
import { StatusBar } from "./ide/StatusBar";
import { BootingScreen, WorkspaceLoadingScreen } from "./ide/LoadingScreens";
import { ORCHESTRATOR_URL } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

export const CodingPage = () => {
  const { user } = useAuth();
  const [podCreated, setPodCreated] = useState(false);
  const [runnerPort, setRunnerPort] = useState<number | null>(null);
  const [searchParams] = useSearchParams();
  const replId = searchParams.get("replId") ?? "";

  useEffect(() => {
    if (!user) return;
    if (!replId) return;
    axios
      .post(`${ORCHESTRATOR_URL}/start`, { replId })
      .then((res) => {
        setRunnerPort(res.data.port || 3002);
        setPodCreated(true);
      })
      .catch((err) => {
        console.error(err);
        setRunnerPort(3002);
        setPodCreated(true);
      });
  }, [replId, user]);

  if (!user) return <Navigate to="/" replace />;

  if (!podCreated || !runnerPort) return <BootingScreen />;
  return <IDEPage runnerPort={runnerPort} />;
};

const IDEPage = ({ runnerPort }: { runnerPort: number }) => {
  const [searchParams] = useSearchParams();
  const replId = searchParams.get("replId") ?? "";

  const [loaded, setLoaded] = useState(false);
  const [fileStructure, setFileStructure] = useState<RemoteFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | undefined>(undefined);
  const [bottomTab, setBottomTab] = useState<"terminal" | "preview" | "output" | "database">("terminal");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [runOutput, setRunOutput] = useState<string>("");

  const socket = useSocket(replId, runnerPort);
  const sidebar = useResize("horizontal", 230, 150, 420);
  const terminal = useResize("vertical", 240, 100, 600);

  useEffect(() => {
    if (!socket) return;
    socket.on("loaded", ({ rootContent }: { rootContent: RemoteFile[] }) => {
      setLoaded(true);
      setFileStructure(rootContent);
    });
    return () => { socket.off("loaded"); };
  }, [socket]);

  const mergeFiles = (incoming: RemoteFile[]) => {
    setFileStructure((prev) => {
      const map = new Map(prev.map((f) => [f.path, f]));
      incoming.forEach((f) => map.set(f.path, f));
      return Array.from(map.values());
    });
  };

  const removeFiles = (removedPaths: RemoteFile[]) => {
    const removed = new Set(removedPaths.map((f) => f.path));
    setFileStructure((prev) => prev.filter((f) => !removed.has(f.path)));
  };

  const onSelect = (file: File) => {
    if (file.type === Type.DIRECTORY || (file as any).type === "dir") {
      socket?.emit("fetchDir", file.path, (data: RemoteFile[]) => mergeFiles(data));
      return;
    }

    const ext = file.path.split('.').pop()?.toLowerCase();
    const isDb = ["db", "sqlite", "sqlite3"].includes(ext || "");
    if (isDb) {
      setSelectedFile({ ...file, content: "BINARY_DB_FILE" });
      setBottomTab("database");
      return;
    }

    socket?.emit("fetchContent", { path: file.path }, (data: string) => {
      setSelectedFile({ ...file, content: data });
    });
  };

  const onCreate = (type: "file" | "folder", name: string, parentPath: string) => {
    const fullPath = parentPath ? `${parentPath}/${name}` : name;
    const event = type === "file" ? "createFile" : "createFolder";
    socket?.emit(event, { path: fullPath }, (res: { success: boolean; dirContents: RemoteFile[] }) => {
      if (res?.success) mergeFiles(res.dirContents);
    });
  };

  const onDelete = (path: string) => {
    socket?.emit("deletePath", { path }, (res: { success: boolean; dirContents: RemoteFile[] }) => {
      if (res?.success) {
        removeFiles(res.dirContents);
        setFileStructure((prev) =>
          prev.filter((f) => f.path !== path && !f.path.startsWith(path + "/"))
        );
        if (selectedFile?.path === path) setSelectedFile(undefined);
      }
    });
  };

  const getRunCommand = (): string => {
    if (selectedFile) return `.venv/bin/python ${selectedFile.path}`;
    const lower = replId.toLowerCase();
    if (lower.startsWith("fastapi")) return ".venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload";
    if (lower.startsWith("django")) return ".venv/bin/python manage.py runserver 0.0.0.0:8000";
    if (lower.startsWith("flask")) return ".venv/bin/python app.py";
    const root = fileStructure.filter((f) => f.type === "file" && !f.path.includes("/"));
    if (root.some((f) => f.name === "manage.py")) return ".venv/bin/python manage.py runserver 0.0.0.0:8000";
    if (root.some((f) => f.name === "app.py")) return ".venv/bin/python app.py";
    return ".venv/bin/python main.py";
  };

  const [isRunning, setIsRunning] = useState(false);
  const runTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureOutputRef = useRef<((data: { data: string }) => void) | null>(null);

  useEffect(() => {
    return () => {
      if (runTimeoutRef.current) clearTimeout(runTimeoutRef.current);
      if (socket && captureOutputRef.current) {
        socket.off("terminal", captureOutputRef.current);
      }
    };
  }, [socket]);

  const handleRun = () => {
    if (!socket) return;
    setBottomTab("output");
    setRunOutput("⏳ Running…\n");
    setIsRunning(true);

    if (captureOutputRef.current) {
      socket.off("terminal", captureOutputRef.current);
    }
    if (runTimeoutRef.current) {
      clearTimeout(runTimeoutRef.current);
    }

    const captureOutput = (data: { data: string }) => {
      setRunOutput((prev) => prev + data.data);
    };
    captureOutputRef.current = captureOutput;
    socket.on("terminal", captureOutput);
    socket.emit("terminalData", { data: "\x03" });

    runTimeoutRef.current = setTimeout(() => {
      const cmd = `.venv/bin/pip install -r requirements.txt -q 2>/dev/null; ${getRunCommand()}`;
      socket.emit("terminalData", { data: `${cmd}\n` });
      
      runTimeoutRef.current = setTimeout(() => {
        if (captureOutputRef.current) {
          socket.off("terminal", captureOutputRef.current);
          captureOutputRef.current = null;
        }
      }, 10000);
    }, 300);
  };

  const handleStop = () => {
    if (!socket) return;
    setIsRunning(false);

    if (runTimeoutRef.current) {
      clearTimeout(runTimeoutRef.current);
      runTimeoutRef.current = null;
    }
    if (captureOutputRef.current) {
      socket.off("terminal", captureOutputRef.current);
      captureOutputRef.current = null;
    }

    socket.emit("terminalData", { data: "\x03" });
    socket.emit("terminalData", { data: "\x03" });
    setRunOutput((prev) => prev + "\n🛑 Process stopped manually.\n");
  };

  const handleRestart = () => {
    handleStop();
    setTimeout(() => {
      handleRun();
    }, 450);
  };

  if (!loaded) return <WorkspaceLoadingScreen />;

  return (
    <div className="flex flex-col w-screen h-screen bg-[#030712] text-slate-100 font-sans overflow-hidden">
      <TopNavbar
        replId={replId}
        selectedFile={selectedFile}
        saveStatus={saveStatus}
        bottomTab={bottomTab}
        onRun={handleRun}
        isRunning={isRunning}
        onStop={handleStop}
        onRestart={handleRestart}
        onTogglePreview={() => setBottomTab((t) => (t === "preview" ? "terminal" : "preview"))}
      />

      <main className="flex-1 flex overflow-hidden relative">
        {socket && (
          <>
            <div style={{ width: sidebar.size, minWidth: sidebar.size }} className="shrink-0 flex">
              <Sidebar
                files={fileStructure}
                selectedPath={selectedFile?.path}
                replId={replId}
                onSelect={onSelect}
                onCreate={onCreate}
                onDelete={onDelete}
              />
            </div>
            <div
              onMouseDown={sidebar.onMouseDown}
              role="separator"
              aria-label="Resize sidebar explorer"
              className="w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-indigo-500 border-r border-slate-900 hover:border-indigo-500 hover:shadow-[0_0_8px_rgba(99,102,241,0.5)] transition-all duration-150"
              title="Drag to resize sidebar"
            />
          </>
        )}

        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="flex-1 overflow-hidden relative">
            {socket ? (
              <Editor
                socket={socket}
                selectedFile={selectedFile}
                onSelect={onSelect}
                files={fileStructure}
                onSaveStatus={setSaveStatus}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 font-medium text-xs">
                Connecting to editor service…
              </div>
            )}
          </div>

          <BottomPanel
            activeTab={bottomTab}
            onTabChange={setBottomTab}
            height={terminal.size}
            onResizeMouseDown={terminal.onMouseDown}
            socket={socket}
            runOutput={runOutput}
            onClearOutput={() => setRunOutput("")}
            runnerPort={runnerPort}
            replId={replId}
          />
        </div>
      </main>

      <StatusBar replId={replId} selectedFile={selectedFile} />
    </div>
  );
};

export { IDEPage as CodingPagePostPodCreation };
