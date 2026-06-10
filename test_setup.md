# Step-by-Step Guide: Testing the Web IDE with a Todo App

This guide walks you through verifying the core features of the **Yuvro Online IDE** (File Explorer, Code Editor, Interactive Terminal, App Preview, and SQLite Database Viewer) by building a fully-featured FastAPI Todo application.

---

## Phase 1: Set Up and Start the Web IDE Services

Before you begin, make sure Docker Desktop is running on your Mac.

1. **Build the Runner Docker Image**:
   Open a terminal in the root of the project directory (`/Users/shivamverma/Desktop/projects/replit/yuvro-assignment`) and run:
   ```bash
   make build-runner-image
   ```

2. **Start the Web IDE Services Concurrently**:
   Run the following command from the root directory:
   ```bash
   make dev
   ```
   This will concurrently spin up:
   * **Init-Service** on [http://localhost:3001](http://localhost:3001)
   * **Orchestrator** on [http://localhost:3002](http://localhost:3002)
   * **Frontend Client** on [http://localhost:5173](http://localhost:5173)

3. **Access the Workspace**:
   Navigate to the following URL in your web browser:
   ```url
   http://localhost:5173/coding/?replId=todo-test-workspace
   ```
   *(Note: The first launch takes a few seconds as the orchestrator spins up the Docker workspace container and installs dependencies in the background).*

---

## Phase 2: Implement the Todo Application in the IDE

Once the workspace loads, you will see a clean dark-themed IDE containing a file explorer on the left, a code editor in the middle, and terminal/app preview/database tabs at the bottom.

### 1. Update the requirements.txt
In the File Explorer, click on `requirements.txt` to open it in the editor. Verify that it contains:
```txt
fastapi
uvicorn
```
If you make any changes, they will be auto-saved.

### 2. Implement the FastAPI Server (`main.py`)
Double-click `main.py` in the file explorer and replace its contents with the following code. This script configures a SQLite database `todo.db`, provides API endpoints for CRUD operations, and serves a modern responsive HTML frontend:

```python
import sqlite3
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import List

app = FastAPI()

DB_FILE = "todo.db"

# Initialize SQLite database and create a todos table if it doesn't exist
def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS todos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            completed BOOLEAN NOT NULL DEFAULT 0
        )
    """)
    conn.commit()
    conn.close()

init_db()

class Todo(BaseModel):
    id: int
    title: str
    completed: bool

class TodoCreate(BaseModel):
    title: str

@app.get("/todos", response_model=List[Todo])
def get_todos():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT id, title, completed FROM todos")
    rows = cursor.fetchall()
    todos = [{"id": r["id"], "title": r["title"], "completed": bool(r["completed"])} for r in rows]
    conn.close()
    return todos

@app.post("/todos", response_model=Todo)
def create_todo(todo: TodoCreate):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("INSERT INTO todos (title, completed) VALUES (?, 0)", (todo.title,))
    todo_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"id": todo_id, "title": todo.title, "completed": False}

@app.post("/todos/{todo_id}/toggle")
def toggle_todo(todo_id: int):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT completed FROM todos WHERE id = ?", (todo_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Todo not found")
    new_status = 1 if row[0] == 0 else 0
    cursor.execute("UPDATE todos SET completed = ? WHERE id = ?", (new_status, todo_id))
    conn.commit()
    conn.close()
    return {"status": "updated", "completed": bool(new_status)}

@app.post("/todos/{todo_id}/delete")
def delete_todo(todo_id: int):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM todos WHERE id = ?", (todo_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}

@app.get("/", response_class=HTMLResponse)
def index():
    return """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>FastAPI Web IDE Todo App</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&display=swap" rel="stylesheet">
        <style>
            body {
                font-family: 'Inter', sans-serif;
                background-color: #0f172a;
                color: #f8fafc;
                display: flex;
                flex-direction: column;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                padding: 2rem;
            }
            .container {
                width: 100%;
                max-width: 500px;
                background-color: #1e293b;
                border-radius: 12px;
                padding: 2rem;
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
                border: 1px solid #334155;
            }
            h1 {
                text-align: center;
                margin-top: 0;
                font-weight: 600;
                background: linear-gradient(to right, #818cf8, #c084fc);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            .form-group {
                display: flex;
                gap: 0.5rem;
                margin-bottom: 1.5rem;
            }
            input[type="text"] {
                flex: 1;
                padding: 0.75rem;
                border-radius: 6px;
                border: 1px solid #475569;
                background-color: #0f172a;
                color: #fff;
                font-size: 1rem;
                outline: none;
            }
            input[type="text"]:focus {
                border-color: #6366f1;
            }
            button {
                padding: 0.75rem 1.25rem;
                background-color: #6366f1;
                color: #fff;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 600;
                transition: background-color 0.2s;
            }
            button:hover {
                background-color: #4f46e5;
            }
            ul {
                list-style: none;
                padding: 0;
                margin: 0;
            }
            li {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0.75rem 1rem;
                background-color: #334155;
                border-radius: 6px;
                margin-bottom: 0.5rem;
                border: 1px solid #475569;
            }
            .todo-text {
                cursor: pointer;
                user-select: none;
                flex: 1;
            }
            .completed {
                text-decoration: line-through;
                color: #94a3b8;
            }
            .delete-btn {
                background-color: #ef4444;
                padding: 0.25rem 0.5rem;
                font-size: 0.85rem;
            }
            .delete-btn:hover {
                background-color: #dc2626;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Todo App</h1>
            <div class="form-group">
                <input type="text" id="todo-input" placeholder="What needs to be done?">
                <button onclick="addTodo()">Add</button>
            </div>
            <ul id="todo-list"></ul>
        </div>

        <script>
            async function fetchTodos() {
                const res = await fetch('todos');
                const todos = await res.json();
                const list = document.getElementById('todo-list');
                list.innerHTML = '';
                todos.forEach(todo => {
                    const li = document.createElement('li');
                    
                    const span = document.createElement('span');
                    span.className = 'todo-text' + (todo.completed ? ' completed' : '');
                    span.innerText = todo.title;
                    span.onclick = () => toggleTodo(todo.id);
                    
                    const btn = document.createElement('button');
                    btn.className = 'delete-btn';
                    btn.innerText = 'Delete';
                    btn.onclick = (e) => {
                        e.stopPropagation();
                        deleteTodo(todo.id);
                    };

                    li.appendChild(span);
                    li.appendChild(btn);
                    list.appendChild(li);
                });
            }

            async function addTodo() {
                const input = document.getElementById('todo-input');
                const title = input.value.trim();
                if (!title) return;
                await fetch('todos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: title })
                });
                input.value = '';
                fetchTodos();
            }

            async function toggleTodo(id) {
                await fetch(`todos/${id}/toggle`, { method: 'POST' });
                fetchTodos();
            }

            async function deleteTodo(id) {
                await fetch(`todos/${id}/delete`, { method: 'POST' });
                fetchTodos();
            }

            // Load initial list
            fetchTodos();
        </script>
    </body>
    </html>
    """

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

---

## Phase 3: Execute and Verify IDE Core Functionality

### 1. Verify the Interactive Terminal
1. Look at the bottom pane of your IDE and click on the **Terminal** tab.
2. In the terminal command prompt, start the FastAPI server:
   ```bash
   python3 main.py
   ```
3. You should see logs confirming that Uvicorn is running and listening on `http://0.0.0.0:8000`.

### 2. Verify the App Preview (Live Iframe Integration)
1. Click the **App Preview** tab next to the Terminal.
2. Make sure the port input box displays **`8000`** (which matches the port in `main.py`).
3. Click the **Refresh** icon or wait for the iframe to load.
4. You should see the sleek, custom Todo App interface!
5. **Interactive check**:
   * Add a few tasks (e.g., "Verify Terminal", "Inspect SQLite DB", "Test Live Preview").
   * Click on a task to toggle it to completed (it will cross out).
   * Delete one of the tasks to confirm deletion updates are working.

### 3. Verify the Database Viewer
1. Click on the **Database** tab in the bottom pane.
2. You should see the Database inspector sidebar.
3. Click **Scan Workspace** (or click the Refresh icon) to discover SQLite files.
4. From the dropdown catalog of databases, select **`todo.db`**.
5. Once selected, click the **Refresh** button next to it.
6. The viewer will inspect `todo.db` and display the **`todos`** table:
   * Double-click on `todos` to view its records.
   * You should see columns `id` (integer), `title` (text), and `completed` (boolean) populated with the tasks you just created in the preview!
7. Select **Query Console** tab:
   * Try running a custom SELECT query:
     ```sql
     SELECT * FROM todos WHERE completed = 0;
     ```
   * Press **Execute Query** and verify the results list.
   * *(Note: Trying to run `INSERT` or other modification queries in this custom panel will be gracefully blocked to enforce read-only safety, verifying security configurations).*

---

### Phase 4: Clean Up

When you are done testing:
1. Press `Ctrl + C` in the IDE terminal to stop the FastAPI server.
2. Press `Ctrl + C` in your host terminal (running `make dev`) to terminate client and orchestrator processes.
3. To purge the Docker environment, docker containers and networks:
   ```bash
   docker rm -f yuvro-repl-todo-test-workspace
   ```
