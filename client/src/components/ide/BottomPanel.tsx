import {
  Terminal as TermIcon,
  MonitorPlay,
  TerminalSquare,
  Database as DbIcon,
} from "lucide-react";
import { type Socket } from "socket.io-client";
import { TerminalManager as Terminal } from "../terminal";
import { Output } from "../output";
import { DatabaseViewer } from "./DatabaseViewer";

type BottomTab = "terminal" | "preview" | "output" | "database";

interface BottomPanelProps {
  activeTab: BottomTab;
  onTabChange: (tab: BottomTab) => void;
  height: number;
  onResizeMouseDown: (e: React.MouseEvent) => void;
  socket: Socket | null;
  runOutput: string;
  onClearOutput: () => void;
  runnerBaseUrl: string | null;
  runnerStarting: boolean;
  runnerError: string;
  projectId: string;
  workspaceId: string;
}

export function BottomPanel({
  activeTab,
  onTabChange,
  height,
  onResizeMouseDown,
  socket,
  runOutput,
  onClearOutput,
  runnerBaseUrl,
  runnerStarting,
  runnerError,
  projectId,
  workspaceId,
}: BottomPanelProps) {
  const runnerStatusText = runnerStarting
    ? "Starting runtime..."
    : runnerError
      ? `Runtime unavailable: ${runnerError}`
      : "Runtime has not been started. Click Run to start it.";

  return (
    <>
      {/* Vertical resize handle */}
      <div
        onMouseDown={onResizeMouseDown}
        role="separator"
        aria-label="Resize terminal panel"
        className="h-1 shrink-0 cursor-row-resize bg-transparent hover:bg-indigo-500 border-t border-slate-900 hover:border-indigo-500 hover:shadow-[0_0_8px_rgba(99,102,241,0.5)] transition-all duration-150"
        title="Drag to resize bottom panel"
      />

      {/* Panel container */}
      <div
        style={{ height }}
        className="shrink-0 flex flex-col bg-[#070b13] border-t border-slate-900 z-10"
      >
        {/* Tab bar */}
        <div className="flex items-center bg-[#0b0f19] border-b border-slate-900 h-9 px-3 gap-1 shrink-0">
          <TabButton
            id="tab-terminal"
            panelId="panel-terminal"
            label="Terminal"
            icon={<TermIcon className="w-3.5 h-3.5" aria-hidden="true" />}
            active={activeTab === "terminal"}
            activeClass="border-indigo-500 text-indigo-300 bg-indigo-950/10"
            onClick={() => onTabChange("terminal")}
          />
          <TabButton
            id="tab-output"
            panelId="panel-output"
            label="Output"
            icon={<MonitorPlay className="w-3.5 h-3.5" aria-hidden="true" />}
            active={activeTab === "output"}
            activeClass="border-amber-500 text-amber-300 bg-amber-950/10"
            onClick={() => onTabChange("output")}
          />
          <TabButton
            id="tab-preview"
            panelId="panel-preview"
            label="App Preview"
            icon={<TerminalSquare className="w-3.5 h-3.5" aria-hidden="true" />}
            active={activeTab === "preview"}
            activeClass="border-indigo-500 text-indigo-300 bg-indigo-950/10"
            onClick={() => onTabChange("preview")}
          />
          <TabButton
            id="tab-database"
            panelId="panel-database"
            label="Database Viewer"
            icon={<DbIcon className="w-3.5 h-3.5" aria-hidden="true" />}
            active={activeTab === "database"}
            activeClass="border-amber-500 text-amber-300 bg-amber-950/10"
            onClick={() => onTabChange("database")}
          />
        </div>

        {/* Tab panels */}
        <div className="flex-1 overflow-hidden relative">
          {/* Terminal panel */}
          <div
            id="panel-terminal"
            role="tabpanel"
            aria-labelledby="tab-terminal"
            className={`absolute inset-0 ${activeTab === "terminal" ? "block" : "hidden"}`}
          >
            {socket ? (
              <Terminal socket={socket} />
            ) : (
              <IdlePanel message={runnerStatusText} />
            )}
          </div>

          {/* Output panel */}
          <div
            id="panel-output"
            role="tabpanel"
            aria-labelledby="tab-output"
            className={`absolute inset-0 flex flex-col ${activeTab === "output" ? "flex" : "hidden"}`}
          >
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#0b0f19] border-b border-slate-900 shrink-0">
              <div className="flex items-center gap-2">
                <MonitorPlay className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-semibold text-slate-300">Run Output</span>
              </div>
              <button
                onClick={onClearOutput}
                className="text-[10px] text-slate-500 hover:text-slate-300 px-2 py-0.5 rounded hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Clear
              </button>
            </div>
            <pre className="flex-1 overflow-auto p-3 font-mono text-[12px] leading-relaxed text-slate-200 bg-[#070b13] whitespace-pre-wrap break-words">
              {runOutput || (
                <span className="text-slate-600 italic">
                  No output yet — click Run or use the terminal.
                </span>
              )}
            </pre>
          </div>

          {/* App Preview panel */}
          <div
            id="panel-preview"
            role="tabpanel"
            aria-labelledby="tab-preview"
            className={`absolute inset-0 ${activeTab === "preview" ? "block" : "hidden"}`}
          >
            {runnerBaseUrl ? (
              <Output runnerBaseUrl={runnerBaseUrl} projectId={projectId} />
            ) : (
              <IdlePanel message={runnerStatusText} />
            )}
          </div>

          {/* Database Viewer panel */}
          <div
            id="panel-database"
            role="tabpanel"
            aria-labelledby="tab-database"
            className={`absolute inset-0 ${activeTab === "database" ? "block" : "hidden"}`}
          >
            {runnerBaseUrl ? (
              <DatabaseViewer runnerBaseUrl={runnerBaseUrl} projectId={projectId} workspaceId={workspaceId} />
            ) : (
              <IdlePanel message={runnerStatusText} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function IdlePanel({ message }: { message: string }) {
  return (
    <div className="h-full w-full flex items-center justify-center bg-[#070b13] text-center p-6">
      <p className="max-w-md text-sm text-slate-500">{message}</p>
    </div>
  );
}

// ─── Internal tab button ───────────────────────────────────────────────────────
interface TabButtonProps {
  id: string;
  panelId: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  activeClass: string;
  onClick: () => void;
}

function TabButton({ id, panelId, label, icon, active, activeClass, onClick }: TabButtonProps) {
  return (
    <button
      id={id}
      onClick={onClick}
      role="tab"
      aria-selected={active}
      aria-controls={panelId}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-md text-xs font-semibold border-b-2 cursor-pointer transition-all duration-150 outline-none ${
        active ? activeClass : "border-transparent text-slate-500 hover:text-slate-300"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
