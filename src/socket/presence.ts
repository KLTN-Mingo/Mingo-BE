/**
 * In-memory presence: userId -> { socketId, name?, avatar? }.
 * App gửi "register" khi connect; khi "call" có thể dùng receiver.userId để tra socketId.
 */

import type { Socket } from "socket.io";

export interface OnlineUser {
  socketId: string;
  userId: string;
  name?: string;
  avatar?: string;
}

const userBySocketId = new Map<string, string>(); // socketId -> userId
const userById = new Map<string, OnlineUser>(); // userId -> OnlineUser

export function registerUser(
  socketId: string,
  userId: string,
  name?: string,
  avatar?: string
): void {
  const existing = userBySocketId.get(socketId);
  if (existing) {
    userById.delete(existing);
  }
  userBySocketId.set(socketId, userId);
  userById.set(userId, { socketId, userId, name, avatar });
}

export function unregisterUser(socketId: string): void {
  const userId = userBySocketId.get(socketId);
  userBySocketId.delete(socketId);
  if (userId) userById.delete(userId);
}

export function getSocketIdByUserId(userId: string): string | undefined {
  return userById.get(userId)?.socketId;
}

export function getOnlineUsers(): OnlineUser[] {
  return Array.from(userById.values());
}
