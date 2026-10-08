#!/bin/bash
# ==============================================================================
# Pear Desktop Remote - Runner Script
# ==============================================================================

# Navigate to the directory where this script is located
cd "$(dirname "$0")" || exit

PORT=8080

# Clean up lingering background instances safely on exit
cleanup() {
    echo -e "\nStopping servers..."
    kill "$PYTHON_PID" "$CF_PID" 2>/dev/null
    exit 0
}
trap cleanup SIGINT SIGTERM

clear
echo "=================================================="
echo " Starting YTM Remote Proxy & Cloudflare Tunnel... "
echo "=================================================="
echo ""

# Start the separated Python proxy server in the background
python3 proxy.py &
PYTHON_PID=$!

# Give the server a moment to spin up
sleep 1

# Start account-free Cloudflare quick tunnel
cloudflared tunnel --url "http://localhost:$PORT" &
CF_PID=$!

# Keep script running
wait
