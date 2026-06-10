import { Cpu } from "lucide-react";

/** Shown while the container/pod is being spun up */
export function BootingScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#030712] gap-5 relative overflow-hidden">
      {/* Glow orb background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-indigo-500/10 blur-[80px]" />

      <div className="relative">
        <div className="w-10 h-10 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        <Cpu className="w-4 h-4 text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#030712] gap-4">
      <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      <span className="text-slate-400 font-medium text-xs">
        Loading workspace…
      </span>
    </div>
  );
}
