import { useEffect, useMemo } from "react";
import { Code as CodeEditor } from "./external/editor/editor/code";
import { type File, buildFileTree, type RemoteFile } from "./external/editor/utils/file-manager";
import {
  Terminal,
  Keyboard,
  Cpu,
  Play,
  Eye,
  PlusSquare,
  Database,
} from "lucide-react";

export const Editor = ({
  files,
  onSelect,
  selectedFile,
  onSave,
  onDraftChange,
  onSaveStatus,
}: {
  files: RemoteFile[];
  onSelect: (file: File) => void;
  selectedFile: File | undefined;
  onSave: (fileId: string, value: string) => Promise<void>;
  onDraftChange?: (fileId: string, value: string) => void;
  onSaveStatus?: (status: "saving" | "saved" | "idle") => void;
}) => {
  const rootDir = useMemo(() => buildFileTree(files), [files]);

  useEffect(() => {
    if (!selectedFile && rootDir && rootDir.files && rootDir.files.length > 0) {
      onSelect(rootDir.files[0]);
    }
  }, [selectedFile, rootDir, onSelect]);

  if (!selectedFile) {
    return (
      <div className="flex h-full w-full select-none flex-col items-center justify-center overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(124,92,255,0.12),_transparent_30%),#09101c] p-8 text-center">
        <div className="flex w-full max-w-2xl flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-2">
            <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-gradient-to-br from-[#7c5cff] to-[#18b6f6] text-2xl font-extrabold text-white shadow-[0_16px_40px_rgba(24,182,246,0.16)]">
              Y
            </div>
            <h2 className="m-0 flex items-center gap-2 text-2xl font-bold text-slate-100">
              Workspace ready
            </h2>
            <p className="max-w-xl text-sm text-slate-500">
              Select a file from the explorer, or use the controls below to run, preview, create files, and inspect databases.
            </p>
          </div>

          <div className="mt-2 grid w-full grid-cols-1 gap-3.5 text-left sm:grid-cols-2">
            <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4 transition duration-150 hover:bg-white/[0.06]">
              <div className="flex items-center gap-2.5 text-[#18b6f6]">
                <Play className="w-4 h-4" />
                <span className="text-xs font-bold text-slate-200">Run Your Code</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                Click the <span className="text-emerald-400 font-semibold">Run</span> button in the top navbar to execute the active project in your container.
              </p>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4 transition duration-150 hover:bg-white/[0.06]">
              <div className="flex items-center gap-2.5 text-[#18b6f6]">
                <Eye className="w-4 h-4" />
                <span className="text-xs font-bold text-slate-200">Live Preview</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                Start a server and open <span className="text-[#18b6f6] font-semibold">App Preview</span> to view web pages in real-time.
              </p>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4 transition duration-150 hover:bg-white/[0.06]">
              <div className="flex items-center gap-2.5 text-[#18b6f6]">
                <PlusSquare className="w-4 h-4" />
                <span className="text-xs font-bold text-slate-200">Create Files</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                Use the icons in the explorer sidebar to create new files or subfolders.
              </p>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4 transition duration-150 hover:bg-white/[0.06]">
              <div className="flex items-center gap-2.5 text-[#18b6f6]">
                <Terminal className="w-4 h-4" />
                <span className="text-xs font-bold text-slate-200">Interactive Terminal</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                Direct shell access is available via the bottom terminal pane for installs and testing commands.
              </p>
            </div>
          </div>

          <div className="w-full rounded-2xl border border-white/8 bg-white/[0.04] p-5 text-left">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <Keyboard className="w-3.5 h-3.5 text-[#18b6f6]" />
              <span>Keyboard Shortcuts</span>
            </div>
            <div className="grid grid-cols-2 gap-y-2 gap-x-6">
              <div className="flex items-center justify-between text-xs text-slate-400 py-0.5">
                <span>Save file content</span>
                <kbd className="rounded border border-white/8 bg-[#0d1321] px-1.5 py-0.5 text-[10px] font-mono text-slate-300">Ctrl&nbsp;+&nbsp;S</kbd>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400 py-0.5">
                <span>Focus Terminal</span>
                <kbd className="rounded border border-white/8 bg-[#0d1321] px-1.5 py-0.5 text-[10px] font-mono text-slate-300">Ctrl&nbsp;+&nbsp;`</kbd>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400 py-0.5">
                <span>Search settings</span>
                <kbd className="rounded border border-white/8 bg-[#0d1321] px-1.5 py-0.5 text-[10px] font-mono text-slate-300">Ctrl&nbsp;+&nbsp;,</kbd>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400 py-0.5">
                <span>Command palette</span>
                <kbd className="rounded border border-white/8 bg-[#0d1321] px-1.5 py-0.5 text-[10px] font-mono text-slate-300">F1</kbd>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-[#18b6f6]/15 bg-[#18b6f6]/10 p-2 px-3 text-[10px] text-[#9adfff]">
            <Cpu className="w-3 h-3 text-[#18b6f6]" />
            <span>Python 3 Virtual Environment Ready</span>
          </div>
        </div>
      </div>
    );
  }

  if (selectedFile.content === "BINARY_DB_FILE" || selectedFile.content === "BINARY_FILE") {
    const isDatabaseFile = selectedFile.content === "BINARY_DB_FILE";
    return (
      <div className="flex h-full w-full select-none flex-col items-center justify-center overflow-y-auto bg-[#09101c] p-8 text-center">
        <div className="max-w-md w-full flex flex-col items-center gap-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#18b6f6]/20 bg-[#18b6f6]/10 text-[#18b6f6] shadow-lg shadow-[#18b6f6]/5">
            <Database className="w-8 h-8" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <h2 className="text-lg font-bold text-slate-100 m-0">{selectedFile.name}</h2>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              {isDatabaseFile
                ? "This is a binary SQLite database file. It cannot be opened or edited as a text file."
                : "This is a binary file. It cannot be opened or edited as a text file."}
            </p>
            {isDatabaseFile ? (
              <p className="text-[11px] text-slate-500 max-w-xs leading-normal">
                Please use the <strong>Database Viewer</strong> panel in the bottom tab to inspect its schema, run SQL queries, and browse its tables.
              </p>
            ) : (
              <p className="text-[11px] text-slate-500 max-w-xs leading-normal">
                Open the source file instead, or run the binary from the terminal if that is what you intended.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <CodeEditor
        onSave={onSave}
        onDraftChange={onDraftChange}
        selectedFile={selectedFile}
        onSaveStatus={onSaveStatus}
      />
    </div>
  );
};
