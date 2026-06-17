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
            ? "bg-[#37373d] text-[#ffffff]"
            : "text-[#cccccc] hover:text-[#ffffff] hover:bg-[#2a2d2e]"
        }`}
        style={{ paddingLeft: `${rowLeftPad}px` }}
      >
        {isDir ? (
          <span className="text-[#c5c5c5] transition-colors flex-shrink-0">
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
          style={{ color: isDir ? "#dcb67a" : fileColor(file.name) }}
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
                  className="text-[#9da1a6] hover:text-[#d4d4d4] p-0.5 hover:bg-[#3a3d41] rounded-sm flex-shrink-0 transition duration-150 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-[#0078d4]"
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
                  className="text-[#9da1a6] hover:text-[#d4d4d4] p-0.5 hover:bg-[#3a3d41] rounded-sm flex-shrink-0 transition duration-150 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-[#0078d4]"
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
              className="text-[#c97777] hover:text-[#f48771] p-0.5 hover:bg-[#3a3d41] rounded-sm flex-shrink-0 transition duration-150 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-[#f48771]"
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
              <div className="flex items-center gap-2 bg-[#1f1f1f] border border-[#0078d4] rounded-sm px-2 py-1.5">
                <span className="shrink-0 text-[#9da1a6]">
                  {creating.type === "folder" ? (
                    <Folder className="w-3.5 h-3.5 text-[#dcb67a]" />
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
                  className="flex-1 bg-transparent border-none outline-none text-[#d4d4d4] text-xs min-w-0"
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
