import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shuffle, 
  Plus, 
  Code, 
  Sparkles, 
  ArrowRight,
  AlertCircle,
  HelpCircle
} from 'lucide-react';

const Github = ({ className }: { className?: string }) => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
    </svg>
);

const SLUG_WORDS = ["car", "dog", "computer", "person", "inside", "word", "for", "please", "to", "cool", "open", "source"];

function getRandomSlug() {
    let slug = "";
    for (let i = 0; i < 3; i++) {
        slug += SLUG_WORDS[Math.floor(Math.random() * SLUG_WORDS.length)];
    }
    return slug;
}

const LANGUAGES = [
    { value: "python", label: "Python", emoji: "🐍", color: "from-blue-600 to-yellow-500", desc: "Standard Python 3 backend environment" },
    { value: "fastapi", label: "FastAPI", emoji: "⚡", color: "from-emerald-500 to-teal-400", desc: "High-performance Python web APIs" },
    { value: "django", label: "Django", emoji: "🎸", color: "from-green-700 to-emerald-600", desc: "The web framework for perfectionists" },
    { value: "flask", label: "Flask", emoji: "🌶️", color: "from-red-500 to-orange-500", desc: "Lightweight WSGI web application framework" },
];

export const LandingPage = () => {
    const [tab, setTab] = useState<'create' | 'clone'>('create');
    const [language, setLanguage] = useState("python");
    const [replId, setReplId] = useState(getRandomSlug());
    const [githubUrl, setGithubUrl] = useState('');
    const [cloneReplId, setCloneReplId] = useState(getRandomSlug());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [rollAnimation, setRollAnimation] = useState(false);
    
    const navigate = useNavigate();

    const triggerShuffle = (target: 'create' | 'clone') => {
        setRollAnimation(true);
        setTimeout(() => setRollAnimation(false), 600);
        
        if (target === 'create') {
            setReplId(getRandomSlug());
        } else {
            setCloneReplId(getRandomSlug());
        }
    };

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!replId.trim()) { 
            setError("Project ID cannot be empty."); 
            return; 
        }
        setLoading(true);
        try {
            const response = await fetch("http://localhost:3001/project", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ replId: replId.trim(), language }),
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || "Failed to create project.");
            }
            navigate(`/coding/?replId=${replId.trim()}`);
        } catch (err: any) {
            setError(err.message || "Something went wrong.");
        } finally {
            setLoading(false);
        }
    };

    const handleCloneProject = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!githubUrl.trim()) { 
            setError("GitHub URL cannot be empty."); 
            return; 
        }
        if (!cloneReplId.trim()) { 
            setError("Project ID cannot be empty."); 
            return; 
        }
        const url = githubUrl.trim();
        if (!url.startsWith("https://github.com/") && !url.startsWith("http://github.com/") && !url.startsWith("git@github.com:")) {
            setError("Please enter a valid GitHub URL (e.g. https://github.com/user/repo)");
            return;
        }
        setLoading(true);
        try {
            const response = await fetch("http://localhost:3001/clone", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ replId: cloneReplId.trim(), githubUrl: url }),
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || "Failed to clone project.");
            }
            navigate(`/coding/?replId=${cloneReplId.trim()}`);
        } catch (err: any) {
            setError(err.message || "Something went wrong.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen w-full flex items-center justify-center bg-[#030712] bg-grid-pattern text-slate-100 font-sans overflow-y-auto px-4 py-12">
            
            {/* Ambient Background Lights */}
            <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/20 blur-[120px] pointer-events-none mesh-bg-animated" />
            <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/15 blur-[120px] pointer-events-none mesh-bg-animated" />
            
            <div className="relative w-full max-w-lg z-10">
                {/* Header Branding */}
                <div className="flex flex-col items-center mb-8 text-center">
                    <div className="flex items-center gap-3 p-2 px-3 rounded-full bg-indigo-950/40 border border-indigo-500/20 backdrop-blur-md mb-4 shadow-lg shadow-indigo-950/20">
                        <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" aria-hidden="true" />
                        <span className="text-xs font-semibold tracking-wider text-indigo-300 uppercase">Cloud Code Sandbox</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white font-extrabold text-xl shadow-lg shadow-indigo-500/30">
                            Y
                        </div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-white m-0 text-wrap:balance">
                            Yuvro
                        </h1>
                    </div>
                    <p className="text-slate-400 text-sm mt-2 max-w-sm">
                        Instantly prototype and execute python applications in isolated cloud containers.
                    </p>
                </div>

                {/* Main Card Container */}
                <div className="glass-card w-full rounded-2xl p-6 md:p-8">
                    {/* Tab Navigation */}
                    <div className="flex bg-slate-950/60 p-1.5 rounded-xl border border-slate-800/80 mb-6" role="tablist" aria-label="Project Actions">
                        <button
                            role="tab"
                            aria-selected={tab === 'create'}
                            aria-controls="create-panel"
                            id="tab-create"
                            tabIndex={0}
                            onClick={() => { setTab('create'); setError(''); }}
                            className={`flex-1 flex items-center justify-center gap-2.5 py-2.5 rounded-lg font-semibold text-xs transition-all duration-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500 outline-none ${
                                tab === 'create' 
                                    ? 'bg-gradient-to-r from-indigo-600 to-blue-500 text-white shadow-md shadow-indigo-600/15' 
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                            }`}
                        >
                            <Code className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>New Project</span>
                        </button>
                        <button
                            role="tab"
                            aria-selected={tab === 'clone'}
                            aria-controls="clone-panel"
                            id="tab-clone"
                            tabIndex={0}
                            onClick={() => { setTab('clone'); setError(''); }}
                            className={`flex-1 flex items-center justify-center gap-2.5 py-2.5 rounded-lg font-semibold text-xs transition-all duration-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500 outline-none ${
                                tab === 'clone' 
                                    ? 'bg-gradient-to-r from-indigo-600 to-blue-500 text-white shadow-md shadow-indigo-600/15' 
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                            }`}
                        >
                            <Github className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Clone from GitHub</span>
                        </button>
                    </div>

                    {/* Inline Error Announcement Container */}
                    {error && (
                        <div 
                            className="flex items-start gap-2.5 p-3 rounded-lg border border-red-500/20 bg-red-950/20 text-red-300 text-xs mb-5 animate-fade-in" 
                            aria-live="polite"
                        >
                            <AlertCircle className="w-4 h-4 mt-0.5 text-red-400 flex-shrink-0" aria-hidden="true" />
                            <div>
                                <span className="font-semibold">Error:</span> {error}
                            </div>
                        </div>
                    )}

                    {/* CREATE TAB PANEL */}
                    <div 
                        id="create-panel"
                        role="tabpanel"
                        aria-labelledby="tab-create"
                        className={tab === 'create' ? 'block' : 'hidden'}
                    >
                        <form onSubmit={handleCreateProject} className="space-y-5">
                            {/* Project ID Field */}
                            <div>
                                <label 
                                    htmlFor="create-repl-id"
                                    className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2"
                                >
                                    Workspace ID
                                </label>
                                <div className="relative flex items-center">
                                    <input
                                        id="create-repl-id"
                                        type="text"
                                        value={replId}
                                        onChange={e => setReplId(e.target.value)}
                                        placeholder="Enter workspace name…"
                                        disabled={loading}
                                        autoComplete="off"
                                        spellCheck={false}
                                        required
                                        className="w-full pl-3.5 pr-20 py-2.5 bg-slate-950/80 border border-slate-800 focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/10 focus:ring-offset-0 outline-none rounded-lg text-slate-200 font-mono text-xs transition duration-200"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => triggerShuffle('create')}
                                        disabled={loading}
                                        aria-label="Generate random project ID"
                                        title="Generate random ID"
                                        className="absolute right-2.5 px-2.5 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/15 text-indigo-300 rounded-md text-[10px] font-bold tracking-wide flex items-center gap-1 cursor-pointer transition duration-150 focus-visible:ring-2 focus-visible:ring-indigo-500 outline-none"
                                    >
                                        <Shuffle className={`w-3 h-3 ${rollAnimation ? 'animate-dice' : ''}`} aria-hidden="true" />
                                        <span>Random</span>
                                    </button>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-1.5">
                                    A url-friendly identifier for hosting your container
                                </p>
                            </div>

                            {/* Language Selection Grid */}
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">
                                    Select Environment
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Environment choices">
                                    {LANGUAGES.map(lang => {
                                        const isSelected = language === lang.value;
                                        return (
                                            <div
                                                key={lang.value}
                                                id={`lang-${lang.value}`}
                                                role="radio"
                                                aria-checked={isSelected}
                                                tabIndex={loading ? -1 : 0}
                                                onClick={() => !loading && setLanguage(lang.value)}
                                                onKeyDown={e => {
                                                    if (!loading && (e.key === ' ' || e.key === 'Enter')) {
                                                        e.preventDefault();
                                                        setLanguage(lang.value);
                                                    }
                                                }}
                                                className={`interactive-card p-3 rounded-xl border text-left cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500 outline-none ${
                                                    isSelected 
                                                        ? 'bg-indigo-950/20 border-indigo-500/80 shadow-md shadow-indigo-950/10' 
                                                        : 'bg-slate-900/30 border-slate-800/80'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <span className="text-xl flex-shrink-0" role="img" aria-label={lang.label}>
                                                        {lang.emoji}
                                                    </span>
                                                    <div>
                                                        <div className={`text-xs font-bold transition duration-150 ${
                                                            isSelected ? 'text-indigo-200' : 'text-slate-300'
                                                        }`}>
                                                            {lang.label}
                                                        </div>
                                                        <div className="text-[9px] text-slate-500 leading-normal mt-0.5">
                                                            {lang.desc}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                id="btn-create-project"
                                disabled={loading}
                                className={`glow-btn-primary w-full py-3 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500 outline-none ${
                                    loading ? 'opacity-75 cursor-not-allowed' : ''
                                }`}
                            >
                                {loading ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Provisioning environment…</span>
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-4 h-4" aria-hidden="true" />
                                        <span>Create Workspace</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>

                    {/* CLONE TAB PANEL */}
                    <div 
                        id="clone-panel"
                        role="tabpanel"
                        aria-labelledby="tab-clone"
                        className={tab === 'clone' ? 'block' : 'hidden'}
                    >
                        <form onSubmit={handleCloneProject} className="space-y-5">
                            {/* GitHub URL Input */}
                            <div>
                                <label 
                                    htmlFor="clone-github-url"
                                    className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2"
                                >
                                    GitHub Repo URL
                                </label>
                                <input
                                    id="clone-github-url"
                                    type="url"
                                    value={githubUrl}
                                    onChange={e => setGithubUrl(e.target.value)}
                                    placeholder="https://github.com/username/repository…"
                                    disabled={loading}
                                    required
                                    className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/10 focus:ring-offset-0 outline-none rounded-lg text-slate-200 text-xs transition duration-200"
                                />
                                <p className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-1">
                                    <HelpCircle className="w-3 h-3 text-indigo-400/80 flex-shrink-0" />
                                    <span>Supports public repositories only</span>
                                </p>
                            </div>

                            {/* Cloned Workspace ID */}
                            <div>
                                <label 
                                    htmlFor="clone-repl-id"
                                    className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2"
                                >
                                    New Workspace ID
                                </label>
                                <div className="relative flex items-center">
                                    <input
                                        id="clone-repl-id"
                                        type="text"
                                        value={cloneReplId}
                                        onChange={e => setCloneReplId(e.target.value)}
                                        placeholder="Enter workspace name…"
                                        disabled={loading}
                                        autoComplete="off"
                                        spellCheck={false}
                                        required
                                        className="w-full pl-3.5 pr-20 py-2.5 bg-slate-950/80 border border-slate-800 focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/10 focus:ring-offset-0 outline-none rounded-lg text-slate-200 font-mono text-xs transition duration-200"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => triggerShuffle('clone')}
                                        disabled={loading}
                                        aria-label="Generate random clone project ID"
                                        title="Generate random ID"
                                        className="absolute right-2.5 px-2.5 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/15 text-indigo-300 rounded-md text-[10px] font-bold tracking-wide flex items-center gap-1 cursor-pointer transition duration-150 focus-visible:ring-2 focus-visible:ring-indigo-500 outline-none"
                                    >
                                        <Shuffle className={`w-3 h-3 ${rollAnimation ? 'animate-dice' : ''}`} aria-hidden="true" />
                                        <span>Random</span>
                                    </button>
                                </div>
                            </div>

                            {/* Github Cloning Info Box */}
                            <div className="flex gap-3 p-3.5 rounded-lg bg-indigo-950/10 border border-indigo-500/10 text-xs">
                                <span className="text-base flex-shrink-0">🚀</span>
                                <div className="text-slate-400 leading-relaxed text-[11px]">
                                    We will clone the repository, install dependencies (if `requirements.txt` exists) and map it to a fresh isolated container.
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                id="btn-clone-project"
                                disabled={loading}
                                className={`glow-btn-primary w-full py-3 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500 outline-none ${
                                    loading ? 'opacity-75 cursor-not-allowed' : ''
                                }`}
                            >
                                {loading ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Cloning & building container…</span>
                                    </>
                                ) : (
                                    <>
                                        <ArrowRight className="w-4 h-4" aria-hidden="true" />
                                        <span>Clone & Launch</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Footer Credits */}
                <div className="mt-8 text-center text-[10px] text-slate-600 font-mono tracking-wider">
                    YUVRO CLOUD ENGINE &bull; POWERED BY CONTAINER VIRTUALIZATION
                </div>
            </div>
        </div>
    );
};