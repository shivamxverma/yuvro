import { Play, Square, RotateCw, Eye, CheckCircle2, Loader2, Sparkles, FolderKanban } from "lucide-react";
import { type File } from "../external/editor/utils/file-manager";

interface TopNavbarProps {
  workspaceLabel: string;
  projectLabel: string;
  selectedFile: File | undefined;
  saveStatus: "idle" | "saving" | "saved";
  bottomTab: "terminal" | "preview" | "output" | "database";
  onRun: () => void;
  isRunning: boolean;
  isRunnerStarting?: boolean;
  disableRun?: boolean;
  onStop: () => void;
  onRestart: () => void;
  onTogglePreview: () => void;
}

export function TopNavbar({
  workspaceLabel,
  projectLabel,
  selectedFile,
  saveStatus,
  bottomTab,
  onRun,
  isRunning,
  isRunnerStarting = false,
  disableRun = false,
  onStop,
  onRestart,
  onTogglePreview,
}: TopNavbarProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/8 bg-[#0d1321]/96 px-5 backdrop-blur-xl z-20">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7c5cff] to-[#18b6f6] text-sm font-black text-white shadow-[0_12px_30px_rgba(24,182,246,0.2)] select-none">
          Y
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            <FolderKanban className="h-3.5 w-3.5 text-[#18b6f6]" />
            <span>{workspaceLabel || "Workspace"}</span>
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold text-white">{projectLabel}</span>
            {selectedFile ? (
              <>
                <span className="text-slate-600">/</span>
                <span className="truncate rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-xs font-mono text-slate-300">
                  {selectedFile.name}
                </span>
              </>
            ) : (
              <span className="truncate text-xs text-slate-500">No file selected</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="hidden items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3 py-2 text-[11px] font-medium text-slate-400 lg:flex">
          <Sparkles className="h-3.5 w-3.5 text-[#f59e0b]" />
          Live sandbox
        </div>

        {saveStatus !== "idle" && (
          <div
            className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-semibold transition-all duration-300 ${
              saveStatus === "saving"
                ? "border border-amber-400/20 bg-amber-500/10 text-amber-300"
                : "border border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
            }`}
          >
            {saveStatus === "saving" ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                <span>Saving…</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                <span>Saved</span>
              </>
            )}
          </div>
        )}

        {!isRunning ? (
          <button
            onClick={onRun}
            disabled={isRunnerStarting || disableRun}
            title={disableRun ? "Use the terminal for C++ projects." : undefined}
            className="flex cursor-pointer items-center gap-1.5 rounded-full border border-emerald-400/20 bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-[11px] font-bold tracking-wide text-white shadow-[0_12px_30px_rgba(16,185,129,0.18)] transition duration-150 hover:from-emerald-600 hover:to-teal-600 focus-visible:ring-2 focus-visible:ring-emerald-500 outline-none active:scale-[0.98] disabled:cursor-wait disabled:from-emerald-500/70 disabled:to-teal-500/70 disabled:active:scale-100"
          >
            {isRunnerStarting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                <span>Starting…</span>
              </>
            ) : disableRun ? (
              <>
                <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                <span>Use Terminal</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                <span>Run</span>
              </>
            )}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={onRestart}
              className="flex cursor-pointer items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-2 text-[11px] font-bold tracking-wide text-slate-300 transition duration-150 hover:border-white/16 hover:bg-white/[0.08] hover:text-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-500 outline-none"
            >
              <RotateCw className="w-3 h-3 text-indigo-400" aria-hidden="true" />
              <span>Restart</span>
            </button>
            <button
              onClick={onStop}
              className="flex cursor-pointer items-center gap-1.5 rounded-full border border-rose-400/20 bg-gradient-to-r from-rose-500 to-red-500 px-4 py-2 text-[11px] font-bold tracking-wide text-white shadow-[0_12px_30px_rgba(244,63,94,0.18)] transition duration-150 hover:from-rose-600 hover:to-red-600 focus-visible:ring-2 focus-visible:ring-rose-500 outline-none active:scale-[0.98]"
            >
              <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
              <span>Stop</span>
            </button>
          </div>
        )}

        <button
          onClick={onTogglePreview}
          className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-4 py-2 text-[11px] font-semibold tracking-wide transition duration-150 focus-visible:ring-2 focus-visible:ring-indigo-500 outline-none ${
            bottomTab === "preview"
              ? "border-indigo-400/30 bg-indigo-500/12 text-indigo-200 shadow-sm"
              : "border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/16 hover:text-slate-200"
          }`}
        >
          <Eye className="w-3.5 h-3.5" aria-hidden="true" />
          <span>App Preview</span>
        </button>
      </div>
    </header>
  );
}
