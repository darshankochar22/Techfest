// Lightweight on-device facial signal extraction using MediaPipe FaceMesh.
// Computes simple engagement metrics (smile/brow indicators) from facial landmarks.
// No video frames leave the browser.
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

type SignalSnapshot = {
  timestamp: number
  smileScore: number // 0-1
  browScore: number // 0-1 (raised vs neutral)
  engagement: number // 0-1 aggregate
}

type BehaviorSummary = {
  samples: number
  avgSmile: number
  avgBrow: number
  avgEngagement: number
}

type AnalysisState = {
  running: boolean
  lastSnapshot: SignalSnapshot | null
  timeline: SignalSnapshot[]
  summary: BehaviorSummary | null
  error: string | null
}

type UseBehaviorAnalysisArgs = {
  stream: MediaStream | null
  enabled: boolean
  sampleIntervalMs?: number
  maxSamples?: number
}

const defaultSummary: BehaviorSummary = {
  samples: 0,
  avgSmile: 0,
  avgBrow: 0,
  avgEngagement: 0,
}

export function useBehaviorAnalysis({
  stream,
  enabled,
  sampleIntervalMs = 500,
  maxSamples = 240, // ~2 minutes at 500ms
}: UseBehaviorAnalysisArgs): AnalysisState & { computeSummary: () => BehaviorSummary } {
  const [running, setRunning] = useState(false)
  const [timeline, setTimeline] = useState<SignalSnapshot[]>([])
  const [lastSnapshot, setLastSnapshot] = useState<SignalSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const processorRef = useRef<ReturnType<typeof createProcessor> | null>(null)
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null)

  // Lazy create hidden video element for processing frames
  useEffect(() => {
    if (!hiddenVideoRef.current) {
      const video = document.createElement("video")
      video.playsInline = true
      video.muted = true
      video.style.display = "none"
      hiddenVideoRef.current = video
      document.body.appendChild(video)
    }
    return () => {
      if (hiddenVideoRef.current) {
        hiddenVideoRef.current.pause()
        hiddenVideoRef.current.srcObject = null
        hiddenVideoRef.current.remove()
      }
    }
  }, [])

  // Start/stop analysis when stream or enabled changes
  useEffect(() => {
    if (!enabled || !stream || !hiddenVideoRef.current) {
      stopProcessing()
      return
    }

    let cancelled = false
    const start = async () => {
      try {
        setError(null)
        hiddenVideoRef.current!.srcObject = stream
        await hiddenVideoRef.current!.play().catch(() => undefined)
        const processor = await createProcessor()
        processorRef.current = processor
        setRunning(true)
        processor.start(
          hiddenVideoRef.current!,
          sampleIntervalMs,
          (snapshot) => {
            if (cancelled) return
            setLastSnapshot(snapshot)
            setTimeline((prev) => {
              const next = [...prev, snapshot]
              if (next.length > maxSamples) {
                next.shift()
              }
              return next
            })
          },
          (err) => setError(err?.message || "Analysis failed")
        )
      } catch (err) {
        console.error(err)
        setError(err instanceof Error ? err.message : "Unable to start analysis")
        setRunning(false)
      }
    }

    start()
    return () => {
      cancelled = true
      stopProcessing()
    }
  }, [enabled, stream, sampleIntervalMs, maxSamples])

  const stopProcessing = useCallback(() => {
    processorRef.current?.stop()
    processorRef.current = null
    setRunning(false)
  }, [])

  // Compute aggregates on demand
  const computeSummary = useCallback((): BehaviorSummary => {
    if (!timeline.length) return defaultSummary
    const totals = timeline.reduce(
      (acc, snap) => {
        acc.smile += snap.smileScore
        acc.brow += snap.browScore
        acc.engagement += snap.engagement
        return acc
      },
      { smile: 0, brow: 0, engagement: 0 }
    )
    const samples = timeline.length
    return {
      samples,
      avgSmile: totals.smile / samples,
      avgBrow: totals.brow / samples,
      avgEngagement: totals.engagement / samples,
    }
  }, [timeline])

  const summary = useMemo(() => computeSummary(), [computeSummary])

  return {
    running,
    timeline,
    lastSnapshot,
    summary,
    error,
    computeSummary,
  }
}

// --- Face processing helpers ---
type Processor = {
  start: (
    video: HTMLVideoElement,
    interval: number,
    onSnapshot: (snapshot: SignalSnapshot) => void,
    onError: (err: Error) => void
  ) => void
  stop: () => void
}

async function createProcessor(): Promise<Processor> {
  const [{ FaceMesh }, { drawConnectors }, { TRIANGULATION }] = await Promise.all([
    import("@mediapipe/face_mesh"),
    import("@mediapipe/drawing_utils"),
    import("@mediapipe/face_mesh"),
  ])

  // FaceMesh setup
  const mesh = new FaceMesh.FaceMesh({
    locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
  })
  mesh.setOptions({
    maxNumFaces: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
    refineLandmarks: true,
  })

  let timer: number | null = null

  const stop = () => {
    if (timer) {
      window.clearInterval(timer)
      timer = null
    }
  }

  const start = (
    video: HTMLVideoElement,
    interval: number,
    onSnapshot: (snapshot: SignalSnapshot) => void,
    onError: (err: Error) => void
  ) => {
    stop()
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")

    const sample = async () => {
      try {
        if (!ctx) return
        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 480
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const imageBitmap = ctx.getImageData(0, 0, canvas.width, canvas.height)
        await mesh.send({ image: imageBitmap })
      } catch (err) {
        stop()
        onError(err as Error)
      }
    }

    mesh.onResults((results: any) => {
      if (!results.multiFaceLandmarks?.length) return
      const landmarks = results.multiFaceLandmarks[0]
      const snapshot = computeSignals(landmarks)
      onSnapshot(snapshot)
    })

    timer = window.setInterval(sample, interval)
  }

  return { start, stop }
}

// Simple heuristics from facial landmarks
function computeSignals(landmarks: any[]): SignalSnapshot {
  const now = Date.now()

  const mouthLeft = landmarks[61]
  const mouthRight = landmarks[291]
  const mouthTop = landmarks[13]
  const mouthBottom = landmarks[14]
  const browLeft = landmarks[105]
  const browRight = landmarks[334]
  const eyeLeft = landmarks[159]
  const eyeRight = landmarks[386]

  const mouthWidth = distance2d(mouthLeft, mouthRight)
  const mouthHeight = distance2d(mouthTop, mouthBottom)
  const smileRatio = mouthWidth > 0 ? clamp(mouthHeight / mouthWidth, 0, 0.5) : 0

  const browEyeLeft = distance2d(browLeft, eyeLeft)
  const browEyeRight = distance2d(browRight, eyeRight)
  const browScoreRaw = clamp((browEyeLeft + browEyeRight) / 2, 0.01, 0.07)

  const smileScore = normalize(smileRatio, 0.02, 0.12)
  const browScore = normalize(browScoreRaw, 0.025, 0.06)
  const engagement = clamp((smileScore * 0.6 + (1 - browScore) * 0.4), 0, 1)

  return {
    timestamp: now,
    smileScore,
    browScore,
    engagement,
  }
}

function distance2d(a: any, b: any) {
  const dx = (a?.x ?? 0) - (b?.x ?? 0)
  const dy = (a?.y ?? 0) - (b?.y ?? 0)
  return Math.sqrt(dx * dx + dy * dy)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function normalize(value: number, min: number, max: number) {
  if (value <= min) return 0
  if (value >= max) return 1
  return (value - min) / (max - min)
}
