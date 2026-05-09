/**
 * In-memory presence:
 * - socketId -> userId
 * - userId -> set(socketId)
 * App gửi "register" khi connect; mỗi user có thể online nhiều session.
 */

import type { Socket } from "socket.io";

export interface OnlineUser {
  socketId: string;
  userId: string;
  name?: string;
  avatar?: string;
}

const userIdBySocketId = new Map<string, string>();
const socketIdsByUserId = new Map<string, Set<string>>();
const profileByUserId = new Map<string, { name?: string; avatar?: string }>();

export function registerUser(
  socketId: string,
  userId: string,
  name?: string,
  avatar?: string
): void {
  const existingUserId = userIdBySocketId.get(socketId);
  if (existingUserId && existingUserId !== userId) {
    const oldSet = socketIdsByUserId.get(existingUserId);
    oldSet?.delete(socketId);
    if (!oldSet || oldSet.size === 0) {
      socketIdsByUserId.delete(existingUserId);
      profileByUserId.delete(existingUserId);
    }
  }

  userIdBySocketId.set(socketId, userId);

  const socketIds = socketIdsByUserId.get(userId) ?? new Set<string>();
  socketIds.add(socketId);
  socketIdsByUserId.set(userId, socketIds);

  profileByUserId.set(userId, { name, avatar });
}

export function unregisterUser(socketId: string): void {
  const userId = userIdBySocketId.get(socketId);
  userIdBySocketId.delete(socketId);

  if (!userId) return;

  const socketIds = socketIdsByUserId.get(userId);
  socketIds?.delete(socketId);

  if (!socketIds || socketIds.size === 0) {
    socketIdsByUserId.delete(userId);
    profileByUserId.delete(userId);
  }
}

export function getSocketIdByUserId(userId: string): string | undefined {
  const socketIds = socketIdsByUserId.get(userId);
  if (!socketIds || socketIds.size === 0) return undefined;
  const ids = Array.from(socketIds);
  return ids[ids.length - 1];
}

export function getSocketIdsByUserId(userId: string): string[] {
  return Array.from(socketIdsByUserId.get(userId) ?? []);
}

export function getOnlineUsers(): OnlineUser[] {
  return Array.from(socketIdsByUserId.entries()).map(([userId, socketIds]) => {
    const ids = Array.from(socketIds);
    const profile = profileByUserId.get(userId);
    return {
      userId,
      socketId: ids[ids.length - 1],
      name: profile?.name,
      avatar: profile?.avatar,
    };
  });
}
