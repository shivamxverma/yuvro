import { useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { RefreshCw, ExternalLink } from "lucide-react";

export const Output = ({ runnerPort }: { runnerPort: number }) => {
    const [searchParams] = useSearchParams();
    const replId = searchParams.get('replId') ?? '';
    const [containerPort, setContainerPort] = useState("8000");
    const [iframeKey, setIframeKey] = useState(0);

    const PROXY_URI = `http://localhost:${runnerPort}/proxy/${replId}/${containerPort}/`;

    const handleRefresh = useCallback(() => {
        setIframeKey(k => k + 1);
    }, []);

    return (
        <div className="flex flex-col h-full bg-[#070b13]">
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#0b0f19] border-b border-slate-900 shrink-0">
                <span className="font-semibold text-slate-300 text-xs">App Preview</span>
                <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-xs">Port:</span>
                    <input
                        type="text"
                        value={containerPort}
                        onChange={(e) => setContainerPort(e.target.value)}
                        className="w-14 px-1.5 py-0.5 bg-slate-800 text-white rounded border border-slate-700 text-center focus:outline-none focus:border-indigo-500 font-mono text-xs"
                    />
                    <button
                        onClick={handleRefresh}
                        title="Reload preview"
                        className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded cursor-pointer transition-colors"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <a
                        href={PROXY_URI}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open in new tab"
                        className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded cursor-pointer transition-colors"
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                </div>
            </div>
            <div className="flex-1 bg-white overflow-hidden">
                <iframe
                    key={iframeKey}
                    width="100%"
                    height="100%"
                    src={PROXY_URI}
                    title="App Preview"
                    style={{ colorScheme: "light" }}
                />
            </div>
        </div>
    );
}