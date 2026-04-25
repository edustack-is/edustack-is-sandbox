#!/bin/bash

echo "🛑 Shutting down EduStack services..."

# 1. Kill by Ports
PORTS=(3000 3001 5173)
for port in "${PORTS[@]}"; do
    PID=$(lsof -t -i :$port)
    if [ ! -z "$PID" ]; then
        echo "Cleaning port $port (PID: $PID)..."
        kill -9 $PID 2>/dev/null
    fi
done

# 2. Kill by Process Patterns (Node/Wrangler/Nest)
# We use -f to match the full command line
pkill -9 -f "node" 2>/dev/null
pkill -9 -f "nest" 2>/dev/null
pkill -9 -f "wrangler" 2>/dev/null
pkill -9 -f "vite" 2>/dev/null

echo "✅ All services terminated. Ports 3000, 3001, and 5173 are now free."
