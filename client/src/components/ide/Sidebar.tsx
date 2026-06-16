import { useEffect, useRef, useState } from "react";
import {
  File as FileIcon,
  Folder,
  FolderOpen,
  FolderPlus,
  FilePlus,
  FolderTree,
} from "lucide-react";
import { type File, type RemoteFile } from "../external/editor/utils/file-manager";
import { FileNode } from "./FileNode";

interface SidebarProps {
  files: RemoteFile[];
  selectedNodeId: string | undefined;
  projectLabel: string;
  rootNodeId: string;
  onSelect: (f: File) => void;
  onExpand: (nodeId: string) => Promise<void>;
  onCreate: (type: "file" | "folder", name: string, parentId: string) => void;
  onDelete: (nodeId: string) => void;
}

export function Sidebar({
  files,
  selectedNodeId,
  projectLabel,
  rootNodeId,
  onSelect,
  onExpand,
  onCreate,
  onDelete,
}: SidebarProps) {
  const [creating, setCreating] = useState<{ type: "file" | "folder"; parentId: string } | null>(null);
  const [inputVal, setInputVal] = useState("");
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creating) setTimeout(() => inputRef.current?.focus(), 50);
  }, [creating]);

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

  return (
    <div className="w-full h-full bg-[#0b0f19] border-r border-slate-900 flex flex-col shrink-0">
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-slate-900">
        <div className="flex items-center gap-2">
          <FolderTree className="w-3.5 h-3.5 text-indigo-400" aria-hidden="true" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
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
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-md cursor-pointer transition duration-150 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
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
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-md cursor-pointer transition duration-150 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <FolderPlus className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="px-3.5 py-2 text-xs font-semibold text-slate-500 flex items-center gap-2 select-none">
        <FolderOpen className="w-3.5 h-3.5 text-amber-500/80" aria-hidden="true" />
        <span className="truncate font-mono">{projectLabel}</span>
      </div>

      {creating && creating.parentId === rootNodeId && (
        <div className="px-3 py-1.5">
          <div className="flex items-center gap-2 bg-slate-950 border border-indigo-500/50 rounded-lg px-2.5 py-1.5">
            <span className="shrink-0 text-slate-400">
              {creating.type === "folder" ? (
                <Folder className="w-3.5 h-3.5" />
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
              className="flex-1 bg-transparent border-none outline-none text-slate-200 text-xs min-w-0 font-mono"
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2 py-2 pb-6">
        {rootFiles.length === 0 && !creating ? (
          <div className="text-center text-[11px] text-slate-600 mt-6 font-medium">
            Empty Workspace
          </div>
        ) : (
          rootFiles.map((f) => (
            <FileNode
              key={f.id}
              file={f}
              depth={0}
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
    </div>
  );
}
