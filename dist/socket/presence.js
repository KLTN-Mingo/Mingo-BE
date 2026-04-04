"use strict";
/**
 * In-memory presence: userId -> { socketId, name?, avatar? }.
 * App gửi "register" khi connect; khi "call" có thể dùng receiver.userId để tra socketId.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUser = registerUser;
exports.unregisterUser = unregisterUser;
exports.getSocketIdByUserId = getSocketIdByUserId;
exports.getOnlineUsers = getOnlineUsers;
const userBySocketId = new Map(); // socketId -> userId
const userById = new Map(); // userId -> OnlineUser
function registerUser(socketId, userId, name, avatar) {
    const existing = userBySocketId.get(socketId);
    if (existing) {
        userById.delete(existing);
    }
    userBySocketId.set(socketId, userId);
    userById.set(userId, { socketId, userId, name, avatar });
}
function unregisterUser(socketId) {
    const userId = userBySocketId.get(socketId);
    userBySocketId.delete(socketId);
    if (userId)
        userById.delete(userId);
}
function getSocketIdByUserId(userId) {
    return userById.get(userId)?.socketId;
}
function getOnlineUsers() {
    return Array.from(userById.values());
}
