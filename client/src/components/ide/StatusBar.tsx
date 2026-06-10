import { type File } from "../external/editor/utils/file-manager";

interface StatusBarProps {
  replId: string;
  selectedFile: File | undefined;
}

export function StatusBar({ replId, selectedFile }: StatusBarProps) {
  return (
    <footer className="h-6 bg-indigo-600 shrink-0 flex items-center justify-between px-4 select-none z-20">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-white uppercase tracking-wider">
          <span
            className="w-1.5 h-1.5 bg-emerald-400 rounded-full pulse-indicator"
            aria-hidden="true"
          />
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
  );
}
