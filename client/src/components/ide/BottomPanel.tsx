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
    ? "Starting workspace runtime..."
    : runnerError
      ? `Runtime unavailable: ${runnerError}`
      : "Workspace runtime is not ready yet.";

  return (
    <>
      <div
        onMouseDown={onResizeMouseDown}
        role="separator"
        aria-label="Resize terminal panel"
        className="h-1 shrink-0 cursor-row-resize bg-transparent border-t border-white/6 transition-all duration-150 hover:border-[#18b6f6] hover:bg-[#18b6f6]/50 hover:shadow-[0_0_10px_rgba(24,182,246,0.35)]"
        title="Drag to resize bottom panel"
      />

      <div
        style={{ height }}
        className="z-10 flex shrink-0 flex-col border-t border-white/6 bg-[#08101d]"
      >
        <div className="flex h-11 shrink-0 items-center gap-1 border-b border-white/6 bg-[#0d1321]/96 px-3">
          <TabButton
            id="tab-terminal"
            panelId="panel-terminal"
            label="Terminal"
            icon={<TermIcon className="w-3.5 h-3.5" aria-hidden="true" />}
            active={activeTab === "terminal"}
            activeClass="border-[#18b6f6] text-[#9adfff] bg-[#18b6f6]/10"
            onClick={() => onTabChange("terminal")}
          />
          <TabButton
            id="tab-output"
            panelId="panel-output"
            label="Output"
            icon={<MonitorPlay className="w-3.5 h-3.5" aria-hidden="true" />}
            active={activeTab === "output"}
            activeClass="border-[#f59e0b] text-[#ffd28b] bg-[#f59e0b]/10"
            onClick={() => onTabChange("output")}
          />
          <TabButton
            id="tab-preview"
            panelId="panel-preview"
            label="App Preview"
            icon={<TerminalSquare className="w-3.5 h-3.5" aria-hidden="true" />}
            active={activeTab === "preview"}
            activeClass="border-[#7c5cff] text-[#c2b7ff] bg-[#7c5cff]/10"
            onClick={() => onTabChange("preview")}
          />
          <TabButton
            id="tab-database"
            panelId="panel-database"
            label="Database Viewer"
            icon={<DbIcon className="w-3.5 h-3.5" aria-hidden="true" />}
            active={activeTab === "database"}
            activeClass="border-[#f59e0b] text-[#ffd28b] bg-[#f59e0b]/10"
            onClick={() => onTabChange("database")}
          />
        </div>

        <div className="flex-1 overflow-hidden relative">
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
            <div className="flex shrink-0 items-center justify-between border-b border-white/6 bg-[#0d1321]/96 px-3 py-2">
              <div className="flex items-center gap-2">
                <MonitorPlay className="w-3.5 h-3.5 text-[#f59e0b]" />
                <span className="text-xs font-semibold text-slate-300">Run Output</span>
              </div>
              <button
                onClick={onClearOutput}
                className="cursor-pointer rounded-full px-2.5 py-1 text-[10px] text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-slate-300"
              >
                Clear
              </button>
            </div>
            <pre className="flex-1 overflow-auto whitespace-pre-wrap break-words bg-[#08101d] p-4 font-mono text-[12px] leading-relaxed text-slate-200">
              {runOutput || (
                <span className="text-slate-600 italic">
                  No output yet — click Run or use the terminal.
                </span>
              )}
            </pre>
          </div>

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
    <div className="flex h-full w-full items-center justify-center bg-[#08101d] p-6 text-center">
      <p className="max-w-md text-sm text-slate-500">{message}</p>
    </div>
  );
}

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
      className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-150 outline-none ${
        active ? activeClass : "border-transparent text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
