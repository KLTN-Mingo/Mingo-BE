"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/message.routes.ts
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const message_controller_1 = require("../controllers/message.controller");
const router = (0, express_1.Router)();
// Allow all file types for message attachments (images, video, audio, documents)
const messageUpload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
});
// ─── Status (no :boxId param — must come before parameterised routes) ─────────
router.put("/status/online", auth_middleware_1.authMiddleware, message_controller_1.setOnline);
router.put("/status/offline", auth_middleware_1.authMiddleware, message_controller_1.setOffline);
// ─── Admin (prefix /admin — place before /:boxId) ────────────────────────────
router.get("/admin/messages", auth_middleware_1.authMiddleware, message_controller_1.adminGetAllMessages);
router.get("/admin/boxes", auth_middleware_1.authMiddleware, message_controller_1.adminGetAllBoxes);
router.get("/admin/search", auth_middleware_1.authMiddleware, message_controller_1.adminSearchMessages);
router.get("/admin/boxes/:boxId/messages", auth_middleware_1.authMiddleware, message_controller_1.adminGetBoxMessages);
router.delete("/admin/messages/:messageId", auth_middleware_1.authMiddleware, message_controller_1.adminDeleteMessage);
// ─── Calls ────────────────────────────────────────────────────────────────────
router.get("/calls/history", auth_middleware_1.authMiddleware, message_controller_1.getCallHistory);
router.post("/calls", auth_middleware_1.authMiddleware, message_controller_1.createCall);
router.patch("/calls/:callId", auth_middleware_1.authMiddleware, message_controller_1.updateCallStatus);
// ─── Boxes ────────────────────────────────────────────────────────────────────
router.post("/boxes", auth_middleware_1.authMiddleware, message_controller_1.createGroup);
router.get("/boxes", auth_middleware_1.authMiddleware, message_controller_1.getDirectBoxes);
// Alias: /conversations → same as /boxes (list direct chats), so "conversations" is not treated as boxId
router.get("/conversations", auth_middleware_1.authMiddleware, message_controller_1.getDirectBoxes);
router.get("/boxes/groups", auth_middleware_1.authMiddleware, message_controller_1.getGroupBoxes);
router.get("/boxes/read-status", auth_middleware_1.authMiddleware, message_controller_1.checkReadStatus);
router.get("/boxes/:boxId", auth_middleware_1.authMiddleware, message_controller_1.getBoxById);
router.delete("/boxes/:boxId", auth_middleware_1.authMiddleware, message_controller_1.deleteBox);
router.patch("/boxes/:boxId/avatar", auth_middleware_1.authMiddleware, message_controller_1.updateGroupAvatar);
router.post("/boxes/:boxId/read", auth_middleware_1.authMiddleware, message_controller_1.markAsRead);
// ─── Messages ─────────────────────────────────────────────────────────────────
// Send message — supports optional file upload (field name: "file")
router.post("/:boxId/send", auth_middleware_1.authMiddleware, messageUpload.single("file"), message_controller_1.sendMessage);
// Fetch messages
router.get("/:boxId", auth_middleware_1.authMiddleware, message_controller_1.getMessages);
router.get("/:boxId/group", auth_middleware_1.authMiddleware, message_controller_1.getGroupMessages);
// Edit / delete
router.patch("/:messageId/edit", auth_middleware_1.authMiddleware, message_controller_1.editMessage);
router.delete("/:messageId", auth_middleware_1.authMiddleware, message_controller_1.deleteOrRevokeMessage);
// Search inside a box
router.get("/:boxId/search", auth_middleware_1.authMiddleware, message_controller_1.searchMessages);
// ─── Media ────────────────────────────────────────────────────────────────────
router.get("/:boxId/media/images", auth_middleware_1.authMiddleware, message_controller_1.getImageList);
router.get("/:boxId/media/videos", auth_middleware_1.authMiddleware, message_controller_1.getVideoList);
router.get("/:boxId/media/audio", auth_middleware_1.authMiddleware, message_controller_1.getAudioList);
router.get("/:boxId/media/files", auth_middleware_1.authMiddleware, message_controller_1.getOtherFileList);
exports.default = router;
