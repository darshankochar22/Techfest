import base64
import io
import os
import tempfile
from typing import Dict, List
import numpy as np
import soundfile as sf
import whisper
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
from pydantic import BaseModel
from TTS.api import TTS

load_dotenv()

WHISPER_MODEL_NAME = "base"
LLM_MODEL = "llama-3.3-70b-versatile"
TTS_MODEL = "tts_models/en/ljspeech/tacotron2-DDC"
SYSTEM_PROMPT = (
    "You are an experienced BI interview coach. Ask follow-up questions, "
    "evaluate reasoning, and give concise feedback."
)

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise RuntimeError("Please set GROQ_API_KEY in your environment.")

whisper_model = whisper.load_model(WHISPER_MODEL_NAME)
tts = TTS(TTS_MODEL)
groq_client = Groq(api_key=GROQ_API_KEY)

sessions: Dict[str, List[Dict[str, str]]] = {}

app = FastAPI(title="Pointer AI Interview Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ResetRequest(BaseModel):
    session_id: str


def transcribe_audio_bytes(audio_bytes: bytes) -> str:
    if not audio_bytes:
        return ""
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
        temp_file.write(audio_bytes)
        temp_path = temp_file.name
    try:
        result = whisper_model.transcribe(temp_path)
    finally:
        os.remove(temp_path)
    return result["text"].strip()


def ensure_exclamation(text: str) -> str:
    text = text.strip()
    if text.endswith("!"):
        return text
    if text.endswith("."):
        text = text[:-1]
    return text + "!"


def synthesize_reply(reply: str) -> str:
    audio = tts.tts(reply)
    rate = tts.synthesizer.output_sample_rate
    buffer = io.BytesIO()
    sf.write(buffer, audio, rate, format="WAV")
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def update_session(session_id: str, role: str, content: str) -> List[Dict[str, str]]:
    history = sessions.setdefault(
        session_id, [{"role": "system", "content": SYSTEM_PROMPT}]
    )
    history.append({"role": role, "content": content})
    return history


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/interview/turn")
async def interview_turn(
    session_id: str = Form(...), audio: UploadFile = File(..., description="WAV/M4A")
):
    audio_bytes = await audio.read()
    transcript = transcribe_audio_bytes(audio_bytes)
    if not transcript:
        raise HTTPException(status_code=400, detail="Could not understand audio.")

    user_history = update_session(session_id, "user", transcript)
    completion = groq_client.chat.completions.create(
        messages=user_history,
        model=LLM_MODEL,
        max_tokens=150,
    )
    reply = ensure_exclamation(completion.choices[0].message.content.strip())
    update_session(session_id, "assistant", reply)

    reply_audio = synthesize_reply(reply)
    return {
        "sessionId": session_id,
        "transcript": transcript,
        "replyText": reply,
        "replyAudio": reply_audio,
    }


@app.post("/interview/reset")
def reset_session(payload: ResetRequest):
    sessions.pop(payload.session_id, None)
    return {"sessionId": payload.session_id, "cleared": True}

