import sqlite3
from dataclasses import dataclass
from datetime import datetime

@dataclass
class Transaction:
    id: int
    wheat_amount: float
    tools_amount: float
    wheat_price: float
    tools_price: float
    timestamp: datetime

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
