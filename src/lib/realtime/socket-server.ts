import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";

// Instance unique du serveur Socket.io, attachée au même serveur HTTP que Next.js
// (voir server.ts). Rien en dehors de lib/realtime/emitter.ts ne doit importer
// directement cette instance : toute émission passe par l'abstraction emitter,
// ce qui permet de brancher plus tard un adaptateur Redis pour scaler sans toucher
// au code métier.
let io: SocketIOServer | undefined;

export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    path: "/socket.io",
    cors: {
      origin: process.env.NEXTAUTH_URL ?? "*",
    },
  });

  io.on("connection", (socket) => {
    // Le client rejoint explicitement ses rooms après connexion (voir socket-client.ts) :
    // le serveur ne pousse aucune donnée avant qu'une room ne soit demandée.
    socket.on("join", (room: string) => {
      if (typeof room === "string" && room.length > 0) {
        socket.join(room);
      }
    });
    socket.on("leave", (room: string) => {
      if (typeof room === "string" && room.length > 0) {
        socket.leave(room);
      }
    });
  });

  return io;
}

export function getSocketServer(): SocketIOServer | undefined {
  return io;
}
