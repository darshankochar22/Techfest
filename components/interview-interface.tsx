"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  PhoneOff,
  Maximize2,
  Minimize2,
  Home,
  Loader2,
  RefreshCcw,
  Volume2,
  MessageSquare,
  MessageSquareOff,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useInterviewSession } from "@/hooks/useInterviewSession"

export function InterviewInterface() {
  const router = useRouter()
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [isAudioOn, setIsAudioOn] = useState(true)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [hasRemoteStream, setHasRemoteStream] = useState(false)
  const [showConversation, setShowConversation] = useState(false)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null)
  const [socket, setSocket] = useState<WebSocket | null>(null)
  const [resumeText, setResumeText] = useState("")
  const [jobDescription, setJobDescription] = useState("")

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const cameraPreviewRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const screenShareVideoRef = useRef<HTMLVideoElement>(null)
  const playVideoSafely = async (element: HTMLVideoElement | null) => {
    if (!element) return
    try {
      await element.play()
    } catch (error) {
      console.warn("Unable to auto-play video element:", error)
    }
  }
  useEffect(() => {
    if (!screenShareVideoRef.current) return
    if (screenStream && isScreenSharing) {
      screenShareVideoRef.current.srcObject = screenStream
      playVideoSafely(screenShareVideoRef.current)
    } else {
      screenShareVideoRef.current.srcObject = null
    }
  }, [screenStream, isScreenSharing])
  const {
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
    backendUrl,
  } = useInterviewSession()

  // Interviewer info
  const interviewerName = "AI Interviewer"
  const interviewerInitials = "AI"
  const interviewerAvatar = "/images/avatars/albert-flores.png" // Using existing avatar as placeholder

  // Initialize WebRTC and media
  useEffect(() => {
    const initWebRTC = async () => {
      try {
        // Initialize local media
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        })
        setLocalStream(stream)
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }

        // Create WebSocket connection for signaling (with fallback)
        let ws: WebSocket | null = null
        try {
          const wsUrl =
            typeof window !== "undefined"
              ? (window.location.protocol === "https:" ? "wss:" : "ws:") +
                "//" +
                window.location.hostname +
                ":3001"
              : "ws://localhost:3001"

          ws = new WebSocket(wsUrl)

          if (ws) {
            ws.onopen = () => {
              console.log("WebSocket connected")
              setIsConnected(true)
              // Join interview room
              if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(
                  JSON.stringify({
                    type: "join",
                    room: "interview-room",
                  })
                )
              }
            }

            ws.onmessage = async (event) => {
              try {
                const message = JSON.parse(event.data)

                switch (message.type) {
                  case "offer":
                    await handleOffer(message.offer)
                    break
                  case "answer":
                    await handleAnswer(message.answer)
                    break
                  case "ice-candidate":
                    await handleIceCandidate(message.candidate)
                    break
                  case "remote-stream":
                    setHasRemoteStream(true)
                    break
                  case "user-joined":
                    console.log("User joined the room")
                    break
                }
              } catch (error) {
                console.error("Error processing WebSocket message:", error)
              }
            }

            ws.onerror = () => {
              // Silently handle WebSocket errors without noisy console output
              setIsConnected(false)
            }

            ws.onclose = () => {
              console.log("WebSocket disconnected")
              setIsConnected(false)
            }
          }
        } catch (error) {
          console.warn("WebSocket connection failed, continuing without real-time signaling:", error)
          setIsConnected(false)
        }

        // Create RTCPeerConnection
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
          ],
        })

        // Add local stream tracks to peer connection
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream)
        })

        // Handle remote stream
        pc.ontrack = (event) => {
          setHasRemoteStream(true)
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0]
          }
        }

        // Handle ICE candidates - use closure to capture ws
        pc.onicecandidate = (event) => {
          if (event.candidate && ws && ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: "ice-candidate",
                candidate: event.candidate,
                room: "interview-room",
              })
            )
          }
        }

        setPeerConnection(pc)

        // Create offer when WebSocket is ready
        const createOfferWhenReady = async () => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            try {
              const offer = await pc.createOffer()
              await pc.setLocalDescription(offer)
              ws.send(
                JSON.stringify({
                  type: "offer",
                  offer: offer,
                  room: "interview-room",
                })
              )
            } catch (error) {
              console.error("Error creating offer:", error)
            }
          } else {
            // Wait for WebSocket to connect
            setTimeout(createOfferWhenReady, 100)
          }
        }

        // Start attempting to create offer
        createOfferWhenReady()
      } catch (error) {
        console.error("Error initializing WebRTC:", error)
        // Fallback: continue without WebRTC connection
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          })
          setLocalStream(stream)
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream
          }
        } catch (mediaError) {
          console.error("Error accessing media devices:", mediaError)
        }
      }
    }

    initWebRTC()

    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop())
      }
      if (screenStream) {
        screenStream.getTracks().forEach((track) => track.stop())
      }
      if (peerConnection) {
        peerConnection.close()
      }
      if (socket) {
        socket.close()
      }
    }
  }, [])

  useEffect(() => {
    if (cameraPreviewRef.current && localStream) {
      cameraPreviewRef.current.srcObject = localStream
    }
  }, [localStream])

  // WebRTC handlers
  const handleOffer = async (offer: RTCSessionDescriptionInit) => {
    if (!peerConnection) return
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
    const answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)
    if (socket) {
      socket.send(
        JSON.stringify({
          type: "answer",
          answer: answer,
          room: "interview-room",
        })
      )
    }
  }

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    if (!peerConnection) return
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
  }

  const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
    if (!peerConnection) return
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
  }

  // Centralized helper to cleanly stop screen sharing from any path
  const stopScreenShare = async () => {
    if (!screenStream && !isScreenSharing) return

    // Restore camera track in peer connection
    if (peerConnection && localStream) {
      const cameraTrack = localStream.getVideoTracks()[0]
      const sender = peerConnection
        .getSenders()
        .find((s) => s.track && s.track.kind === "video")
      if (sender && cameraTrack) {
        try {
          await sender.replaceTrack(cameraTrack)
        } catch (err) {
          console.warn("Failed to restore camera track after screen share:", err)
        }
      }
    }

    // Stop any active display tracks
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop())
      setScreenStream(null)
    }

    // Clear local preview and flags
    if (screenShareVideoRef.current) {
      screenShareVideoRef.current.srcObject = null
    }
    setIsScreenSharing(false)

    // Ensure the normal local camera preview is visible again
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
      await playVideoSafely(localVideoRef.current)
    }
  }

  // Toggle video
  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !isVideoOn
        setIsVideoOn(!isVideoOn)
      }
    }
  }

  // Toggle audio - use interview session recording
  const toggleAudio = () => {
    if (isRecording) {
      stopRecording()
      setIsAudioOn(false)
    } else {
      startRecording()
      setIsAudioOn(true)
    }
  }

  // Toggle screen share
  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const displayVideoConstraints: MediaTrackConstraints = {
          cursor: "always",
        }
        const stream = await navigator.mediaDevices.getDisplayMedia({
          // keep constraints simple for maximum browser compatibility
          video: displayVideoConstraints,
          audio: false,
        })
        setScreenStream(stream)
        setIsScreenSharing(true)

        // Local preview: show the display stream in the dedicated screen-share video element
        await playVideoSafely(screenShareVideoRef.current)

        // Replace video track in peer connection so the AI sees the shared screen
        if (peerConnection && localStream) {
          const videoTrack = stream.getVideoTracks()[0]
          const sender = peerConnection
            .getSenders()
            .find((s) => s.track && s.track.kind === "video")
          if (sender && videoTrack) {
            await sender.replaceTrack(videoTrack)
          }
        }

        // Handle screen share stop triggered from browser UI
        stream.getVideoTracks()[0].onended = () => {
          // Fire and forget; helper is idempotent
          void stopScreenShare()
        }
      } else {
        // Explicit stop via our toggle button
        await stopScreenShare()
      }
    } catch (error) {
      console.error("Error sharing screen:", error)
    }
  }

  // Toggle fullscreen
  const toggleFullscreen = async () => {
    if (!document.fullscreenElement && containerRef.current) {
      try {
        await containerRef.current.requestFullscreen()
        setIsFullscreen(true)
      } catch (error) {
        console.error("Error entering fullscreen:", error)
      }
    } else {
      try {
        await document.exitFullscreen()
        setIsFullscreen(false)
      } catch (error) {
        console.error("Error exiting fullscreen:", error)
      }
    }
  }

  // Handle fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [])

  const statusLabel = useMemo(() => {
    switch (status) {
      case "recording":
        return "Listening… release the mic to send."
      case "processing":
        return "Pointer is thinking..."
      case "error":
        return error ?? "Something went wrong. Try again."
      default:
        return "Press the mic to speak with the interviewer."
    }
  }, [status, error])

  const handleResetSession = () => {
    resetSession()
  }

  const handleSaveContext = async () => {
    await updateContext({ resumeText, jobDescription })
  }

  // End call handler
  const endCall = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop())
    }
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop())
    }
    if (peerConnection) {
      peerConnection.close()
    }
    if (socket) {
      socket.send(
        JSON.stringify({
          type: "leave",
          room: "interview-room",
        })
      )
      socket.close()
    }
    router.push("/")
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-screen h-screen bg-background flex flex-col"
    >
      {/* Navbar */}
      <nav className="w-full py-3 px-6 bg-background/80 backdrop-blur-md border-b border-border z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-foreground text-xl font-semibold">Pointer</span>
            <span className="text-sm px-2 py-1 rounded bg-primary/10 text-primary">AI Interview</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                <Home className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main video container */}
      <div className="flex-1 relative flex items-center justify-center p-4 gap-4">
        {isScreenSharing ? (
          <div className="w-full h-full flex items-center justify-center px-4">
            <div className="relative w-full max-w-5xl h-full max-h-[75vh] mx-auto">
              <div className="w-full h-full rounded-3xl overflow-hidden bg-muted/40 border-2 border-border shadow-[0_0_40px_rgba(0,0,0,0.35)]">
                <video
                  ref={screenShareVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain bg-black"
                />
                {!screenStream && (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground text-lg font-medium">
                    Preparing screen share...
                  </div>
                )}
              </div>

              {/* Overlapping bubbles */}
              <div className="absolute -top-10 -right-6 flex flex-col items-center">
                <div className="relative w-24 h-24 rounded-full overflow-hidden bg-muted border-2 border-primary/40 shadow-lg">
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    muted={false}
                    className={`w-full h-full object-cover ${hasRemoteStream ? "block" : "hidden"}`}
                  />
                  {!hasRemoteStream && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center bg-gradient-to-br from-primary/10 to-primary/5 px-3">
                      <Avatar className="w-14 h-14 mx-auto mb-1 border-2 border-primary/30">
                        <AvatarImage src={interviewerAvatar} alt={interviewerName} />
                        <AvatarFallback className="bg-primary/20 text-primary text-xl font-semibold">
                          {interviewerInitials}
                        </AvatarFallback>
                      </Avatar>
                      <p className="text-[10px] text-muted-foreground">
                        {isConnected ? "Connecting..." : "Waiting..."}
                      </p>
                    </div>
                  )}
                </div>

                <div className="relative w-24 h-24 rounded-full overflow-hidden bg-muted border-2 border-primary/40 shadow-lg -mt-8">
                  <video
                    ref={cameraPreviewRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {!isVideoOn && (
                    <div className="absolute inset-0 bg-muted flex items-center justify-center">
                      <VideoOff className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex w-full h-full gap-4">
            <div className="flex-1 h-full relative rounded-xl overflow-hidden bg-muted/20 border border-border">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                muted={false}
                className={`w-full h-full object-cover ${hasRemoteStream ? "block" : "hidden"}`}
              />
              {!hasRemoteStream && (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                  <div className="text-center">
                    <Avatar className="w-24 h-24 mx-auto mb-4 border-4 border-primary/30">
                      <AvatarImage src={interviewerAvatar} alt={interviewerName} />
                      <AvatarFallback className="bg-primary/20 text-primary text-3xl font-semibold">
                        {interviewerInitials}
                      </AvatarFallback>
                    </Avatar>
                    <h3 className="text-foreground text-xl font-semibold mb-1">{interviewerName}</h3>
                    <p className="text-muted-foreground text-sm">
                      {isConnected ? "Connecting..." : "Preparing..."}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 h-full relative rounded-xl overflow-hidden bg-muted/20 border border-border">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {!isVideoOn && (
                <div className="absolute inset-0 bg-muted flex items-center justify-center">
                  <VideoOff className="w-12 h-12 text-muted-foreground" />
                </div>
              )}
            </div>
            </div>
        )}
      </div>

      {/* Control bar - always visible above content */}
      <div className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-center gap-4 px-4 pb-6 pt-4 bg-gradient-to-t from-background via-background/95 to-transparent">
        {/* Video toggle */}
        <Button
          onClick={toggleVideo}
          size="lg"
          className={`rounded-full w-14 h-14 ${
            isVideoOn
              ? "bg-secondary text-secondary-foreground hover:bg-secondary/90"
              : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
          }`}
          aria-label={isVideoOn ? "Turn off camera" : "Turn on camera"}
        >
          {isVideoOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
        </Button>

        {/* Audio toggle - uses interview recording */}
        <Button
          onClick={toggleAudio}
          size="lg"
          className={`rounded-full w-14 h-14 ${
            isRecording
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/90"
          }`}
          aria-label={isRecording ? "Stop recording" : "Start recording"}
        >
          {isRecording ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
        </Button>

        {/* Screen share toggle */}
        <Button
          onClick={toggleScreenShare}
          size="lg"
          className={`rounded-full w-14 h-14 ${
            isScreenSharing
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/90"
          }`}
          aria-label={isScreenSharing ? "Stop sharing screen" : "Share screen"}
        >
          {isScreenSharing ? <MonitorOff className="w-6 h-6" /> : <Monitor className="w-6 h-6" />}
        </Button>

        {/* Conversation toggle */}
        <Button
          onClick={() => setShowConversation(!showConversation)}
          size="lg"
          className={`rounded-full w-14 h-14 ${
            showConversation
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/90"
          }`}
          aria-label={showConversation ? "Hide conversation" : "Show conversation"}
        >
          {showConversation ? <MessageSquareOff className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
        </Button>

        {/* Fullscreen toggle */}
        <Button
          onClick={toggleFullscreen}
          size="lg"
          className="rounded-full w-14 h-14 bg-secondary text-secondary-foreground hover:bg-secondary/90"
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFullscreen ? <Minimize2 className="w-6 h-6" /> : <Maximize2 className="w-6 h-6" />}
        </Button>

        {/* End call button */}
        <Button
          onClick={endCall}
          size="lg"
          className="rounded-full w-14 h-14 bg-destructive text-destructive-foreground hover:bg-destructive/90"
          aria-label="End call"
        >
          <PhoneOff className="w-6 h-6" />
        </Button>
      </div>

      {/* Status indicators */}
      {!isScreenSharing && (
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
          <div className="px-3 py-1.5 rounded-full bg-muted/80 backdrop-blur-sm border border-border text-sm font-medium">
            <span className="text-muted-foreground">AI Interview</span>
          </div>
          {!isVideoOn && (
            <div className="px-3 py-1.5 rounded-full bg-destructive/20 backdrop-blur-sm border border-destructive text-sm font-medium text-destructive">
              Camera Off
            </div>
          )}
          {isRecording && (
            <div className="px-3 py-1.5 rounded-full bg-primary/20 backdrop-blur-sm border border-primary text-sm font-medium text-primary">
              Recording...
            </div>
          )}
          {isScreenSharing && (
            <div className="px-3 py-1.5 rounded-full bg-primary/20 backdrop-blur-sm border border-primary text-sm font-medium text-primary">
              Sharing Screen
            </div>
          )}
        </div>
      )}

      {/* Conversation + backend controls */}
      {showConversation && (
        <div className="w-full px-6 pb-6">
          <div className="max-w-4xl mx-auto space-y-4">
            <Card className="bg-background/80 border border-border">
              <CardHeader className="space-y-2">
                <CardTitle className="text-lg">Interview context</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Paste the job description and candidate resume so the interviewer can tailor questions.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="job-description">Job description</Label>
                  <Textarea
                    id="job-description"
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Paste the JD here..."
                    className="min-h-[140px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="resume-text">Candidate resume</Label>
                  <Textarea
                    id="resume-text"
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                    placeholder="Paste the candidate resume here..."
                    className="min-h-[180px]"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground">
                    {contextSavedAt
                      ? `Context saved ${new Date(contextSavedAt).toLocaleTimeString()}`
                      : "Context is optional but improves interview relevance."}
                  </div>
                  <div className="flex items-center gap-3">
                    {contextError && <p className="text-xs text-destructive">{contextError}</p>}
                    <Button
                      onClick={handleSaveContext}
                      disabled={isSavingContext || (!resumeText && !jobDescription)}
                    >
                      {isSavingContext ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving...
                        </span>
                      ) : (
                        "Save context"
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-background/80 border border-border">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg">Pointer conversation</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {statusLabel} <span className="block text-xs text-muted-foreground">Session ID: {sessionId}</span>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="lg" className="rounded-full h-14 w-14" onClick={resetSession}>
                  <RefreshCcw className="w-5 h-5" />
                </Button>
              </div>
            </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Volume2 className="w-4 h-4" />
              FastAPI backend: {backendUrl}
            </div>
            <div className="max-h-48 overflow-y-auto space-y-3 pr-2">
              {messages.length === 0 && (
                <div className="text-sm text-muted-foreground border border-dashed border-border rounded-xl p-4">
                  Conversation will appear here after you speak. Pointer echoes your transcript, responds, and plays the
                  spoken reply automatically.
                </div>
              )}
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.speaker === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                      message.speaker === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    <p className="text-[10px] uppercase tracking-wide opacity-70 mb-1">
                      {message.speaker === "user" ? "You" : "Pointer"}
                    </p>
                    <p>{message.text}</p>
                  </div>
                </div>
              ))}
            </div>
            {status === "processing" && (
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Pointer is composing a response…
              </div>
            )}
            {error && status === "error" && (
              <p className="text-sm text-destructive flex items-center gap-2">
                <MicOff className="w-4 h-4" />
                {error}
              </p>
            )}
          </CardContent>
        </Card>
          </div>
      </div>
      )}
    </div>
  )
}

