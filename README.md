<!-- Project README -->

# Pointer AI Landing Page

Opinionated setup notes for running the Next.js frontend and the Python FastAPI backend locally. Keep it simple; no extra test steps are required.

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
2. Install deps:
   ```bash
   pip install --upgrade pip
   pip install -r backend/requirements.txt
   ```
3. Environment:
   - `GROQ_API_KEY` is required for LLM access (set in `.env` or your shell).
4. Run:
   ```bash
   uvicorn backend.conversation:app --reload --port 8000
   ```

## Notes

- The TTS model downloads on first run via `coqui-tts`; expect a short initial warm-up.
- Frontend and backend are independent; start only what you need for your workflow.
