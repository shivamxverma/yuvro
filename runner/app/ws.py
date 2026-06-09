import os
import socketio
from app.fs import BASE_DIR, fetch_dir, fetch_file_content, save_file
from app.aws import save_to_s3
from app.pty import TerminalManager

terminal_manager = TerminalManager()

def init_ws(sio: socketio.AsyncServer):
    
    @sio.event
    async def connect(sid, environ):
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
                        
        repl_id = host.split('.')[0] if host else ""
        
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
        
        await save_file(full_path, content)
        
        async with sio.session(sid) as session:
            repl_id = session.get("repl_id", "")
            
        if repl_id:
            await save_to_s3(f"yuvro/code/{repl_id}", file_path, content)

    @sio.on("requestTerminal")
    async def on_request_terminal(sid):
        async def on_terminal_output(decoded_output: str):
            await sio.emit("terminal", {"data": decoded_output}, to=sid)
            
        terminal_manager.create_pty(sid, on_terminal_output)

    @sio.on("terminalData")
    async def on_terminal_data(sid, data):
        if isinstance(data, dict):
            typed_char = data.get("data", "")
        else:
            typed_char = data
            
        terminal_manager.write(sid, typed_char)
