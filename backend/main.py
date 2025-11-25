import sounddevice as sd
from TTS.api import TTS

tts = TTS("tts_models/en/ljspeech/tacotron2-DDC")

audio = tts.tts("Hello eshikaaa i love u!")
sr = tts.synthesizer.output_sample_rate

sd.play(audio, sr)
sd.wait()
