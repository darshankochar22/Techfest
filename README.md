<!-- Project README -->

# Pointer AI Landing Page

Opinionated setup notes for running the Next.js frontend and the Python FastAPI backend locally. Keep it simple; no extra test steps are required.

## Screenshots

![Landing page preview](<public/images/Screenshot 2025-12-11 at 3.37.56 PM.png>)
![Product UI preview](<public/images/Screenshot 2025-12-11 at 3.37.10 PM.png>)
![Dashboard preview](<public/images/Screenshot 2025-12-11 at 3.50.05 PM.png>)
![Additional view](<public/images/Screenshot 2025-12-11 at 3.50.32 PM.png>)

## Prerequisites

- Node.js 18+ (matches Next.js 15 requirements)
- Python 3.12+
- `ffmpeg` in your PATH (required by the TTS stack)

## 1) Frontend (Next.js)

1. Install deps:
   ```bash
   npm install
   ```
2. Environment (optional):
   - `NEXT_PUBLIC_WS_URL` to point the app to a custom signaling WebSocket (defaults to the built-in API routes if not set).
3. Run:
   ```bash
   npm run dev
   ```
   The site is available at http://localhost:3000.

### WebRTC signaling (optional but recommended)

- Start the lightweight signaling server if you want true real-time signaling:
  ```bash
  node server/websocket-server.js
  ```
- Alternatively, the built-in API routes under `app/api/webrtc/*` provide a polling-based fallback.

## 2) Backend (FastAPI)

1. From the repo root, create and activate a virtualenv (example):
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   ```
2. Create `backend/.env` (or export in your shell) with:
   ```env
   GROQ_API_KEY=your_groq_api_key_here
   ```
3. Install deps:
   ```bash
   pip install --upgrade pip
   pip install -r backend/requirements.txt
   ```
4. Run:
   ```bash
   uvicorn backend.conversation:app --reload --port 8000
   ```

## Notes

- The TTS model downloads on first run via `coqui-tts`; expect a short initial warm-up.
- Frontend and backend are independent; start only what you need for your workflow.
