# Pear Remote Controller 🎵

A sleek, Discord-inspired web-based remote control for Pear Desktop's music player. Control playback directly from your phone or secondary device on the same Wi-Fi network.

![Discord-inspired theme preview](https://placehold.co/600x300/2b2d31/5865f2?text=YT+Music+Remote)

## Features ✨

- 🎨 **Modern Design** - Discord/Signal-inspired dark theme
- 📱 **Mobile-Friendly** - Responsive layout for phones and tablets
- 🎮 **Full Playback Control**
  - Play/Pause with smooth animations
  - Next/Previous track navigation
  - Seek any position in the current track
  - Volume control with mute toggle
- 🖼️ **Album Art Display** - Shows cover art dynamically
- 🔀 **Queue Navigation** - Tap left/right on album art to skip tracks
- 📺 **Up Next Queue** - See what's coming up
- 🔌 **WebSocket & Polling** - Real-time updates with fallback

## Controls 🎛️

| Button               | Action                           |
| -------------------- | -------------------------------- |
| ▶️ Play/Pause        | Toggle playback state            |
| ⏮ Previous           | Skip to previous track           |
| ⏭ Next               | Skip to next track               |
| 🔇 Mute              | Toggle audio mute                |
| 📊 Seek Bar          | Drag to seek in current track    |
| Album Art Left/Right | Skip 10 seconds forward/backward |

## Quick Start 🚀

### On macOS

```bash
./host-pear-remote.command
```

The script will:

1. Detect your local IP address
2. Start a simple HTTP server on port 80
3. Display instructions for connecting from your phone

### Manual Setup

1. **Install Python 3** (if not already installed)

   ```bash
   # macOS
   brew install python3
   ```

2. **Start the server manually**

   ```bash
   cd /path/to/pear-remote-controller
   python3 -m http.server 80 --bind 0.0.0.0
   ```

3. **Connect your phone** to the same Wi-Fi network and open:
   ```
   http://<your-computer-ip>:80
   ```

### Permissions ⚠️

The first time you load the page, you'll need to approve the connection on Pear Desktop. Follow the authentication prompts shown in the browser.

## Requirements 🔧

- **Pear Desktop** running locally (with API on port 26538)
- **Python 3** for the HTTP server
- **Same Wi-Fi network** for both devices
- **Web Browser** - Chrome, Safari, or Firefox

## How It Works ⚙️

This app communicates with Pear Desktop's local API:

- **WebSocket connection** (`ws://<ip>:26538/api/v1/ws`) for real-time updates
- **HTTP polling fallback** when WebSocket is unavailable
- **OAuth authentication** via client ID `web_remote_client`

The interface updates automatically as you control playback from your phone.

## Customization 🎨

### Theme Variables (`style.css`)

```css
:root {
  --bg-color: #1e1f22; /* Background */
  --card-bg: #2b2d31; /* Card background */
  --text-primary: #f2f3f5; /* Primary text */
  --accent-red: #5865f2; /* Accent color (Discord blurple) */
}
```

### Changing the Port

Edit `main.js` to change the API port:

```javascript
const API_PORT = 26538; // Default Pear Desktop port
```

## Project Structure 📁

```
pear-remote-controller/
├── index.html       # Main HTML file
├── main.js          # Frontend JavaScript logic
├── style.css        # Styling with Discord-like theme
├── README.md        # This file
└── host-pear-remote.command  # macOS launcher script
```

## Troubleshooting 🐛

| Issue                    | Solution                                                |
| ------------------------ | ------------------------------------------------------- |
| "Auth Required" shown    | Check that Pear Desktop is running and has API enabled  |
| Can't connect from phone | Ensure both devices are on the same Wi-Fi network       |
| Volume doesn't work      | Some browsers may block audio context; refresh the page |
| Album art not loading    | Check that Pear Desktop is serving images via API       |

## Keyboard Shortcuts ⌨️

- `Space` - Play/Pause
- `← Arrow` - Skip back 10 seconds
- `→ Arrow` - Skip forward 10 seconds

## License 📄

MIT License - See [LICENSE](./LICENSE) for details.

---

**Made with ❤️ for [Pear Desktop](https://github.com/pear-devs/pear-desktop)**
