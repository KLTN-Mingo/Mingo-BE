// src/socket/socket.ts
import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import onCall from "./events/onCall";
import onCallAccepted from "./events/onCallAccepted";
import onCallRejected from "./events/onCallRejected";
import onHangup from "./events/onHangup";
import onWebrtcSignal from "./events/onWebrtcSignal";
import {
  CallPayload,
  CallAcceptedPayload,
  CallRejectedPayload,
  HangupPayload,
  WebrtcSignalPayload,
} from "./socket.types";

let io: Server;

/**
 * Initialise Socket.IO on the given HTTP server.
 * Call this once from server.ts, then import `getIO()` wherever you need
 * the live `io` instance (e.g. to emit from a REST controller).
 */
export function initSocketIO(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL ?? "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // ── Call signalling events ────────────────────────────────────────────────

    socket.on("call", (payload: CallPayload) => {
      onCall(io, payload);
    });

    socket.on("callAccepted", (data: CallAcceptedPayload) => {
      onCallAccepted(io, data);
    });

    socket.on("callRejected", (data: CallRejectedPayload) => {
      onCallRejected(io, data);
    });

    socket.on("hangup", (data: HangupPayload) => {
      onHangup(io, data);
    });

    socket.on("webrtcSignal", (data: WebrtcSignalPayload) => {
      onWebrtcSignal(io, data);
    });

    // ── Presence ──────────────────────────────────────────────────────────────

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

/** Returns the initialised Socket.IO server instance. */
export function getIO(): Server {
  if (!io) throw new Error("Socket.IO has not been initialised. Call initSocketIO() first.");
  return io;
}
