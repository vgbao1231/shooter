import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import express from "express";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { GameRoom } from "./GameRoom";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Built client is at apps/web/dist; the server runs from apps/server.
const webDist = path.resolve(__dirname, "../../web/dist");

// Static client + health, mounted on the same HTTP server Colyseus binds to.
// Colyseus intercepts `/matchmake*` and forwards everything else here.
const app = express();
app.use(express.static(webDist));
app.get("/health", (_request, response) => {
  response.json({ ok: true, game: "inkshot" });
});
// SPA fallback.
app.get(/.*/, (_request, response) => {
  response.sendFile(path.join(webDist, "index.html"));
});

const httpServer = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define("lobby", GameRoom).filterBy(["code"]);

const port = Number(process.env.PORT ?? 8080);
const hostname = process.env.HOST ?? "0.0.0.0";
await gameServer.listen(port, hostname);
console.log(`[inkshot] LAN host ready at http://${hostname}:${port}`);
