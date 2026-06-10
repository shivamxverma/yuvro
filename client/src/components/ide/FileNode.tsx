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
  selectedPath: string | undefined;
  onSelect: (f: File) => void;
  onDelete: (path: string) => void;
  expandedDirs: Set<string>;
  onToggleDir: (path: string) => void;
  creating: { type: "file" | "folder"; parentPath: string } | null;
  setCreating: (val: { type: "file" | "folder"; parentPath: string } | null) => void;
  inputVal: string;
  setInputVal: (val: string) => void;
  onCreate: (type: "file" | "folder", name: string, parentPath: string) => void;
}

export function FileNode({
  file,
  depth,
  allFiles,
  selectedPath,
  onSelect,
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
  const isDir = file.type === "dir";
  const isOpen = expandedDirs.has(file.path);
  const isSelected = selectedPath === file.path;

  const children = allFiles.filter((f) => {
    const parent = f.path.includes("/")
      ? f.path.substring(0, f.path.lastIndexOf("/"))
      : "";
    return parent === file.path;
  });

  const handleClick = () => {
    if (isDir) {
      onToggleDir(file.path);
      onSelect(file as unknown as File);
    } else {
      onSelect(file as unknown as File);
    }
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
        className={`group flex items-center gap-2 px-2.5 py-1.5 cursor-pointer rounded-lg mb-0.5 text-xs select-none transition-all duration-150 focus-visible:ring-2 focus-visible:ring-indigo-500/80 outline-none ${
          isSelected
            ? "bg-indigo-950/30 text-indigo-300 border-l-2 border-indigo-500 shadow-sm"
            : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/40"
        }`}
        style={{ paddingLeft: `${10 + depth * 14}px` }}
      >
        {isDir ? (
          <span className="text-slate-500/80 group-hover:text-slate-400/90 transition-colors flex-shrink-0">
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
              <FolderOpen className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <Folder className="w-3.5 h-3.5" aria-hidden="true" />
            )
          ) : (
            <FileIcon className="w-3.5 h-3.5" aria-hidden="true" />
          )}
        </span>

        <span className="flex-1 truncate font-mono text-[12px]">{file.name}</span>

        {hovered && (
          <div className="flex items-center gap-1.5">
            {isDir && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!expandedDirs.has(file.path)) {
                      onToggleDir(file.path);
                    }
                    setCreating({ type: "file", parentPath: file.path });
                    setInputVal("");
                  }}
                  aria-label="New File"
                  title="New File"
                  className="text-slate-400 hover:text-slate-200 p-0.5 bg-slate-950/20 hover:bg-slate-950/50 rounded flex-shrink-0 transition duration-150 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <FilePlus className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!expandedDirs.has(file.path)) {
                      onToggleDir(file.path);
                    }
                    setCreating({ type: "folder", parentPath: file.path });
                    setInputVal("");
                  }}
                  aria-label="New Folder"
                  title="New Folder"
                  className="text-slate-400 hover:text-slate-200 p-0.5 bg-slate-950/20 hover:bg-slate-950/50 rounded flex-shrink-0 transition duration-150 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <FolderPlus className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(file.path);
              }}
              aria-label={`Delete ${file.name}`}
              title="Delete item"
              className="text-red-400/70 hover:text-red-400 p-0.5 bg-slate-950/20 hover:bg-slate-950/50 rounded flex-shrink-0 transition duration-150 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {isDir &&
        isOpen && (
          <>
            {creating && creating.parentPath === file.path && (
              <div className="py-1" style={{ paddingLeft: `${10 + (depth + 1) * 14}px` }}>
                <div className="flex items-center gap-2 bg-slate-950 border border-indigo-500/50 rounded-lg px-2.5 py-1.5">
                  <span className="shrink-0 text-slate-400">
                    {creating.type === "folder" ? (
                      <Folder className="w-3.5 h-3.5" />
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
                          onCreate(creating.type, inputVal.trim(), creating.parentPath);
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
                        onCreate(creating.type, inputVal.trim(), creating.parentPath);
                      }
                      setCreating(null);
                      setInputVal("");
                    }}
                    spellCheck={false}
                    autoComplete="off"
                    placeholder={creating.type === "folder" ? "folder name…" : "file name…"}
                    className="flex-1 bg-transparent border-none outline-none text-slate-200 text-xs min-w-0 font-mono"
                  />
                </div>
              </div>
            )}
            {children.map((child) => (
              <FileNode
                key={child.path}
                file={child}
                depth={depth + 1}
                allFiles={allFiles}
                selectedPath={selectedPath}
                onSelect={onSelect}
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
