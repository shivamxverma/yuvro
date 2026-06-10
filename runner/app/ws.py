import os
import asyncio
import socketio
from app.fs import BASE_DIR, fetch_dir, fetch_file_content, save_file, create_file, create_folder, delete_path
from app.aws import save_to_s3
from app.pty import TerminalManager, log_to_file

terminal_manager = TerminalManager()

def init_ws(sio: socketio.AsyncServer):
    
    @sio.event
    async def connect(sid, environ):
        # Primary: read replId from Socket.IO query param (sent by client)
        query_string = environ.get('QUERY_STRING', '')
        repl_id = ''
        for part in query_string.split('&'):
            if part.startswith('replId='):
                repl_id = part[len('replId='):]
                break

        # Fallback: try to extract from Host header subdomain (legacy)
        if not repl_id:
            host = environ.get('HTTP_HOST', '')
            if not host:
                headers = environ.get('headers', {})
                if isinstance(headers, dict):
                    host = headers.get('host', '')
                elif isinstance(headers, list):
                    for k, v in headers:
                        if k.lower() == b'host':
                            host = v.decode('utf-8')
                            break
            if host and '.' in host:
                repl_id = host.split('.')[0]

        async with sio.session(sid) as session:
            session['repl_id'] = repl_id

        print(f"[WS Connected] Session: {sid}, Repl ID: {repl_id}")

        try:
            root_content = await fetch_dir(BASE_DIR, "")
            await sio.emit("loaded", {"rootContent": root_content}, to=sid)
        except Exception as e:
            print(f"[WS Error] Failed to read root directory: {e}")


    @sio.event
    async def disconnect(sid):
        print(f"[WS Disconnected] Session: {sid}")
        terminal_manager.clear(sid)

    @sio.on("fetchDir")
    async def on_fetch_dir(sid, dir_path):
        full_path = os.path.join(BASE_DIR, dir_path)
        contents = await fetch_dir(full_path, dir_path)
        return contents

    @sio.on("fetchContent")
    async def on_fetch_content(sid, data):
        file_path = data.get("path", "")
        full_path = os.path.join(BASE_DIR, file_path)
        content = await fetch_file_content(full_path)
        return content

    @sio.on("updateContent")
    async def on_update_content(sid, data):
        file_path = data.get("path", "")
        content = data.get("content", "")
        full_path = os.path.join(BASE_DIR, file_path)
        
        # Save to disk first (fast, blocking)
        await save_file(full_path, content)
        
        # Fire-and-forget S3 upload in background (non-blocking)
        async with sio.session(sid) as session:
            repl_id = session.get("repl_id", "")
            
        if repl_id:
            asyncio.ensure_future(save_to_s3(f"yuvro/code/{repl_id}", file_path, content))
        
        # Acknowledge save to client so it can show "Saved" indicator
        return {"ok": True}

    @sio.on("requestTerminal")
    async def on_request_terminal(sid):
        log_to_file(f"[WS requestTerminal] Received for Sid: {sid}")
        async def on_terminal_output(decoded_output: str):
            await sio.emit("terminal", {"data": decoded_output}, to=sid)

        async with sio.session(sid) as session:
            repl_id = session.get("repl_id", "")

        terminal_manager.create_pty(sid, on_terminal_output, repl_id=repl_id)

    @sio.on("terminalData")
    async def on_terminal_data(sid, data):
        log_to_file(f"[WS TerminalData Received] Session: {sid}, Data: {data!r}")
        if isinstance(data, dict):
            typed_char = data.get("data", "")
        else:
            typed_char = data
            
        log_to_file(f"[WS TerminalData Writing] Session: {sid}, Char: {typed_char!r}")
        terminal_manager.write(sid, typed_char)

    @sio.on("createFile")
    async def on_create_file(sid, data):
        file_path = data.get("path", "")
        full_path = os.path.join(BASE_DIR, file_path)
        await create_file(full_path)
        # Return updated listing of the parent directory
        parent = os.path.dirname(file_path)
        parent_full = os.path.join(BASE_DIR, parent) if parent else BASE_DIR
        contents = await fetch_dir(parent_full, parent)
        return {"success": True, "dirContents": contents}

    @sio.on("createFolder")
    async def on_create_folder(sid, data):
        folder_path = data.get("path", "")
        full_path = os.path.join(BASE_DIR, folder_path)
        await create_folder(full_path)
        parent = os.path.dirname(folder_path)
        parent_full = os.path.join(BASE_DIR, parent) if parent else BASE_DIR
        contents = await fetch_dir(parent_full, parent)
        return {"success": True, "dirContents": contents}

    @sio.on("deletePath")
    async def on_delete_path(sid, data):
        path = data.get("path", "")
        full_path = os.path.join(BASE_DIR, path)
        await delete_path(full_path)
        parent = os.path.dirname(path)
        parent_full = os.path.join(BASE_DIR, parent) if parent else BASE_DIR
        contents = await fetch_dir(parent_full, parent)
        return {"success": True, "dirContents": contents}
