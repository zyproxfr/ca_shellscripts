"use client";

import { io, type Socket } from "socket.io-client";

let socket: Socket | undefined;

/**
 * Instance Socket.io unique côté client (réutilisée par tous les composants),
 * avec reconnexion automatique (backoff exponentiel intégré à Socket.io). Le
 * serveur n'accepte aucune donnée entrante en dehors de join/leave — voir
 * lib/realtime/socket-server.ts.
 */
export function getSocketClient(): Socket {
  if (!socket) {
    socket = io({ path: "/socket.io", reconnection: true });
  }
  return socket;
}
