import socketio
from app.core.config import log_to_file
from app.services.terminal import TerminalManager

terminal_manager = TerminalManager()


def init_ws(sio: socketio.AsyncServer):
    @sio.event
    async def connect(sid, environ):
        query_string = environ.get("QUERY_STRING", "")
        repl_id = ""
        for part in query_string.split("&"):
            if part.startswith("replId="):
                repl_id = part[len("replId="):]
                break

        async with sio.session(sid) as session:
            session["repl_id"] = repl_id

        print(f"[WS Connected] Session: {sid}, Repl ID: {repl_id}")

    @sio.event
    async def disconnect(sid):
        print(f"[WS Disconnected] Session: {sid}")
        terminal_manager.detach_client(sid)

    @sio.on("requestTerminal")
    async def on_request_terminal(sid):
        log_to_file(f"[WS requestTerminal] Received for Sid: {sid}")
        session = await sio.get_session(sid)
        repl_id = session.get("repl_id", "")
        if not repl_id:
            await sio.emit("terminal", {"data": "Project session is missing.\r\n"}, to=sid)
            return

        async def on_terminal_output(decoded_output: str):
            await sio.emit("terminal", {"data": decoded_output}, to=sid)

        terminal_manager.attach_client(repl_id, sid, on_terminal_output)
        await sio.emit("terminalReady", {"ready": True}, to=sid)

    @sio.on("terminalData")
    async def on_terminal_data(sid, data):
        log_to_file(f"[WS TerminalData Received] Session: {sid}, Data: {data!r}")
        typed_char = data.get("data", "") if isinstance(data, dict) else data
        log_to_file(f"[WS TerminalData Writing] Session: {sid}, Char: {typed_char!r}")
        terminal_manager.write(sid, typed_char)
