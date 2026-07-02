import { useState } from "react";
import { LockKeyhole, Mail, UserRound } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { INIT_SERVICE_URL } from "../lib/api";

type Mode = "signin" | "signup";

function GithubMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-neutral-700">
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
    <div className="relative flex min-h-screen items-center justify-center bg-neutral-50/60 px-4 py-12 text-neutral-800">
      <div className="w-full max-w-md bg-white border border-neutral-200/80 rounded-2xl shadow-xl shadow-neutral-100/50 p-8 transition-all">
        {/* Logo and Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-900 font-black text-white text-lg shadow-sm mb-4">
            Y
          </div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">Welcome to Yuvro</h1>
          <p className="mt-1 text-sm text-neutral-500">Sign in to access your cloud workspaces</p>
        </div>

        {/* Tab Toggle */}
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-neutral-100 p-1 mb-6">
          {(["signin", "signup"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setMode(value);
                setError("");
              }}
              className={`rounded-md py-1.5 text-xs font-medium transition-all ${
                mode === value
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-800"
              }`}
            >
              {value === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignup && (
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                Display Name
              </span>
              <div className="relative flex items-center">
                <UserRound className="absolute left-3.5 h-4 w-4 text-neutral-400" />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ada Lovelace"
                  required
                  className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-10 pr-4 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all"
                />
              </div>
            </label>
          )}

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Email
            </span>
            <div className="relative flex items-center">
              <Mail className="absolute left-3.5 h-4 w-4 text-neutral-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@example.com"
                autoComplete="email"
                required
                className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-10 pr-4 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all"
              />
            </div>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Password
            </span>
            <div className="relative flex items-center">
              <LockKeyhole className="absolute left-3.5 h-4 w-4 text-neutral-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete={isSignup ? "new-password" : "current-password"}
                required
                minLength={8}
                className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-10 pr-4 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all"
              />
            </div>
          </label>

          {(error || oauthErrorMessage) && (
            <div className="rounded-xl border border-rose-100 bg-rose-50/50 px-4 py-3 text-sm text-rose-600">
              {error || oauthErrorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-neutral-900 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Submitting..." : isSignup ? "Create account" : "Sign in"}
          </button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-neutral-100"></div>
            <span className="flex-shrink mx-3 text-[10px] text-neutral-400 uppercase tracking-widest">
              Or continue with
            </span>
            <div className="flex-grow border-t border-neutral-100"></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white py-2.5 px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 active:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-200"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.41 0-6.177-2.767-6.177-6.177S10.584 6.16 13.993 6.16c1.558 0 2.977.579 4.062 1.53l3.057-3.057C19.262 2.913 16.793 2 13.993 2 8.474 2 4 6.474 4 12s4.474 10 9.993 10c5.777 0 9.643-4.06 9.643-9.8 0-.665-.06-1.3-.176-1.915H12.24Z"
                />
              </svg>
              <span>Google</span>
            </button>

            <button
              type="button"
              onClick={handleGitHubSignIn}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white py-2.5 px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 active:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-200"
            >
              <GithubMark />
              <span>GitHub</span>
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-[11px] text-neutral-400 leading-normal">
          This is the first authentication layer only. Provider linking can be added later.
        </p>
      </div>
    </div>
  );
}
