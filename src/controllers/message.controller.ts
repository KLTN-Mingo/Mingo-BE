// src/controllers/message.controller.ts
import { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import { sendSuccess, sendCreated } from "../utils/response";
import { ValidationError, NotFoundError } from "../errors";
import { MessageService, CallService } from "../services/message.service";
import {
  SendMessageDto,
  CreateGroupDto,
  EditMessageDto,
  DeleteOrRevokeMessageDto,
  CreateCallDto,
  UpdateCallStatusDto,
} from "../dtos/message.dto";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getUserId(req: Request): string {
  const userId = (req as any).user?.userId as string | undefined;
  if (!userId) throw new ValidationError("Authentication required");
  return userId;
}

/** Safely extract a route param as string (guards against multer 2.x type augmentation) */
function param(req: Request, key: string): string {
  return (req.params as Record<string, string>)[key];
}

/** Safely extract a query string value */
function query(req: Request, key: string): string | undefined {
  const val = req.query[key];
  return typeof val === "string" ? val : undefined;
}

// ─── Message Box Controllers ──────────────────────────────────────────────────

/** POST /api/messages/boxes — Create a new group chat */
export const createGroup = asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { membersIds, groupName, groupAva } = req.body as CreateGroupDto;

  if (!Array.isArray(membersIds) || membersIds.length === 0) {
    throw new ValidationError("membersIds must be a non-empty array");
  }
  if (!groupName?.trim()) {
    throw new ValidationError("groupName is required");
  }

  const result = await MessageService.createGroup(userId, { membersIds, groupName, groupAva });
  sendCreated(res, result, result.message);
});

/** GET /api/messages/boxes — Get all direct (1-1) boxes for current user */
export const getDirectBoxes = asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const result = await MessageService.getDirectBoxes(userId);
  sendSuccess(res, result, "Fetched direct boxes");
});

/** GET /api/messages/boxes/groups — Get all group boxes for current user */
export const getGroupBoxes = asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const result = await MessageService.getGroupBoxes(userId);
  sendSuccess(res, result, "Fetched group boxes");
});

/** GET /api/messages/boxes/:boxId — Get a single box by ID */
export const getBoxById = asyncHandler(async (req: Request, res: Response) => {
  const boxId = param(req, "boxId");
  if (!boxId) throw new ValidationError("boxId is required");

  const result = await MessageService.getBoxById(boxId);
  sendSuccess(res, result, "Fetched box");
});

/** DELETE /api/messages/boxes/:boxId — Delete a box */
export const deleteBox = asyncHandler(async (req: Request, res: Response) => {
  const boxId = param(req, "boxId");
  if (!boxId) throw new ValidationError("boxId is required");

  const result = await MessageService.deleteBox(boxId);
  sendSuccess(res, result, result.message);
});

/** PATCH /api/messages/boxes/:boxId/avatar — Upload group avatar */
export const updateGroupAvatar = asyncHandler(async (req: Request, res: Response) => {
  const boxId = param(req, "boxId");
  const { url, publicId } = req.body;

  if (!boxId) throw new ValidationError("boxId is required");
  if (!url || !publicId) throw new ValidationError("url and publicId are required");

  const result = await MessageService.updateGroupAvatar(boxId, url, publicId);
  sendSuccess(res, result, result.message);
});

// ─── Message Controllers ──────────────────────────────────────────────────────

/** POST /api/messages/:boxId/send — Send a message to a box (or start new direct chat) */
export const sendMessage = asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const boxId = param(req, "boxId");

  if (!boxId) throw new ValidationError("boxId is required");

  let content = req.body.content;
  if (!content) throw new ValidationError("content is required");

  // Parse JSON content if it was sent as a string
  if (typeof content === "string") {
    try {
      const parsed = JSON.parse(content);
      if (typeof parsed === "object") content = parsed;
    } catch {
      // content stays as plain string (text message)
    }
  }

  const dto: SendMessageDto = { boxId, content };
  const result = await MessageService.sendMessage(dto, req.file, userId);
  sendCreated(res, result, result.message);
});

/** GET /api/messages/:boxId — Get direct messages in a box */
export const getMessages = asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const boxId = param(req, "boxId");
  if (!boxId) throw new ValidationError("boxId is required");

  const result = await MessageService.getMessages(boxId, userId);
  sendSuccess(res, result, "Fetched messages");
});

/** GET /api/messages/:boxId/group — Get group messages in a box */
export const getGroupMessages = asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const boxId = param(req, "boxId");
  if (!boxId) throw new ValidationError("boxId is required");

  const result = await MessageService.getGroupMessages(boxId, userId);
  sendSuccess(res, result, "Fetched group messages");
});

/** PATCH /api/messages/:messageId/edit — Edit a text message */
export const editMessage = asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const messageId = param(req, "messageId");
  const { newContent } = req.body as EditMessageDto;

  if (!messageId) throw new ValidationError("messageId is required");
  if (!newContent?.trim()) throw new ValidationError("newContent is required");

  const result = await MessageService.editMessage(messageId, { newContent }, userId);
  sendSuccess(res, result, "Message edited");
});

/** DELETE /api/messages/:messageId — Revoke, delete, or unsend a message */
export const deleteOrRevokeMessage = asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const messageId = param(req, "messageId");
  const { action } = (req.body ?? {}) as DeleteOrRevokeMessageDto;

  if (!messageId) throw new ValidationError("messageId is required");
  if (!action || !["revoke", "delete", "unsend"].includes(action)) {
    throw new ValidationError("action must be one of: revoke, delete, unsend");
  }

  const result = await MessageService.deleteOrRevokeMessage(messageId, { action }, userId);
  sendSuccess(res, result, result.message);
});

// ─── Read Status Controllers ──────────────────────────────────────────────────

/** POST /api/messages/boxes/:boxId/read — Mark all messages in a box as read */
export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const boxId = param(req, "boxId");
  if (!boxId) throw new ValidationError("boxId is required");

  const result = await MessageService.markAsRead(boxId, userId);
  sendSuccess(res, result ?? { message: "No messages to mark" }, "Read status updated");
});

/** GET /api/messages/boxes/read-status — Check read status for multiple boxes */
export const checkReadStatus = asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const raw = req.query["boxIds"];

  let boxIds: string[] = [];
  if (typeof raw === "string") {
    boxIds = raw.split(",").map((s) => s.trim()).filter(Boolean);
  } else if (Array.isArray(raw)) {
    boxIds = (raw as string[]).map((s) => s.trim()).filter(Boolean);
  }

  if (boxIds.length === 0) throw new ValidationError("boxIds query param is required");

  const result = await MessageService.checkReadStatus(boxIds, userId);
  sendSuccess(res, result, "Read status fetched");
});

// ─── Media List Controllers ───────────────────────────────────────────────────

/** GET /api/messages/:boxId/media/images */
export const getImageList = asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const boxId = param(req, "boxId");
  if (!boxId) throw new ValidationError("boxId is required");

  const files = await MessageService.getImageList(boxId, userId);
  sendSuccess(res, files, "Fetched image list");
});

/** GET /api/messages/:boxId/media/videos */
export const getVideoList = asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const boxId = param(req, "boxId");
  if (!boxId) throw new ValidationError("boxId is required");

  const files = await MessageService.getVideoList(boxId, userId);
  sendSuccess(res, files, "Fetched video list");
});

/** GET /api/messages/:boxId/media/audio */
export const getAudioList = asyncHandler(async (req: Request, res: Response) => {
  const boxId = param(req, "boxId");
  if (!boxId) throw new ValidationError("boxId is required");

  const files = await MessageService.getAudioList(boxId);
  sendSuccess(res, files, "Fetched audio list");
});

/** GET /api/messages/:boxId/media/files */
export const getOtherFileList = asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const boxId = param(req, "boxId");
  if (!boxId) throw new ValidationError("boxId is required");

  const files = await MessageService.getOtherFileList(boxId, userId);
  sendSuccess(res, files, "Fetched file list");
});

// ─── Search Controllers ───────────────────────────────────────────────────────

/** GET /api/messages/:boxId/search?q=query — Search messages in a box */
export const searchMessages = asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const boxId = param(req, "boxId");
  const q = query(req, "q");

  if (!boxId) throw new ValidationError("boxId is required");
  if (!q?.trim()) throw new ValidationError("q query param is required");

  const result = await MessageService.searchMessagesInBox(boxId, q, userId);
  sendSuccess(res, result, "Search results");
});

// ─── Online Status Controllers ────────────────────────────────────────────────

/** PUT /api/messages/status/online */
export const setOnline = asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const result = await MessageService.setOnlineStatus(userId, true);
  sendSuccess(res, result, result.message);
});

/** PUT /api/messages/status/offline */
export const setOffline = asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const result = await MessageService.setOnlineStatus(userId, false);
  sendSuccess(res, result, result.message);
});

// ─── Admin Controllers ────────────────────────────────────────────────────────

/** GET /api/messages/admin/messages */
export const adminGetAllMessages = asyncHandler(async (req: Request, res: Response) => {
  const result = await MessageService.getAllMessages();
  sendSuccess(res, result, "All messages fetched");
});

/** GET /api/messages/admin/boxes */
export const adminGetAllBoxes = asyncHandler(async (req: Request, res: Response) => {
  const result = await MessageService.getAllBoxes();
  sendSuccess(res, result, "All boxes fetched");
});

/** GET /api/messages/admin/boxes/:boxId/messages */
export const adminGetBoxMessages = asyncHandler(async (req: Request, res: Response) => {
  const boxId = param(req, "boxId");
  if (!boxId) throw new ValidationError("boxId is required");

  const result = await MessageService.getBoxMessages(boxId);
  sendSuccess(res, result, "Box messages fetched");
});

/** DELETE /api/messages/admin/messages/:messageId */
export const adminDeleteMessage = asyncHandler(async (req: Request, res: Response) => {
  const messageId = param(req, "messageId");
  if (!messageId) throw new ValidationError("messageId is required");

  const result = await MessageService.deleteMessage(messageId);
  sendSuccess(res, result, result.message);
});

/** GET /api/messages/admin/search?id=...&q=... */
export const adminSearchMessages = asyncHandler(async (req: Request, res: Response) => {
  const id = query(req, "id");
  const q = query(req, "q");

  const result = await MessageService.adminSearchMessages(id, q);
  sendSuccess(res, result, "Admin search results");
});

// ─── Call Controllers ─────────────────────────────────────────────────────────

/** GET /api/messages/calls/history */
export const getCallHistory = asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const result = await CallService.getCallHistory(userId);
  sendSuccess(res, result, "Call history fetched");
});

/** POST /api/messages/calls */
export const createCall = asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const {
    receiverId,
    callType,
    startTime,
    status,
    endTime,
  } = req.body as Omit<CreateCallDto, "callerId">;

  if (!receiverId) throw new ValidationError("receiverId is required");
  if (!callType || !["video", "voice"].includes(callType)) {
    throw new ValidationError("callType must be video or voice");
  }
  if (!startTime) throw new ValidationError("startTime is required");
  if (!status) throw new ValidationError("status is required");

  const dto: CreateCallDto = {
    callerId: userId,
    receiverId,
    callType,
    startTime: new Date(startTime),
    status,
    endTime: endTime ? new Date(endTime) : undefined,
    createBy: userId,
  } as any;

  const result = await CallService.createCall(dto);
  sendCreated(res, result, result.message);
});

/** PATCH /api/messages/calls/:callId */
export const updateCallStatus = asyncHandler(async (req: Request, res: Response) => {
  const callId = param(req, "callId");
  const dto = req.body as UpdateCallStatusDto;

  if (!callId) throw new ValidationError("callId is required");

  const updated = await CallService.updateCallStatus(callId, {
    ...dto,
    endTime: dto.endTime ? new Date(dto.endTime) : undefined,
  });

  if (!updated) throw new NotFoundError("Call not found");
  sendSuccess(res, updated, "Call status updated");
});
