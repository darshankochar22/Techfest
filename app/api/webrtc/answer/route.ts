import { NextRequest, NextResponse } from "next/server"

// In-memory store for answers (in production, use Redis or a database)
const answers = new Map<string, RTCSessionDescriptionInit>()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { roomId, answer } = body

    if (!roomId || !answer) {
      return NextResponse.json(
        { error: "Missing roomId or answer" },
        { status: 400 }
      )
    }

    // Store answer for the room
    answers.set(roomId, answer)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error handling answer:", error)
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

    const answer = answers.get(roomId)
    return NextResponse.json({ answer })
  } catch (error) {
    console.error("Error getting answer:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

