import { getSocketServer } from "@/lib/realtime/socket-server";
import type { RealtimeEvent } from "@/lib/realtime/events";

/**
 * Seul point d'entrée autorisé pour diffuser un événement temps réel. Les services
 * métier (src/server/**) appellent cette fonction après commit d'une transaction —
 * jamais avant, pour ne jamais notifier un état qui pourrait encore être annulé.
 */
export function emitToRoom(room: string, event: RealtimeEvent): void {
  const io = getSocketServer();
  if (!io) {
    // Le serveur socket peut être indisponible (ex: script exécuté hors server.ts,
    // comme le seed). Ce n'est jamais bloquant : les clients se resynchronisent via
    // polling/snapshot REST (voir lib/realtime/README dans la doc du projet).
    return;
  }
  io.to(room).emit("event", event);
}
