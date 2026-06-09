import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import socketio
import uvicorn
from app.ws import init_ws

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')

init_ws(sio) 

socket_app = socketio.ASGIApp(sio, fastapi_app=app)

if __name__ == "__main__":
    port = int(os.getenv("PORT", 3001))
    
    uvicorn.run("app.main:socket_app", host="0.0.0.0", port=port, reload=True)
