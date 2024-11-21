from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from models import MarketSimulation, TradeEvent
from typing import Dict
from fastapi.websockets import WebSocket
import json
import asyncio

app = FastAPI()
simulation = MarketSimulation()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://127.0.0.1:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # Update simulation and send state
            simulation.update()
            state = simulation.get_state()
            await websocket.send_json(state)
            await asyncio.sleep(0.1)  # 100ms update interval
    except Exception as e:
        print(f"WebSocket error: {e}")

@app.post("/trade")
async def execute_trade(trade: Dict):
    result = simulation.handle_trade(trade)
    return result

@app.get("/state")
async def get_state():
    return simulation.get_state()

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8001)
