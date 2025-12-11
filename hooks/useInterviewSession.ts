"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

type Speaker = "user" | "assistant"

export type InterviewMessage = {
  id: string
  speaker: Speaker
  text: string
  timestamp: number
}

type Status = "idle" | "recording" | "processing" | "error"

const baseUrl =
  process.env.NEXT_PUBLIC_INTERVIEW_API?.replace(/\/$/, "") || "http://localhost:8000"

const b64ToBlob = (b64: string, type: string) => {
  const byteCharacters = atob(b64)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  return new Blob([byteArray], { type })
}

export function useInterviewSession() {
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID())
  const [messages, setMessages] = useState<InterviewMessage[]>([])
  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [replyAudioUrl, setReplyAudioUrl] = useState<string | null>(null)
  const [isSavingContext, setIsSavingContext] = useState(false)
  const [contextError, setContextError] = useState<string | null>(null)
  const [contextSavedAt, setContextSavedAt] = useState<number | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunkRef = useRef<Blob[]>([])

  useEffect(
    () => () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop()
      }
      if (replyAudioUrl) {
        URL.revokeObjectURL(replyAudioUrl)
      }
    },
    [replyAudioUrl]
  )

  const playReplyAudio = useCallback((base64Audio: string) => {
    if (!base64Audio) return
    const blob = b64ToBlob(base64Audio, "audio/wav")
    const url = URL.createObjectURL(blob)
    setReplyAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return url
    })
    const player = new Audio(url)
    player.play().catch((err) => {
      console.error("Failed to play reply audio:", err)
    })
  }, [])

  const sendTurn = useCallback(
    async (audioBlob: Blob) => {
      setStatus("processing")
      setError(null)
      try {
        const file = new File([audioBlob], `turn-${Date.now()}.webm`, { type: audioBlob.type })
        const form = new FormData()
        form.append("session_id", sessionId)
        form.append("audio", file)

        const response = await fetch(`${baseUrl}/interview/turn`, {
          method: "POST",
          body: form,
        })
        if (!response.ok) {
          throw new Error(`Backend error (${response.status})`)
        }
        const payload = await response.json()
        const transcript = payload.transcript?.trim()
        const reply = payload.replyText?.trim()

        setMessages((prev) => [
          ...prev,
          transcript
            ? {
                id: `${Date.now()}-user`,
                speaker: "user",
                text: transcript,
                timestamp: Date.now(),
              }
            : null,
          reply
            ? {
                id: `${Date.now()}-assistant`,
                speaker: "assistant",
                text: reply,
                timestamp: Date.now(),
              }
            : null,
        ].filter(Boolean) as InterviewMessage[])

        if (payload.replyAudio) {
          playReplyAudio(payload.replyAudio)
        }
        setStatus("idle")
      } catch (err) {
        console.error(err)
        setError(err instanceof Error ? err.message : "Unknown error")
        setStatus("error")
      }
    },
    [sessionId, playReplyAudio]
  )

  const startRecording = useCallback(async () => {
    if (typeof window === "undefined") return
    if (isRecording) return
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : undefined
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recorderRef.current = recorder
      chunkRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunkRef.current.push(event.data)
        }
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        const audioBlob = new Blob(chunkRef.current, {
          type: mimeType || "audio/webm",
        })
        chunkRef.current = []
        setIsRecording(false)
        if (audioBlob.size > 0) {
          await sendTurn(audioBlob)
        } else {
          setStatus("idle")
        }
      }

      recorder.start()
      setIsRecording(true)
      setStatus("recording")
    } catch (err) {
      console.error(err)
      setError("Unable to access microphone")
      setStatus("error")
    }
  }, [isRecording, sendTurn])

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop()
    }
  }, [])

  const resetSession = useCallback(async () => {
    try {
      await fetch(`${baseUrl}/interview/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      })
    } catch (err) {
      console.warn("Failed to reset server session", err)
    } finally {
      setSessionId(crypto.randomUUID())
      setMessages([])
      setError(null)
      setStatus("idle")
      setContextSavedAt(null)
      setContextError(null)
    }
  }, [sessionId])

  const updateContext = useCallback(
    async ({ resumeText, jobDescription }: { resumeText: string; jobDescription: string }) => {
      setIsSavingContext(true)
      setContextError(null)
      try {
        const response = await fetch(`${baseUrl}/interview/context`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            resume_text: resumeText,
            job_description: jobDescription,
          }),
        })

        if (!response.ok) {
          throw new Error(`Backend error (${response.status})`)
        }

        setContextSavedAt(Date.now())
        setMessages([]) // Clear local transcript to reflect the refreshed context
      } catch (err) {
        console.error(err)
        setContextError(err instanceof Error ? err.message : "Unable to save context")
      } finally {
        setIsSavingContext(false)
      }
    },
    [sessionId]
  )

  return {
    sessionId,
    messages,
    status,
    error,
    isRecording,
    startRecording,
    stopRecording,
    resetSession,
    updateContext,
    isSavingContext,
    contextError,
    contextSavedAt,
    backendUrl: baseUrl,
  }
}

