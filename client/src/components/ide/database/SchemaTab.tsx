import { Binary, Key } from "lucide-react";

interface ColumnSchema {
  cid: number;
  name: string;
  type: string;
  notnull: boolean;
  dflt_value: any;
  pk: boolean;
}

interface SchemaTabProps {
  selectedTable: string;
  schema: ColumnSchema[];
}

export function SchemaTab({ selectedTable, schema }: SchemaTabProps) {
  if (!selectedTable) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs h-full">
        <Binary className="w-8 h-8 mb-2 opacity-30 text-indigo-500" />
        Select a table from the sidebar to view its structure.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-[#070b13] animate-fade-in">
      <table className="w-full text-left text-xs border-collapse">
        <thead className="sticky top-0 bg-[#090d16] border-b border-slate-900 z-10">
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
    </div>
  );
}
