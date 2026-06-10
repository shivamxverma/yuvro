import React, { useState, useEffect } from "react";
import axios from "axios";
import { Loader2 } from "lucide-react";
import { DatabaseSidebar } from "./database/DatabaseSidebar";
import { BrowseDataTab } from "./database/BrowseDataTab";
import { SchemaTab } from "./database/SchemaTab";
import { QueryConsoleTab } from "./database/QueryConsoleTab";
import { AddConnectionModal } from "./database/AddConnectionModal";

interface DatabaseViewerProps {
  runnerPort: number;
  replId: string;
}

interface DbConnection {
  id: string;
  name: string;
  type: "sqlite" | "postgres" | "mysql";
  path?: string;
  host?: string;
  port?: number;
  user?: string;
  database?: string;
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

export function DatabaseViewer({ runnerPort, replId }: DatabaseViewerProps) {
  // DB Catalog State
  const [dbList, setDbList] = useState<DbConnection[]>([]);
  const [selectedDb, setSelectedDb] = useState<string>("");
  
  // Table Navigation State
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("");

  // Views & Active State
  const [activeTab, setActiveTab] = useState<"data" | "schema" | "query">("data");
  
  // Data Grid Rows
  const [rows, setRows] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Schema Info
  const [schema, setSchema] = useState<ColumnSchema[]>([]);

  // Query Console State
  const [customQuery, setCustomQuery] = useState<string>("SELECT * FROM sqlite_master LIMIT 10;");
  const [queryResults, setQueryResults] = useState<any[]>([]);
  const [queryColumns, setQueryColumns] = useState<string[]>([]);
  
  // Statuses
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [queryError, setQueryError] = useState<string>("");

  // Modal State
  const [isAddingConnection, setIsAddingConnection] = useState(false);

  const host = `http://localhost:${runnerPort}`;

  // 1. Fetch connections catalog
  const fetchDatabases = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(`${host}/api/db/connections`);
      const databases = res.data.databases || [];
      setDbList(databases);
      if (databases.length > 0) {
        const exists = databases.some((d: DbConnection) => d.id === selectedDb);
        if (!exists) {
          setSelectedDb(databases[0].id);
        }
      } else {
        setSelectedDb("");
        setTables([]);
        setSelectedTable("");
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to fetch database connection list from runner server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatabases();
  }, [runnerPort]);

  // 2. Fetch tables when connection selection changes
  const fetchTables = async (dbId: string) => {
    if (!dbId) return;
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(`${host}/api/db/tables`, { params: { db_path: dbId } });
      const tbls = res.data.tables || [];
      setTables(tbls);
      if (tbls.length > 0) {
        const exists = tbls.some((t: TableInfo) => t.name === selectedTable);
        if (!exists) {
          setSelectedTable(tbls[0].name);
        }
      } else {
        setSelectedTable("");
      }
    } catch (err: any) {
      console.error(err);
      setError(`Failed to read tables from connection.`);
      setTables([]);
      setSelectedTable("");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDb) {
      fetchTables(selectedDb);
    }
  }, [selectedDb]);

  // 3. Fetch rows when table or page settings change
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
      setRows([]);
      setColumns([]);
      setTotalRows(0);
    } finally {
      setLoading(false);
    }
  };

  // 4. Fetch table schema columns
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
      setSchema([]);
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

  // 5. Custom query execution
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

  // 6. Delete manual connection profile
  const handleDeleteConnection = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to remove this connection profile?")) return;
    setLoading(true);
    try {
      await axios.delete(`${host}/api/db/connections/${id}`);
      if (selectedDb === id) {
        setSelectedDb("");
      }
      await fetchDatabases();
    } catch (err: any) {
      console.error(err);
      setError("Failed to delete connection profile.");
    } finally {
      setLoading(false);
    }
  };

  const resetPage = () => setPage(1);
  const currentDbObj = dbList.find((d) => d.id === selectedDb);

  return (
    <div className="flex h-full bg-[#070b13] text-slate-200 overflow-hidden font-sans relative">
      
      {/* 1. Sidebar Panel */}
      <DatabaseSidebar
        dbList={dbList}
        selectedDb={selectedDb}
        setSelectedDb={setSelectedDb}
        tables={tables}
        selectedTable={selectedTable}
        setSelectedTable={setSelectedTable}
        onAddClick={() => setIsAddingConnection(true)}
        onRefreshClick={fetchDatabases}
        onDeleteClick={handleDeleteConnection}
        resetPage={resetPage}
      />

      {/* 2. Main Work Panel */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        
        {/* Navigation Tabs bar */}
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
            <span>
              {currentDbObj ? `${currentDbObj.type.toUpperCase()} Active` : "Offline"}
            </span>
          </div>
        </div>

        {/* Tab display components */}
        <div className="flex-1 overflow-hidden relative flex flex-col">
          {error && (
            <div className="m-3 p-2.5 bg-red-950/20 border border-red-500/20 text-red-300 rounded text-xs flex items-center gap-2 shrink-0 animate-fade-in">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* LOADING overlays */}
          {loading && (
            <div className="absolute inset-0 bg-[#070b13]/60 z-20 flex items-center justify-center backdrop-blur-[1px]">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
          )}

          {activeTab === "data" && (
            <BrowseDataTab
              selectedTable={selectedTable}
              rows={rows}
              columns={columns}
              page={page}
              setPage={setPage}
              pageSize={pageSize}
              setPageSize={setPageSize}
              totalRows={totalRows}
            />
          )}

          {activeTab === "schema" && (
            <SchemaTab
              selectedTable={selectedTable}
              schema={schema}
            />
          )}

          {activeTab === "query" && (
            <QueryConsoleTab
              query={customQuery}
              setQuery={setCustomQuery}
              onExecute={handleRunQuery}
              results={queryResults}
              columns={queryColumns}
              error={queryError}
              loading={loading}
            />
          )}
        </div>
      </div>

      {/* 3. Connection Modal */}
      <AddConnectionModal
        isOpen={isAddingConnection}
        onClose={() => setIsAddingConnection(false)}
        replId={replId}
        runnerPort={runnerPort}
        onSaveConnectionSuccess={async (newId) => {
          await fetchDatabases();
          setSelectedDb(newId);
        }}
      />

    </div>
  );
}
