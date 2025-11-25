# Pointer AI Interview Backend

## Quick start

1. Install dependencies inside your virtualenv:
   ```
   pip install fastapi uvicorn python-dotenv whisper soundfile TTS groq numpy
   ```
2. Set `GROQ_API_KEY` in `.env` or your shell.
3. Start the API server from `backend/`:
   ```
   uvicorn conversation:app --reload --port 8000
   ```

## API

### `GET /health`
Simple readiness probe. Returns `{"status": "ok"}`.

### `POST /interview/turn`
Multipart form-data request:
- `session_id` (text) – stable identifier per interview
- `audio` (file) – WAV/M4A chunk recorded from the browser

Response:
```json
{
  "sessionId": "candidate-123",
  "transcript": "string",
  "replyText": "string!",
  "replyAudio": "base64-wav"
}
```

### `POST /interview/reset`
JSON body: `{ "session_id": "candidate-123" }`. Clears stored conversation context.

## Example Next.js client snippet

```ts
const sendTurn = async (file: File, sessionId: string) => {
  const form = new FormData();
  form.append("session_id", sessionId);
  form.append("audio", file);

  const res = await fetch("http://localhost:8000/interview/turn", {
    method: "POST",
    body: form,
  });
  const data = await res.json();

  const audio = Buffer.from(data.replyAudio, "base64");
  const blob = new Blob([audio], { type: "audio/wav" });
  const url = URL.createObjectURL(blob);
  const player = new Audio(url);
  player.play();

  return data;
};
```

