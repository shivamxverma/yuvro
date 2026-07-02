# Yuvro React Todo Starter

This frontend is meant to pair with the FastAPI todo starter in another project inside the same Yuvro workspace.

## Setup

1. Create a FastAPI project from the starter.
2. Open that FastAPI project and provision Postgres from the **Database** tab.
3. Start the FastAPI project.
4. Copy `.env.example` to `.env`.
5. Set `VITE_BACKEND_URL` to the FastAPI project's preview URL.
6. Start the React project.

The Vite dev server proxies `/api/*` to `VITE_BACKEND_URL`, so the UI calls:

- `POST /todo`
- `GET /all-todo`

## Run command

```bash
npm install
npm run dev -- --host 0.0.0.0 --port 8000
```
