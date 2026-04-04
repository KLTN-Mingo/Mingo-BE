"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSocketIO = initSocketIO;
exports.getIO = getIO;
const socket_io_1 = require("socket.io");
const onCall_1 = __importDefault(require("./events/onCall"));
const onCallAccepted_1 = __importDefault(require("./events/onCallAccepted"));
const onCallRejected_1 = __importDefault(require("./events/onCallRejected"));
const onHangup_1 = __importDefault(require("./events/onHangup"));
const onWebrtcSignal_1 = __importDefault(require("./events/onWebrtcSignal"));
const presence_1 = require("./presence");
let io;
/**
 * Initialise Socket.IO on the given HTTP server.
 * Call this once from server.ts, then import `getIO()` wherever you need
 * the live `io` instance (e.g. to emit from a REST controller).
 */
function initSocketIO(httpServer) {
    io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: process.env.CLIENT_URL ?? "*",
            methods: ["GET", "POST"],
            credentials: true,
        },
    });
    io.on("connection", (socket) => {
        console.log(`Socket connected: ${socket.id}`);
        // ── Presence: app gửi register để server lưu userId <-> socketId ───────────
        socket.on("register", (data) => {
            const userId = data?.userId;
            if (userId) {
                (0, presence_1.registerUser)(socket.id, userId, data.name, data.avatar);
                const users = (0, presence_1.getOnlineUsers)().map((u) => ({
                    userId: u.userId,
                    socketId: u.socketId,
                    name: u.name,
                    avatar: u.avatar,
                }));
                socket.emit("getUsers", users);
            }
        });
        // ── Call signalling events ────────────────────────────────────────────────
        socket.on("call", (payload) => {
            (0, onCall_1.default)(io, payload);
        });
        socket.on("callAccepted", (data) => {
            (0, onCallAccepted_1.default)(io, data);
        });
        socket.on("callRejected", (data) => {
            (0, onCallRejected_1.default)(io, data);
        });
        socket.on("hangup", (data) => {
            (0, onHangup_1.default)(io, data);
        });
        socket.on("webrtcSignal", (data) => {
            (0, onWebrtcSignal_1.default)(io, data);
        });
        socket.on("disconnect", () => {
            (0, presence_1.unregisterUser)(socket.id);
            console.log(`Socket disconnected: ${socket.id}`);
        });
    });
    return io;
}
/** Returns the initialised Socket.IO server instance. */
function getIO() {
    if (!io)
        throw new Error("Socket.IO has not been initialised. Call initSocketIO() first.");
    return io;
}
