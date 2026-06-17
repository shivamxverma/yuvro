import React, { useState } from "react";
import axios from "axios";
import { Server, X, Loader2, Database } from "lucide-react";
import { ORCHESTRATOR_URL } from "../../../lib/api";

interface AddConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  workspaceId: string;
  runnerBaseUrl: string;
  onSaveConnectionSuccess: (newConnId: string) => void;
}

export function AddConnectionModal({
  isOpen,
  onClose,
  projectId,
  workspaceId,
  runnerBaseUrl,
  onSaveConnectionSuccess,
}: AddConnectionModalProps) {
  const [dbType, setDbType] = useState<"postgres" | "mysql" | "sqlite">("postgres");
  const [connName, setConnName] = useState("");
  const [hostVal, setHostVal] = useState("yuvro-db-" + projectId);
  const [portVal, setPortVal] = useState("5432");
  const [userVal, setUserVal] = useState("postgres");
  const [passVal, setPassVal] = useState("secret");
  const [dbnameVal, setDbnameVal] = useState("yuvro_db");
  const [sqlitePathVal, setSqlitePathVal] = useState("");
  const [loading, setLoading] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [error, setError] = useState("");

  const host = runnerBaseUrl;

  if (!isOpen) return null;

  const handleDbTypeChange = (type: "postgres" | "mysql" | "sqlite") => {
    setDbType(type);
    if (type === "postgres") {
      setPortVal("5432");
      setUserVal("postgres");
      setHostVal("yuvro-db-" + projectId);
    } else if (type === "mysql") {
      setPortVal("3306");
      setUserVal("root");
      setHostVal("yuvro-db-" + projectId);
    }
  };

  const handleSaveConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload: any = {
        name: connName.trim() || `${dbType.toUpperCase()}: ${dbnameVal || sqlitePathVal}`,
        type: dbType,
      };

      if (dbType === "sqlite") {
        payload.path = sqlitePathVal.trim();
      } else {
        payload.host = hostVal.trim();
        payload.port = parseInt(portVal.trim());
        payload.user = userVal.trim();
        payload.password = passVal;
        payload.database = dbnameVal.trim();
      }

      const res = await axios.post(`${host}/api/db/connections`, payload);
      const newConn = res.data.connection;
      onSaveConnectionSuccess(newConn.id);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError("Failed to save connection profile. Ensure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleProvisionContainer = async () => {
    setProvisioning(true);
    setError("");
    try {
      // POST to Orchestrator to start container on network
      const res = await axios.post(`${ORCHESTRATOR_URL}/db/start`, {
        workspaceId,
        projectId,
        engine: dbType,
      });

      const creds = res.data;
      if (creds.status === "started") {
        // Register connection details inside runner
        const registerPayload = {
          name: `Containerized ${dbType.toUpperCase()} (${projectId})`,
          type: dbType,
          host: creds.host,
          port: creds.port,
          user: creds.user,
          password: creds.password,
          database: creds.database,
        };

        const registerRes = await axios.post(`${host}/api/db/connections`, registerPayload);
        const newConn = registerRes.data.connection;
        onSaveConnectionSuccess(newConn.id);
        onClose();
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || err.message || "Failed to spin up database container.");
    } finally {
      setProvisioning(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0b0f19] border border-slate-800 rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in flex flex-col max-h-[90%]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-900 shrink-0">
          <div className="flex items-center gap-2 text-indigo-400">
            <Server className="w-4 h-4" />
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Add Connection Profile
            </span>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-slate-500 hover:text-slate-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSaveConnection} className="p-4 space-y-4 overflow-y-auto flex-1 text-left">
          {error && (
            <div className="p-2.5 bg-red-950/20 border border-red-500/20 text-red-300 rounded text-xs flex items-center gap-2">
              <span>{error}</span>
            </div>
          )}

          {/* Database choice */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Database Engine
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["postgres", "mysql", "sqlite"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleDbTypeChange(type)}
                  className={`py-1.5 rounded text-xs font-semibold border cursor-pointer text-center capitalize transition-colors ${
                    dbType === type
                      ? "bg-indigo-950/30 text-indigo-300 border-indigo-500/80"
                      : "bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300 hover:border-slate-700"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Profile Name */}
          <div>
            <label htmlFor="modal-conn-name" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Connection Label / Name
            </label>
            <input
              id="modal-conn-name"
              type="text"
              placeholder="e.g. My Remote Database..."
              value={connName}
              onChange={(e) => setConnName(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-950 text-slate-200 border border-slate-800 focus:border-indigo-500/80 rounded text-xs focus:outline-none font-sans"
            />
          </div>

          {dbType === "sqlite" ? (
            /* SQLite file path */
            <div>
              <label htmlFor="modal-sqlite-path" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                SQLite Database File Path
              </label>
              <input
                id="modal-sqlite-path"
                type="text"
                placeholder="e.g. test.db"
                value={sqlitePathVal}
                onChange={(e) => setSqlitePathVal(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 bg-slate-950 text-slate-200 border border-slate-800 focus:border-indigo-500/80 rounded text-xs focus:outline-none font-mono"
              />
              <p className="text-[9px] text-slate-500 mt-1">
                Specify the file path relative to your workspace root directory.
              </p>
            </div>
          ) : (
            /* Postgres or MySQL connection parameters */
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label htmlFor="modal-db-host" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Host
                  </label>
                  <input
                    id="modal-db-host"
                    type="text"
                    placeholder="e.g. host.docker.internal"
                    value={hostVal}
                    onChange={(e) => setHostVal(e.target.value)}
                    required
                    className="w-full px-2.5 py-1.5 bg-slate-950 text-slate-200 border border-slate-800 focus:border-indigo-500/80 rounded text-xs focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="modal-db-port" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Port
                  </label>
                  <input
                    id="modal-db-port"
                    type="text"
                    placeholder="5432"
                    value={portVal}
                    onChange={(e) => setPortVal(e.target.value)}
                    required
                    className="w-full px-2.5 py-1.5 bg-slate-950 text-slate-200 border border-slate-800 focus:border-indigo-500/80 rounded text-xs focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="modal-db-user" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Username
                  </label>
                  <input
                    id="modal-db-user"
                    type="text"
                    placeholder="postgres"
                    value={userVal}
                    onChange={(e) => setUserVal(e.target.value)}
                    required
                    className="w-full px-2.5 py-1.5 bg-slate-950 text-slate-200 border border-slate-800 focus:border-indigo-500/80 rounded text-xs focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="modal-db-pass" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Password
                  </label>
                  <input
                    id="modal-db-pass"
                    type="password"
                    placeholder="Password..."
                    value={passVal}
                    onChange={(e) => setPassVal(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-950 text-slate-200 border border-slate-800 focus:border-indigo-500/80 rounded text-xs focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="modal-db-name" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Database Name
                </label>
                <input
                  id="modal-db-name"
                  type="text"
                  placeholder="yuvro_db"
                  value={dbnameVal}
                  onChange={(e) => setDbnameVal(e.target.value)}
                  required
                  className="w-full px-2.5 py-1.5 bg-slate-950 text-slate-200 border border-slate-800 focus:border-indigo-500/80 rounded text-xs focus:outline-none font-mono"
                />
              </div>

              {/* dynamic docker trigger */}
              <div className="pt-2 border-t border-slate-900">
                <button
                  type="button"
                  disabled={provisioning || loading}
                  onClick={handleProvisionContainer}
                  className="w-full py-2 bg-indigo-950/40 hover:bg-indigo-950/80 border border-indigo-800/40 text-indigo-300 hover:text-indigo-200 rounded text-xs font-bold transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {provisioning ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Provisioning container…</span>
                    </>
                  ) : (
                    <>
                      <Database className="w-3.5 h-3.5" />
                      <span>Provision local Docker Container</span>
                    </>
                  )}
                </button>
                <p className="text-[9px] text-slate-600 mt-1.5 leading-relaxed">
                  💡 Click above to instantly spawn a new containerized {dbType.toUpperCase()} database on your workspace network.
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-3 border-t border-slate-900 justify-end shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-slate-950 text-slate-400 border border-slate-800 rounded text-xs font-bold hover:text-slate-200 hover:border-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || provisioning}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-md shadow-indigo-600/15 disabled:opacity-50"
            >
              {loading && !provisioning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving…</span>
                </>
              ) : (
                <span>Save & Connect</span>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
