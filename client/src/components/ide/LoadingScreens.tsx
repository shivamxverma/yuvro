import { Cpu } from "lucide-react";

/** Shown while the container/pod is being spun up */
export function BootingScreen() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-5 overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(24,182,246,0.14),_transparent_28%),#09101c]">
      <div className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#18b6f6]/10 blur-[80px]" />

      <div className="relative">
        <div className="h-10 w-10 rounded-full border-3 border-[#18b6f6]/20 border-t-[#18b6f6] animate-spin" />
        <Cpu className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 text-[#18b6f6]" />
      </div>

      <div className="flex flex-col items-center gap-1.5 z-10">
        <span className="text-slate-200 font-semibold text-sm">
          Initializing workspace…
        </span>
        <span className="text-slate-500 font-mono text-[10px] tracking-wider uppercase">
          Spinning up sandboxed environment
        </span>
      </div>
    </div>
  );
}

/** Shown while the socket connects and loads the workspace */
export function WorkspaceLoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#09101c]">
      <div className="h-8 w-8 rounded-full border-2 border-[#18b6f6]/20 border-t-[#18b6f6] animate-spin" />
      <span className="text-slate-400 font-medium text-xs">
        Loading workspace…
      </span>
    </div>
  );
}
