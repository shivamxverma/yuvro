import { useEffect, useRef, useState } from "react";
import { type Socket, io } from 'socket.io-client';
import { useSearchParams } from 'react-router-dom';
import axios from "axios";
import { type File, type RemoteFile, Type } from "./external/editor/utils/file-manager";
import { Editor } from "./editor";
import { Output } from "./output";
import { TerminalManager as Terminal } from "./terminal";
import { 
  Play, 
  Eye, 
  Terminal as TermIcon, 
  File as FileIcon, 
  Folder, 
  FolderOpen, 
  ChevronRight, 
  ChevronDown, 
  FilePlus, 
  FolderPlus, 
  Trash2, 
  Cpu,
  FolderTree,
  TerminalSquare
} from 'lucide-react';

// ─── File extension → color helper ───────────────────────────────────────────
function fileColor(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    py: '#38bdf8', // Light blue
    ts: '#60a5fa', // Blue
    tsx: '#60a5fa', 
    js: '#fbbf24', // Amber
    jsx: '#fbbf24',
    css: '#c084fc', // Purple
    html: '#f97316', // Orange
    json: '#34d399', // Emerald
    md: '#94a3b8', // Slate
    txt: '#94a3b8',
    yml: '#f472b6', // Pink
    yaml: '#f472b6',
    env: '#fb7185', // Rose
  };
  return map[ext ?? ''] ?? '#94a3b8';
}

// ─── Socket hook ─────────────────────────────────────────────────────────────
function useSocket(replId: string, port: number | null) {
  const [socket, setSocket] = useState<Socket | null>(null);
  useEffect(() => {
    if (!port) return;
    const s = io(`ws://${replId}.localhost:${port}`);
    setSocket(s);
    return () => { s.disconnect(); };
  }, [replId, port]);
  return socket;
}

// ─── Resize hook ──────────────────────────────────────────────────────────────
function useResize(
  direction: 'horizontal' | 'vertical',
  initialSize: number,
  min: number,
  max: number
) {
  const [size, setSize] = useState(initialSize);
  const dragging = useRef(false);
  const startPos = useRef(0);
  const startSize = useRef(0);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startPos.current = direction === 'horizontal' ? e.clientX : e.clientY;
    startSize.current = size;
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = direction === 'horizontal'
        ? e.clientX - startPos.current
        : startPos.current - e.clientY; // drag up = bigger
      const next = Math.min(max, Math.max(min, startSize.current + delta));
      setSize(next);
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [direction, min, max]);

  return { size, onMouseDown };
}

// ─── Single file tree node ────────────────────────────────────────────────────
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

function FileNode({ file, depth, allFiles, selectedPath, onSelect, onDelete, expandedDirs, onToggleDir }: FileNodeProps) {
  const [hovered, setHovered] = useState(false);
  const isDir = file.type === 'dir';
  const isOpen = expandedDirs.has(file.path);
  const children = allFiles.filter(f => {
    const parent = f.path.includes('/') ? f.path.substring(0, f.path.lastIndexOf('/')) : '';
    return parent === file.path;
  });

  const isSelected = selectedPath === file.path;

  return (
    <>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => {
          if (isDir) {
            onToggleDir(file.path);
            onSelect(file as unknown as File);
          } else {
            onSelect(file as unknown as File);
          }
        }}
        tabIndex={0}
        role="button"
        aria-selected={isSelected}
        aria-label={`${isDir ? 'Folder' : 'File'} ${file.name}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (isDir) {
              onToggleDir(file.path);
              onSelect(file as unknown as File);
            } else {
              onSelect(file as unknown as File);
            }
          }
        }}
        className={`group flex items-center gap-2 px-2.5 py-1.5 cursor-pointer rounded-lg mb-0.5 text-xs select-none transition-all duration-150 focus-visible:ring-2 focus-visible:ring-indigo-500/80 outline-none ${
          isSelected 
            ? 'bg-indigo-950/30 text-indigo-300 border-l-2 border-indigo-500 shadow-sm' 
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
        }`}
        style={{ paddingLeft: `${10 + depth * 14}px` }}
      >
        {isDir ? (
          <span className="text-slate-500/80 group-hover:text-slate-400/90 transition-colors flex-shrink-0">
            {isOpen ? <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" /> : <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />}
          </span>
        ) : (
          <span className="w-3.5 h-3.5" aria-hidden="true" />
        )}
        
        <span className="flex-shrink-0" style={{ color: isDir ? '#f59e0b' : fileColor(file.name) }}>
          {isDir ? (
            isOpen ? <FolderOpen className="w-3.5 h-3.5" aria-hidden="true" /> : <Folder className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <FileIcon className="w-3.5 h-3.5" aria-hidden="true" />
          )}
        </span>
        
        <span className="flex-1 truncate font-mono text-[12px]">{file.name}</span>
        
        {hovered && (
          <button
            onClick={e => { e.stopPropagation(); onDelete(file.path); }}
            aria-label={`Delete ${file.name}`}
            title="Delete item"
            className="text-red-400/70 hover:text-red-400 p-0.5 bg-slate-950/20 hover:bg-slate-950/50 rounded flex-shrink-0 transition duration-150 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
      {isDir && isOpen && children.map(child => (
        <FileNode key={child.path} file={child} depth={depth + 1} allFiles={allFiles}
          selectedPath={selectedPath} onSelect={onSelect} onDelete={onDelete}
          expandedDirs={expandedDirs} onToggleDir={onToggleDir} />
      ))}
    </>
  );
}

// ─── Sidebar file explorer ────────────────────────────────────────────────────
interface SidebarProps {
  files: RemoteFile[];
  selectedPath: string | undefined;
  replId: string;
  onSelect: (f: File) => void;
  onCreate: (type: 'file' | 'folder', name: string, parentPath: string) => void;
  onDelete: (path: string) => void;
}

function Sidebar({ files, selectedPath, replId, onSelect, onCreate, onDelete }: SidebarProps) {
  const [creating, setCreating] = useState<{ type: 'file' | 'folder' } | null>(null);
  const [inputVal, setInputVal] = useState('');
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (creating) setTimeout(() => inputRef.current?.focus(), 50); }, [creating]);

  const rootFiles = files.filter(f => !f.path.includes('/'));

  const handleCreate = () => {
    if (!inputVal.trim()) { setCreating(null); return; }
    onCreate(creating!.type, inputVal.trim(), '');
    setInputVal(''); setCreating(null);
  };

  const toggleDir = (path: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  return (
    <div className="w-full h-full bg-[#0b0f19] border-r border-slate-900 flex flex-col shrink-0">
      {/* Explorer header */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-slate-900">
        <div className="flex items-center gap-2">
          <FolderTree className="w-3.5 h-3.5 text-indigo-400" aria-hidden="true" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Explorer</span>
        </div>
        <div className="flex gap-1.5">
          <button 
            onClick={() => { setCreating({ type: 'file' }); setInputVal(''); }}
            aria-label="New File"
            title="New File"
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-md cursor-pointer transition duration-150 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <FilePlus className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button 
            onClick={() => { setCreating({ type: 'folder' }); setInputVal(''); }}
            aria-label="New Folder"
            title="New Folder"
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-md cursor-pointer transition duration-150 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <FolderPlus className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Project label */}
      <div className="px-3.5 py-2 text-xs font-semibold text-slate-500 flex items-center gap-2 select-none">
        <FolderOpen className="w-3.5 h-3.5 text-amber-500/80" aria-hidden="true" />
        <span className="truncate font-mono">{replId}</span>
      </div>

      {/* New file/folder input */}
      {creating && (
        <div className="px-3 py-1.5">
          <div className="flex items-center gap-2 bg-slate-950 border border-indigo-500/50 rounded-lg px-2.5 py-1.5">
            <span className="shrink-0 text-slate-400">
              {creating.type === 'folder' ? <Folder className="w-3.5 h-3.5" /> : <FileIcon className="w-3.5 h-3.5" />}
            </span>
            <input
              ref={inputRef}
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(null); }}
              onBlur={handleCreate}
              spellCheck={false}
              autoComplete="off"
              placeholder={creating.type === 'folder' ? 'folder name…' : 'file name…'}
              className="flex-1 bg-transparent border-none outline-none text-slate-200 text-xs min-w-0 font-mono"
            />
          </div>
        </div>
      )}

      {/* File tree */}
      <div className="flex-1 overflow-y-auto px-2 py-2 pb-6">
        {rootFiles.length === 0 && !creating ? (
          <div className="text-center text-[11px] text-slate-600 mt-6 font-medium">
            Empty Workspace
          </div>
        ) : (
          rootFiles.map(f => (
            <FileNode key={f.path} file={f} depth={0} allFiles={files}
              selectedPath={selectedPath} onSelect={onSelect} onDelete={onDelete}
              expandedDirs={expandedDirs} onToggleDir={toggleDir} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Booting screen ───────────────────────────────────────────────────────────
export const CodingPage = () => {
  const [podCreated, setPodCreated] = useState(false);
  const [runnerPort, setRunnerPort] = useState<number | null>(null);
  const [searchParams] = useSearchParams();
  const replId = searchParams.get('replId') ?? '';

  useEffect(() => {
    if (replId) {
      axios.post(`http://localhost:3002/start`, { replId })
        .then((res) => {
          const port = res.data.port;
          setRunnerPort(port || 3002);
          setPodCreated(true);
        })
        .catch(err => {
          console.error(err);
          // Fallback to 3002 if things fail
          setRunnerPort(3002);
          setPodCreated(true);
        });
    }
  }, [replId]);

  if (!podCreated || !runnerPort) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#030712] gap-5 relative overflow-hidden">
        {/* Glow orbs background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-indigo-500/10 blur-[80px]" />
        
        <div className="relative">
          <div className="w-10 h-10 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          <Cpu className="w-4 h-4 text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <div className="flex flex-col items-center gap-1.5 z-10">
          <span className="text-slate-200 font-semibold text-sm">Initializing workspace…</span>
          <span className="text-slate-500 font-mono text-[10px] tracking-wider uppercase">Spinning up sandboxed environment</span>
        </div>
      </div>
    );
  }
  return <CodingPagePostPodCreation runnerPort={runnerPort} />;
};

// ─── Main IDE ─────────────────────────────────────────────────────────────────
export const CodingPagePostPodCreation = ({ runnerPort }: { runnerPort: number }) => {
  const [searchParams] = useSearchParams();
  const replId = searchParams.get('replId') ?? '';
  const [loaded, setLoaded] = useState(false);
  const socket = useSocket(replId, runnerPort);
  const [fileStructure, setFileStructure] = useState<RemoteFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | undefined>(undefined);
  const [bottomTab, setBottomTab] = useState<'terminal' | 'preview'>('terminal');

  // ── resize hooks
  const sidebar = useResize('horizontal', 230, 150, 420);
  const terminal = useResize('vertical', 240, 100, 600);

  // ── socket events
  useEffect(() => {
    if (!socket) return;
    socket.on('loaded', ({ rootContent }: { rootContent: RemoteFile[] }) => {
      setLoaded(true);
      setFileStructure(rootContent);
    });
    return () => { socket.off('loaded'); };
  }, [socket]);

  // ── file tree helpers
  const mergeFiles = (incoming: RemoteFile[]) => {
    setFileStructure(prev => {
      const map = new Map(prev.map(f => [f.path, f]));
      incoming.forEach(f => map.set(f.path, f));
      return Array.from(map.values());
    });
  };

  const removeFiles = (removedPaths: RemoteFile[]) => {
    const removed = new Set(removedPaths.map(f => f.path));
    setFileStructure(prev => prev.filter(f => !removed.has(f.path)));
  };

  const onSelect = (file: File) => {
    if (file.type === Type.DIRECTORY) {
      socket?.emit("fetchDir", file.path, (data: RemoteFile[]) => mergeFiles(data));
    } else {
      socket?.emit("fetchContent", { path: file.path }, (data: string) => {
        setSelectedFile({ ...file, content: data });
      });
    }
  };

  const onCreate = (type: 'file' | 'folder', name: string, parentPath: string) => {
    const fullPath = parentPath ? `${parentPath}/${name}` : name;
    const event = type === 'file' ? 'createFile' : 'createFolder';
    socket?.emit(event, { path: fullPath }, (res: { success: boolean; dirContents: RemoteFile[] }) => {
      if (res?.success) mergeFiles(res.dirContents);
    });
  };

  const onDelete = (path: string) => {
    socket?.emit('deletePath', { path }, (res: { success: boolean; dirContents: RemoteFile[] }) => {
      if (res?.success) {
        removeFiles(res.dirContents);
        setFileStructure(prev => prev.filter(f => f.path !== path && !f.path.startsWith(path + '/')));
        if (selectedFile?.path === path) setSelectedFile(undefined);
      }
    });
  };

  // ── run logic
  const getRunCommand = (): string => {
    if (selectedFile) return `.venv/bin/python ${selectedFile.path}`;
    const lowerReplId = replId.toLowerCase();
    if (lowerReplId.startsWith("fastapi")) return ".venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload";
    if (lowerReplId.startsWith("django")) return ".venv/bin/python manage.py runserver 0.0.0.0:8000";
    if (lowerReplId.startsWith("flask")) return ".venv/bin/python app.py";
    const root = fileStructure.filter(f => f.type === "file" && !f.path.includes("/"));
    if (root.some(f => f.name === "manage.py")) return ".venv/bin/python manage.py runserver 0.0.0.0:8000";
    if (root.some(f => f.name === "app.py")) return ".venv/bin/python app.py";
    return ".venv/bin/python main.py";
  };

  const handleRun = () => {
    if (!socket) return;
    socket.emit("terminalData", { data: "\x03" });
    setTimeout(() => {
      const cmd = `.venv/bin/pip install -r requirements.txt -q 2>/dev/null; ${getRunCommand()}`;
      socket.emit("terminalData", { data: `${cmd}\n` });
    }, 300);
  };

  if (!loaded) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#030712] gap-4">
        <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        <span className="text-slate-400 font-medium text-xs">Loading workspace…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-screen h-screen bg-[#030712] text-slate-100 font-sans overflow-hidden">

      {/* ── Top Navbar */}
      <header className="h-12 bg-[#0b0f19] border-b border-slate-900 flex items-center justify-between px-4 shrink-0 z-20">
        {/* Left branding and file breadcrumbs */}
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white font-extrabold text-[11px] shadow-md shadow-indigo-600/10 select-none">
            Y
          </div>
          <span className="text-slate-700 text-xs">/</span>
          <span className="text-slate-400 text-xs font-mono font-semibold max-w-[120px] truncate">{replId}</span>
          {selectedFile && (
            <>
              <span className="text-slate-700 text-xs">/</span>
              <span className="text-slate-200 text-xs font-mono font-medium truncate max-w-[180px]">{selectedFile.name}</span>
            </>
          )}
        </div>

        {/* Right buttons action group */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRun}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 border border-emerald-500/10 text-white text-[11px] font-bold tracking-wide rounded-md shadow-lg shadow-emerald-500/10 cursor-pointer transition duration-150 focus-visible:ring-2 focus-visible:ring-emerald-500 outline-none active:scale-[0.98]"
          >
            <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
            <span>Run</span>
          </button>
          <button
            onClick={() => setBottomTab(t => t === 'preview' ? 'terminal' : 'preview')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-semibold tracking-wide rounded-md border cursor-pointer transition duration-150 focus-visible:ring-2 focus-visible:ring-indigo-500 outline-none ${
              bottomTab === 'preview'
                ? 'bg-indigo-950/20 text-indigo-300 border-indigo-500/40 shadow-sm'
                : 'bg-slate-900/40 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
            <span>App Preview</span>
          </button>
        </div>
      </header>

      {/* ── Main Workspace Body */}
      <main className="flex-1 flex overflow-hidden relative">

        {/* Sidebar & Explorer */}
        {socket && (
          <>
            <div style={{ width: sidebar.size, minWidth: sidebar.size }} className="shrink-0 flex">
              <Sidebar
                files={fileStructure}
                selectedPath={selectedFile?.path}
                replId={replId}
                onSelect={onSelect}
                onCreate={onCreate}
                onDelete={onDelete}
              />
            </div>
            
            {/* Horizontal Resize handle */}
            <div
              onMouseDown={sidebar.onMouseDown}
              role="separator"
              aria-label="Resize sidebar explorer"
              className="w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-indigo-500 border-r border-slate-900 hover:border-indigo-500 hover:shadow-[0_0_8px_rgba(99,102,241,0.5)] transition-all duration-150 group"
              title="Drag to resize sidebar"
            />
          </>
        )}

        {/* Editor + bottom panels */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">

          {/* Editor Area */}
          <div className="flex-1 overflow-hidden relative">
            {socket ? (
              <Editor socket={socket} selectedFile={selectedFile} onSelect={onSelect} files={fileStructure} />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 font-medium text-xs">
                Connecting to editor service…
              </div>
            )}
          </div>

          {/* Vertical Resize handle */}
          <div
            onMouseDown={terminal.onMouseDown}
            role="separator"
            aria-label="Resize terminal panel"
            className="h-1 shrink-0 cursor-row-resize bg-transparent hover:bg-indigo-500 border-t border-slate-900 hover:border-indigo-500 hover:shadow-[0_0_8px_rgba(99,102,241,0.5)] transition-all duration-150"
            title="Drag to resize bottom panel"
          />

          {/* Bottom Tabs Panel */}
          <div style={{ height: terminal.size }} className="shrink-0 flex flex-col bg-[#070b13] border-t border-slate-900 z-10">
            {/* Panel Tab selector */}
            <div className="flex items-center bg-[#0b0f19] border-b border-slate-900 h-9 px-3 gap-1 shrink-0">
              <button 
                onClick={() => setBottomTab('terminal')}
                role="tab"
                aria-selected={bottomTab === 'terminal'}
                aria-controls="panel-terminal"
                id="tab-terminal"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-md text-xs font-semibold border-b-2 cursor-pointer transition-all duration-150 outline-none ${
                  bottomTab === 'terminal' 
                    ? 'border-indigo-500 text-indigo-300 bg-indigo-950/10' 
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                <TermIcon className="w-3.5 h-3.5" aria-hidden="true" /> 
                <span>Terminal</span>
              </button>
              <button 
                onClick={() => setBottomTab('preview')}
                role="tab"
                aria-selected={bottomTab === 'preview'}
                aria-controls="panel-preview"
                id="tab-preview"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-md text-xs font-semibold border-b-2 cursor-pointer transition-all duration-150 outline-none ${
                  bottomTab === 'preview' 
                    ? 'border-indigo-500 text-indigo-300 bg-indigo-950/10' 
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                <TerminalSquare className="w-3.5 h-3.5" aria-hidden="true" /> 
                <span>App Preview</span>
              </button>
            </div>

            {/* Panel Tab Panels */}
            <div className="flex-1 overflow-hidden relative">
              <div 
                id="panel-terminal"
                role="tabpanel"
                aria-labelledby="tab-terminal"
                className={`absolute inset-0 ${bottomTab === 'terminal' ? 'block' : 'hidden'}`}
              >
                {socket && <Terminal socket={socket} />}
              </div>
              <div 
                id="panel-preview"
                role="tabpanel"
                aria-labelledby="tab-preview"
                className={`absolute inset-0 ${bottomTab === 'preview' ? 'block' : 'hidden'}`}
              >
                <Output runnerPort={runnerPort} />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── Status Bar */}
      <footer className="h-6 bg-indigo-600 shrink-0 flex items-center justify-between px-4 select-none z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-white uppercase tracking-wider">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full pulse-indicator" aria-hidden="true" />
            <span>Sandbox Connected</span>
          </div>
          <span className="text-indigo-400/80 text-[10px]">&bull;</span>
          <span className="text-white/80 font-mono text-[10px]">{replId}</span>
        </div>
        {selectedFile && (
          <div className="hidden sm:flex items-center text-[10px] font-mono text-indigo-100">
            {selectedFile.path}
          </div>
        )}
      </footer>
    </div>
  );
};