// src/socket/socket.ts
import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import onCall from "./events/onCall";
import onCallAccepted from "./events/onCallAccepted";
import onCallRejected from "./events/onCallRejected";
import onHangup from "./events/onHangup";
import onWebrtcSignal from "./events/onWebrtcSignal";
import { registerUser, unregisterUser, getOnlineUsers } from "./presence";
import {
  CallPayload,
  CallAcceptedPayload,
  CallRejectedPayload,
  HangupPayload,
  WebrtcSignalPayload,
} from "./socket.types";

let io: Server;

async function configureRedisAdapter(server: Server): Promise<void> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return;

  try {
    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    server.adapter(createAdapter(pubClient, subClient));
    console.log("Socket.IO Redis adapter connected");
  } catch (error) {
    console.error("Failed to init Socket.IO Redis adapter:", error);
  }
}

function bindNotificationEvents(socket: Socket): void {
  socket.on(
    "notification:read",
    async (payload: string | { notificationId?: string }) => {
      const userId = socket.data.userId as string | undefined;
      const notificationId =
        typeof payload === "string" ? payload : payload?.notificationId;

      if (!userId || !notificationId) {
        socket.emit("notification:error", {
          event: "notification:read",
          message: "Thiếu thông tin user hoặc notificationId",
        });
        return;
      }

      try {
        const { NotificationService } = await import(
          "../services/notification.service"
        );
        await NotificationService.markAsRead(notificationId, userId);
        socket.emit("notification:read:done", { notificationId });
      } catch (error: any) {
        socket.emit("notification:error", {
          event: "notification:read",
          message: error?.message ?? "Không thể đánh dấu đã đọc",
        });
      }
    }
  );

  socket.on(
    "notification:seen",
    async (payload?: string | { notificationId?: string }) => {
      const userId = socket.data.userId as string | undefined;

      if (!userId) {
        socket.emit("notification:error", {
          event: "notification:seen",
          message: "Thiếu thông tin user",
        });
        return;
      }

      const notificationId =
        typeof payload === "string" ? payload : payload?.notificationId;

      try {
        const { NotificationService } = await import(
          "../services/notification.service"
        );

        if (notificationId) {
          await NotificationService.markAsSeen(notificationId, userId);
          socket.emit("notification:seen:done", { notificationId });
          return;
        }

        const count = await NotificationService.markAllAsSeen(userId);
        socket.emit("notification:seen-all:done", { count });
      } catch (error: any) {
        socket.emit("notification:error", {
          event: "notification:seen",
          message: error?.message ?? "Không thể đánh dấu đã xem",
        });
      }
    }
  );

  socket.on("notification:seen-all", async () => {
    const userId = socket.data.userId as string | undefined;

    if (!userId) {
      socket.emit("notification:error", {
        event: "notification:seen-all",
        message: "Thiếu thông tin user",
      });
      return;
    }

    try {
      const { NotificationService } = await import(
        "../services/notification.service"
      );
      const count = await NotificationService.markAllAsSeen(userId);
      socket.emit("notification:seen-all:done", { count });
    } catch (error: any) {
      socket.emit("notification:error", {
        event: "notification:seen-all",
        message: error?.message ?? "Không thể đánh dấu tất cả đã xem",
      });
    }
  });
}

function bindRegisterAndDisconnect(socket: Socket): void {
  socket.on(
    "register",
    (data: { userId: string; socketId?: string; name?: string; avatar?: string }) => {
      const userId = data?.userId;
      if (userId) {
        registerUser(socket.id, userId, data.name, data.avatar);
        socket.data.userId = userId;
        const users = getOnlineUsers().map((u) => ({
          userId: u.userId,
          socketId: u.socketId,
          name: u.name,
          avatar: u.avatar,
        }));
        socket.emit("getUsers", users);
      }
    }
  );

  socket.on("disconnect", () => {
    unregisterUser(socket.id);
    console.log(`Socket disconnected: ${socket.id}`);
  });
}

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

  void configureRedisAdapter(io);

  const notificationsNsp = io.of("/notifications");
  notificationsNsp.on("connection", (socket: Socket) => {
    console.log(`Notification namespace connected: ${socket.id}`);
    bindRegisterAndDisconnect(socket);
    bindNotificationEvents(socket);
  });

  io.on("connection", (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);
    bindRegisterAndDisconnect(socket);
    bindNotificationEvents(socket);

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

  });

  return io;
}

/** Returns the initialised Socket.IO server instance. */
export function getIO(): Server {
  if (!io) throw new Error("Socket.IO has not been initialised. Call initSocketIO() first.");
  return io;
}
