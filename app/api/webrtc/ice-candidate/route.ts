import { NextRequest, NextResponse } from "next/server"

// In-memory store for ICE candidates (in production, use Redis or a database)
const iceCandidates = new Map<string, RTCIceCandidateInit[]>()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { roomId, candidate } = body

    if (!roomId || !candidate) {
      return NextResponse.json(
        { error: "Missing roomId or candidate" },
        { status: 400 }
      )
    }

    // Store ICE candidate for the room
    if (!iceCandidates.has(roomId)) {
      iceCandidates.set(roomId, [])
    }
    iceCandidates.get(roomId)!.push(candidate)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error handling ICE candidate:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get("roomId")

    if (!roomId) {
      return NextResponse.json({ error: "Missing roomId" }, { status: 400 })
    }

    const candidates = iceCandidates.get(roomId) || []
    return NextResponse.json({ candidates })
  } catch (error) {
    console.error("Error getting ICE candidates:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

