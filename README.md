# Medieval Town Simulation

A simple economic simulation of a medieval town and village trading system.

## Setup

1. Activate the virtual environment:

```
.\venv\Scripts\activate
```

2. Start the backend server (keep this terminal open):

```
cd backend
python simulation.py
```

The backend server will run on http://127.0.0.1:8001

3. n a new terminal, start a simple HTTP server for the frontend (keep this terminal open):
   - First, activate the virtual environment as shown in step 2 above
   - Then run:

```
cd frontend
python -m http.server 8000
```

The frontend will be available at http://127.0.0.1:8000
