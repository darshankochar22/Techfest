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
  LayoutGrid,
  Loader2,
  RefreshCcw,
  Volume2,
  MessageSquare,
  MessageSquareOff,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
  const [viewMode, setViewMode] = useState<"ai-big" | "user-big" | "split">("user-big")
  const [showConversation, setShowConversation] = useState(false)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null)
  const [socket, setSocket] = useState<WebSocket | null>(null)

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const {
    sessionId,
    messages,
    status,
    error,
    isRecording,
    startRecording,
    stopRecording,
    resetSession,
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

            ws.onerror = (error) => {
              console.error("WebSocket error:", error)
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
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        })
        setScreenStream(stream)
        setIsScreenSharing(true)

        // Replace video track in peer connection
        if (peerConnection && localStream) {
          const videoTrack = stream.getVideoTracks()[0]
          const sender = peerConnection
            .getSenders()
            .find((s) => s.track && s.track.kind === "video")
          if (sender && videoTrack) {
            await sender.replaceTrack(videoTrack)
          }
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }

        // Handle screen share stop
        stream.getVideoTracks()[0].onended = async () => {
          setIsScreenSharing(false)
          if (localStream) {
            // Replace back with camera track
            if (peerConnection) {
              const cameraTrack = localStream.getVideoTracks()[0]
              const sender = peerConnection
                .getSenders()
                .find((s) => s.track && s.track.kind === "video")
              if (sender && cameraTrack) {
                await sender.replaceTrack(cameraTrack)
              }
            }
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = localStream
            }
          }
          stream.getTracks().forEach((track) => track.stop())
          setScreenStream(null)
        }
      } else {
        if (screenStream) {
          // Replace back with camera track
          if (peerConnection && localStream) {
            const cameraTrack = localStream.getVideoTracks()[0]
            const sender = peerConnection
              .getSenders()
              .find((s) => s.track && s.track.kind === "video")
            if (sender && cameraTrack) {
              await sender.replaceTrack(cameraTrack)
            }
          }
          screenStream.getTracks().forEach((track) => track.stop())
          setScreenStream(null)
        }
        setIsScreenSharing(false)
        if (localVideoRef.current && localStream) {
          localVideoRef.current.srcObject = localStream
        }
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
      className="fixed inset-0 w-screen h-screen bg-background flex flex-col overflow-hidden"
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
        {/* Split view mode */}
        {viewMode === "split" && (
          <>
            {/* AI Interviewer - Left side */}
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

            {/* User - Right side */}
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
          </>
        )}

        {/* AI Big view mode */}
        {viewMode === "ai-big" && (
          <>
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
                    <Avatar className="w-32 h-32 mx-auto mb-6 border-4 border-primary/30">
                      <AvatarImage src={interviewerAvatar} alt={interviewerName} />
                      <AvatarFallback className="bg-primary/20 text-primary text-4xl font-semibold">
                        {interviewerInitials}
                      </AvatarFallback>
                    </Avatar>
                    <h3 className="text-foreground text-2xl font-semibold mb-2">{interviewerName}</h3>
                    <p className="text-muted-foreground text-lg">
                      {isConnected ? "Connecting..." : "Preparing interview..."}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Local video (picture-in-picture) */}
            <div className="absolute bottom-20 right-4 w-64 h-48 rounded-xl overflow-hidden bg-muted border-2 border-primary shadow-lg">
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
          </>
        )}

        {/* User Big view mode */}
        {viewMode === "user-big" && (
          <>
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

            {/* AI video (picture-in-picture) */}
            <div className="absolute bottom-20 right-4 w-64 h-48 rounded-xl overflow-hidden bg-muted border-2 border-primary shadow-lg">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                muted={false}
                className={`w-full h-full object-cover ${hasRemoteStream ? "block" : "hidden"}`}
              />
              {!hasRemoteStream && (
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                  <Avatar className="w-16 h-16 border-2 border-primary/30">
                    <AvatarImage src={interviewerAvatar} alt={interviewerName} />
                    <AvatarFallback className="bg-primary/20 text-primary text-xl font-semibold">
                      {interviewerInitials}
                    </AvatarFallback>
                  </Avatar>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Control bar */}
      <div className="w-full flex items-center justify-center gap-4 p-6 bg-gradient-to-t from-background via-background to-transparent">
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

        {/* View mode toggle - switch between user big and AI big */}
        <Button
          onClick={() => {
            setViewMode(viewMode === "user-big" ? "ai-big" : "user-big")
          }}
          size="lg"
          className="rounded-full w-14 h-14 bg-secondary text-secondary-foreground hover:bg-secondary/90"
          aria-label={viewMode === "user-big" ? "Switch to AI view" : "Switch to your view"}
          title={viewMode === "user-big" ? "Show AI big" : "Show you big"}
        >
          <LayoutGrid className="w-6 h-6" />
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

      {/* Conversation + backend controls */}
      {showConversation && (
        <div className="w-full px-6 pb-6">
          <Card className="max-w-4xl mx-auto bg-background/80 border border-border">
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
      )}
    </div>
  )
}

