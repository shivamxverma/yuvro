import { Play, Eye, CheckCircle2, Loader2 } from "lucide-react";
import { type File } from "../external/editor/utils/file-manager";

interface TopNavbarProps {
  replId: string;
  selectedFile: File | undefined;
  saveStatus: "idle" | "saving" | "saved";
  bottomTab: "terminal" | "preview" | "output" | "database";
  onRun: () => void;
  onTogglePreview: () => void;
}

export function TopNavbar({
  replId,
  selectedFile,
  saveStatus,
  bottomTab,
  onRun,
  onTogglePreview,
}: TopNavbarProps) {
  return (
    <header className="h-12 bg-[#0b0f19] border-b border-slate-900 flex items-center justify-between px-4 shrink-0 z-20">
      {/* Left: branding + breadcrumb */}
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white font-extrabold text-[11px] shadow-md shadow-indigo-600/10 select-none">
          Y
        </div>
        <span className="text-slate-700 text-xs">/</span>
        <span className="text-slate-400 text-xs font-mono font-semibold max-w-[120px] truncate">
          {replId}
        </span>
        {selectedFile && (
          <>
            <span className="text-slate-700 text-xs">/</span>
            <span className="text-slate-200 text-xs font-mono font-medium truncate max-w-[180px]">
              {selectedFile.name}
            </span>
          </>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2.5">
        {/* Save status indicator */}
        {saveStatus !== "idle" && (
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all duration-300 ${
              saveStatus === "saving"
                ? "text-amber-400 bg-amber-950/30 border border-amber-500/20"
                : "text-emerald-400 bg-emerald-950/30 border border-emerald-500/20"
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

        {/* Run button */}
        <button
          onClick={onRun}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 border border-emerald-500/10 text-white text-[11px] font-bold tracking-wide rounded-md shadow-lg shadow-emerald-500/10 cursor-pointer transition duration-150 focus-visible:ring-2 focus-visible:ring-emerald-500 outline-none active:scale-[0.98]"
        >
          <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
          <span>Run</span>
        </button>

        {/* App Preview toggle */}
        <button
          onClick={onTogglePreview}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-semibold tracking-wide rounded-md border cursor-pointer transition duration-150 focus-visible:ring-2 focus-visible:ring-indigo-500 outline-none ${
            bottomTab === "preview"
              ? "bg-indigo-950/20 text-indigo-300 border-indigo-500/40 shadow-sm"
              : "bg-slate-900/40 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700"
          }`}
        >
          <Eye className="w-3.5 h-3.5" aria-hidden="true" />
          <span>App Preview</span>
        </button>
      </div>
    </header>
  );
}
