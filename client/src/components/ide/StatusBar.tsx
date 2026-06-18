import { type File } from "../external/editor/utils/file-manager";

interface StatusBarProps {
  projectLabel: string;
  selectedFile: File | undefined;
}

export function StatusBar({ projectLabel, selectedFile }: StatusBarProps) {
  return (
    <footer className="z-20 flex h-7 shrink-0 items-center justify-between border-t border-white/6 bg-[#0a1020] px-4 select-none">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-200">
          <span
            className="pulse-indicator h-1.5 w-1.5 rounded-full bg-emerald-400"
            aria-hidden="true"
          />
          <span>Sandbox Connected</span>
        </div>
        <span className="text-slate-600 text-[10px]">&bull;</span>
        <span className="font-mono text-[10px] text-slate-400">{projectLabel}</span>
      </div>
      {selectedFile && (
        <div className="hidden items-center text-[10px] font-mono text-slate-500 sm:flex">
          {selectedFile.path}
        </div>
      )}
    </footer>
  );
}
