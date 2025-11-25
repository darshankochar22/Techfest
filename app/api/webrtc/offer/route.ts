import { NextRequest, NextResponse } from "next/server"

// In-memory store for offers (in production, use Redis or a database)
const offers = new Map<string, RTCSessionDescriptionInit>()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { roomId, offer } = body

    if (!roomId || !offer) {
      return NextResponse.json(
        { error: "Missing roomId or offer" },
        { status: 400 }
      )
    }

    // Store offer for the room
    offers.set(roomId, offer)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error handling offer:", error)
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

    const offer = offers.get(roomId)
    return NextResponse.json({ offer })
  } catch (error) {
    console.error("Error getting offer:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

