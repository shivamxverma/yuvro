import { useEffect, useMemo } from "react";
import { Code as CodeEditor } from "./external/editor/editor/code";
import { type File, buildFileTree, type RemoteFile } from "./external/editor/utils/file-manager";
import { type Socket } from "socket.io-client";
import { 
  Terminal, 
  Keyboard, 
  Cpu, 
  Play, 
  Eye, 
  PlusSquare
} from 'lucide-react';

export const Editor = ({
  files,
  onSelect,
  selectedFile,
  socket
}: {
  files: RemoteFile[];
  onSelect: (file: File) => void;
  selectedFile: File | undefined;
  socket: Socket;
}) => {
  const rootDir = useMemo(() => {
    return buildFileTree(files);
  }, [files]);

  useEffect(() => {
    if (!selectedFile && rootDir && rootDir.files && rootDir.files.length > 0) {
      onSelect(rootDir.files[0]);
    }
  }, [selectedFile, rootDir, onSelect]);

  if (!selectedFile) {
    return (
      <div className="w-full h-full bg-[#030712] flex flex-col items-center justify-center p-8 text-center select-none overflow-y-auto">
        <div className="max-w-md w-full flex flex-col items-center gap-6">
          
          {/* Logo & Welcome Header */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white font-extrabold text-2xl shadow-lg shadow-indigo-500/10 mb-2">
              Y
            </div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2 m-0">
              Welcome to Yuvro Workspace
            </h2>
            <p className="text-xs text-slate-500">
              Select a file from the explorer sidebar to begin coding, or use the quick links below.
            </p>
          </div>

          {/* Quick Actions Grid */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-left mt-2">
            <div className="p-3.5 rounded-xl border border-slate-900 bg-slate-950/40 hover:bg-slate-900/10 transition duration-150">
              <div className="flex items-center gap-2.5 text-indigo-400">
                <Play className="w-4 h-4" />
                <span className="text-xs font-bold text-slate-200">Run Your Code</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                Click the <span className="text-emerald-400 font-semibold">Run</span> button in the top navbar to execute the active python script in your container.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-900 bg-slate-950/40 hover:bg-slate-900/10 transition duration-150">
              <div className="flex items-center gap-2.5 text-indigo-400">
                <Eye className="w-4 h-4" />
                <span className="text-xs font-bold text-slate-200">Live Preview</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                Start a server (e.g. FastAPI/Django) and toggle the <span className="text-indigo-400 font-semibold">App Preview</span> tab to view web pages in real-time.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-900 bg-slate-950/40 hover:bg-slate-900/10 transition duration-150">
              <div className="flex items-center gap-2.5 text-indigo-400">
                <PlusSquare className="w-4 h-4" />
                <span className="text-xs font-bold text-slate-200">Create Files</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                Use the icons in the explorer sidebar to create new files or subfolders for python, HTML, or JSON.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-900 bg-slate-950/40 hover:bg-slate-900/10 transition duration-150">
              <div className="flex items-center gap-2.5 text-indigo-400">
                <Terminal className="w-4 h-4" />
                <span className="text-xs font-bold text-slate-200">Interactive Terminal</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                Direct shell access is available via the bottom terminal pane for pip installs and testing commands.
              </p>
            </div>
          </div>

          {/* Keyboard Shortcuts Cheat Sheet */}
          <div className="w-full bg-slate-950/60 border border-slate-900/80 rounded-xl p-4 text-left">
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
              <Keyboard className="w-3.5 h-3.5 text-indigo-400" />
              <span>Keyboard Shortcuts</span>
            </div>
            <div className="grid grid-cols-2 gap-y-2 gap-x-6">
              <div className="flex items-center justify-between text-xs text-slate-400 py-0.5">
                <span>Save file content</span>
                <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-[10px] font-mono text-slate-300">Ctrl&nbsp;+&nbsp;S</kbd>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400 py-0.5">
                <span>Focus Terminal</span>
                <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-[10px] font-mono text-slate-300">Ctrl&nbsp;+&nbsp;`</kbd>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400 py-0.5">
                <span>Search settings</span>
                <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-[10px] font-mono text-slate-300">Ctrl&nbsp;+&nbsp;,</kbd>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400 py-0.5">
                <span>Command palette</span>
                <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-[10px] font-mono text-slate-300">F1</kbd>
              </div>
            </div>
          </div>

          {/* Environment status bar info */}
          <div className="flex items-center gap-2 p-2 px-3 rounded-full bg-indigo-950/30 border border-indigo-500/10 text-[10px] text-indigo-300/80">
            <Cpu className="w-3 h-3 text-indigo-400" />
            <span>Python 3 Virtual Environment Ready</span>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <CodeEditor socket={socket} selectedFile={selectedFile} />
    </div>
  );
};
