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
    <div className="w-full h-full bg-[#181818] border-r border-[#2b2b2b] flex flex-col shrink-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#252526]">
        <div className="flex items-center gap-2">
          <FolderTree className="w-3.5 h-3.5 text-[#c5c5c5]" aria-hidden="true" />
          <span className="text-[10px] font-bold text-[#bbbbbb] uppercase tracking-[0.18em]">
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
            className="p-1 text-[#9da1a6] hover:text-[#d4d4d4] hover:bg-[#2a2d2e] rounded-sm cursor-pointer transition duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[#0078d4]"
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
            className="p-1 text-[#9da1a6] hover:text-[#d4d4d4] hover:bg-[#2a2d2e] rounded-sm cursor-pointer transition duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[#0078d4]"
          >
            <FolderPlus className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="px-3 pt-3 pb-1 text-[10px] font-bold text-[#8c8c8c] uppercase tracking-[0.16em] select-none">
        Workspace
      </div>

      <div className="px-2 pb-2">
        <div className="mb-1 flex items-center gap-1.5 px-1 text-[11px] text-[#d4d4d4] select-none">
          <ChevronDown className="w-3.5 h-3.5 text-[#c5c5c5]" aria-hidden="true" />
          <FolderOpen className="w-4 h-4 text-[#dcb67a]" aria-hidden="true" />
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
                  className={`w-full flex items-center gap-2 px-2 py-1 text-left text-[13px] transition duration-150 ${
                    isActive
                      ? "bg-[#2a2d2e] text-[#ffffff]"
                      : "text-[#cccccc] hover:bg-[#2a2d2e] hover:text-[#ffffff]"
                  }`}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 shrink-0 text-[#c5c5c5]" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 shrink-0 text-[#c5c5c5]" aria-hidden="true" />
                  )}
                  <Folder className="w-4 h-4 shrink-0 text-[#dcb67a]" aria-hidden="true" />
                  <span className="truncate">{project.name}</span>
                </button>

                {isExpanded && (
                  <>
                    {creating && creating.parentId === rootNodeId && (
                      <div className="px-2 py-1">
                        <div className="flex items-center gap-2 bg-[#1f1f1f] border border-[#0078d4] rounded-sm px-2 py-1.5 ml-[18px]">
                          <span className="shrink-0 text-[#9da1a6]">
                            {creating.type === "folder" ? (
                              <Folder className="w-3.5 h-3.5 text-[#dcb67a]" />
                            ) : (
                              <FileIcon className="w-3.5 h-3.5" />
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
                            className="flex-1 bg-transparent border-none outline-none text-[#d4d4d4] text-xs min-w-0"
                          />
                        </div>
                      </div>
                    )}

                    <div className="py-0.5">
                      {rootFiles.length === 0 && !creating ? (
                        <div className="px-2 ml-[18px] text-[11px] text-[#6b6b6b]">
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
