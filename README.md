<!-- Project README -->

# Pointer: AI Interviewer

Project overview, setup, and run instructions for the Pointer AI landing page and demo backend. A more detailed 2-page writeup lives at `docs/technical-summary.pdf`.

## Screenshots

![Landing page preview](<public/images/Screenshot 2025-12-11 at 3.37.56 PM.png>)
![Product UI preview](<public/images/Screenshot 2025-12-11 at 3.37.10 PM.png>)
![Dashboard preview](<public/images/Screenshot 2025-12-11 at 3.50.05 PM.png>)
![Additional view](<public/images/Screenshot 2025-12-11 at 3.50.32 PM.png>)


## Project overview

Pointer provides a mock-interview experience with voice: the frontend captures audio, the backend transcribes with Whisper, gets an LLM reply via Groq, and returns TTS audio (coqui-tts) for playback.

## Setup instructions

- Prereqs: install Node.js 18+, Python 3.12+, and `ffmpeg` (on PATH).
- Frontend deps: from repo root run `npm install`.
- Backend deps: create `backend/.env` with `GROQ_API_KEY=...`, then run `pip install -r backend/requirements.txt` inside an activated virtualenv.

## Architecture overview

- Frontend: Next.js 15 (App Router), Radix/Shadcn UI, optional WebSocket signaling server (`server/websocket-server.js`) with polling fallback routes under `app/api/webrtc/*`.
- Backend: FastAPI (`backend/conversation.py` / `backend/conversation_realtime.py`) using Whisper (base) STT, Groq LLM, coqui-tts for speech.
- Data flow: browser records → upload chunk → backend transcribes → LLM reply → TTS wav → frontend plays audio.

![Architecture diagram](<public/images/Screenshot 2025-12-11 at 8.55.38 PM.png>)
![Architecture overview](<public/images/Screenshot 2025-12-11 at 9.00.51 PM.png>)

## How to run locally (step by step)

### Frontend (Next.js)

1. From repo root, install once:

```bash
npm install
```

2. (Optional) If you use an external signaling server, set:

```bash
export NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

3. Start the dev server:

```bash
npm run dev
```

4. Open http://localhost:3000 in your browser.

### Signaling server (optional but recommended)

```bash
node server/websocket-server.js
```

If not running this, the app falls back to the API polling routes under `app/api/webrtc/*`.

### Backend (FastAPI)

1. Create and activate a virtualenv:

```bash
python -m venv .venv
source .venv/bin/activate
```

2. Add your API key:

```bash
echo "GROQ_API_KEY=your_key" > backend/.env
```

3. Install backend deps:

```bash
pip install -r backend/requirements.txt
```

4. Run the API:

```bash
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

## Team & Roles:

Eshika Mishra: (Frontend, UI UX design): Expert
figma, User experience design, React
developer, responsible for designing &
developing frontend of the overall platform
and user testing

Darshan Kochar: Backend AI developer,with
roles of Architecture design and API
integration & Full stack end to end
development and Deployment & Devops,
docker, Redis implementation in later stages
