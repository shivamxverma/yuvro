import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { INIT_SERVICE_URL } from "../lib/api";

export type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function parseJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail =
      typeof payload === "object" && payload && "detail" in payload
        ? String((payload as { detail?: string }).detail)
        : "Request failed.";
    throw new Error(detail);
  }
  return payload as T;
}

async function fetchMe(): Promise<AuthUser | null> {
  const response = await fetch(`${INIT_SERVICE_URL}/auth/me`, {
    credentials: "include",
  });
  if (response.status === 401) {
    return null;
  }
  const payload = await parseJson<{ user: AuthUser }>(response);
  return payload.user;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async (): Promise<AuthUser | null> => {
    try {
      const user = await fetchMe();
      if (user) {
        setUser(user);
        return user;
      }

      const refreshResponse = await fetch(`${INIT_SERVICE_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!refreshResponse.ok) {
        setUser(null);
        return null;
      }

      const refreshedUser = await fetchMe();
      setUser(refreshedUser);
      return refreshedUser;
    } catch {
      setUser(null);
      return null;
    }
  };

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, []);

  const signIn = async (email: string, password: string) => {
    const response = await fetch(`${INIT_SERVICE_URL}/auth/signin`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const payload = await parseJson<{ user: AuthUser }>(response);
    setUser(payload.user);
  };

  const signUp = async (email: string, password: string, name?: string) => {
    const response = await fetch(`${INIT_SERVICE_URL}/auth/signup`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    const payload = await parseJson<{ user: AuthUser }>(response);
    setUser(payload.user);
  };

  const signOut = async () => {
    await fetch(`${INIT_SERVICE_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
