import './App.css';
import type { ReactElement } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { AuthPage } from './components/authPage';
import { LandingPage } from './components/landing';
import { CodingPage } from './components/codingPage';

function HomeRoute() {
  const { user, loading } = useAuth();
  if (loading) return <FullscreenMessage label="Loading account..." />;
  return user ? <LandingPage /> : <AuthPage />;
}

function ProtectedRoute({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();
  if (loading) return <FullscreenMessage label="Checking session..." />;
  if (!user) return <Navigate to="/" replace />;
  return children;
}

function FullscreenMessage({ label }: { label: string }) {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#030712] text-sm font-medium text-slate-400">
      {label}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route
            path="/coding"
            element={
              <ProtectedRoute>
                <CodingPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App;
