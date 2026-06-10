import { useState } from "react";
import { useSearchParams } from "react-router-dom";

export const Output = ({ runnerPort }: { runnerPort: number }) => {
    const [searchParams] = useSearchParams();
    const replId = searchParams.get('replId') ?? '';
    const [containerPort, setContainerPort] = useState("8000");
    // Route through the runner's built-in reverse proxy instead of the broken subdomain URL
    const PROXY_URI = `http://localhost:${runnerPort}/proxy/${replId}/?container_port=${containerPort}`;

    return (
        <div className="flex flex-col h-[40vh] bg-white border-b border-slate-800">
            <div className="flex items-center justify-between p-2 bg-slate-900 text-white text-xs border-b border-slate-800">
                <span className="font-semibold text-slate-300">App Preview</span>
                <div className="flex items-center gap-2">
                    <span className="text-slate-400">Container Port:</span>
                    <input 
                        type="text" 
                        value={containerPort} 
                        onChange={(e) => setContainerPort(e.target.value)} 
                        className="w-16 px-1 py-0.5 bg-slate-800 text-white rounded border border-slate-700 text-center focus:outline-none focus:border-blue-500 font-mono"
                    />
                </div>
            </div>
            <div className="flex-1 bg-white">
                <iframe width={"100%"} height={"100%"} src={PROXY_URI} />
            </div>
        </div>
    );
}