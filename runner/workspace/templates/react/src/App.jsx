import { useEffect, useState } from "react";

const API_ROOT = "/api";
const backendUrl = import.meta.env.VITE_BACKEND_URL || "";

export default function App() {
  const [title, setTitle] = useState("");
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function loadTodos() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_ROOT}/all-todo`);
      if (!response.ok) {
        throw new Error(`Failed to load todos (${response.status})`);
      }
      const data = await response.json();
      setTodos(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not reach the FastAPI backend. Configure VITE_BACKEND_URL and restart Vite."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTodos();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();

    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(`${API_ROOT}/todo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: normalizedTitle }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || `Request failed (${response.status})`);
      }

      const createdTodo = await response.json();
      setTodos((currentTodos) => [createdTodo, ...currentTodos]);
      setTitle("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create todo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="app-panel">
        <div className="hero">
          <p className="eyebrow">Yuvro React Starter</p>
          <h1>Todo client for a FastAPI workspace.</h1>
          <p className="copy">
            This app talks to the FastAPI starter through Vite's `/api` proxy.
            Point <code>VITE_BACKEND_URL</code> at your FastAPI project's preview URL.
          </p>
        </div>

        <div className="meta-grid">
          <article className="meta-card">
            <span className="meta-label">Proxy target</span>
            <strong>{backendUrl || "Not configured yet"}</strong>
          </article>
          <article className="meta-card">
            <span className="meta-label">List endpoint</span>
            <strong>/all-todo</strong>
          </article>
        </div>

        <form className="composer" onSubmit={handleSubmit}>
          <label className="composer-label" htmlFor="todo-title">
            Add a todo
          </label>
          <div className="composer-row">
            <input
              id="todo-title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Write a quick task"
            />
            <button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Create"}
            </button>
          </div>
        </form>

        {error ? <div className="notice error">{error}</div> : null}
        {!backendUrl ? (
          <div className="notice">
            Create a `.env` file from `.env.example`, set `VITE_BACKEND_URL`, and restart
            `npm run dev`.
          </div>
        ) : null}

        <section className="list-panel">
          <div className="list-header">
            <h2>Todos</h2>
            <button type="button" className="ghost" onClick={() => void loadTodos()}>
              Refresh
            </button>
          </div>

          {loading ? <p className="empty">Loading todos...</p> : null}
          {!loading && todos.length === 0 ? (
            <p className="empty">No todos yet. Create one from this page or the FastAPI API.</p>
          ) : null}

          <div className="todo-list">
            {todos.map((todo) => (
              <article key={todo.id} className="todo-card">
                <div>
                  <span className="todo-id">#{todo.id}</span>
                  <h3>{todo.title}</h3>
                </div>
                <time dateTime={todo.created_at}>
                  {new Date(todo.created_at).toLocaleString()}
                </time>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
