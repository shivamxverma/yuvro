import React from "react";
import { Table as TableIcon, ChevronLeft, ChevronRight } from "lucide-react";

interface BrowseDataTabProps {
  selectedTable: string;
  rows: any[];
  columns: string[];
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  pageSize: number;
  setPageSize: (size: number) => void;
  totalRows: number;
}

export function BrowseDataTab({
  selectedTable,
  rows,
  columns,
  page,
  setPage,
  pageSize,
  setPageSize,
  totalRows,
}: BrowseDataTabProps) {
  const totalPages = Math.ceil(totalRows / pageSize) || 1;

  if (!selectedTable) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs">
        <TableIcon className="w-8 h-8 mb-2 opacity-30 text-indigo-500" />
        Select a table from the sidebar to browse rows.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
      {/* Rows Table */}
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
              type="button"
              className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 rounded disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              type="button"
              className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 rounded disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
