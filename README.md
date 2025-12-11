<!-- Project README -->

# Pointer AI Landing Page

Project overview, setup, and run instructions for the Pointer AI landing page and demo backend. A more detailed 2-page writeup lives at `docs/technical-summary.pdf`.

## Screenshots

![Landing page preview](<public/images/Screenshot 2025-12-11 at 3.37.56 PM.png>)
![Product UI preview](<public/images/Screenshot 2025-12-11 at 3.37.10 PM.png>)
![Dashboard preview](<public/images/Screenshot 2025-12-11 at 3.50.05 PM.png>)
![Additional view](<public/images/Screenshot 2025-12-11 at 3.50.32 PM.png>)

## Project overview

Pointer provides a mock-interview experience with voice: the frontend captures audio, the backend transcribes with Whisper, gets an LLM reply via Groq, and returns TTS audio (coqui-tts) for playback.

## Setup instructions

- Prereqs: Node.js 18+, Python 3.12+, `ffmpeg` on PATH.
- Frontend deps: `npm install`
- Backend deps: create `backend/.env` with `GROQ_API_KEY=...`, then `pip install -r backend/requirements.txt`

## Architecture overview

- Frontend: Next.js 15 (App Router), Radix/Shadcn UI, optional WebSocket signaling server (`server/websocket-server.js`) with polling fallback routes under `app/api/webrtc/*`.
- Backend: FastAPI (`backend/conversation.py` / `backend/conversation_realtime.py`) using Whisper (base) STT, Groq LLM, coqui-tts for speech.
- Data flow: browser records → upload chunk → backend transcribes → LLM reply → TTS wav → frontend plays audio.

## How to run locally

- Frontend: `npm run dev` (http://localhost:3000). Optionally set `NEXT_PUBLIC_WS_URL` for custom signaling.
- Signaling (optional, recommended): `node server/websocket-server.js`
- Backend: from repo root,
  ```bash
  python -m venv .venv
  source .venv/bin/activate
  echo "GROQ_API_KEY=your_key" > backend/.env
  pip install -r backend/requirements.txt
  uvicorn backend.conversation:app --reload --port 8000
  ```

## APIs or endpoints

- Backend FastAPI:
  - `GET /health` → `{"status":"ok"}`
  - `POST /interview/turn` (multipart: `session_id`, `audio` file) → transcript, replyText, replyAudio (base64 wav)
  - `POST /interview/reset` (JSON: `session_id`) → clears context
- Frontend signaling (fallback):
  - `POST /api/webrtc/offer`
  - `POST /api/webrtc/answer`
  - `POST /api/webrtc/ice-candidate`

## Example inputs/outputs

`POST /interview/turn` response (abridged):

```json
{
  "sessionId": "candidate-123",
  "transcript": "Tell me about yourself",
  "replyText": "Great to meet you! ...",
  "replyAudio": "base64-wav..."
}
```

## List of dependencies

- Frontend (core): Next.js 15.2.6, React 19, Radix UI, Tailwind stack, Vercel analytics.
- Backend (core): FastAPI, uvicorn, python-dotenv, whisper, groq, coqui-tts, soundfile/device, numpy.
- Signaling: `ws` for optional WebSocket server.

## Contributors

- Pointer team / Darshan (maintainer)

## Notes

- First TTS run downloads the model; expect a short warm-up.
- Frontend and backend are independent; start only what you need.
