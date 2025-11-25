import os
import queue
import tempfile
import numpy as np
import sounddevice as sd
import soundfile as sf
import whisper
from dotenv import load_dotenv
from groq import Groq
from TTS.api import TTS


WHISPER_MODEL = "base"
LLM_MODEL = "llama-3.3-70b-versatile"
TTS_MODEL = "tts_models/en/ljspeech/tacotron2-DDC"
SAMPLE_RATE = 16000
PAUSE_SECONDS = 3.0
BLOCK_DURATION = 0.2  
SILENCE_THRESHOLD = 0.01

load_dotenv()


def listen_for_utterance():
    print("Speak now (pause for 3 seconds to send, Ctrl+C to stop)...")
    audio_blocks = []
    silence_time = 0.0
    q = queue.Queue()

    def callback(indata, frames, time, status):
        if status:
            print(status)
        q.put(indata.copy())

    block_frames = int(SAMPLE_RATE * BLOCK_DURATION)
    with sd.InputStream(
        samplerate=SAMPLE_RATE, channels=1, callback=callback, blocksize=block_frames
    ):
        while True:
            block = q.get()
            audio_blocks.append(block)
            energy = np.linalg.norm(block) / np.sqrt(len(block))
            if energy < SILENCE_THRESHOLD:
                silence_time += BLOCK_DURATION
            else:
                silence_time = 0.0
            if silence_time >= PAUSE_SECONDS and len(audio_blocks) > 1:
                break

    audio = np.concatenate(audio_blocks, axis=0)
    temp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    sf.write(temp.name, audio, SAMPLE_RATE)
    temp.close()
    return temp.name


def main():
    stt_model = whisper.load_model(WHISPER_MODEL)

    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("Please set GROQ_API_KEY in your environment.")
    client = Groq(api_key=api_key)
    tts = TTS(TTS_MODEL)

    try:
        while True:
            audio_path = listen_for_utterance()
            transcription = stt_model.transcribe(audio_path)["text"].strip()
            os.remove(audio_path)
            if not transcription:
                print("Heard nothing, try again.")
                continue
            print(f"You: {transcription}")
            if transcription.lower() in {"quit", "exit"}:
                print("Bye!")
                break

            completion = client.chat.completions.create(
                messages=[{"role": "user", "content": transcription}],
                model=LLM_MODEL,
            )
            reply = completion.choices[0].message.content.strip()
            if not reply.endswith("!"):
                reply = reply.rstrip(".") + "!"
            print(f"Pointer: {reply}")

            audio = tts.tts(reply)
            sd.play(audio, tts.synthesizer.output_sample_rate)
            sd.wait()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()

