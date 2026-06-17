import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function OAuthSuccessPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  useEffect(() => {
    let mounted = true;

    void refreshUser()
      .then((user) => {
        if (mounted) {
          navigate(user ? "/" : "/?authError=oauth_failed", { replace: true });
        }
      })
      .catch(() => {
        if (mounted) {
          navigate("/?authError=oauth_failed", { replace: true });
        }
      });

    return () => {
      mounted = false;
    };
  }, [navigate, refreshUser]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#030712] px-4 text-center text-slate-300">
      Finalizing Google sign-in...
    </div>
  );
}
