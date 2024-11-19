from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from models import Database, Transaction
from pydantic import BaseModel

app = FastAPI()
db = Database()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://127.0.0.1:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class MarketState(BaseModel):
    wheat_demand: float
    wheat_supply: float
    tools_demand: float
    tools_supply: float

def calculate_price(demand: float, supply: float, base_price: float = 10.0):
    # More dynamic price calculation
    demand_factor = float(demand) / 50.0  # Normalize to 1.0 at middle demand
    supply_factor = float(supply) / 50.0
    
    # Calculate price with increased volatility
    price = base_price * (demand_factor / supply_factor if supply_factor > 0 else 2)
    
    # Add minimum and maximum bounds
    return min(max(price, base_price * 0.2), base_price * 5.0)

@app.post("/update_market")
async def update_market(state: MarketState):
    wheat_price = calculate_price(state.wheat_demand, state.wheat_supply)
    tools_price = calculate_price(state.tools_demand, state.tools_supply)
    return {"wheat_price": wheat_price, "tools_price": tools_price}

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8001)
