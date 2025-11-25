// WebSocket Server for WebRTC Signaling
// Run this separately: node server/websocket-server.js

const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 3001 });

const rooms = new Map(); // roomId -> Set of WebSocket connections

wss.on("connection", (ws) => {
  let currentRoom = null;

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());

      switch (data.type) {
        case "join":
          // Join a room
          currentRoom = data.room || "interview-room";
          if (!rooms.has(currentRoom)) {
            rooms.set(currentRoom, new Set());
          }
          rooms.get(currentRoom).add(ws);
          console.log(`Client joined room: ${currentRoom}`);

          // Notify others in the room
          rooms.get(currentRoom).forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(
                JSON.stringify({
                  type: "user-joined",
                  room: currentRoom,
                })
              );
            }
          });
          break;

        case "offer":
        case "answer":
        case "ice-candidate":
          // Relay signaling messages to other peers in the room
          if (currentRoom && rooms.has(currentRoom)) {
            rooms.get(currentRoom).forEach((client) => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
              }
            });
          }
          break;

        case "leave":
          // Leave the room
          if (currentRoom && rooms.has(currentRoom)) {
            rooms.get(currentRoom).delete(ws);
            if (rooms.get(currentRoom).size === 0) {
              rooms.delete(currentRoom);
            }

            // Notify others in the room
            rooms.get(currentRoom)?.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(
                  JSON.stringify({
                    type: "user-left",
                    room: currentRoom,
                  })
                );
              }
            });
          }
          break;
      }
    } catch (error) {
      console.error("Error handling message:", error);
    }
  });

  ws.on("close", () => {
    if (currentRoom && rooms.has(currentRoom)) {
      rooms.get(currentRoom).delete(ws);
      if (rooms.get(currentRoom).size === 0) {
        rooms.delete(currentRoom);
      }
    }
    console.log("Client disconnected");
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });
});

console.log("WebSocket server running on ws://localhost:3001");

