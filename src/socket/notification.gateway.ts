import { getIO } from "./socket";
import { getSocketIdsByUserId } from "./presence";

export interface ShareNotificationPayload {
  type: "dm_share" | "repost";
  shareId: string;
  postId: string;
  actor: {
    id: string;
    name?: string;
    avatar?: string;
  };
  recipientId: string;
  message?: string;
  createdAt: string;
}

function emitToUser(userId: string, event: "new_dm_share" | "new_repost", payload: ShareNotificationPayload): void {
  const socketIds = getSocketIdsByUserId(userId);
  if (!socketIds.length) return;

  try {
    const io = getIO();
    const notificationNsp = io.of("/notifications");
    for (const socketId of socketIds) {
      notificationNsp.to(socketId).emit(event, payload);
    }
  } catch {
    // Skip when socket server is not initialized.
  }
}

export const NotificationGateway = {
  emitDmShare(userId: string, payload: ShareNotificationPayload): void {
    emitToUser(userId, "new_dm_share", payload);
  },
  emitRepost(userId: string, payload: ShareNotificationPayload): void {
    emitToUser(userId, "new_repost", payload);
  },
};
