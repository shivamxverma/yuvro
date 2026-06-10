import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Database,
  Table as TableIcon,
  Key,
  Play,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  AlertCircle,
  FileCode2,
  Binary,
} from "lucide-react";

interface DatabaseViewerProps {
  runnerPort: number;
}

interface TableInfo {
  name: string;
  rowCount: number;
}

interface ColumnSchema {
  cid: number;
  name: string;
  type: string;
  notnull: boolean;
  dflt_value: any;
  pk: boolean;
}

export function DatabaseViewer({ runnerPort }: DatabaseViewerProps) {
  // DB List
  const [dbList, setDbList] = useState<string[]>([]);
  const [selectedDb, setSelectedDb] = useState<string>("");
  
  // Tables List
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("");

  // Views & Active State
  const [activeTab, setActiveTab] = useState<"data" | "schema" | "query">("data");
  
  // Rows Data
  const [rows, setRows] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Table Schema Info
  const [schema, setSchema] = useState<ColumnSchema[]>([]);

  // Query Console State
  const [customQuery, setCustomQuery] = useState<string>("SELECT * FROM sqlite_master LIMIT 10;");
  const [queryResults, setQueryResults] = useState<any[]>([]);
  const [queryColumns, setQueryColumns] = useState<string[]>([]);
  
  // Statuses
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [queryError, setQueryError] = useState<string>("");

  const host = `http://localhost:${runnerPort}`;

  // 1. Fetch available databases
  const fetchDatabases = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(`${host}/api/db/list`);
      const databases = res.data.databases || [];
      setDbList(databases);
      if (databases.length > 0) {
        setSelectedDb(databases[0]);
      } else {
        setSelectedDb("");
        setTables([]);
        setSelectedTable("");
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to fetch database list from runner server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatabases();
  }, [runnerPort]);

  // 2. Fetch tables when DB changes
  const fetchTables = async (db: string) => {
    if (!db) return;
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(`${host}/api/db/tables`, { params: { db_path: db } });
      const tbls = res.data.tables || [];
      setTables(tbls);
      if (tbls.length > 0) {
        // Auto-select first table if none is currently selected
        const exists = tbls.some((t: TableInfo) => t.name === selectedTable);
        if (!exists) {
          setSelectedTable(tbls[0].name);
        }
      } else {
        setSelectedTable("");
      }
    } catch (err: any) {
      console.error(err);
      setError(`Failed to read tables from ${db}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDb) {
      fetchTables(selectedDb);
    }
  }, [selectedDb]);

  // 3. Fetch rows when table or page changes
  const fetchRows = async () => {
    if (!selectedDb || !selectedTable || activeTab !== "data") return;
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(`${host}/api/db/rows`, {
        params: {
          db_path: selectedDb,
          table: selectedTable,
          page,
          page_size: pageSize,
        },
      });
      setRows(res.data.rows || []);
      setColumns(res.data.columns || []);
      setTotalRows(res.data.total || 0);
    } catch (err: any) {
      console.error(err);
      setError(`Failed to fetch rows for table: ${selectedTable}`);
    } finally {
      setLoading(false);
    }
  };

  // 4. Fetch table schema
  const fetchSchema = async () => {
    if (!selectedDb || !selectedTable || activeTab !== "schema") return;
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(`${host}/api/db/schema`, {
        params: {
          db_path: selectedDb,
          table: selectedTable,
        },
      });
      setSchema(res.data.schema || []);
    } catch (err: any) {
      console.error(err);
      setError(`Failed to fetch schema for table: ${selectedTable}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "data") {
      fetchRows();
    } else if (activeTab === "schema") {
      fetchSchema();
    }
  }, [selectedDb, selectedTable, activeTab, page, pageSize]);

  // 5. Run Custom Query
  const handleRunQuery = async () => {
    if (!selectedDb || !customQuery.trim()) return;
    setLoading(true);
    setQueryError("");
    setQueryResults([]);
    setQueryColumns([]);
    try {
      const res = await axios.post(`${host}/api/db/query`, {
        db_path: selectedDb,
        query: customQuery,
      });
      setQueryResults(res.data.results || []);
      setQueryColumns(res.data.columns || []);
    } catch (err: any) {
      console.error(err);
      setQueryError(err.response?.data || err.message || "Failed to execute query.");
    } finally {
      setLoading(false);
    }
  };

  // UI Helpers
  const totalPages = Math.ceil(totalRows / pageSize) || 1;

  if (dbList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-400 bg-[#070b13]">
        <Database className="w-10 h-10 text-indigo-500/60 mb-3 animate-pulse" />
        <h3 className="text-sm font-semibold text-slate-200">No SQLite database found</h3>
        <p className="text-xs text-slate-500 mt-1.5 max-w-sm leading-relaxed">
          Create a `.db`, `.sqlite`, or `.sqlite3` file in your workspace, or run migrations via the interactive terminal to generate one.
        </p>
        <button
          onClick={fetchDatabases}
          className="mt-4 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded text-xs font-semibold cursor-pointer transition-colors shadow-sm shadow-indigo-600/10"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Scan Workspace
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-[#070b13] text-slate-200 overflow-hidden font-sans">
      {/* 1. SIDEBAR: Databases and Tables */}
      <div className="w-60 border-r border-slate-900 flex flex-col bg-[#090d16] shrink-0 overflow-y-auto">
        <div className="p-3 border-b border-slate-900/80 flex flex-col gap-2 shrink-0">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Active Connection
          </label>
          <div className="relative flex items-center gap-1.5">
            <select
              value={selectedDb}
              onChange={(e) => {
                setSelectedDb(e.target.value);
                setPage(1);
              }}
              className="flex-1 px-2.5 py-1.5 bg-slate-950 text-slate-200 border border-slate-800 rounded text-xs focus:outline-none focus:border-indigo-500/80 font-mono"
            >
              {dbList.map((db) => (
                <option key={db} value={db}>
                  {db}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                fetchDatabases();
                if (selectedDb) fetchTables(selectedDb);
              }}
              title="Refresh database catalog"
              className="p-1.5 hover:bg-slate-800 rounded border border-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2.5 mb-2 flex items-center justify-between">
            <span>Tables</span>
            <span className="bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded text-[9px]">
              {tables.length}
            </span>
          </div>

          {tables.length === 0 ? (
            <div className="text-[11px] text-slate-600 italic px-2.5 mt-2">
              No tables found in this DB.
            </div>
          ) : (
            <div className="space-y-0.5" role="listbox" aria-label="Database Tables">
              {tables.map((tbl) => {
                const isSelected = selectedTable === tbl.name;
                return (
                  <button
                    key={tbl.name}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      setSelectedTable(tbl.name);
                      setPage(1);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-indigo-950/20 text-indigo-300 border-l-2 border-indigo-500"
                        : "hover:bg-slate-900/50 text-slate-400 hover:text-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <TableIcon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-indigo-400" : "text-slate-500"}`} />
                      <span className="truncate font-mono">{tbl.name}</span>
                    </div>
                    <span className="text-[10px] text-slate-600 bg-slate-950 px-1 rounded shrink-0">
                      {tbl.rowCount}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 2. MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between px-3 bg-[#090d16] border-b border-slate-900 h-9 shrink-0">
          <div className="flex gap-1.5 h-full items-end">
            <button
              onClick={() => setActiveTab("data")}
              className={`px-3 py-1.5 text-xs font-semibold border-b-2 cursor-pointer transition-all duration-150 outline-none ${
                activeTab === "data"
                  ? "border-indigo-500 text-indigo-300 bg-indigo-950/10"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              Browse Data
            </button>
            <button
              onClick={() => setActiveTab("schema")}
              className={`px-3 py-1.5 text-xs font-semibold border-b-2 cursor-pointer transition-all duration-150 outline-none ${
                activeTab === "schema"
                  ? "border-indigo-500 text-indigo-300 bg-indigo-950/10"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              Schema
            </button>
            <button
              onClick={() => setActiveTab("query")}
              className={`px-3 py-1.5 text-xs font-semibold border-b-2 cursor-pointer transition-all duration-150 outline-none ${
                activeTab === "query"
                  ? "border-amber-500 text-amber-300 bg-amber-950/10"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              Query Console
            </button>
          </div>

          <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
            <span>SQLite Connected</span>
          </div>
        </div>

        {/* Tab View Contents */}
        <div className="flex-1 overflow-hidden relative flex flex-col">
          {error && (
            <div className="m-3 p-2.5 bg-red-950/20 border border-red-500/20 text-red-300 rounded text-xs flex items-center gap-2 shrink-0 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* LOADING COVER */}
          {loading && (
            <div className="absolute inset-0 bg-[#070b13]/60 z-20 flex items-center justify-center backdrop-blur-[1px]">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
          )}

          {/* TAB 1: BROWSE DATA */}
          {activeTab === "data" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {!selectedTable ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs">
                  <TableIcon className="w-8 h-8 mb-2 opacity-30 text-indigo-500" />
                  Select a table from the sidebar to browse rows.
                </div>
              ) : (
                <>
                  {/* Rows Grid */}
                  <div className="flex-1 overflow-auto bg-[#070b13]">
                    {rows.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-500 italic">
                        Table is empty.
                      </div>
                    ) : (
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="sticky top-0 bg-[#090d16] border-b border-slate-900 z-10">
                          <tr>
                            {columns.map((col) => (
                              <th
                                key={col}
                                className="px-4 py-2.5 font-semibold text-slate-400 border-r border-slate-900 font-mono text-[11px]"
                              >
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-900/60 font-mono text-[11px]">
                          {rows.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-900/30">
                              {columns.map((col) => {
                                const val = row[col];
                                const isNull = val === null;
                                return (
                                  <td
                                    key={col}
                                    className={`px-4 py-2 border-r border-slate-900/40 truncate max-w-xs ${
                                      isNull ? "text-slate-600 italic" : "text-slate-300"
                                    }`}
                                  >
                                    {isNull ? "NULL" : String(val)}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Pagination Footer */}
                  <div className="h-10 bg-[#090d16] border-t border-slate-900 px-3 flex items-center justify-between shrink-0 text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <span>Show</span>
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setPage(1);
                        }}
                        className="bg-slate-900 text-slate-300 border border-slate-800 rounded px-1.5 py-0.5 outline-none focus:border-indigo-500/80 text-[11px]"
                      >
                        {[10, 20, 50, 100].map((size) => (
                          <option key={size} value={size}>
                            {size} rows
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-3">
                      <span>
                        Page <strong className="text-slate-300 font-semibold">{page}</strong> of{" "}
                        <strong className="text-slate-300 font-semibold">{totalPages}</strong> (
                        <strong className="text-slate-400">{totalRows}</strong> total rows)
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page === 1}
                          className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 rounded disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          disabled={page === totalPages}
                          className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 rounded disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 2: SCHEMA VIEWER */}
          {activeTab === "schema" && (
            <div className="flex-1 overflow-auto bg-[#070b13]">
              {!selectedTable ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs h-full">
                  <Binary className="w-8 h-8 mb-2 opacity-30 text-indigo-500" />
                  Select a table from the sidebar to view its structure.
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-[#090d16] border-b border-slate-900">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold text-slate-400 border-r border-slate-900">CID</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-400 border-r border-slate-900">Column Name</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-400 border-r border-slate-900">Type</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-400 border-r border-slate-900">Nullable</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-400 border-r border-slate-900">Default</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-400">Primary Key</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/60 font-mono text-[11px]">
                    {schema.map((col) => (
                      <tr key={col.cid} className="hover:bg-slate-900/30">
                        <td className="px-4 py-2.5 border-r border-slate-900/40 text-slate-500">{col.cid}</td>
                        <td className="px-4 py-2.5 border-r border-slate-900/40 font-bold text-indigo-300">{col.name}</td>
                        <td className="px-4 py-2.5 border-r border-slate-900/40 text-emerald-400">{col.type || "BLOB"}</td>
                        <td className="px-4 py-2.5 border-r border-slate-900/40 text-slate-400">
                          {col.notnull ? "NOT NULL" : "NULL"}
                        </td>
                        <td className="px-4 py-2.5 border-r border-slate-900/40 text-slate-500">
                          {col.dflt_value !== null ? String(col.dflt_value) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-slate-400">
                          {col.pk ? (
                            <span className="flex items-center gap-1 text-amber-500 font-semibold text-[10px]">
                              <Key className="w-3 h-3" />
                              PK
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB 3: QUERY CONSOLE */}
          {activeTab === "query" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Query Editor Box */}
              <div className="p-3 border-b border-slate-900 flex flex-col gap-2 bg-[#090d16]/40 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <FileCode2 className="w-4 h-4 text-amber-400" />
                    <span>SQL Query (Read-only)</span>
                  </div>
                  <button
                    onClick={handleRunQuery}
                    className="flex items-center gap-1 px-3 py-1 bg-amber-600 hover:bg-amber-500 text-slate-900 rounded text-xs font-bold transition duration-150 cursor-pointer shadow-md shadow-amber-600/10 focus:outline-none"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Execute</span>
                  </button>
                </div>
                <textarea
                  value={customQuery}
                  onChange={(e) => setCustomQuery(e.target.value)}
                  placeholder="SELECT * FROM users LIMIT 10;"
                  rows={4}
                  className="w-full p-2.5 bg-slate-950 text-slate-200 border border-slate-800 rounded font-mono text-xs focus:outline-none focus:border-amber-500/80 leading-relaxed shadow-inner"
                />
              </div>

              {/* Query Results */}
              <div className="flex-1 overflow-auto relative flex flex-col">
                {queryError && (
                  <div className="m-3 p-3 bg-red-950/20 border border-red-500/20 text-red-300 rounded text-xs flex items-start gap-2 animate-fade-in shrink-0">
                    <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                    <div className="font-mono whitespace-pre-wrap break-words">{queryError}</div>
                  </div>
                )}

                {queryResults.length === 0 && !queryError ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-600 text-xs">
                    No query results yet. Type a query above and click Execute.
                  </div>
                ) : (
                  <div className="flex-1 overflow-auto bg-[#070b13]">
                    <div className="bg-[#090d16] px-3 py-1.5 border-b border-slate-900 text-[10px] text-slate-500 uppercase tracking-wider font-semibold sticky top-0 z-10 flex items-center justify-between">
                      <span>Query Results ({queryResults.length} rows returned)</span>
                    </div>
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-7 bg-[#090d16]/90 border-b border-slate-900 z-10">
                        <tr>
                          {queryColumns.map((col) => (
                            <th
                              key={col}
                              className="px-4 py-2 font-semibold text-slate-400 border-r border-slate-900 font-mono text-[11px]"
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900/60 font-mono text-[11px]">
                        {queryResults.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-900/30">
                            {queryColumns.map((col) => {
                              const val = row[col];
                              const isNull = val === null;
                              return (
                                <td
                                  key={col}
                                  className={`px-4 py-2 border-r border-slate-900/40 truncate max-w-xs ${
                                    isNull ? "text-slate-600 italic" : "text-slate-300"
                                  }`}
                                >
                                  {isNull ? "NULL" : String(val)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
