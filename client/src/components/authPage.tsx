import { useState } from "react";
import { LockKeyhole, Mail, UserRound } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

type Mode = "signin" | "signup";

export function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isSignup = mode === "signup";

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

                {error && (
                  <div className="rounded-2xl border border-rose-500/30 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Submitting..." : isSignup ? "Create account" : "Sign in"}
                </button>
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
