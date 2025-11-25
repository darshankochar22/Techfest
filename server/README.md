# WebRTC Backend Setup

This project uses WebRTC for peer-to-peer video/audio communication and screen sharing.

## Setup Instructions

### Option 1: WebSocket Server (Recommended for Real-time)

1. Install dependencies:
```bash
npm install ws
```

2. Start the WebSocket server:
```bash
node server/websocket-server.js
```

The WebSocket server will run on `ws://localhost:3001`

3. Update environment variable (optional):
```env
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

### Option 2: HTTP API Routes (Fallback)

The API routes are already set up in:
- `/app/api/webrtc/offer/route.ts`
- `/app/api/webrtc/answer/route.ts`
- `/app/api/webrtc/ice-candidate/route.ts`

These use polling to exchange signaling messages. This is less efficient but works without a separate WebSocket server.

## Architecture

- **WebRTC**: Handles peer-to-peer media (video, audio, screen share)
- **Signaling Server**: Coordinates connection setup (offer/answer/ICE candidates)
- **STUN Servers**: Google's public STUN servers for NAT traversal
- **TURN Server**: (Optional) Required for users behind strict NATs/firewalls

## Production Considerations

1. **Use a TURN server** (e.g., Twilio, Cloudflare, or self-hosted coturn)
2. **Replace in-memory storage** with Redis or a database
3. **Add authentication** and room access control
4. **Monitor connection quality** and handle reconnections
5. **Use HTTPS/WSS** for secure connections

## Testing

1. Start the Next.js dev server: `npm run dev`
2. Start the WebSocket server: `node server/websocket-server.js`
3. Open two browser windows to test peer-to-peer connection

