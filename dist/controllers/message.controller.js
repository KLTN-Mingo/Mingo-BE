"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCallStatus = exports.createCall = exports.getCallHistory = exports.adminSearchMessages = exports.adminDeleteMessage = exports.adminGetBoxMessages = exports.adminGetAllBoxes = exports.adminGetAllMessages = exports.setOffline = exports.setOnline = exports.searchMessages = exports.getOtherFileList = exports.getAudioList = exports.getVideoList = exports.getImageList = exports.checkReadStatus = exports.markAsRead = exports.deleteOrRevokeMessage = exports.editMessage = exports.getGroupMessages = exports.getMessages = exports.sendMessage = exports.updateGroupAvatar = exports.deleteBox = exports.getBoxById = exports.getGroupBoxes = exports.getDirectBoxes = exports.createGroup = void 0;
const async_handler_1 = require("../utils/async-handler");
const response_1 = require("../utils/response");
const errors_1 = require("../errors");
const validators_1 = require("../utils/validators");
const message_service_1 = require("../services/message.service");
// ─── Helpers ──────────────────────────────────────────────────────────────────
function getUserId(req) {
    const userId = req.user?.userId;
    if (!userId)
        throw new errors_1.ValidationError("Authentication required");
    return userId;
}
/** Safely extract a route param as string (guards against multer 2.x type augmentation) */
function param(req, key) {
    return req.params[key];
}
/** Safely extract a query string value */
function query(req, key) {
    const val = req.query[key];
    return typeof val === "string" ? val : undefined;
}
// ─── Message Box Controllers ──────────────────────────────────────────────────
/** POST /api/messages/boxes — Create a new group chat */
exports.createGroup = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getUserId(req);
    const { membersIds, groupName, groupAva } = req.body;
    if (!Array.isArray(membersIds) || membersIds.length === 0) {
        throw new errors_1.ValidationError("membersIds must be a non-empty array");
    }
    if (!groupName?.trim()) {
        throw new errors_1.ValidationError("groupName is required");
    }
    const result = await message_service_1.MessageService.createGroup(userId, { membersIds, groupName, groupAva });
    (0, response_1.sendCreated)(res, result, result.message);
});
/** GET /api/messages/boxes — Get all direct (1-1) boxes for current user */
exports.getDirectBoxes = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getUserId(req);
    const result = await message_service_1.MessageService.getDirectBoxes(userId);
    (0, response_1.sendSuccess)(res, result, "Fetched direct boxes");
});
/** GET /api/messages/boxes/groups — Get all group boxes for current user */
exports.getGroupBoxes = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getUserId(req);
    const result = await message_service_1.MessageService.getGroupBoxes(userId);
    (0, response_1.sendSuccess)(res, result, "Fetched group boxes");
});
/** GET /api/messages/boxes/:boxId — Get a single box by ID */
exports.getBoxById = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const boxId = param(req, "boxId");
    if (!boxId)
        throw new errors_1.ValidationError("boxId is required");
    (0, validators_1.validateObjectId)(boxId, "boxId");
    const result = await message_service_1.MessageService.getBoxById(boxId);
    (0, response_1.sendSuccess)(res, result, "Fetched box");
});
/** DELETE /api/messages/boxes/:boxId — Delete a box */
exports.deleteBox = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const boxId = param(req, "boxId");
    if (!boxId)
        throw new errors_1.ValidationError("boxId is required");
    (0, validators_1.validateObjectId)(boxId, "boxId");
    const result = await message_service_1.MessageService.deleteBox(boxId);
    (0, response_1.sendSuccess)(res, result, result.message);
});
/** PATCH /api/messages/boxes/:boxId/avatar — Upload group avatar */
exports.updateGroupAvatar = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const boxId = param(req, "boxId");
    const { url, publicId } = req.body;
    if (!boxId)
        throw new errors_1.ValidationError("boxId is required");
    (0, validators_1.validateObjectId)(boxId, "boxId");
    if (!url || !publicId)
        throw new errors_1.ValidationError("url and publicId are required");
    const result = await message_service_1.MessageService.updateGroupAvatar(boxId, url, publicId);
    (0, response_1.sendSuccess)(res, result, result.message);
});
// ─── Message Controllers ──────────────────────────────────────────────────────
/** POST /api/messages/:boxId/send — Send a message to a box (or start new direct chat) */
exports.sendMessage = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getUserId(req);
    const boxId = param(req, "boxId");
    if (!boxId)
        throw new errors_1.ValidationError("boxId is required");
    (0, validators_1.validateObjectId)(boxId, "boxId");
    let content = req.body.content;
    if (!content)
        throw new errors_1.ValidationError("content is required");
    // Parse JSON content if it was sent as a string
    if (typeof content === "string") {
        try {
            const parsed = JSON.parse(content);
            if (typeof parsed === "object")
                content = parsed;
        }
        catch {
            // content stays as plain string (text message)
        }
    }
    const dto = { boxId, content };
    const result = await message_service_1.MessageService.sendMessage(dto, req.file, userId);
    (0, response_1.sendCreated)(res, result, result.message);
});
/** GET /api/messages/:boxId — Get direct messages in a box */
exports.getMessages = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getUserId(req);
    const boxId = param(req, "boxId");
    if (!boxId)
        throw new errors_1.ValidationError("boxId is required");
    (0, validators_1.validateObjectId)(boxId, "boxId");
    const result = await message_service_1.MessageService.getMessages(boxId, userId);
    (0, response_1.sendSuccess)(res, result, "Fetched messages");
});
/** GET /api/messages/:boxId/group — Get group messages in a box */
exports.getGroupMessages = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getUserId(req);
    const boxId = param(req, "boxId");
    if (!boxId)
        throw new errors_1.ValidationError("boxId is required");
    (0, validators_1.validateObjectId)(boxId, "boxId");
    const result = await message_service_1.MessageService.getGroupMessages(boxId, userId);
    (0, response_1.sendSuccess)(res, result, "Fetched group messages");
});
/** PATCH /api/messages/:messageId/edit — Edit a text message */
exports.editMessage = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getUserId(req);
    const messageId = param(req, "messageId");
    const { newContent } = req.body;
    if (!messageId)
        throw new errors_1.ValidationError("messageId is required");
    (0, validators_1.validateObjectId)(messageId, "messageId");
    if (!newContent?.trim())
        throw new errors_1.ValidationError("newContent is required");
    const result = await message_service_1.MessageService.editMessage(messageId, { newContent }, userId);
    (0, response_1.sendSuccess)(res, result, "Message edited");
});
/** DELETE /api/messages/:messageId — Revoke, delete, or unsend a message */
exports.deleteOrRevokeMessage = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getUserId(req);
    const messageId = param(req, "messageId");
    const { action } = (req.body ?? {});
    if (!messageId)
        throw new errors_1.ValidationError("messageId is required");
    (0, validators_1.validateObjectId)(messageId, "messageId");
    if (!action || !["revoke", "delete", "unsend"].includes(action)) {
        throw new errors_1.ValidationError("action must be one of: revoke, delete, unsend");
    }
    const result = await message_service_1.MessageService.deleteOrRevokeMessage(messageId, { action }, userId);
    (0, response_1.sendSuccess)(res, result, result.message);
});
// ─── Read Status Controllers ──────────────────────────────────────────────────
/** POST /api/messages/boxes/:boxId/read — Mark all messages in a box as read */
exports.markAsRead = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getUserId(req);
    const boxId = param(req, "boxId");
    if (!boxId)
        throw new errors_1.ValidationError("boxId is required");
    (0, validators_1.validateObjectId)(boxId, "boxId");
    const result = await message_service_1.MessageService.markAsRead(boxId, userId);
    (0, response_1.sendSuccess)(res, result ?? { message: "No messages to mark" }, "Read status updated");
});
/** GET /api/messages/boxes/read-status — Check read status for multiple boxes */
exports.checkReadStatus = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getUserId(req);
    const raw = req.query["boxIds"];
    let boxIds = [];
    if (typeof raw === "string") {
        boxIds = raw.split(",").map((s) => s.trim()).filter(Boolean);
    }
    else if (Array.isArray(raw)) {
        boxIds = raw.map((s) => s.trim()).filter(Boolean);
    }
    if (boxIds.length === 0)
        throw new errors_1.ValidationError("boxIds query param is required");
    boxIds.forEach((id) => (0, validators_1.validateObjectId)(id, "boxId"));
    const result = await message_service_1.MessageService.checkReadStatus(boxIds, userId);
    (0, response_1.sendSuccess)(res, result, "Read status fetched");
});
// ─── Media List Controllers ───────────────────────────────────────────────────
/** GET /api/messages/:boxId/media/images */
exports.getImageList = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getUserId(req);
    const boxId = param(req, "boxId");
    if (!boxId)
        throw new errors_1.ValidationError("boxId is required");
    (0, validators_1.validateObjectId)(boxId, "boxId");
    const files = await message_service_1.MessageService.getImageList(boxId, userId);
    (0, response_1.sendSuccess)(res, files, "Fetched image list");
});
/** GET /api/messages/:boxId/media/videos */
exports.getVideoList = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getUserId(req);
    const boxId = param(req, "boxId");
    if (!boxId)
        throw new errors_1.ValidationError("boxId is required");
    (0, validators_1.validateObjectId)(boxId, "boxId");
    const files = await message_service_1.MessageService.getVideoList(boxId, userId);
    (0, response_1.sendSuccess)(res, files, "Fetched video list");
});
/** GET /api/messages/:boxId/media/audio */
exports.getAudioList = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const boxId = param(req, "boxId");
    if (!boxId)
        throw new errors_1.ValidationError("boxId is required");
    (0, validators_1.validateObjectId)(boxId, "boxId");
    const files = await message_service_1.MessageService.getAudioList(boxId);
    (0, response_1.sendSuccess)(res, files, "Fetched audio list");
});
/** GET /api/messages/:boxId/media/files */
exports.getOtherFileList = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getUserId(req);
    const boxId = param(req, "boxId");
    if (!boxId)
        throw new errors_1.ValidationError("boxId is required");
    (0, validators_1.validateObjectId)(boxId, "boxId");
    const files = await message_service_1.MessageService.getOtherFileList(boxId, userId);
    (0, response_1.sendSuccess)(res, files, "Fetched file list");
});
// ─── Search Controllers ───────────────────────────────────────────────────────
/** GET /api/messages/:boxId/search?q=query — Search messages in a box */
exports.searchMessages = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getUserId(req);
    const boxId = param(req, "boxId");
    const q = query(req, "q");
    if (!boxId)
        throw new errors_1.ValidationError("boxId is required");
    (0, validators_1.validateObjectId)(boxId, "boxId");
    if (!q?.trim())
        throw new errors_1.ValidationError("q query param is required");
    const result = await message_service_1.MessageService.searchMessagesInBox(boxId, q, userId);
    (0, response_1.sendSuccess)(res, result, "Search results");
});
// ─── Online Status Controllers ────────────────────────────────────────────────
/** PUT /api/messages/status/online */
exports.setOnline = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getUserId(req);
    const result = await message_service_1.MessageService.setOnlineStatus(userId, true);
    (0, response_1.sendSuccess)(res, result, result.message);
});
/** PUT /api/messages/status/offline */
exports.setOffline = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getUserId(req);
    const result = await message_service_1.MessageService.setOnlineStatus(userId, false);
    (0, response_1.sendSuccess)(res, result, result.message);
});
// ─── Admin Controllers ────────────────────────────────────────────────────────
/** GET /api/messages/admin/messages */
exports.adminGetAllMessages = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await message_service_1.MessageService.getAllMessages();
    (0, response_1.sendSuccess)(res, result, "All messages fetched");
});
/** GET /api/messages/admin/boxes */
exports.adminGetAllBoxes = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const result = await message_service_1.MessageService.getAllBoxes();
    (0, response_1.sendSuccess)(res, result, "All boxes fetched");
});
/** GET /api/messages/admin/boxes/:boxId/messages */
exports.adminGetBoxMessages = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const boxId = param(req, "boxId");
    if (!boxId)
        throw new errors_1.ValidationError("boxId is required");
    (0, validators_1.validateObjectId)(boxId, "boxId");
    const result = await message_service_1.MessageService.getBoxMessages(boxId);
    (0, response_1.sendSuccess)(res, result, "Box messages fetched");
});
/** DELETE /api/messages/admin/messages/:messageId */
exports.adminDeleteMessage = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const messageId = param(req, "messageId");
    if (!messageId)
        throw new errors_1.ValidationError("messageId is required");
    (0, validators_1.validateObjectId)(messageId, "messageId");
    const result = await message_service_1.MessageService.deleteMessage(messageId);
    (0, response_1.sendSuccess)(res, result, result.message);
});
/** GET /api/messages/admin/search?id=...&q=... */
exports.adminSearchMessages = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const id = query(req, "id");
    const q = query(req, "q");
    const result = await message_service_1.MessageService.adminSearchMessages(id, q);
    (0, response_1.sendSuccess)(res, result, "Admin search results");
});
// ─── Call Controllers ─────────────────────────────────────────────────────────
/** GET /api/messages/calls/history */
exports.getCallHistory = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getUserId(req);
    const result = await message_service_1.CallService.getCallHistory(userId);
    (0, response_1.sendSuccess)(res, result, "Call history fetched");
});
/** POST /api/messages/calls */
exports.createCall = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getUserId(req);
    const { receiverId, callType, startTime, status, endTime, } = req.body;
    if (!receiverId)
        throw new errors_1.ValidationError("receiverId is required");
    if (!callType || !["video", "voice"].includes(callType)) {
        throw new errors_1.ValidationError("callType must be video or voice");
    }
    if (!startTime)
        throw new errors_1.ValidationError("startTime is required");
    if (!status)
        throw new errors_1.ValidationError("status is required");
    const dto = {
        callerId: userId,
        receiverId,
        callType,
        startTime: new Date(startTime),
        status,
        endTime: endTime ? new Date(endTime) : undefined,
        createBy: userId,
    };
    const result = await message_service_1.CallService.createCall(dto);
    (0, response_1.sendCreated)(res, result, result.message);
});
/** PATCH /api/messages/calls/:callId */
exports.updateCallStatus = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const callId = param(req, "callId");
    const dto = req.body;
    if (!callId)
        throw new errors_1.ValidationError("callId is required");
    (0, validators_1.validateObjectId)(callId, "callId");
    const updated = await message_service_1.CallService.updateCallStatus(callId, {
        ...dto,
        endTime: dto.endTime ? new Date(dto.endTime) : undefined,
    });
    if (!updated)
        throw new errors_1.NotFoundError("Call not found");
    (0, response_1.sendSuccess)(res, updated, "Call status updated");
});
