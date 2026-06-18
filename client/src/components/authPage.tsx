import { useState } from "react";
import { LockKeyhole, Mail, UserRound } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { INIT_SERVICE_URL } from "../lib/api";

type Mode = "signin" | "signup";

function GithubMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
      <path d="M12 0C5.373 0 0 5.373 0 12a12.01 12.01 0 0 0 8.207 11.387c.6.111.793-.261.793-.577v-2.234c-3.338.726-4.032-1.416-4.032-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.744.082-.729.082-.729 1.205.085 1.839 1.237 1.839 1.237 1.07 1.834 2.808 1.305 3.493.998.107-.776.418-1.305.761-1.605-2.665-.304-5.466-1.332-5.466-5.93 0-1.312.469-2.381 1.236-3.221-.124-.304-.535-1.524.117-3.176 0 0 1.008-.322 3.3 1.229A11.49 11.49 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.29-1.551 3.298-1.229 3.298-1.229.651 1.652.24 2.872.117 3.176.767.84 1.235 1.909 1.235 3.221 0 4.609-2.804 5.624-5.475 5.921.43.371.814 1.102.814 2.222v3.293c0 .319.192.69.8.576A12.01 12.01 0 0 0 24 12c0-6.627-5.373-12-12-12Z" />
    </svg>
  );
}

export function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isSignup = mode === "signup";
  const authError = searchParams.get("authError");

  const oauthErrorMessage =
    authError === "account_exists_different_signin_method"
      ? "This email is already registered with a different sign-in method."
      : authError === "oauth_failed"
        ? "OAuth sign-in could not be completed."
        : "";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isSignup) {
        await signUp(email.trim(), password, name.trim() || undefined);
      } else {
        await signIn(email.trim(), password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    const origin = window.location.origin;
    window.location.assign(`${INIT_SERVICE_URL}/auth/google?origin=${encodeURIComponent(origin)}`);
  };

  const handleGitHubSignIn = () => {
    const origin = window.location.origin;
    window.location.assign(`${INIT_SERVICE_URL}/auth/github?origin=${encodeURIComponent(origin)}`);
  };

  return (
    <div className="relative min-h-screen overflow-y-auto bg-[#030712] px-4 py-12 text-slate-100">
      <div className="absolute left-[-10%] top-[-10%] h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-10%] h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-6rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/70 shadow-2xl shadow-cyan-950/20 backdrop-blur xl:grid-cols-[1.15fr_0.85fr]">
          <section className="hidden border-r border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_30%),linear-gradient(180deg,#07111f_0%,#020617_100%)] p-10 xl:block">
            <div className="mb-10 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400 font-black text-slate-950">
                Y
              </div>
              <div>
                <div className="text-xl font-semibold text-white">Yuvro</div>
                <div className="text-sm text-slate-400">Cloud IDE for students</div>
              </div>
            </div>

            <div className="space-y-6 text-left">
              <h1 className="m-0 max-w-md text-5xl font-black leading-tight text-white">
                Start coding without touching local setup.
              </h1>
              <p className="max-w-md text-base leading-7 text-slate-300">
                Sign in to create private workspaces, launch frontend and backend projects,
                and return later with your files, environment config, and database data intact.
              </p>
              <div className="grid gap-3 pt-4 text-sm text-slate-200">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                  Instant starter environments for Python, Node, React, and Go.
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                  Sandboxed execution and full-stack preview in one browser tab.
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                  Persistent source files and database data with disposable containers.
                </div>
              </div>
            </div>
          </section>

          <section className="p-6 sm:p-8 xl:p-10">
            <div className="mx-auto max-w-md text-left">
              <div className="mb-8 xl:hidden">
                <div className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
                  Yuvro
                </div>
                <h1 className="m-0 text-3xl font-black text-white">Cloud IDE access</h1>
              </div>

              <div className="mb-6 inline-flex rounded-full border border-slate-800 bg-slate-900 p-1">
                {(["signin", "signup"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setMode(value);
                      setError("");
                    }}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      mode === value
                        ? "bg-cyan-400 text-slate-950"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {value === "signin" ? "Sign in" : "Create account"}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {isSignup && (
                  <label className="block">
                    <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                      Display Name
                    </span>
                    <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3">
                      <UserRound className="h-4 w-4 text-slate-500" />
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ada Lovelace"
                        className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
                      />
                    </div>
                  </label>
                )}

                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                    Email
                  </span>
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3">
                    <Mail className="h-4 w-4 text-slate-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="student@example.com"
                      autoComplete="email"
                      required
                      className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                    Password
                  </span>
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3">
                    <LockKeyhole className="h-4 w-4 text-slate-500" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      autoComplete={isSignup ? "new-password" : "current-password"}
                      required
                      minLength={8}
                      className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
                    />
                  </div>
                </label>

                {(error || oauthErrorMessage) && (
                  <div className="rounded-2xl border border-rose-500/30 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
                    {error || oauthErrorMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Submitting..." : isSignup ? "Create account" : "Sign in"}
                </button>

                <div className="flex items-center gap-3 py-1">
                  <div className="h-px flex-1 bg-slate-800" />
                  <span className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-600">Or</span>
                  <div className="h-px flex-1 bg-slate-800" />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-700 hover:bg-slate-900"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-bold text-slate-950">
                      G
                    </span>
                    Continue with Google
                  </button>

                  <button
                    type="button"
                    onClick={handleGitHubSignIn}
                    className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-700 hover:bg-slate-900"
                  >
                    <GithubMark />
                    Continue with GitHub
                  </button>
                </div>
              </form>

              <p className="mt-5 text-sm leading-6 text-slate-500">
                This is the first authentication layer only. Provider linking can be added later
                without replacing the stored user record.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
