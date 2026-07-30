import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";

// Instance unique du serveur Socket.io, attachée au même serveur HTTP que Next.js
// (voir server.ts). Rien en dehors de lib/realtime/emitter.ts ne doit importer
// directement cette instance : toute émission passe par l'abstraction emitter,
// ce qui permet de brancher plus tard un adaptateur Redis pour scaler sans toucher
// au code métier.
//
// Stockée sur `globalThis` (comme le client Prisma, cf. lib/prisma/client.ts) :
// en développement, Next.js compile les routes API via son propre bundler,
// indépendamment du module chargé par server.ts au démarrage. Une simple variable
// de module donnerait deux instances distinctes de `io` selon qui l'importe, et
// les routes API ne verraient jamais l'instance réellement attachée au serveur HTTP.
const globalForSocket = globalThis as unknown as { io?: SocketIOServer };

export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
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

  globalForSocket.io = io;
  return io;
}

export function getSocketServer(): SocketIOServer | undefined {
  return globalForSocket.io;
}
