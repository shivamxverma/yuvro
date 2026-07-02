import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { INIT_SERVICE_URL } from "../lib/api";

export function OAuthSuccessPage() {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  useEffect(() => {
    let mounted = true;

    async function finalizeLogin() {
      try {
        const res = await fetch(`${INIT_SERVICE_URL}/auth/me`, {
          credentials: "include",
        });
        if (!res.ok) {
          if (mounted) navigate("/?authError=oauth_failed", { replace: true });
          return;
        }
        const data = await res.json();
        const user = data?.data?.user ?? null;
        if (user && mounted) {
          setUser(user);
          navigate("/", { replace: true });
        } else if (mounted) {
          navigate("/?authError=oauth_failed", { replace: true });
        }
      } catch {
        if (mounted) navigate("/?authError=oauth_failed", { replace: true });
      }
    }

    void finalizeLogin();

    return () => {
      mounted = false;
    };
  }, [navigate, setUser]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#030712] px-4 text-center text-slate-300">
      Finalizing sign-in...
    </div>
  );
}
