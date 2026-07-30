import { createServer } from "node:http";
import next from "next";
import { initSocketServer } from "@/lib/realtime/socket-server";

// Serveur HTTP custom : Next.js App Router seul ne peut pas héberger un serveur
// Socket.io persistant (route handlers sans état / à la requête). Comme le
// déploiement cible est un Docker auto-hébergé (pas de plateforme serverless), on
// attache Next.js et Socket.io au même serveur HTTP.
const port = Number(process.env.PORT ?? 3000);
const dev = process.env.NODE_ENV !== "production";

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  initSocketServer(httpServer);

  httpServer.listen(port, () => {
    console.log(`> Serveur prêt sur http://localhost:${port}`);
  });
});
