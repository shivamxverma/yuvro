import { useEffect, useRef, useState } from "react";
import {
  File as FileIcon,
  Folder,
  FolderOpen,
  FolderPlus,
  FilePlus,
  FolderTree,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { type File, type RemoteFile } from "../external/editor/utils/file-manager";
import { FileNode } from "./FileNode";

interface SidebarProps {
  files: RemoteFile[];
  selectedNodeId: string | undefined;
  workspaceLabel: string;
  workspaceProjects: Array<{ id: string; name: string; type: string }>;
  activeProjectId: string;
  rootNodeId: string;
  onSelect: (f: File) => void;
  onSwitchProject: (projectId: string) => void;
  onExpand: (nodeId: string) => Promise<void>;
  onCreate: (type: "file" | "folder", name: string, parentId: string) => void;
  onDelete: (nodeId: string) => void;
}

export function Sidebar({
  files,
  selectedNodeId,
  workspaceLabel,
  workspaceProjects,
  activeProjectId,
  rootNodeId,
  onSelect,
  onSwitchProject,
  onExpand,
  onCreate,
  onDelete,
}: SidebarProps) {
  const [creating, setCreating] = useState<{ type: "file" | "folder"; parentId: string } | null>(null);
  const [inputVal, setInputVal] = useState("");
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [collapsedProjectIds, setCollapsedProjectIds] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creating) setTimeout(() => inputRef.current?.focus(), 50);
  }, [creating]);

  useEffect(() => {
    setCollapsedProjectIds((prev) => {
      if (!prev.has(activeProjectId)) return prev;
      const next = new Set(prev);
      next.delete(activeProjectId);
      return next;
    });
  }, [activeProjectId]);

  const visibleFiles = files.filter((f) => !f.isRoot);
  const rootFiles = visibleFiles.filter((f) => f.parentId === rootNodeId);

  const getActiveParentId = (): string => {
    if (!selectedNodeId) return rootNodeId;
    const selectedItem = files.find((f) => f.id === selectedNodeId);
    if (selectedItem?.type === "FOLDER") {
      return selectedItem.id;
    }
    return selectedItem?.parentId ?? rootNodeId;
  };

  const handleCreate = () => {
    if (!inputVal.trim()) {
      setCreating(null);
      return;
    }
    onCreate(creating!.type, inputVal.trim(), creating!.parentId);
    setInputVal("");
    setCreating(null);
  };

  const toggleDir = (nodeId: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      next.has(nodeId) ? next.delete(nodeId) : next.add(nodeId);
      return next;
    });
  };

  const toggleProject = (projectId: string) => {
    setCollapsedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  return (
    <div className="flex h-full w-full shrink-0 flex-col border-r border-white/8 bg-[#0b1020]">
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
        <div className="flex items-center gap-2">
          <FolderTree className="h-3.5 w-3.5 text-[#6dc7ff]" aria-hidden="true" />
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
            Explorer
          </span>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => {
              setCreating({ type: "file", parentId: getActiveParentId() });
              setInputVal("");
            }}
            aria-label="New File"
            title="New File"
            className="cursor-pointer rounded-lg p-1.5 text-slate-500 transition duration-150 hover:bg-white/[0.06] hover:text-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-[#18b6f6]"
          >
            <FilePlus className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button
            onClick={() => {
              setCreating({ type: "folder", parentId: getActiveParentId() });
              setInputVal("");
            }}
            aria-label="New Folder"
            title="New Folder"
            className="cursor-pointer rounded-lg p-1.5 text-slate-500 transition duration-150 hover:bg-white/[0.06] hover:text-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-[#18b6f6]"
          >
            <FolderPlus className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="px-4 pb-1 pt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 select-none">
        Workspace
      </div>

      <div className="px-3 pb-3">
        <div className="mb-2 flex items-center gap-1.5 rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2 text-[11px] text-slate-200 select-none">
          <ChevronDown className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          <FolderOpen className="h-4 w-4 text-[#f59e0b]" aria-hidden="true" />
          <span className="truncate font-medium">{workspaceLabel || "workspace"}</span>
        </div>
        <div className="flex flex-col">
          {workspaceProjects.map((project) => {
            const isActive = project.id === activeProjectId;
            const isExpanded = isActive && !collapsedProjectIds.has(project.id);
            return (
              <div key={project.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (isActive) {
                      toggleProject(project.id);
                      return;
                    }
                    onSwitchProject(project.id);
                  }}
                  className={`mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] transition duration-150 ${
                    isActive
                      ? "bg-[#171f34] text-white shadow-[inset_0_0_0_1px_rgba(109,199,255,0.16)]"
                      : "text-slate-300 hover:bg-white/[0.05] hover:text-white"
                  }`}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
                  )}
                  <Folder className="h-4 w-4 shrink-0 text-[#f59e0b]" aria-hidden="true" />
                  <span className="truncate">{project.name}</span>
                </button>

                {isExpanded && (
                  <>
                    {creating && creating.parentId === rootNodeId && (
                      <div className="px-2 py-1">
                        <div className="ml-[18px] flex items-center gap-2 rounded-xl border border-[#18b6f6]/40 bg-[#0f1729] px-3 py-2">
                          <span className="shrink-0 text-slate-500">
                            {creating.type === "folder" ? (
                              <Folder className="h-3.5 w-3.5 text-[#f59e0b]" />
                            ) : (
                              <FileIcon className="h-3.5 w-3.5" />
                            )}
                          </span>
                          <input
                            ref={inputRef}
                            value={inputVal}
                            onChange={(e) => setInputVal(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleCreate();
                              if (e.key === "Escape") setCreating(null);
                            }}
                            onBlur={handleCreate}
                            spellCheck={false}
                            autoComplete="off"
                            placeholder={creating.type === "folder" ? "folder name…" : "file name…"}
                            className="min-w-0 flex-1 border-none bg-transparent text-xs text-slate-200 outline-none"
                          />
                        </div>
                      </div>
                    )}

                    <div className="py-0.5">
                      {rootFiles.length === 0 && !creating ? (
                        <div className="ml-[18px] px-2 text-[11px] text-slate-600">
                          No files
                        </div>
                      ) : (
                        rootFiles.map((f) => (
                          <FileNode
                            key={f.id}
                            file={f}
                            depth={1}
                            allFiles={visibleFiles}
                            selectedNodeId={selectedNodeId}
                            onSelect={onSelect}
                            onExpand={onExpand}
                            onDelete={onDelete}
                            expandedDirs={expandedDirs}
                            onToggleDir={toggleDir}
                            creating={creating}
                            setCreating={setCreating}
                            inputVal={inputVal}
                            setInputVal={setInputVal}
                            onCreate={onCreate}
                          />
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex-1" />
    </div>
  );
}
