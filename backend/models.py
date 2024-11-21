import sqlite3
from dataclasses import dataclass
from datetime import datetime
from typing import List, Dict
import random

@dataclass
class Transaction:
    id: int
    wheat_amount: float
    tools_amount: float
    wheat_price: float
    tools_price: float
    timestamp: datetime

@dataclass
class TradeEvent:
    timestamp: datetime
    wheat_amount: float
    tools_amount: float
    wheat_price: float
    tools_price: float
    seller: str
    buyer: str

class Database:
    def __init__(self):
        self.conn = sqlite3.connect('simulation.db')
        self.create_tables()

    def create_tables(self):
        cursor = self.conn.cursor()
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY,
            wheat_amount REAL,
            tools_amount REAL,
            wheat_price REAL,
            tools_price REAL,
            timestamp DATETIME
        )''')
        self.conn.commit()

class MarketSimulation:
    def __init__(self):
        self.village_market = {
            "wheat": 100.0,
            "tools": 0.0,
            "money": 500.0,
            "wheat_production_rate": 2.0,
            "wheat_reserve": 20.0
        }
        
        self.town_market = {
            "wheat": 0.0,
            "tools": 100.0,
            "money": 1000.0,
            "tools_production_rate": 1.0
        }
        
        self.prices = {
            "wheat": 10.0,
            "tools": 10.0
        }
        
        self.trade_history: List[TradeEvent] = []
    
    def update(self):
        # Update production
        if self.village_market["wheat"] < 200:  # Max capacity
            self.village_market["wheat"] += self.village_market["wheat_production_rate"]
        
        if self.town_market["tools"] < 200:  # Max capacity
            self.town_market["tools"] += self.town_market["tools_production_rate"]
        
        # Update prices based on supply/demand
        self._update_prices()
    
    def handle_trade(self, trade: Dict) -> Dict:
        """Handle a trade between town and village"""
        if trade["type"] == "wheat":
            return self._handle_wheat_trade(trade["amount"])
        elif trade["type"] == "tools":
            return self._handle_tools_trade(trade["amount"])
        return {"success": False, "error": "Invalid trade type"}
    
    def _handle_wheat_trade(self, amount: float) -> Dict:
        # Village sells wheat to town
        if self.village_market["wheat"] - amount < self.village_market["wheat_reserve"]:
            return {"success": False, "error": "Insufficient wheat reserves"}
        
        cost = amount * self.prices["wheat"]
        if self.town_market["money"] < cost:
            return {"success": False, "error": "Town cannot afford wheat"}
        
        # Execute trade
        self.village_market["wheat"] -= amount
        self.village_market["money"] += cost
        self.town_market["wheat"] += amount
        self.town_market["money"] -= cost
        
        self.trade_history.append(TradeEvent(
            timestamp=datetime.now(),
            wheat_amount=amount,
            tools_amount=0,
            wheat_price=self.prices["wheat"],
            tools_price=0,
            seller="village",
            buyer="town"
        ))
        
        return {"success": True}
    
    def _handle_tools_trade(self, amount: float) -> Dict:
        # Town sells tools to village
        if self.town_market["tools"] < amount:
            return {"success": False, "error": "Insufficient tools"}
            
        cost = amount * self.prices["tools"]
        if self.village_market["money"] < cost:
            return {"success": False, "error": "Village cannot afford tools"}
        
        # Execute trade
        self.town_market["tools"] -= amount
        self.town_market["money"] += cost
        self.village_market["tools"] += amount
        self.village_market["money"] -= cost
        
        self.trade_history.append(TradeEvent(
            timestamp=datetime.now(),
            wheat_amount=0,
            tools_amount=amount,
            wheat_price=0,
            tools_price=self.prices["tools"],
            seller="town",
            buyer="village"
        ))
        
        return {"success": True}
    
    def _update_prices(self):
        """Update prices based on supply and demand"""
        self.prices["wheat"] = 10.0 * (1 + (self.town_market["wheat"] - 50) / 100)
        self.prices["tools"] = 10.0 * (1 + (self.village_market["tools"] - 50) / 100)
        
        # Ensure minimum prices
        self.prices["wheat"] = max(5.0, min(20.0, self.prices["wheat"]))
        self.prices["tools"] = max(5.0, min(20.0, self.prices["tools"]))
    
    def get_state(self) -> Dict:
        """Get current simulation state"""
        return {
            "village": self.village_market,
            "town": self.town_market,
            "prices": self.prices,
            "recent_trades": [vars(trade) for trade in self.trade_history[-10:]]
        }
