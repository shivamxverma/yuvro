import React from "react";
import { Plus, RefreshCw, Trash2, Table as TableIcon } from "lucide-react";

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

interface DatabaseSidebarProps {
  dbList: DbConnection[];
  selectedDb: string;
  setSelectedDb: (id: string) => void;
  tables: TableInfo[];
  selectedTable: string;
  setSelectedTable: (name: string) => void;
  onAddClick: () => void;
  onRefreshClick: () => void;
  onDeleteClick: (id: string, e: React.MouseEvent) => void;
  resetPage: () => void;
}

export function DatabaseSidebar({
  dbList,
  selectedDb,
  setSelectedDb,
  tables,
  selectedTable,
  setSelectedTable,
  onAddClick,
  onRefreshClick,
  onDeleteClick,
  resetPage,
}: DatabaseSidebarProps) {
  const currentDbObj = dbList.find((d) => d.id === selectedDb);

  return (
    <div className="w-60 border-r border-slate-900 flex flex-col bg-[#090d16] shrink-0 overflow-y-auto">
      <div className="p-3 border-b border-slate-900/80 flex flex-col gap-2 shrink-0">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-left">
          Active Connection
        </label>
        <div className="relative flex items-center gap-1.5">
          <select
            value={selectedDb}
            onChange={(e) => {
              setSelectedDb(e.target.value);
              resetPage();
            }}
            className="flex-1 px-2.5 py-1.5 bg-slate-950 text-slate-200 border border-slate-800 rounded text-xs focus:outline-none focus:border-indigo-500/80 font-mono"
          >
            {dbList.map((db) => (
              <option key={db.id} value={db.id}>
                {db.name}
              </option>
            ))}
          </select>
          
          <button
            onClick={onAddClick}
            type="button"
            title="Add Database Connection"
            className="p-1.5 hover:bg-slate-800 rounded border border-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          
          <button
            onClick={onRefreshClick}
            type="button"
            title="Refresh Catalog"
            className="p-1.5 hover:bg-slate-800 rounded border border-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer transition-colors shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
        
        {currentDbObj && currentDbObj.type !== "sqlite" && (
          <button
            onClick={(e) => onDeleteClick(currentDbObj.id, e)}
            type="button"
            className="mt-1 flex items-center justify-center gap-1 py-1 bg-red-950/20 hover:bg-red-950/40 border border-red-950/40 hover:border-red-500/30 text-red-400 rounded text-[10px] font-semibold transition-colors cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            <span>Remove Connection Profile</span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2.5 mb-2 flex items-center justify-between">
          <span>Tables</span>
          <span className="bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded text-[9px]">
            {tables.length}
          </span>
        </div>

        {tables.length === 0 ? (
          <div className="text-[11px] text-slate-600 italic px-2.5 mt-2 text-left">
            No tables found.
          </div>
        ) : (
          <div className="space-y-0.5 animate-fade-in" role="listbox" aria-label="Database Tables">
            {tables.map((tbl) => {
              const isSelected = selectedTable === tbl.name;
              return (
                <button
                  key={tbl.name}
                  role="option"
                  aria-selected={isSelected}
                  type="button"
                  onClick={() => {
                    setSelectedTable(tbl.name);
                    resetPage();
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
  );
}
