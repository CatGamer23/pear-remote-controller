const API_PORT = 26538;
const CLIENT_ID = "web_remote_client";
const BASE_URL = new URL(`http://${window.location.hostname}:${API_PORT}`);

// Helper function to clamp numbers cleanly
const clamp = (val, min = 0, max = 1) => Math.min(Math.max(val, min), max);

let authToken = localStorage.getItem("pear_auth_token");
let currentDuration = 0;
let currentElapsed = 0;
let isPlaying = false;
let isSeeking = false;
let isAdjustingVolume = false;
let volumeDebounceTimer = null;
let lastServerSyncTime = performance.now();
let ws = null;
let pollFallbackInterval = null;
let isMutedState = false;
let cachedImageSrc = null;

// DOM Cache
const elements = {
  title: document.getElementById("title"),
  artist: document.getElementById("artist"),
  cover: document.getElementById("cover"),
  favicon: document.getElementById("favicon"),
  iconPlay: document.getElementById("icon-play"),
  iconPause: document.getElementById("icon-pause"),
  artContainer: document.getElementById("art-container"),
  overlayLeft: document.getElementById("overlay-left"),
  overlayRight: document.getElementById("overlay-right"),
  silentAudio: document.getElementById("silent-audio"),
  upNextContainer: document.getElementById("up-next-container"),
  upNextText: document.getElementById("up-next-text"),
  volumeSlider: document.getElementById("volume-slider"),
  btnMute: document.getElementById("btn-mute"),
  iconVol: document.getElementById("icon-vol"),
  wavePath: document.getElementById("wave-path"),
  clipRect: document.getElementById("clip-rect"),
  unplayedClipRect: document.getElementById("unplayed-clip-rect"),
  progressBarWrapper: document.getElementById("progress-bar-wrapper"),
  timeCurrent: document.getElementById("time-current"),
  timeTotal: document.getElementById("time-total"),
  btnPrev: document.getElementById("btn-prev"),
  btnToggle: document.getElementById("btn-toggle"),
  btnNext: document.getElementById("btn-next"),
};

// Adjusted wave properties
const BASE_Y = 14;
const WAVELENGTH = 28;
const MAX_AMPLITUDE = 6.5;
let wavePhase = 0;
let currentAmplitude = 0;

// Icon SVG Paths
const VOL_ICONS = {
  muted: `<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>`,
  low: `<path d="M7 9v6h4l5 5V4l-5 5H7z"/>`,
  med: `<path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/>`,
  high: `<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>`,
};

function updateVolumeIcon(vol, isMuted) {
  if (isMuted || vol === 0) {
    elements.iconVol.innerHTML = VOL_ICONS.muted;
  } else if (vol < 34) {
    elements.iconVol.innerHTML = VOL_ICONS.low;
  } else if (vol < 67) {
    elements.iconVol.innerHTML = VOL_ICONS.med;
  } else {
    elements.iconVol.innerHTML = VOL_ICONS.high;
  }
}

function formatTime(seconds) {
  if (!seconds || Number.isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// High-resolution smooth sine wave generator
function generateFlowingWavePath(amplitude, phase) {
  const step = 1;
  const startX = -28;
  const endX = 428;
  let path = "";

  for (let x = startX; x <= endX; x += step) {
    const angle = ((x + phase) / WAVELENGTH) * Math.PI * 2;
    const y = BASE_Y + Math.sin(angle) * amplitude;
    path += (x === startX ? "M " : " L ") + `${x} ${y.toFixed(2)}`;
  }

  return path;
}

function animateWave() {
  const targetAmp = isPlaying ? MAX_AMPLITUDE : 0;
  currentAmplitude += (targetAmp - currentAmplitude) * 0.08;

  if (isPlaying) wavePhase += 0.35;

  elements.wavePath.setAttribute(
    "d",
    generateFlowingWavePath(currentAmplitude, wavePhase),
  );

  if (isPlaying && !isSeeking && currentDuration > 0) {
    const deltaSec = (performance.now() - lastServerSyncTime) / 1000;
    const computedElapsed = Math.min(
      currentElapsed + deltaSec,
      currentDuration,
    );
    renderProgress(computedElapsed, currentDuration);
  }

  requestAnimationFrame(animateWave);
}

function renderProgress(elapsed, duration) {
  elements.timeCurrent.textContent = formatTime(elapsed);
  elements.timeTotal.textContent = formatTime(duration);
  const ratio = duration > 0 ? clamp(elapsed / duration) : 0;
  const widthNum = ratio * 400;
  const widthStr = widthNum.toFixed(2);

  // Update played wave clip
  elements.clipRect.setAttribute("width", widthStr);

  // Update unplayed background track clip (shifts x position and shrinks width)
  elements.unplayedClipRect.setAttribute("x", widthStr);
  elements.unplayedClipRect.setAttribute(
    "width",
    Math.max(0, 400 - widthNum).toFixed(2),
  );
}

function updateUI(
  title,
  artist,
  imgSrc,
  isPaused = true,
  elapsedSeconds = 0,
  songDuration = 0,
) {
  elements.title.textContent = title;
  elements.artist.textContent = artist;
  currentDuration = songDuration;
  isPlaying = !isPaused;

  if (!isSeeking) {
    currentElapsed = elapsedSeconds;
    lastServerSyncTime = performance.now();
    renderProgress(currentElapsed, currentDuration);
  }

  document.title = title ? `${title} • ${artist}` : "YT Music Remote";

  if (imgSrc && imgSrc !== cachedImageSrc) {
    cachedImageSrc = imgSrc;
    elements.cover.src = imgSrc;
    elements.favicon.href = imgSrc;
  }

  if (isPlaying) {
    elements.iconPlay.style.display = "none";
    elements.iconPause.style.display = "block";
  } else {
    elements.iconPlay.style.display = "block";
    elements.iconPause.style.display = "none";
  }

  if (isPaused) {
    elements.silentAudio.pause();
  } else {
    elements.silentAudio.play().catch(() => {});
  }
}

async function apiFetch(endpoint, method = "GET", body = null) {
  if (!authToken && !(await ensureAuth())) return null;

  try {
    const targetUrl = new URL(endpoint, BASE_URL);
    const options = {
      method,
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(4000),
    };

    if (body) options.body = JSON.stringify(body);

    const res = await fetch(targetUrl, options);

    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem("pear_auth_token");
      authToken = null;
      if (await ensureAuth()) return apiFetch(endpoint, method, body);
      return null;
    }

    return res;
  } catch {
    updateUI("Offline", "Cannot reach Pear Desktop");
    return null;
  }
}

async function fetchVolumeState() {
  if (isAdjustingVolume) return;
  const res = await apiFetch("/api/v1/volume");
  if (res?.ok) {
    const data = await res.json();
    if (!isAdjustingVolume) {
      elements.volumeSlider.value = data.state;
      isMutedState = Boolean(data.isMuted);
      updateVolumeIcon(data.state, isMutedState);
    }
  }
}

async function fetchNextTrack() {
  const res = await apiFetch("/api/v1/queue/next");
  if (res?.ok && res.status !== 204) {
    const data = await res.json();
    if (data?.title) {
      const combinedByline = data.shortBylineText?.runs
        ? data.shortBylineText.runs.map((run) => run.text).join("")
        : "";

      // Try rendering with title + artist first, relying on text-overflow ellipsis
      // If combined string is extremely long (>45 chars), try falling back to just title
      let displayText = data.title;
      if (combinedByline) {
        const fullAttempt = `${data.title} • ${combinedByline}`;
        if (fullAttempt.length <= 45) {
          displayText = fullAttempt;
        } else {
          // If too long, drop the artist and use just the title to prevent overflow cutoff
          displayText = data.title;
        }
      }

      elements.upNextText.textContent = displayText;
      elements.upNextContainer.hidden = false;
      return;
    }
  }
  elements.upNextContainer.hidden = true;
}

async function ensureAuth() {
  if (authToken) return true;
  try {
    updateUI("Authenticating...", "Approve on Pear Desktop");
    const authUrl = new URL(`/auth/${CLIENT_ID}`, BASE_URL);
    const res = await fetch(authUrl, {
      method: "POST",
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) throw new Error(`Auth failed status ${res.status}`);

    const data = await res.json();

    if (data?.accessToken) {
      authToken = data.accessToken;
      localStorage.setItem("pear_auth_token", authToken);
      return true;
    }
  } catch {
    updateUI("Auth Required", "Approve request on Pear Desktop");
    return false;
  }
}

async function fetchStatus() {
  if (isSeeking) return;

  const res = await apiFetch("/api/v1/song");

  if (res?.status === 204) {
    updateUI("Nothing Playing", "", "", true, 0, 0);
    elements.upNextContainer.hidden = true;
    return;
  }

  if (res?.ok) {
    const data = await res.json();
    updateUI(
      data?.title ?? "Nothing Playing",
      data?.artist ?? "",
      data?.imageSrc,
      data?.isPaused ?? true,
      data?.elapsedSeconds ?? 0,
      data?.songDuration ?? 0,
    );

    fetchNextTrack();
    fetchVolumeState();
  }
}

function connectWebSocket() {
  if (!authToken) return;

  const wsUrl = `ws://${BASE_URL.hostname}:${API_PORT}/api/v1/ws?token=${authToken}`;
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    if (pollFallbackInterval) {
      clearInterval(pollFallbackInterval);
      pollFallbackInterval = null;
    }
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data?.title !== undefined) {
        updateUI(
          data?.title ?? "Nothing Playing",
          data?.artist ?? "",
          data?.imageSrc,
          data?.isPaused ?? true,
          data?.elapsedSeconds ?? 0,
          data?.songDuration ?? 0,
        );
        fetchNextTrack();
      } else {
        fetchStatus();
      }
    } catch {
      fetchStatus();
    }
  };

  ws.onclose = ws.onerror = () => {
    pollFallbackInterval ??= setInterval(fetchStatus, 2000);
    setTimeout(connectWebSocket, 5000);
  };
}

async function sendCommand(endpoint, body = null) {
  lastServerSyncTime = performance.now();
  await apiFetch(endpoint, "POST", body);
  setTimeout(fetchStatus, 150);
}

// Event Listeners
elements.volumeSlider.addEventListener("input", (e) => {
  isAdjustingVolume = true;
  const volVal = Number(e.target.value);
  updateVolumeIcon(volVal, isMutedState);
  apiFetch("/api/v1/volume", "POST", { volume: volVal });

  clearTimeout(volumeDebounceTimer);
  volumeDebounceTimer = setTimeout(() => {
    isAdjustingVolume = false;
  }, 1000);
});

elements.btnMute.addEventListener("click", async () => {
  isMutedState = !isMutedState;
  updateVolumeIcon(Number(elements.volumeSlider.value), isMutedState);
  await sendCommand("/api/v1/toggle-mute");
  fetchVolumeState();
});

function handleSeek(e) {
  if (!currentDuration) return 0;
  const rect = elements.progressBarWrapper.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clickX = clientX - rect.left;
  const percentage = clamp(clickX / rect.width);
  const targetSeconds = Math.round(percentage * currentDuration);

  currentElapsed = targetSeconds;
  lastServerSyncTime = performance.now();
  renderProgress(currentElapsed, currentDuration);

  return targetSeconds;
}

elements.progressBarWrapper.addEventListener("pointerdown", (e) => {
  isSeeking = true;
  elements.progressBarWrapper.setPointerCapture(e.pointerId);
  handleSeek(e);
});

elements.progressBarWrapper.addEventListener("pointermove", (e) => {
  if (isSeeking) handleSeek(e);
});

elements.progressBarWrapper.addEventListener("pointerup", (e) => {
  if (isSeeking) {
    const targetSeconds = handleSeek(e);
    isSeeking = false;
    sendCommand("/api/v1/seek-to", { seconds: targetSeconds });
  }
});

elements.progressBarWrapper.addEventListener("pointercancel", () => {
  isSeeking = false;
});

let lastTapTime = 0;
elements.artContainer.addEventListener("click", (e) => {
  const now = performance.now();
  if (now - lastTapTime < 300) {
    const rect = elements.artContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const isLeft = clickX < rect.width / 2;
    const targetOverlay = isLeft ? elements.overlayLeft : elements.overlayRight;
    const endpoint = isLeft ? "/api/v1/go-back" : "/api/v1/go-forward";

    targetOverlay.classList.add("active");
    setTimeout(() => targetOverlay.classList.remove("active"), 400);
    sendCommand(endpoint, { seconds: 10 });
  }
  lastTapTime = now;
});

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    elements.btnToggle.click();
  } else if (e.code === "ArrowLeft") {
    e.preventDefault();
    sendCommand("/api/v1/go-back", { seconds: 10 });
  } else if (e.code === "ArrowRight") {
    e.preventDefault();
    sendCommand("/api/v1/go-forward", { seconds: 10 });
  }
});

elements.btnPrev.addEventListener("click", () =>
  sendCommand("/api/v1/previous"),
);

elements.btnToggle.addEventListener("click", () => {
  const targetEndpoint = isPlaying ? "/api/v1/pause" : "/api/v1/play";
  isPlaying = !isPlaying;
  lastServerSyncTime = performance.now();

  if (isPlaying) {
    elements.iconPlay.style.display = "none";
    elements.iconPause.style.display = "block";
  } else {
    elements.iconPlay.style.display = "block";
    elements.iconPause.style.display = "none";
  }

  sendCommand(targetEndpoint);
});

elements.btnNext.addEventListener("click", () => sendCommand("/api/v1/next"));

// Initialize
requestAnimationFrame(animateWave);

if (await ensureAuth()) {
  await fetchStatus();
  connectWebSocket();
}
