#!/bin/bash
# Navigate to the directory where this script is located
cd "$(dirname "$0")" || exit

# Get local IP address (Wi-Fi interface en0, or ethernet en1)
PORT=80
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)

clear
echo "=================================================="
echo " Starting YTM Frontend Server..."
echo " Open this link on your phone (same Wi-Fi):"
echo " http://${IP}:${PORT}"
echo "=================================================="
echo ""

# Start Python HTTP server
python3 -m http.server $PORT --bind 0.0.0.0
