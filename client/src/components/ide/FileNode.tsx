import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  File as FileIcon,
  Folder,
  FolderOpen,
  Trash2,
  FilePlus,
  FolderPlus,
} from "lucide-react";
import { type File, type RemoteFile } from "../external/editor/utils/file-manager";
import { fileColor } from "../../utils/fileColor";

interface FileNodeProps {
  file: RemoteFile;
  depth: number;
  allFiles: RemoteFile[];
  selectedNodeId: string | undefined;
  onSelect: (f: File) => void;
  onExpand: (nodeId: string) => Promise<void>;
  onDelete: (nodeId: string) => void;
  expandedDirs: Set<string>;
  onToggleDir: (nodeId: string) => void;
  creating: { type: "file" | "folder"; parentId: string } | null;
  setCreating: (val: { type: "file" | "folder"; parentId: string } | null) => void;
  inputVal: string;
  setInputVal: (val: string) => void;
  onCreate: (type: "file" | "folder", name: string, parentId: string) => void;
}

export function FileNode({
  file,
  depth,
  allFiles,
  selectedNodeId,
  onSelect,
  onExpand,
  onDelete,
  expandedDirs,
  onToggleDir,
  creating,
  setCreating,
  inputVal,
  setInputVal,
  onCreate,
}: FileNodeProps) {
  const [hovered, setHovered] = useState(false);
  const isDir = file.type === "FOLDER";
  const isOpen = expandedDirs.has(file.id);
  const isSelected = selectedNodeId === file.id;
  const children = allFiles.filter((f) => f.parentId === file.id);
  const rowLeftPad = 18 + depth * 14;

  const handleClick = async () => {
    if (isDir) {
      if (!isOpen) {
        await onExpand(file.id);
      }
      onToggleDir(file.id);
    }
    onSelect(file as unknown as File);
  };

  return (
    <>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={handleClick}
        tabIndex={0}
        role="button"
        aria-selected={isSelected}
        aria-label={`${isDir ? "Folder" : "File"} ${file.name}`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
        className={`group flex items-center gap-1.5 px-2 py-[3px] cursor-pointer text-[13px] select-none transition-colors duration-100 focus-visible:ring-1 focus-visible:ring-[#0078d4] outline-none ${
          isSelected
            ? "bg-[#171f34] text-white"
            : "text-slate-300 hover:bg-white/[0.05] hover:text-white"
        }`}
        style={{ paddingLeft: `${rowLeftPad}px` }}
      >
        {isDir ? (
          <span className="flex-shrink-0 text-slate-500 transition-colors">
            {isOpen ? (
              <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            )}
          </span>
        ) : (
          <span className="w-3.5 h-3.5" aria-hidden="true" />
        )}

        <span
          className="flex-shrink-0"
          style={{ color: isDir ? "#f59e0b" : fileColor(file.name) }}
        >
          {isDir ? (
            isOpen ? (
              <FolderOpen className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Folder className="w-4 h-4" aria-hidden="true" />
            )
          ) : (
            <FileIcon className="w-4 h-4" aria-hidden="true" />
          )}
        </span>

        <span className="flex-1 truncate">{file.name}</span>

        {hovered && (
          <div className="flex items-center gap-1.5">
            {isDir && (
              <>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!expandedDirs.has(file.id)) {
                      await onExpand(file.id);
                      onToggleDir(file.id);
                    }
                    setCreating({ type: "file", parentId: file.id });
                    setInputVal("");
                  }}
                  aria-label="New File"
                  title="New File"
                  className="cursor-pointer rounded-md p-0.5 text-slate-500 transition duration-150 hover:bg-white/[0.08] hover:text-slate-200 outline-none focus-visible:ring-1 focus-visible:ring-[#0078d4]"
                >
                  <FilePlus className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!expandedDirs.has(file.id)) {
                      await onExpand(file.id);
                      onToggleDir(file.id);
                    }
                    setCreating({ type: "folder", parentId: file.id });
                    setInputVal("");
                  }}
                  aria-label="New Folder"
                  title="New Folder"
                  className="cursor-pointer rounded-md p-0.5 text-slate-500 transition duration-150 hover:bg-white/[0.08] hover:text-slate-200 outline-none focus-visible:ring-1 focus-visible:ring-[#0078d4]"
                >
                  <FolderPlus className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(file.id);
              }}
              aria-label={`Delete ${file.name}`}
              title="Delete item"
              className="cursor-pointer rounded-md p-0.5 text-rose-300/70 transition duration-150 hover:bg-white/[0.08] hover:text-rose-300 outline-none focus-visible:ring-1 focus-visible:ring-[#f48771]"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {isDir && isOpen && (
        <>
          {creating && creating.parentId === file.id && (
            <div className="py-1" style={{ paddingLeft: `${rowLeftPad + 14}px` }}>
              <div className="flex items-center gap-2 rounded-xl border border-[#18b6f6]/40 bg-[#0f1729] px-3 py-2">
                <span className="shrink-0 text-slate-500">
                  {creating.type === "folder" ? (
                    <Folder className="w-3.5 h-3.5 text-[#f59e0b]" />
                  ) : (
                    <FileIcon className="w-3.5 h-3.5" />
                  )}
                </span>
                <input
                  autoFocus
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if (inputVal.trim()) {
                        onCreate(creating.type, inputVal.trim(), creating.parentId);
                      }
                      setCreating(null);
                      setInputVal("");
                    }
                    if (e.key === "Escape") {
                      setCreating(null);
                      setInputVal("");
                    }
                  }}
                  onBlur={() => {
                    if (inputVal.trim()) {
                      onCreate(creating.type, inputVal.trim(), creating.parentId);
                    }
                    setCreating(null);
                    setInputVal("");
                  }}
                  spellCheck={false}
                  autoComplete="off"
                  placeholder={creating.type === "folder" ? "folder name…" : "file name…"}
                  className="min-w-0 flex-1 border-none bg-transparent text-xs text-slate-200 outline-none"
                />
              </div>
            </div>
          )}
          {children.map((child) => (
            <FileNode
              key={child.id}
              file={child}
              depth={depth + 1}
              allFiles={allFiles}
              selectedNodeId={selectedNodeId}
              onSelect={onSelect}
              onExpand={onExpand}
              onDelete={onDelete}
              expandedDirs={expandedDirs}
              onToggleDir={onToggleDir}
              creating={creating}
              setCreating={setCreating}
              inputVal={inputVal}
              setInputVal={setInputVal}
              onCreate={onCreate}
            />
          ))}
        </>
      )}
    </>
  );
}
