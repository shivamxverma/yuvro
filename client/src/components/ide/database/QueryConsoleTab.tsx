import { FileCode2, Play, AlertCircle, Loader2 } from "lucide-react";

interface QueryConsoleTabProps {
  query: string;
  setQuery: (val: string) => void;
  onExecute: () => void;
  results: any[];
  columns: string[];
  error: string;
  loading: boolean;
}

export function QueryConsoleTab({
  query,
  setQuery,
  onExecute,
  results,
  columns,
  error,
  loading,
}: QueryConsoleTabProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
      {/* Query Editor Box */}
      <div className="p-3 border-b border-slate-900 flex flex-col gap-2 bg-[#090d16]/40 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <FileCode2 className="w-4 h-4 text-amber-400" />
            <span>SQL Query (Read-only)</span>
          </div>
          <button
            onClick={onExecute}
            type="button"
            disabled={loading || !query.trim()}
            className="flex items-center gap-1 px-3 py-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-slate-900 rounded text-xs font-bold transition duration-150 cursor-pointer shadow-md shadow-amber-600/10 focus:outline-none"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>Execute</span>
          </button>
        </div>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="SELECT * FROM users LIMIT 10;"
          rows={4}
          className="w-full p-2.5 bg-slate-950 text-slate-200 border border-slate-800 rounded font-mono text-xs focus:outline-none focus:border-amber-500/80 leading-relaxed shadow-inner"
        />
      </div>

      {/* Query Results / Errors */}
      <div className="flex-1 overflow-auto relative flex flex-col">
        {error && (
          <div className="m-3 p-3 bg-red-950/20 border border-red-500/20 text-red-300 rounded text-xs flex items-start gap-2 animate-fade-in shrink-0">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <div className="font-mono whitespace-pre-wrap break-words text-left">{error}</div>
          </div>
        )}

        {results.length === 0 && !error ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-600 text-xs">
            No query results yet. Type a query above and click Execute.
          </div>
        ) : (
          <div className="flex-1 overflow-auto bg-[#070b13]">
            <div className="bg-[#090d16] px-3 py-1.5 border-b border-slate-900 text-[10px] text-slate-500 uppercase tracking-wider font-semibold sticky top-0 z-10 flex items-center justify-between">
              <span>Query Results ({results.length} rows returned)</span>
            </div>
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-7 bg-[#090d16]/90 border-b border-slate-900 z-10">
                <tr>
                  {columns.map((col) => (
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
                {results.map((row, idx) => (
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
          </div>
        )}
      </div>
    </div>
  );
}
