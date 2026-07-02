# Yuvro FastAPI Todo Starter

This starter is built to test Yuvro's FastAPI runtime plus the Database Viewer.

## What it does

- `POST /todo` creates a todo
- `GET /todo` returns the latest todo
- `GET /todo/{id}` returns one todo
- `GET /all-todo` returns every todo

## Database setup inside Yuvro

1. Open the **Database** tab.
2. Click **Add Connection**.
3. Choose **Postgres**.
4. Click the button that provisions a containerized database.
5. Save the generated connection profile.
6. Start the FastAPI app.

The API automatically reads the first saved Postgres connection from `.yuvro/db_connections.json`.

## Run command

```bash
.venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## Sample request

```bash
curl -X POST http://127.0.0.1:8000/todo \
  -H "Content-Type: application/json" \
  -d '{"title":"Ship Yuvro Postgres demo"}'
```
