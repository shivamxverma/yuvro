import { useEffect, useMemo, useRef, useState } from "react";
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
import { INIT_SERVICE_URL, ORCHESTRATOR_URL } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

type ProjectDetail = {
  workspace: { id: string; name: string };
  project: { id: string; name: string; type: string };
  rootNode: { id: string };
};

type NodePayload = {
  id: string;
  parentId: string | null;
  type: "FILE" | "FOLDER";
  name: string;
  path: string;
  isRoot?: boolean;
};

function toEditorFile(node: NodePayload, content?: string): File {
  return {
    id: node.id,
    name: node.name,
    path: node.path,
    parentId: node.parentId,
    type: node.type === "FOLDER" ? Type.DIRECTORY : Type.FILE,
    depth: 0,
    content,
  };
}

function collectDescendantIds(nodes: RemoteFile[], rootId: string): Set<string> {
  const ids = new Set<string>([rootId]);
  let changed = true;

  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (node.parentId && ids.has(node.parentId) && !ids.has(node.id)) {
        ids.add(node.id);
        changed = true;
      }
    }
  }

  return ids;
}

export const CodingPage = () => {
  const { user } = useAuth();
  const [podCreated, setPodCreated] = useState(false);
  const [runnerBaseUrl, setRunnerBaseUrl] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const workspaceId = searchParams.get("workspaceId") ?? "";
  const projectId = searchParams.get("projectId") ?? "";

  useEffect(() => {
    if (!user || !workspaceId || !projectId) return;
    axios
      .post(`${ORCHESTRATOR_URL}/start`, { workspaceId, projectId })
      .then((res) => {
        setRunnerBaseUrl(res.data.baseUrl || `http://localhost:${res.data.port || 3002}`);
        setPodCreated(true);
      })
      .catch((err) => {
        console.error(err);
        setRunnerBaseUrl("http://localhost:3002");
        setPodCreated(true);
      });
  }, [workspaceId, projectId, user]);

  if (!user) return <Navigate to="/" replace />;
  if (!workspaceId || !projectId) return <Navigate to="/" replace />;
  if (!podCreated || !runnerBaseUrl) return <BootingScreen />;

  return <IDEPage runnerBaseUrl={runnerBaseUrl} workspaceId={workspaceId} projectId={projectId} />;
};

const IDEPage = ({
  runnerBaseUrl,
  workspaceId,
  projectId,
}: {
  runnerBaseUrl: string;
  workspaceId: string;
  projectId: string;
}) => {
  const [loaded, setLoaded] = useState(false);
  const [fileStructure, setFileStructure] = useState<RemoteFile[]>([]);
  const [projectName, setProjectName] = useState("");
  const [projectType, setProjectType] = useState("");
  const [rootNodeId, setRootNodeId] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(undefined);
  const [selectedFile, setSelectedFile] = useState<File | undefined>(undefined);
  const [loadedDirectoryIds, setLoadedDirectoryIds] = useState<Set<string>>(new Set());
  const [bottomTab, setBottomTab] = useState<"terminal" | "preview" | "output" | "database">("terminal");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [runOutput, setRunOutput] = useState<string>("");
  const [terminalReady, setTerminalReady] = useState(false);
  const loadedDirectoryIdsRef = useRef<Set<string>>(new Set());
  const autoRunTriggeredRef = useRef(false);
  const draftContentsRef = useRef<Map<string, string>>(new Map());
  const dirtyFileIdsRef = useRef<Set<string>>(new Set());
  const savingFileIdsRef = useRef<Set<string>>(new Set());

  const socket = useSocket(projectId, runnerBaseUrl);
  const sidebar = useResize("horizontal", 230, 150, 420);
  const terminal = useResize("vertical", 240, 100, 600);

  useEffect(() => {
    loadedDirectoryIdsRef.current = loadedDirectoryIds;
  }, [loadedDirectoryIds]);

  useEffect(() => {
    setTerminalReady(false);
    autoRunTriggeredRef.current = false;
  }, [projectId, runnerBaseUrl]);

  useEffect(() => {
    if (!socket) return;

    const handleTerminalReady = () => {
      setTerminalReady(true);
    };

    socket.on("terminalReady", handleTerminalReady);

    return () => {
      socket.off("terminalReady", handleTerminalReady);
    };
  }, [socket]);

  const mergeChildren = (parentId: string, children: RemoteFile[]) => {
    setFileStructure((prev) => {
      const nextChildIds = new Set(children.map((child) => child.id));
      const staleChildIds = prev
        .filter((node) => node.parentId === parentId && !nextChildIds.has(node.id))
        .map((node) => node.id);

      const idsToRemove = new Set<string>();
      for (const childId of staleChildIds) {
        for (const descendantId of collectDescendantIds(prev, childId)) {
          idsToRemove.add(descendantId);
        }
      }

      const survivors = prev.filter(
        (node) => node.parentId !== parentId && !idsToRemove.has(node.id)
      );
      return [...survivors, ...children];
    });
  };

  const fetchChildren = async (nodeId: string, force = false) => {
    if (!force && loadedDirectoryIdsRef.current.has(nodeId)) {
      return;
    }

    const response = await fetch(`${INIT_SERVICE_URL}/nodes/${nodeId}/children`, {
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error("Failed to load folder contents.");
    }

    const payload = (await response.json()) as { nodes: RemoteFile[] };
    mergeChildren(nodeId, payload.nodes);
    setLoadedDirectoryIds((prev) => {
      const next = new Set(prev);
      next.add(nodeId);
      return next;
    });
  };

  const fetchProjectState = async () => {
    setLoaded(false);
    const projectRes = await fetch(`${INIT_SERVICE_URL}/projects/${projectId}`, {
      credentials: "include",
    });
    if (!projectRes.ok) {
      throw new Error("Failed to load project.");
    }
    const detail = (await projectRes.json()) as ProjectDetail;
    setProjectName(detail.project.name);
    setProjectType(detail.project.type);
    setRootNodeId(detail.rootNode.id);
    setFileStructure([]);
    setLoadedDirectoryIds(new Set());
    loadedDirectoryIdsRef.current = new Set();
    await fetchChildren(detail.rootNode.id, true);
    setLoaded(true);
  };

  useEffect(() => {
    void fetchProjectState().catch((err) => {
      console.error(err);
    });
  }, [projectId]);

  useEffect(() => {
    if (!selectedNodeId) return;
    const exists = fileStructure.some((node) => node.id === selectedNodeId);
    if (!exists) {
      setSelectedNodeId(undefined);
      setSelectedFile(undefined);
    }
  }, [fileStructure, selectedNodeId]);

  const markDraft = (fileId: string, content: string) => {
    draftContentsRef.current.set(fileId, content);
    dirtyFileIdsRef.current.add(fileId);
    setSelectedFile((prev) => (prev && prev.id === fileId ? { ...prev, content } : prev));
  };

  const flushFileSave = async (fileId?: string) => {
    if (!fileId || !dirtyFileIdsRef.current.has(fileId)) return;
    const content = draftContentsRef.current.get(fileId);
    if (content == null) return;
    await handleSave(fileId, content);
  };

  const onSelect = async (file: File) => {
    await flushFileSave(selectedFile?.id);
    setSelectedNodeId(file.id);
    const isDirectory = file.type === Type.DIRECTORY || (file as unknown as { type?: string }).type === "FOLDER";
    if (isDirectory) {
      setSelectedFile(undefined);
      return;
    }

    const ext = file.path.split(".").pop()?.toLowerCase();
    const isDb = ["db", "sqlite", "sqlite3"].includes(ext || "");
    if (isDb) {
      setSelectedFile({ ...toEditorFile(file as unknown as NodePayload), content: "BINARY_DB_FILE" });
      setBottomTab("database");
      return;
    }

    const response = await fetch(`${INIT_SERVICE_URL}/nodes/${file.id}/content`, {
      credentials: "include",
    });
    if (!response.ok) {
      return;
    }
    const payload = await response.json();
    setSelectedFile(toEditorFile(payload.node, payload.content));
  };

  const onCreate = async (type: "file" | "folder", name: string, parentId: string) => {
    await fetch(`${INIT_SERVICE_URL}/nodes`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parent_id: parentId,
        name,
        type: type === "file" ? "FILE" : "FOLDER",
      }),
    });
    await fetchChildren(parentId, true);
  };

  const onDelete = async (nodeId: string) => {
    await fetch(`${INIT_SERVICE_URL}/nodes/${nodeId}`, {
      method: "DELETE",
      credentials: "include",
    });
    const removedIds = collectDescendantIds(fileStructure, nodeId);
    setFileStructure((prev) => {
      return prev.filter((node) => !removedIds.has(node.id));
    });
    setLoadedDirectoryIds((prev) => {
      const next = new Set(prev);
      for (const removedId of removedIds) {
        next.delete(removedId);
      }
      return next;
    });
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(undefined);
      setSelectedFile(undefined);
    }
  };

  const handleSave = async (nodeId: string, content: string) => {
    if (savingFileIdsRef.current.has(nodeId)) return;
    savingFileIdsRef.current.add(nodeId);
    const response = await fetch(`${INIT_SERVICE_URL}/nodes/${nodeId}/content`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    try {
      if (!response.ok) {
        throw new Error("Failed to save file.");
      }
      draftContentsRef.current.set(nodeId, content);
      dirtyFileIdsRef.current.delete(nodeId);
      setSelectedFile((prev) => (prev && prev.id === nodeId ? { ...prev, content } : prev));
    } finally {
      savingFileIdsRef.current.delete(nodeId);
    }
  };

  const flushDirtyFiles = async (fileIds?: string[]) => {
    const ids = fileIds ?? Array.from(dirtyFileIdsRef.current);
    for (const fileId of ids) {
      if (!dirtyFileIdsRef.current.has(fileId)) continue;
      const content = draftContentsRef.current.get(fileId);
      if (content == null) continue;
      await handleSave(fileId, content);
    }
  };

  const rootLevelFiles = useMemo(
    () => fileStructure.filter((f) => f.parentId === rootNodeId && f.type === "FILE"),
    [fileStructure, rootNodeId]
  );

  const getRunCommand = (): string => {
    if (projectType === "fastapi") return ".venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload";
    if (projectType === "django") return ".venv/bin/python manage.py runserver 0.0.0.0:8000";
    if (projectType === "flask") return ".venv/bin/python app.py";
    if (rootLevelFiles.some((f) => f.name === "manage.py")) return ".venv/bin/python manage.py runserver 0.0.0.0:8000";
    if (rootLevelFiles.some((f) => f.name === "app.py")) return ".venv/bin/python app.py";
    if (selectedFile && selectedFile.type === Type.FILE) {
      return `.venv/bin/python ${selectedFile.path.replace(/^\//, "")}`;
    }
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

  const handleRun = async () => {
    if (!socket || !terminalReady) return;
    await flushFileSave(selectedFile?.id);
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
      const cmd = `.venv/bin/python -m ensurepip --upgrade >/dev/null 2>&1; .venv/bin/python -m pip install -r requirements.txt -q 2>/dev/null; ${getRunCommand()}`;
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
      void handleRun();
    }, 450);
  };

  useEffect(() => {
    if (!loaded || !socket || !terminalReady || autoRunTriggeredRef.current) return;
    autoRunTriggeredRef.current = true;
    void handleRun();
  }, [loaded, socket, terminalReady]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (dirtyFileIdsRef.current.size === 0) return;
      void flushDirtyFiles();
    }, 20000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (dirtyFileIdsRef.current.size === 0) return;
      event.preventDefault();
      event.returnValue = "";
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "hidden" || dirtyFileIdsRef.current.size === 0) return;
      void flushDirtyFiles();
    };

    const handlePageHide = () => {
      if (dirtyFileIdsRef.current.size === 0) return;
      void flushDirtyFiles();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, []);

  if (!loaded || !rootNodeId) return <WorkspaceLoadingScreen />;

  return (
    <div className="flex flex-col w-screen h-screen bg-[#030712] text-slate-100 font-sans overflow-hidden">
      <TopNavbar
        projectLabel={projectName || projectId}
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
                selectedNodeId={selectedNodeId}
                projectLabel={projectName || projectId}
                rootNodeId={rootNodeId}
                onSelect={(file) => {
                  void onSelect(file);
                }}
                onExpand={(nodeId) => fetchChildren(nodeId)}
                onCreate={(type, name, parentId) => {
                  void onCreate(type, name, parentId);
                }}
                onDelete={(nodeId) => {
                  void onDelete(nodeId);
                }}
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
            <Editor
              selectedFile={selectedFile}
              onSelect={(file) => {
                void onSelect(file);
              }}
              files={fileStructure}
              onSaveStatus={setSaveStatus}
              onSave={handleSave}
              onDraftChange={markDraft}
            />
          </div>

          <BottomPanel
            activeTab={bottomTab}
            onTabChange={setBottomTab}
            height={terminal.size}
            onResizeMouseDown={terminal.onMouseDown}
            socket={socket}
            runOutput={runOutput}
            onClearOutput={() => setRunOutput("")}
            runnerBaseUrl={runnerBaseUrl}
            projectId={projectId}
            workspaceId={workspaceId}
          />
        </div>
      </main>

      <StatusBar projectLabel={projectName || projectId} selectedFile={selectedFile} />
    </div>
  );
};

export { IDEPage as CodingPagePostPodCreation };
