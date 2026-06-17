import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Code,
  FolderKanban,
  HelpCircle,
  LogOut,
  Plus,
  Shuffle,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { INIT_SERVICE_URL } from '../lib/api';

const Github = ({ className }: { className?: string }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
  </svg>
);

const SLUG_WORDS = ['car', 'dog', 'computer', 'person', 'inside', 'word', 'for', 'please', 'to', 'cool', 'open', 'source'];

function getRandomSlug() {
  let slug = '';
  for (let i = 0; i < 3; i += 1) {
    slug += SLUG_WORDS[Math.floor(Math.random() * SLUG_WORDS.length)];
  }
  return slug;
}

const PythonIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="5.5" fill="#0C1524" />
    <path d="M12 4.5c-2.48 0-2.86 1.07-2.86 2.37v1.48h2.9v.44H7.94c-1.24 0-2.14.95-2.14 2.14v3.42c0 1.2.95 2.14 2.14 2.14h1.18v-1.63c0-1.24.95-2.14 2.14-2.14h2.9c1.2 0 2.14-.95 2.14-2.14V7.94c0-1.2-.95-2.14-2.14-2.14H12c-.01 0 0-1.3-.01-1.3zm-1.07 1.11c.33 0 .6.27.6.6c0 .33-.27.6-.6.6a.6.6 0 0 1-.6-.6c0-.33.27-.6.6-.6z" fill="#3776AB" />
    <path d="M12 19.5c2.48 0 2.86-1.07 2.86-2.37v-1.48h-2.9v-.44h4.1c1.24 0 2.14-.95 2.14-2.14V9.65c0-1.2-.95-2.14-2.14-2.14h-1.18v1.63c0 1.24-.95 2.14-2.14 2.14h-2.9c-1.2 0-2.14.95-2.14 2.14v2.71c0 1.2.95 2.14 2.14 2.14H12c.01 0 0 1.3.01 1.3zm1.07-1.11a.6.6 0 1 1 0-1.2.6.6 0 0 1 0 1.2z" fill="#FFE052" />
  </svg>
);

const FastApiIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="5.5" fill="#00211E" />
    <path d="M12.5 4L6.5 13H11.5L10.5 20L17.5 11H12L13.5 4H12.5Z" fill="#FFFFFF" />
    <path d="M11.5 4L5.5 13H10.5L9.5 20L16.5 11H11L12.5 4H11.5Z" fill="#009688" opacity="0.6" />
    <path d="M12 4.5L6 13.5h5V20l6.5-9h-5l1.5-6.5z" stroke="#009688" strokeWidth="0.8" />
  </svg>
);

const DjangoIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="5.5" fill="#092E20" />
    <path d="M14.5 5.5H13v5.5c-.5-.7-1.4-1.1-2.3-1.1-1.8 0-3.3 1.5-3.3 3.3s1.5 3.3 3.3 3.3c.9 0 1.8-.4 2.3-1.1V17.5h1.5v-12zm-3.8 10c-1 0-1.8-.8-1.8-1.8s.8-1.8 1.8-1.8 1.8.8 1.8 1.8-.8 1.8-1.8 1.8z" fill="#FFFFFF" />
    <path d="M15 5.5h-2v5.5c-.7-.7-1.7-1.1-2.8-1.1-2.2 0-4 1.8-4 4s1.8 4 4 4c1.1 0 2.1-.4 2.8-1.1V18h2V5.5z" stroke="#44B78B" strokeWidth="0.8" opacity="0.5" />
  </svg>
);

const FlaskIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="5.5" fill="#1C1C1C" />
    <path d="M15 5h-1V4h-4v1H9v5.2L5.8 16.6C5 18 6 19.5 7.6 19.5h8.8c1.6 0 2.6-1.5 1.8-2.9L15 10.2V5z" stroke="#FF5252" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7.4 16.5h9.2l-1.6-2.8H9l-1.6 2.8z" fill="#FF5252" opacity="0.8" />
    <circle cx="10" cy="13" r="0.8" fill="#FFF" opacity="0.6" />
    <circle cx="13" cy="14" r="0.6" fill="#FFF" opacity="0.6" />
  </svg>
);

const LANGUAGES = [
  { value: 'python', label: 'Python', icon: <PythonIcon className="w-full h-full" />, desc: 'Standard Python 3 backend environment' },
  { value: 'fastapi', label: 'FastAPI', icon: <FastApiIcon className="w-full h-full" />, desc: 'High-performance Python web APIs' },
  { value: 'django', label: 'Django', icon: <DjangoIcon className="w-full h-full" />, desc: 'The web framework for perfectionists' },
  { value: 'flask', label: 'Flask', icon: <FlaskIcon className="w-full h-full" />, desc: 'Lightweight WSGI web application framework' },
];

type ProjectSummary = {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  type: string;
  createdAt: string;
  updatedAt: string;
};

type WorkspaceSummary = {
  id: string;
  ownerUserId: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  projects: ProjectSummary[];
};

type WorkspaceListResponse = {
  workspaces: WorkspaceSummary[];
};

type ProjectBootstrapResponse = {
  workspace: { id: string };
  project: { id: string };
};

type WorkspaceTargetMode = 'new' | 'existing';

const WorkspaceModeToggle = ({
  mode,
  setMode,
  disabled,
  hasWorkspaces,
}: {
  mode: WorkspaceTargetMode;
  setMode: (mode: WorkspaceTargetMode) => void;
  disabled: boolean;
  hasWorkspaces: boolean;
}) => {
  if (!hasWorkspaces) {
    return null;
  }

  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Target</label>
      <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-1.5">
        <button
          type="button"
          onClick={() => setMode('existing')}
          disabled={disabled}
          className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
            mode === 'existing'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
          }`}
        >
          Existing Workspace
        </button>
        <button
          type="button"
          onClick={() => setMode('new')}
          disabled={disabled}
          className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
            mode === 'new'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
          }`}
        >
          New Workspace
        </button>
      </div>
    </div>
  );
};

export const LandingPage = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<'create' | 'clone'>('create');
  const [language, setLanguage] = useState('python');
  const [workspaceName, setWorkspaceName] = useState('My Workspace');
  const [projectName, setProjectName] = useState(getRandomSlug());
  const [githubUrl, setGithubUrl] = useState('');
  const [cloneWorkspaceName, setCloneWorkspaceName] = useState('Imported Workspace');
  const [cloneProjectName, setCloneProjectName] = useState(getRandomSlug());
  const [createMode, setCreateMode] = useState<WorkspaceTargetMode>('new');
  const [cloneMode, setCloneMode] = useState<WorkspaceTargetMode>('new');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [error, setError] = useState('');
  const [rollAnimation, setRollAnimation] = useState(false);

  const selectedWorkspace = workspaces.find(workspace => workspace.id === selectedWorkspaceId) ?? null;

  const fetchWorkspaces = async () => {
    setLoadingWorkspaces(true);
    try {
      const response = await fetch(`${INIT_SERVICE_URL}/workspaces`, {
        credentials: 'include',
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to load workspaces.');
      }
      const payload: WorkspaceListResponse = await response.json();
      setWorkspaces(payload.workspaces);
      setSelectedWorkspaceId(currentId => {
        if (currentId && payload.workspaces.some(workspace => workspace.id === currentId)) {
          return currentId;
        }
        return payload.workspaces[0]?.id ?? '';
      });
      if (payload.workspaces.length > 0) {
        setCreateMode(current => (current === 'existing' || current === 'new' ? current : 'existing'));
        setCloneMode(current => (current === 'existing' || current === 'new' ? current : 'existing'));
      } else {
        setCreateMode('new');
        setCloneMode('new');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load workspaces.');
    } finally {
      setLoadingWorkspaces(false);
    }
  };

  useEffect(() => {
    if (!user) {
      return;
    }
    void fetchWorkspaces();
  }, [user]);

  useEffect(() => {
    if (workspaces.length === 0) {
      setCreateMode('new');
      setCloneMode('new');
      return;
    }
    if (!selectedWorkspaceId) {
      setSelectedWorkspaceId(workspaces[0].id);
    }
  }, [selectedWorkspaceId, workspaces]);

  const triggerShuffle = (target: 'create' | 'clone') => {
    setRollAnimation(true);
    window.setTimeout(() => setRollAnimation(false), 600);
    if (target === 'create') {
      setProjectName(getRandomSlug());
      return;
    }
    setCloneProjectName(getRandomSlug());
  };

  const openProject = (workspaceId: string, projectId: string) => {
    navigate(`/coding/?workspaceId=${workspaceId}&projectId=${projectId}`);
  };

  const createTemplatePayload = () => {
    if (createMode === 'existing') {
      if (!selectedWorkspace) {
        throw new Error('Select a workspace first.');
      }
      return {
        url: `${INIT_SERVICE_URL}/workspaces/${selectedWorkspace.id}/projects/template`,
        body: {
          projectName: projectName.trim(),
          type: language,
        },
      };
    }

    return {
      url: `${INIT_SERVICE_URL}/workspaces/bootstrap/template`,
      body: {
        workspaceName: workspaceName.trim(),
        projectName: projectName.trim(),
        type: language,
      },
    };
  };

  const createClonePayload = () => {
    if (cloneMode === 'existing') {
      if (!selectedWorkspace) {
        throw new Error('Select a workspace first.');
      }
      return {
        url: `${INIT_SERVICE_URL}/workspaces/${selectedWorkspace.id}/projects/clone`,
        body: {
          projectName: cloneProjectName.trim(),
          githubUrl: githubUrl.trim(),
        },
      };
    }

    return {
      url: `${INIT_SERVICE_URL}/workspaces/bootstrap/clone`,
      body: {
        workspaceName: cloneWorkspaceName.trim(),
        projectName: cloneProjectName.trim(),
        githubUrl: githubUrl.trim(),
      },
    };
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!projectName.trim()) {
      setError('Project name is required.');
      return;
    }
    if (createMode === 'new' && !workspaceName.trim()) {
      setError('Workspace name is required.');
      return;
    }
    if (createMode === 'existing' && !selectedWorkspace) {
      setError('Select an existing workspace.');
      return;
    }

    setLoading(true);
    try {
      const { url, body } = createTemplatePayload();
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to create project.');
      }
      const payload: ProjectBootstrapResponse = await response.json();
      navigate(`/coding/?workspaceId=${payload.workspace.id}&projectId=${payload.project.id}`);
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleCloneProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!githubUrl.trim()) {
      setError('GitHub URL cannot be empty.');
      return;
    }
    if (
      !githubUrl.trim().startsWith('https://github.com/') &&
      !githubUrl.trim().startsWith('http://github.com/') &&
      !githubUrl.trim().startsWith('git@github.com:')
    ) {
      setError('Please enter a valid GitHub URL (e.g. https://github.com/user/repo).');
      return;
    }
    if (!cloneProjectName.trim()) {
      setError('Project name is required.');
      return;
    }
    if (cloneMode === 'new' && !cloneWorkspaceName.trim()) {
      setError('Workspace name is required.');
      return;
    }
    if (cloneMode === 'existing' && !selectedWorkspace) {
      setError('Select an existing workspace.');
      return;
    }

    setLoading(true);
    try {
      const { url, body } = createClonePayload();
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to clone project.');
      }
      const payload: ProjectBootstrapResponse = await response.json();
      navigate(`/coding/?workspaceId=${payload.workspace.id}&projectId=${payload.project.id}`);
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#030712] bg-grid-pattern px-4 py-12 text-slate-100">
      <div className="absolute left-[-10%] top-[-15%] h-[50%] w-[50%] rounded-full bg-indigo-900/20 blur-[120px] pointer-events-none mesh-bg-animated" />
      <div className="absolute bottom-[-15%] right-[-10%] h-[50%] w-[50%] rounded-full bg-blue-900/15 blur-[120px] pointer-events-none mesh-bg-animated" />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-col gap-4 rounded-3xl border border-slate-800/80 bg-slate-950/55 p-6 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-3 rounded-full border border-indigo-500/20 bg-indigo-950/40 px-3 py-2 shadow-lg shadow-indigo-950/20">
              <Sparkles className="h-4 w-4 animate-pulse text-indigo-400" aria-hidden="true" />
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">Cloud Code Sandbox</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-xl font-extrabold text-white shadow-lg shadow-indigo-500/30">
                Y
              </div>
              <h1 className="m-0 text-3xl font-extrabold tracking-tight text-white">Yuvro</h1>
            </div>
            <p className="mt-2 max-w-xl text-sm text-slate-400">
              Manage multiple projects inside a workspace, then launch any project into its own isolated coding runtime.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start rounded-full border border-slate-800 bg-slate-950/70 px-4 py-2 text-xs text-slate-300 md:self-center">
            <span className="max-w-[220px] truncate">{user?.name || user?.email}</span>
            <button
              type="button"
              onClick={() => {
                void signOut();
              }}
              className="inline-flex items-center gap-1 text-slate-400 transition hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign out</span>
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.95fr] lg:items-start">
          <section className="glass-card flex min-h-0 flex-col rounded-3xl p-6 lg:max-h-[calc(100vh-14rem)]">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <FolderKanban className="h-4 w-4 text-indigo-300" />
                  <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-300">Your Workspaces</h2>
                </div>
                <p className="mt-2 text-xs text-slate-500">Select a workspace to add another project or reopen an existing one.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setError('');
                  void fetchWorkspaces();
                }}
                disabled={loadingWorkspaces}
                className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-[11px] font-semibold text-slate-300 transition hover:border-indigo-500/40 hover:text-white"
              >
                Refresh
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              {loadingWorkspaces ? (
                <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-slate-800/80 bg-slate-950/50 text-sm text-slate-400">
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                    <span>Loading workspaces…</span>
                  </div>
                </div>
              ) : workspaces.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">
                  No workspaces yet. Create the first project on the right and Yuvro will create the workspace automatically.
                </div>
              ) : (
                <div className="space-y-4">
                  {workspaces.map(workspace => {
                    const isSelected = workspace.id === selectedWorkspaceId;
                    return (
                      <div
                        key={workspace.id}
                        className={`rounded-2xl border p-4 transition ${
                          isSelected
                            ? 'border-indigo-500/70 bg-indigo-950/20 shadow-lg shadow-indigo-950/10'
                            : 'border-slate-800 bg-slate-950/40'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedWorkspaceId(workspace.id);
                            setCreateMode('existing');
                            setCloneMode('existing');
                            setError('');
                          }}
                          className="w-full text-left"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-white">{workspace.name}</div>
                              <div className="mt-1 text-[11px] text-slate-500">{workspace.projects.length} project{workspace.projects.length === 1 ? '' : 's'}</div>
                            </div>
                            {isSelected ? (
                              <span className="rounded-full border border-indigo-500/30 bg-indigo-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-indigo-200">
                                Selected
                              </span>
                            ) : null}
                          </div>
                        </button>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {workspace.projects.map(project => (
                            <button
                              key={project.id}
                              type="button"
                              onClick={() => openProject(workspace.id, project.id)}
                              className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-[11px] font-medium text-slate-200 transition hover:border-indigo-500/40 hover:text-white"
                            >
                              {project.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="glass-card rounded-3xl p-6 md:p-8">
            <div className="mb-6 flex bg-slate-950/60 p-1.5 rounded-xl border border-slate-800/80" role="tablist" aria-label="Project Actions">
              <button
                role="tab"
                aria-selected={tab === 'create'}
                aria-controls="create-panel"
                id="tab-create"
                tabIndex={0}
                onClick={() => {
                  setTab('create');
                  setError('');
                }}
                className={`flex-1 flex items-center justify-center gap-2.5 py-2.5 rounded-lg font-semibold text-xs transition-all duration-200 ${
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
                onClick={() => {
                  setTab('clone');
                  setError('');
                }}
                className={`flex-1 flex items-center justify-center gap-2.5 py-2.5 rounded-lg font-semibold text-xs transition-all duration-200 ${
                  tab === 'clone'
                    ? 'bg-gradient-to-r from-indigo-600 to-blue-500 text-white shadow-md shadow-indigo-600/15'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                }`}
              >
                <Github className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Clone from GitHub</span>
              </button>
            </div>

            {error ? (
              <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-500/20 bg-red-950/20 p-3 text-xs text-red-300">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" aria-hidden="true" />
                <div>
                  <span className="font-semibold">Error:</span> {error}
                </div>
              </div>
            ) : null}

            <div id="create-panel" role="tabpanel" aria-labelledby="tab-create" className={tab === 'create' ? 'block' : 'hidden'}>
              <form onSubmit={handleCreateProject} className="space-y-5">
                <WorkspaceModeToggle
                  mode={createMode}
                  setMode={setCreateMode}
                  disabled={loading}
                  hasWorkspaces={workspaces.length > 0}
                />

                {createMode === 'existing' ? (
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Selected Workspace</label>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-3.5 py-3 text-xs text-slate-200">
                      {selectedWorkspace ? selectedWorkspace.name : 'Choose a workspace from the list on the left.'}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label htmlFor="create-workspace-name" className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                      Workspace Name
                    </label>
                    <input
                      id="create-workspace-name"
                      type="text"
                      value={workspaceName}
                      onChange={e => setWorkspaceName(e.target.value)}
                      placeholder="My Workspace"
                      disabled={loading}
                      required={createMode === 'new'}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/80 px-3.5 py-2.5 text-xs text-slate-200 outline-none transition duration-200 focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/10"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="create-project-name" className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                    Project Name
                  </label>
                  <div className="relative flex items-center">
                    <input
                      id="create-project-name"
                      type="text"
                      value={projectName}
                      onChange={e => setProjectName(e.target.value)}
                      placeholder="python-api"
                      disabled={loading}
                      autoComplete="off"
                      spellCheck={false}
                      required
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/80 pl-3.5 pr-20 py-2.5 font-mono text-xs text-slate-200 outline-none transition duration-200 focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/10"
                    />
                    <button
                      type="button"
                      onClick={() => triggerShuffle('create')}
                      disabled={loading}
                      aria-label="Generate random project name"
                      className="absolute right-2.5 flex items-center gap-1 rounded-md border border-indigo-500/15 bg-indigo-500/10 px-2.5 py-1 text-[10px] font-bold tracking-wide text-indigo-300 transition duration-150 hover:bg-indigo-500/20"
                    >
                      <Shuffle className={`h-3 w-3 ${rollAnimation ? 'animate-dice' : ''}`} aria-hidden="true" />
                      <span>Random</span>
                    </button>
                  </div>
                  <p className="mt-1.5 text-[10px] text-slate-500">Project slugs are derived automatically on the backend.</p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2.5">Select Environment</label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Environment choices">
                    {LANGUAGES.map(lang => {
                      const isSelected = language === lang.value;
                      return (
                        <div
                          key={lang.value}
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
                          className={`interactive-card rounded-xl border p-3 text-left outline-none ${
                            isSelected
                              ? 'border-indigo-500/80 bg-indigo-950/20 shadow-md shadow-indigo-950/10'
                              : 'border-slate-800/80 bg-slate-900/30'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-800/60 bg-slate-950/40 p-0.5">
                              {lang.icon}
                            </div>
                            <div>
                              <div className={`text-xs font-bold ${isSelected ? 'text-indigo-200' : 'text-slate-300'}`}>{lang.label}</div>
                              <div className="mt-0.5 text-[9px] leading-normal text-slate-500">{lang.desc}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`glow-btn-primary w-full rounded-lg py-3 text-xs font-bold text-white flex items-center justify-center gap-2 ${
                    loading ? 'cursor-not-allowed opacity-75' : ''
                  }`}
                >
                  {loading ? (
                    <>
                      <div className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      <span>Provisioning environment…</span>
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      <span>{createMode === 'existing' ? 'Add Project To Workspace' : 'Create Workspace'}</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            <div id="clone-panel" role="tabpanel" aria-labelledby="tab-clone" className={tab === 'clone' ? 'block' : 'hidden'}>
              <form onSubmit={handleCloneProject} className="space-y-5">
                <WorkspaceModeToggle
                  mode={cloneMode}
                  setMode={setCloneMode}
                  disabled={loading}
                  hasWorkspaces={workspaces.length > 0}
                />

                <div>
                  <label htmlFor="clone-github-url" className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
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
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/80 px-3.5 py-2.5 text-xs text-slate-200 outline-none transition duration-200 focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/10"
                  />
                  <p className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-500">
                    <HelpCircle className="h-3 w-3 flex-shrink-0 text-indigo-400/80" />
                    <span>Supports public repositories only</span>
                  </p>
                </div>

                {cloneMode === 'existing' ? (
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Selected Workspace</label>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-3.5 py-3 text-xs text-slate-200">
                      {selectedWorkspace ? selectedWorkspace.name : 'Choose a workspace from the list on the left.'}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label htmlFor="clone-workspace-name" className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                      Workspace Name
                    </label>
                    <input
                      id="clone-workspace-name"
                      type="text"
                      value={cloneWorkspaceName}
                      onChange={e => setCloneWorkspaceName(e.target.value)}
                      placeholder="Imported Workspace"
                      disabled={loading}
                      required={cloneMode === 'new'}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/80 px-3.5 py-2.5 text-xs text-slate-200 outline-none transition duration-200 focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/10"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="clone-project-name" className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                    Project Name
                  </label>
                  <div className="relative flex items-center">
                    <input
                      id="clone-project-name"
                      type="text"
                      value={cloneProjectName}
                      onChange={e => setCloneProjectName(e.target.value)}
                      placeholder="github-import"
                      disabled={loading}
                      autoComplete="off"
                      spellCheck={false}
                      required
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/80 pl-3.5 pr-20 py-2.5 font-mono text-xs text-slate-200 outline-none transition duration-200 focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/10"
                    />
                    <button
                      type="button"
                      onClick={() => triggerShuffle('clone')}
                      disabled={loading}
                      aria-label="Generate random clone project name"
                      className="absolute right-2.5 flex items-center gap-1 rounded-md border border-indigo-500/15 bg-indigo-500/10 px-2.5 py-1 text-[10px] font-bold tracking-wide text-indigo-300 transition duration-150 hover:bg-indigo-500/20"
                    >
                      <Shuffle className={`h-3 w-3 ${rollAnimation ? 'animate-dice' : ''}`} aria-hidden="true" />
                      <span>Random</span>
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 rounded-lg border border-indigo-500/10 bg-indigo-950/10 p-3.5 text-xs">
                  <Github className="h-4 w-4 flex-shrink-0 text-indigo-300" />
                  <div className="text-[11px] leading-relaxed text-slate-400">
                    Yuvro will clone the repository into the workspace and launch it as a separate project runtime.
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`glow-btn-primary w-full rounded-lg py-3 text-xs font-bold text-white flex items-center justify-center gap-2 ${
                    loading ? 'cursor-not-allowed opacity-75' : ''
                  }`}
                >
                  {loading ? (
                    <>
                      <div className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      <span>Cloning & building container…</span>
                    </>
                  ) : (
                    <>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      <span>{cloneMode === 'existing' ? 'Clone Into Workspace' : 'Clone & Launch'}</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
