import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Clock3,
  FolderKanban,
  GitBranch,
  HelpCircle,
  Layers3,
  Shuffle,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { INIT_SERVICE_URL } from '../lib/api';

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

const CppIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="5.5" fill="#0B1220" />
    <path d="M12 4.5L6 8v8l6 3.5 6-3.5V8L12 4.5z" fill="#1E88E5" opacity="0.18" />
    <path d="M12 4.5L6 8v8l6 3.5 6-3.5V8L12 4.5z" stroke="#60A5FA" strokeWidth="1.1" />
    <path d="M10.4 9.6a2.8 2.8 0 1 0 0 4.8" stroke="#E5F0FF" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13.55 10.55v3.1M12 12.1h3.1" stroke="#E5F0FF" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M16.8 10.55v3.1M15.25 12.1h3.1" stroke="#E5F0FF" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

const ReactIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="5.5" fill="#06141D" />
    <circle cx="12" cy="12" r="1.8" fill="#61DAFB" />
    <ellipse cx="12" cy="12" rx="7.1" ry="2.8" stroke="#61DAFB" strokeWidth="1.2" />
    <ellipse cx="12" cy="12" rx="7.1" ry="2.8" transform="rotate(60 12 12)" stroke="#61DAFB" strokeWidth="1.2" />
    <ellipse cx="12" cy="12" rx="7.1" ry="2.8" transform="rotate(120 12 12)" stroke="#61DAFB" strokeWidth="1.2" />
  </svg>
);

const LANGUAGES = [
  { value: 'python', label: 'Python', icon: <PythonIcon className="h-full w-full" />, desc: 'General backend runtime' },
  { value: 'fastapi', label: 'FastAPI', icon: <FastApiIcon className="h-full w-full" />, desc: 'High-speed Python APIs' },
  { value: 'django', label: 'Django', icon: <DjangoIcon className="h-full w-full" />, desc: 'Full web framework stack' },
  { value: 'flask', label: 'Flask', icon: <FlaskIcon className="h-full w-full" />, desc: 'Lightweight Python app' },
  { value: 'react', label: 'React', icon: <ReactIcon className="h-full w-full" />, desc: 'Vite frontend workspace' },
  { value: 'cpp', label: 'C++', icon: <CppIcon className="h-full w-full" />, desc: 'Native compile-and-run' },
];

const HANDY_LINKS = ['Workspace guide', 'How to launch', 'Import from GitHub', 'Project templates', 'Status'];
const COMPANY_LINKS = ['About', 'Brand', 'Careers', 'Education', 'Startups'];
const LEGAL_LINKS = ['Terms', 'Commercial agreement', 'Privacy', 'DPA', 'Report abuse'];
const CONNECT_LINKS = ['X / Twitter', 'TikTok', 'Instagram', 'LinkedIn'];

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

function formatWorkspaceDate(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return 'Recently';
  }
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatWorkspaceCount(count: number) {
  return `${count} project${count === 1 ? '' : 's'}`;
}

const PanelLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8f867d]">{children}</div>
);

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
    <div className="inline-flex rounded-full border border-[#dfd6ce] bg-white p-1">
      <button
        type="button"
        onClick={() => setMode('existing')}
        disabled={disabled}
        className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
          mode === 'existing' ? 'bg-[#ff5a1f] text-white' : 'text-[#6c635b] hover:text-[#2f2f34]'
        }`}
      >
        Existing workspace
      </button>
      <button
        type="button"
        onClick={() => setMode('new')}
        disabled={disabled}
        className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
          mode === 'new' ? 'bg-[#ff5a1f] text-white' : 'text-[#6c635b] hover:text-[#2f2f34]'
        }`}
      >
        New workspace
      </button>
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
  const selectedWorkspaceProjects = selectedWorkspace?.projects ?? [];
  const totalProjects = workspaces.reduce((count, workspace) => count + workspace.projects.length, 0);

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
    window.setTimeout(() => setRollAnimation(false), 500);
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

  const handleCreateProject = async (event: React.FormEvent) => {
    event.preventDefault();
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

  const handleCloneProject = async (event: React.FormEvent) => {
    event.preventDefault();
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
    <div className="min-h-screen bg-[#f3efeb] text-[#2f2f34]">
      <div className="mx-auto max-w-[1440px] px-5 pb-16 pt-6 sm:px-8 lg:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-full border border-[#e5ddd6] bg-[#f7f3ef] px-5 py-4">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 grid-cols-2 gap-1 rounded-xl bg-transparent p-1">
                <span className="rounded-sm bg-[#ff5a1f]" />
                <span className="rounded-sm bg-transparent" />
                <span className="rounded-sm bg-[#ff5a1f]" />
                <span className="rounded-sm bg-[#ff5a1f]" />
              </div>
              <span className="text-[2rem] font-black tracking-[-0.06em]">Yuvro</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#ff5a1f] px-3 py-1 text-sm font-semibold text-white">
              Launch
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">{workspaces.length + 1}</span>
            </span>
            <div className="hidden text-sm text-[#5e5751] sm:block">{user?.name || user?.email}</div>
            <button
              type="button"
              onClick={() => {
                void signOut();
              }}
              className="rounded-full px-4 py-2 text-sm font-medium text-[#3e3934] transition hover:bg-[#ebe3dc]"
            >
              Log out
            </button>
            <button
              type="button"
              className="rounded-full border border-[#ff5a1f] px-5 py-2 text-sm font-semibold text-[#ff5a1f]"
            >
              Active session
            </button>
          </div>
        </header>

        <section className="pt-10 text-center sm:pt-14">
          <div className="mx-auto max-w-4xl">
            <h1 style={{ color: '#000000' }} className="m-0 text-[3rem] font-black tracking-[-0.08em] sm:text-[5.5rem]">
              What will you build Today
            </h1>
            <p className="mt-4 text-lg text-[#6a635d]">
              Launch a fresh environment, import a repository, or reopen an existing workspace.
            </p>
          </div>

          <div className="mx-auto mt-8 max-w-3xl rounded-[2rem] border border-[#f4b49b] bg-[#f7f3ef] p-4 shadow-[0_20px_60px_rgba(105,88,74,0.08)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-full border border-[#e3d9d0] bg-white p-1">
                <button
                  type="button"
                  onClick={() => {
                    setTab('create');
                    setError('');
                  }}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    tab === 'create' ? 'bg-[#ff5a1f] text-white' : 'text-[#6c635b]'
                  }`}
                >
                  New Project
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab('clone');
                    setError('');
                  }}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    tab === 'clone' ? 'bg-[#ff5a1f] text-white' : 'text-[#6c635b]'
                  }`}
                >
                  Clone from GitHub
                </button>
              </div>

              <div className="rounded-full bg-[#efe8e2] px-3 py-2 text-xs font-semibold text-[#7b7269]">
                {selectedWorkspace ? `${selectedWorkspace.name} targeted` : 'Auto-create workspace'}
              </div>
            </div>

            {error ? (
              <div className="mt-4 flex items-start gap-2 rounded-2xl border border-[#f6b8a7] bg-[#fff1eb] px-4 py-3 text-left text-sm text-[#b43a1a]">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            <div className="mt-4 text-left">
              {tab === 'create' ? (
                <form onSubmit={handleCreateProject} className="space-y-4">
                  <WorkspaceModeToggle
                    mode={createMode}
                    setMode={setCreateMode}
                    disabled={loading}
                    hasWorkspaces={workspaces.length > 0}
                  />

                  <div className="rounded-[1.75rem] border border-[#eadfd6] bg-white p-5">
                    <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                      <div>
                        <PanelLabel>Workspace Name</PanelLabel>
                        {createMode === 'existing' ? (
                          <div className="rounded-2xl border border-[#ece3db] bg-[#f7f3ef] px-4 py-3 text-sm font-medium text-[#3b3531]">
                            {selectedWorkspace ? selectedWorkspace.name : 'Choose a workspace below'}
                          </div>
                        ) : (
                          <input
                            value={workspaceName}
                            onChange={e => setWorkspaceName(e.target.value)}
                            placeholder="My Workspace"
                            disabled={loading}
                            className="w-full rounded-2xl border border-[#ece3db] bg-[#f8f5f1] px-4 py-3 text-sm text-[#2f2f34] outline-none transition focus:border-[#ff5a1f]"
                          />
                        )}
                      </div>

                      <div className="min-w-[12rem]">
                        <PanelLabel>Template</PanelLabel>
                        <div className="rounded-2xl border border-[#ece3db] bg-[#f8f5f1] px-4 py-3 text-sm font-medium text-[#3b3531]">
                          Blank runtime
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <PanelLabel>Project Name</PanelLabel>
                      <div className="relative">
                        <input
                          value={projectName}
                          onChange={e => setProjectName(e.target.value)}
                          placeholder="python-api"
                          disabled={loading}
                          className="w-full rounded-2xl border border-[#ece3db] bg-[#f8f5f1] px-4 py-4 pr-24 font-mono text-base text-[#2f2f34] outline-none transition focus:border-[#ff5a1f]"
                        />
                        <button
                          type="button"
                          onClick={() => triggerShuffle('create')}
                          disabled={loading}
                          className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-full bg-[#fce5dc] px-3 py-2 text-xs font-semibold text-[#ff5a1f]"
                        >
                          <Shuffle className={`h-3.5 w-3.5 ${rollAnimation ? 'animate-dice' : ''}`} />
                          Random
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      {LANGUAGES.map(lang => {
                        const selected = language === lang.value;
                        return (
                          <button
                            key={lang.value}
                            type="button"
                            onClick={() => setLanguage(lang.value)}
                            className={`rounded-[1.5rem] border p-4 text-left transition ${
                              selected
                                ? 'border-[#ff5a1f] bg-[#fff1eb]'
                                : 'border-[#ece3db] bg-[#faf7f4] hover:bg-white'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 overflow-hidden rounded-xl border border-[#e6ddd5] bg-white p-1.5">
                                {lang.icon}
                              </div>
                              <div>
                                <div className="text-sm font-semibold text-[#2f2f34]">{lang.label}</div>
                                <div className="mt-1 text-xs text-[#7b7269]">{lang.desc}</div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm text-[#7b7269]">Pick a stack and Yuvro will create the runtime automatically.</div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex items-center gap-2 rounded-full bg-[#ff5a1f] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-70"
                    >
                      {loading ? 'Creating workspace…' : createMode === 'existing' ? 'Add project' : 'Create workspace'}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleCloneProject} className="space-y-4">
                  <WorkspaceModeToggle
                    mode={cloneMode}
                    setMode={setCloneMode}
                    disabled={loading}
                    hasWorkspaces={workspaces.length > 0}
                  />

                  <div className="rounded-[1.75rem] border border-[#eadfd6] bg-white p-5">
                    <div>
                      <PanelLabel>GitHub Repository</PanelLabel>
                      <input
                        value={githubUrl}
                        onChange={e => setGithubUrl(e.target.value)}
                        placeholder="https://github.com/username/repository"
                        disabled={loading}
                        className="w-full rounded-2xl border border-[#ece3db] bg-[#f8f5f1] px-4 py-4 text-base text-[#2f2f34] outline-none transition focus:border-[#ff5a1f]"
                      />
                      <div className="mt-2 flex items-center gap-1 text-xs text-[#7b7269]">
                        <HelpCircle className="h-3.5 w-3.5" />
                        Supports public repositories only
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <PanelLabel>Workspace Name</PanelLabel>
                        {cloneMode === 'existing' ? (
                          <div className="rounded-2xl border border-[#ece3db] bg-[#f7f3ef] px-4 py-3 text-sm font-medium text-[#3b3531]">
                            {selectedWorkspace ? selectedWorkspace.name : 'Choose a workspace below'}
                          </div>
                        ) : (
                          <input
                            value={cloneWorkspaceName}
                            onChange={e => setCloneWorkspaceName(e.target.value)}
                            placeholder="Imported Workspace"
                            disabled={loading}
                            className="w-full rounded-2xl border border-[#ece3db] bg-[#f8f5f1] px-4 py-3 text-sm text-[#2f2f34] outline-none transition focus:border-[#ff5a1f]"
                          />
                        )}
                      </div>

                      <div>
                        <PanelLabel>Project Name</PanelLabel>
                        <div className="relative">
                          <input
                            value={cloneProjectName}
                            onChange={e => setCloneProjectName(e.target.value)}
                            placeholder="github-import"
                            disabled={loading}
                            className="w-full rounded-2xl border border-[#ece3db] bg-[#f8f5f1] px-4 py-3 pr-24 font-mono text-sm text-[#2f2f34] outline-none transition focus:border-[#ff5a1f]"
                          />
                          <button
                            type="button"
                            onClick={() => triggerShuffle('clone')}
                            disabled={loading}
                            className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-full bg-[#fce5dc] px-3 py-1.5 text-xs font-semibold text-[#ff5a1f]"
                          >
                            <Shuffle className={`h-3.5 w-3.5 ${rollAnimation ? 'animate-dice' : ''}`} />
                            Random
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-2 rounded-full bg-[#ebe4de] px-4 py-2 text-sm text-[#655d56]">
                      <GitBranch className="h-4 w-4 text-[#ff5a1f]" />
                      Clone and launch inside its own workspace runtime
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex items-center gap-2 rounded-full bg-[#ff5a1f] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-70"
                    >
                      {loading ? 'Cloning repository…' : cloneMode === 'existing' ? 'Clone into workspace' : 'Clone and launch'}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          <div className="mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-3">
            {LANGUAGES.map(lang => (
              <button
                key={lang.value}
                type="button"
                onClick={() => {
                  setTab('create');
                  setLanguage(lang.value);
                }}
                className="rounded-full border border-[#ddd5cd] bg-[#f7f3ef] px-4 py-2 text-sm font-medium text-[#5f5750] transition hover:border-[#ff5a1f] hover:text-[#ff5a1f]"
              >
                {lang.label}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-16 grid gap-6 lg:grid-cols-[1.25fr_0.9fr]">
          <article className="overflow-hidden rounded-[3rem] bg-[#f5a98d] p-8 text-left sm:p-10">
            <div className="text-sm text-[#7e4330]">Workspace Studio</div>
            <div className="mt-2 max-w-md text-[3.2rem] font-black leading-[0.95] tracking-[-0.08em] text-[#2f2f34] sm:text-[4.5rem]">
              Design your workflow freely
            </div>
            <p className="mt-6 max-w-sm text-base leading-7 text-[#6a4a3e]">
              Create blank environments, import repos, and keep related projects together so you can move through ideas without context switching.
            </p>
            <div className="mt-8 rounded-[2rem] border border-[#b36d56] bg-[#f6b39b]/40 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-[#b36d56] bg-[#f9c2af]/60 p-4">
                  <div className="text-sm font-semibold text-[#2f2f34]">Selected Workspace</div>
                  <div className="mt-2 text-2xl font-black tracking-[-0.05em] text-[#2f2f34]">
                    {selectedWorkspace?.name ?? 'Autocreate'}
                  </div>
                </div>
                <div className="rounded-2xl border border-[#b36d56] bg-[#f9c2af]/60 p-4">
                  <div className="text-sm font-semibold text-[#2f2f34]">Projects Ready</div>
                  <div className="mt-2 text-2xl font-black tracking-[-0.05em] text-[#2f2f34]">{totalProjects}</div>
                </div>
              </div>
            </div>
          </article>

          <article className="rounded-[2.5rem] bg-[#dcd5cf] p-8 sm:p-10">
            <div className="text-sm text-[#726a63]">Parallel Workspaces</div>
            <div className="mt-3 text-[3.1rem] font-black leading-none tracking-[-0.08em] text-[#2f2f34] sm:text-[4.2rem]">
              Move faster
            </div>
            <p className="mt-5 text-base leading-7 text-[#5f5851]">
              Keep templates, imports, and active projects visible at the same time. Handle workspace targeting, launch, and reopening from one place.
            </p>
            <div className="mt-8 flex items-center gap-3 rounded-2xl bg-[#f2ede8] px-4 py-4">
              <Sparkles className="h-5 w-5 text-[#ff5a1f]" />
              <span className="text-sm font-medium text-[#4e4842]">
                {selectedWorkspace ? `${selectedWorkspace.name} is ready for the next launch.` : 'Your next workspace will be created automatically.'}
              </span>
            </div>
          </article>
        </section>

        <section className="mt-16 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[2.5rem] bg-[#2f2b2c] p-8 text-white sm:p-10">
            <div className="flex items-center gap-2 text-sm text-white/60">
              <Layers3 className="h-4 w-4" />
              Workspace Directory
            </div>
            <div className="mt-4 text-[3.1rem] font-black leading-none tracking-[-0.08em] text-white sm:text-[4.2rem]">
              Ship anything
            </div>
            <p className="mt-5 max-w-lg text-base leading-7 text-white/70">
              Reopen any project in a selected workspace, keep related code together, and add new runtimes without rebuilding your context from scratch.
            </p>

            <div className="mt-8 space-y-4">
              {loadingWorkspaces ? (
                <div className="rounded-[2rem] border border-white/10 bg-white/5 px-5 py-6 text-sm text-white/70">
                  Loading workspaces…
                </div>
              ) : workspaces.length === 0 ? (
                <div className="rounded-[2rem] border border-white/10 bg-white/5 px-5 py-6 text-sm leading-7 text-white/70">
                  No workspaces yet. Create the first one from the launch panel above and Yuvro will add it here.
                </div>
              ) : (
                workspaces.map(workspace => {
                  const selected = workspace.id === selectedWorkspaceId;
                  return (
                    <div
                      key={workspace.id}
                      className={`rounded-[1.8rem] border px-5 py-5 transition ${
                        selected ? 'border-[#ff8a62] bg-[#3b3536]' : 'border-white/10 bg-white/[0.04]'
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
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-xl font-semibold text-white">{workspace.name}</div>
                            <div className="mt-1 text-sm text-white/55">
                              {formatWorkspaceCount(workspace.projects.length)} · Updated {formatWorkspaceDate(workspace.updatedAt)}
                            </div>
                          </div>
                          {selected ? (
                            <span className="rounded-full bg-[#ff5a1f] px-3 py-1 text-xs font-semibold text-white">Active</span>
                          ) : null}
                        </div>
                      </button>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {workspace.projects.length > 0 ? (
                          workspace.projects.map(project => (
                            <button
                              key={project.id}
                              type="button"
                              onClick={() => openProject(workspace.id, project.id)}
                              className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs font-medium text-white/85 transition hover:border-white/20"
                            >
                              {project.name}
                            </button>
                          ))
                        ) : (
                          <div className="text-sm text-white/50">No projects yet</div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-[3rem] bg-[#ff7447] p-8 sm:p-10">
            <div className="text-sm text-[#7a371f]">Support for Teams</div>
            <div className="mt-3 text-[3.2rem] font-black leading-none tracking-[-0.08em] text-[#2f2f34] sm:text-[4.6rem]">
              Build together
            </div>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#693928]">
              Your team can plan the app while Yuvro handles workspace targeting, project creation, and GitHub imports in the right order.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[2rem] bg-[#f6d1c5] p-5 text-[#2f2f34]">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <FolderKanban className="h-4 w-4" />
                  Selected workspace
                </div>
                <div className="mt-4 text-2xl font-black tracking-[-0.05em]">
                  {selectedWorkspace?.name ?? 'Autocreate'}
                </div>
                <div className="mt-2 text-sm text-[#5d4a41]">
                  {selectedWorkspace ? formatWorkspaceCount(selectedWorkspaceProjects.length) : 'First workspace created automatically'}
                </div>
              </div>

              <div className="rounded-[2rem] bg-[#f6d1c5] p-5 text-[#2f2f34]">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Clock3 className="h-4 w-4" />
                  Status
                </div>
                <div className="mt-4 text-2xl font-black tracking-[-0.05em]">{loading ? 'Working…' : 'Ready'}</div>
                <div className="mt-2 text-sm text-[#5d4a41]">
                  Launch a template or import a repo from the studio above.
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  setTab('create');
                  setError('');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="rounded-full border border-[#d24f29] bg-[#fff2ec] px-5 py-3 text-sm font-semibold text-[#ff5a1f]"
              >
                Deep dive into studio
              </button>
              <button
                type="button"
                onClick={() => {
                  setError('');
                  void fetchWorkspaces();
                }}
                className="text-sm font-semibold text-[#2f2f34] underline underline-offset-4"
              >
                Refresh the directory
              </button>
            </div>
          </div>
        </section>

        <footer className="mt-20 grid gap-10 border-t border-[#e1d9d2] pt-12 lg:grid-cols-2">
          <div className="grid gap-10 sm:grid-cols-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f867d]">Handy Links</div>
              <div className="mt-4 space-y-2">
                {HANDY_LINKS.map(item => (
                  <div key={item} className="text-[1.05rem] text-[#5d5650]">
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f867d]">Company</div>
              <div className="mt-4 space-y-2">
                {COMPANY_LINKS.map(item => (
                  <div key={item} className="text-[1.05rem] text-[#5d5650]">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-10 sm:grid-cols-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f867d]">Legal</div>
              <div className="mt-4 space-y-2">
                {LEGAL_LINKS.map(item => (
                  <div key={item} className="text-[1.05rem] text-[#5d5650]">
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f867d]">Connect</div>
              <div className="mt-4 space-y-2">
                {CONNECT_LINKS.map(item => (
                  <div key={item} className="text-[1.05rem] text-[#5d5650]">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
