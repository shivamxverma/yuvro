import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  File as FileIcon,
  Folder,
  FolderOpen,
  Trash2,
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
        )}
      </div>

      {isDir &&
        isOpen &&
        children.map((child) => (
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
          />
        ))}
    </>
  );
}
