// src/routes/message.routes.ts
import { Router } from "express";
import multer from "multer";
import { authMiddleware } from "../middleware/auth.middleware";
import {
  // Box
  createGroup,
  getDirectBoxes,
  getGroupBoxes,
  getBoxById,
  deleteBox,
  updateGroupAvatar,
  // Messages
  sendMessage,
  getMessages,
  getGroupMessages,
  editMessage,
  deleteOrRevokeMessage,
  // Read status
  markAsRead,
  checkReadStatus,
  // Media
  getImageList,
  getVideoList,
  getAudioList,
  getOtherFileList,
  // Search
  searchMessages,
  // Online status
  setOnline,
  setOffline,
  // Admin
  adminGetAllMessages,
  adminGetAllBoxes,
  adminGetBoxMessages,
  adminDeleteMessage,
  adminSearchMessages,
  // Calls
  getCallHistory,
  createCall,
  updateCallStatus,
} from "../controllers/message.controller";

const router = Router();

// Allow all file types for message attachments (images, video, audio, documents)
const messageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
});

// ─── Status (no :boxId param — must come before parameterised routes) ─────────
router.put("/status/online", authMiddleware, setOnline);
router.put("/status/offline", authMiddleware, setOffline);

// ─── Admin (prefix /admin — place before /:boxId) ────────────────────────────
router.get("/admin/messages", authMiddleware, adminGetAllMessages);
router.get("/admin/boxes", authMiddleware, adminGetAllBoxes);
router.get("/admin/search", authMiddleware, adminSearchMessages);
router.get("/admin/boxes/:boxId/messages", authMiddleware, adminGetBoxMessages);
router.delete("/admin/messages/:messageId", authMiddleware, adminDeleteMessage);

// ─── Calls ────────────────────────────────────────────────────────────────────
router.get("/calls/history", authMiddleware, getCallHistory);
router.post("/calls", authMiddleware, createCall);
router.patch("/calls/:callId", authMiddleware, updateCallStatus);

// ─── Boxes ────────────────────────────────────────────────────────────────────
router.post("/boxes", authMiddleware, createGroup);
router.get("/boxes", authMiddleware, getDirectBoxes);
// Alias: /conversations → same as /boxes (list direct chats), so "conversations" is not treated as boxId
router.get("/conversations", authMiddleware, getDirectBoxes);
router.get("/boxes/groups", authMiddleware, getGroupBoxes);
router.get("/boxes/read-status", authMiddleware, checkReadStatus);
router.get("/boxes/:boxId", authMiddleware, getBoxById);
router.delete("/boxes/:boxId", authMiddleware, deleteBox);
router.patch("/boxes/:boxId/avatar", authMiddleware, updateGroupAvatar);
router.post("/boxes/:boxId/read", authMiddleware, markAsRead);

// ─── Messages ─────────────────────────────────────────────────────────────────

// Send message — supports optional file upload (field name: "file")
router.post(
  "/:boxId/send",
  authMiddleware,
  messageUpload.single("file"),
  sendMessage
);

// Fetch messages
router.get("/:boxId", authMiddleware, getMessages);
router.get("/:boxId/group", authMiddleware, getGroupMessages);

// Edit / delete
router.patch("/:messageId/edit", authMiddleware, editMessage);
router.delete("/:messageId", authMiddleware, deleteOrRevokeMessage);

// Search inside a box
router.get("/:boxId/search", authMiddleware, searchMessages);

// ─── Media ────────────────────────────────────────────────────────────────────
router.get("/:boxId/media/images", authMiddleware, getImageList);
router.get("/:boxId/media/videos", authMiddleware, getVideoList);
router.get("/:boxId/media/audio", authMiddleware, getAudioList);
router.get("/:boxId/media/files", authMiddleware, getOtherFileList);

export default router;
