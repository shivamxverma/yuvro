// ─── File extension → color helper ───────────────────────────────────────────
export function fileColor(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    py: "#38bdf8",   // Light blue
    ts: "#60a5fa",   // Blue
    tsx: "#60a5fa",
    js: "#fbbf24",   // Amber
    jsx: "#fbbf24",
    css: "#c084fc",  // Purple
    html: "#f97316", // Orange
    json: "#34d399", // Emerald
    md: "#94a3b8",   // Slate
    txt: "#94a3b8",
    yml: "#f472b6",  // Pink
    yaml: "#f472b6",
    env: "#fb7185",  // Rose
  };
  return map[ext ?? ""] ?? "#94a3b8";
}
