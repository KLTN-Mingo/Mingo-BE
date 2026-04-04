"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallService = exports.MessageService = void 0;
// src/services/message.service.ts
const mongoose_1 = require("mongoose");
const cloudinary_1 = require("cloudinary");
const streamifier_1 = __importDefault(require("streamifier"));
const message_model_1 = require("../models/message.model");
const message_box_model_1 = require("../models/message-box.model");
const message_file_model_1 = require("../models/message-file.model");
const call_model_1 = require("../models/call.model");
const user_model_1 = require("../models/user.model");
const block_model_1 = require("../models/block.model");
const pusher_1 = require("../lib/pusher");
const errors_1 = require("../errors");
const message_dto_1 = require("../dtos/message.dto");
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
// ─── Private helpers ──────────────────────────────────────────────────────────
const generateRandomString = (length = 20) => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
};
async function uploadFileToCloudinary(file, userId, duration) {
    const { mimetype, buffer, originalname, size } = file;
    let folder;
    let resourceType;
    let type;
    if (mimetype.startsWith("image/")) {
        folder = "Messages/Images";
        resourceType = "image";
        type = "Image";
    }
    else if (mimetype.startsWith("video/")) {
        folder = "Messages/Videos";
        resourceType = "video";
        type = "Video";
    }
    else if (mimetype.startsWith("audio/")) {
        folder = "Messages/Audios";
        resourceType = "auto";
        type = "Audio";
    }
    else {
        folder = "Messages/Documents";
        resourceType = "raw";
        type = "Other";
    }
    const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary_1.v2.uploader.upload_stream({
            folder,
            resource_type: resourceType,
            public_id: type === "Other" || type === "Audio"
                ? `${folder}/${originalname ?? generateRandomString()}`
                : undefined,
        }, (error, result) => {
            if (error)
                return reject(new errors_1.InternalServerError(`Cloudinary upload failed: ${error.message}`, "FILE_UPLOAD_FAILED"));
            if (!result)
                return reject(new errors_1.InternalServerError("No result received from Cloudinary", "FILE_UPLOAD_FAILED"));
            resolve(result);
        });
        streamifier_1.default.createReadStream(buffer).pipe(uploadStream);
    });
    const savedFile = await message_file_model_1.MessageFileModel.create({
        fileName: type === "Other"
            ? (originalname ?? generateRandomString())
            : generateRandomString(),
        url: uploadResult.secure_url ?? uploadResult.url,
        publicId: uploadResult.public_id,
        bytes: String(size),
        width: String(uploadResult.width ?? 0),
        height: String(uploadResult.height ?? 0),
        format: uploadResult.format ?? mimetype.split("/")[1] ?? "unknown",
        type,
        duration: type === "Audio" ? (duration ?? uploadResult.duration ?? 0) : undefined,
        createBy: new mongoose_1.Types.ObjectId(userId),
        createAt: new Date(),
    });
    return savedFile;
}
async function buildMessageContent(data, file, userId, memberIds) {
    let contentIds = [];
    let text = [];
    if (typeof data.content === "string") {
        text = [data.content];
    }
    else if (data.content &&
        data.content.fileName &&
        data.content.type) {
        if (!file)
            throw new errors_1.ValidationError("No file provided for file message", "FILE_REQUIRED");
        const contentMeta = data.content;
        const duration = typeof contentMeta.duration === "number"
            ? contentMeta.duration
            : undefined;
        const savedFile = await uploadFileToCloudinary(file, userId, duration);
        contentIds = [savedFile._id];
        text = [];
    }
    else {
        throw new errors_1.ValidationError("Invalid content: must be a string or a file metadata object", "INVALID_CONTENT_TYPE");
    }
    const visibilityMap = new Map();
    memberIds.forEach((id) => visibilityMap.set(id, true));
    const message = await message_model_1.MessageModel.create({
        flag: true,
        visibility: visibilityMap,
        readedId: [new mongoose_1.Types.ObjectId(userId)],
        contentId: contentIds,
        text,
        boxId: new mongoose_1.Types.ObjectId(data.boxId),
        createBy: new mongoose_1.Types.ObjectId(userId),
        createAt: new Date(),
        updatedAt: new Date(),
    });
    return message;
}
async function populateMessageForPusher(messageId) {
    return message_model_1.MessageModel.findById(messageId)
        .populate({
        path: "contentId",
        model: "File",
        options: { strictPopulate: false },
    })
        .populate({ path: "createBy", model: "User", select: "name avatar" });
}
function buildPusherNewMessage(populated, boxId) {
    return {
        id: populated._id.toString(),
        flag: true,
        isReact: false,
        readedId: populated.readedId.map((id) => id.toString()),
        contentId: populated.contentId?.[populated.contentId.length - 1] ?? undefined,
        text: populated.text?.[populated.text.length - 1] ?? "",
        boxId,
        createAt: new Date().toISOString(),
        createBy: populated.createBy?._id?.toString() ?? populated.createBy?.toString(),
        createName: populated.createBy?.name ?? "Unknown",
        createAvatar: populated.createBy?.avatar ?? "",
    };
}
// ─── MessageService ───────────────────────────────────────────────────────────
exports.MessageService = {
    // ── Send / Create ────────────────────────────────────────────────────────
    async sendMessage(data, file, userId) {
        const userObjectId = new mongoose_1.Types.ObjectId(userId);
        let box = await message_box_model_1.MessageBoxModel.findById(data.boxId);
        if (box) {
            const receiverIds = box.receiverIds.map((id) => id.toString());
            if (receiverIds.length > 2) {
                // Group chat
                const memberIds = [...receiverIds, box.senderId.toString()];
                if (!memberIds.includes(userId)) {
                    throw new errors_1.ForbiddenError("User is not a member of this group", "NOT_GROUP_MEMBER");
                }
                const message = await buildMessageContent(data, file, userId, memberIds);
                box = await message_box_model_1.MessageBoxModel.findByIdAndUpdate(data.boxId, { $push: { messageIds: message._id }, $set: { senderId: userId } }, { new: true });
                if (!box)
                    throw new errors_1.InternalServerError("MessageBox could not be updated", "BOX_UPDATE_FAILED");
                const populated = await populateMessageForPusher(message._id);
                const pusherPayload = buildPusherNewMessage(populated, data.boxId);
                await pusher_1.pusherServer
                    .trigger(`private-${data.boxId}`, "new-message", pusherPayload)
                    .catch((err) => console.error("Pusher error:", err));
                return { success: true, message: "Message sent successfully" };
            }
            else {
                // Direct (1-1) chat
                const [firstId, secondId] = [receiverIds[0], userId].sort();
                const isBlocked = await block_model_1.BlockModel.findOne({
                    $or: [
                        { blockerId: firstId, blockedId: secondId },
                        { blockerId: secondId, blockedId: firstId },
                    ],
                });
                if (isBlocked)
                    throw new errors_1.ForbiddenError("Sender is blocked by receiver", "BLOCKED_USER");
                const memberIds = [...receiverIds, box.senderId.toString()];
                const message = await buildMessageContent(data, file, userId, memberIds);
                box = await message_box_model_1.MessageBoxModel.findByIdAndUpdate(box._id, {
                    $push: { messageIds: message._id },
                    $set: { senderId: userId },
                    $addToSet: { receiverIds: userId },
                }, { new: true });
                const populated = await populateMessageForPusher(message._id);
                const pusherPayload = buildPusherNewMessage(populated, data.boxId);
                await pusher_1.pusherServer
                    .trigger(`private-${data.boxId}`, "new-message", pusherPayload)
                    .catch((err) => console.error("Pusher error:", err));
                return { success: true, message: "Message sent successfully" };
            }
        }
        else {
            // No box found — create new direct box (boxId is the target userId)
            const targetUserId = data.boxId;
            const message = await buildMessageContent(data, file, userId, [
                userId,
                targetUserId,
            ]);
            const newBox = await message_box_model_1.MessageBoxModel.create({
                senderId: userId,
                receiverIds: [targetUserId, userId],
                messageIds: [message._id],
                groupName: "",
                groupAva: "",
                flag: true,
                pin: false,
                createBy: userObjectId,
                status: true,
            });
            const populated = await populateMessageForPusher(message._id);
            const pusherPayload = buildPusherNewMessage(populated, newBox._id.toString());
            await pusher_1.pusherServer
                .trigger(`private-${userId}`, "new-message", pusherPayload)
                .catch((err) => console.error("Pusher error:", err));
            return { success: true, message: "New box created and message sent" };
        }
    },
    async createGroup(leaderId, dto) {
        const { membersIds, groupName, groupAva = "" } = dto;
        if (!Array.isArray(membersIds) || membersIds.length === 0) {
            throw new errors_1.ValidationError("membersIds must be a non-empty array", "INVALID_MEMBERS");
        }
        const leaderExists = await user_model_1.UserModel.exists({ _id: leaderId });
        if (!leaderExists)
            throw new errors_1.NotFoundError("Leader user not found", "LEADER_NOT_FOUND");
        const foundCount = await user_model_1.UserModel.countDocuments({
            _id: { $in: membersIds },
        });
        if (foundCount !== membersIds.length) {
            throw new errors_1.NotFoundError("One or more member IDs do not exist", "MEMBER_NOT_FOUND");
        }
        const allIds = [leaderId, ...membersIds];
        const existing = await message_box_model_1.MessageBoxModel.findOne({
            receiverIds: { $size: allIds.length, $all: allIds },
        });
        if (existing) {
            throw new errors_1.ConflictError("A group with these members already exists", "GROUP_ALREADY_EXISTS");
        }
        const box = await message_box_model_1.MessageBoxModel.create({
            senderId: leaderId,
            receiverIds: allIds,
            messageIds: [],
            groupName,
            groupAva,
            flag: true,
            pin: false,
            createBy: new mongoose_1.Types.ObjectId(leaderId),
        });
        return { success: true, message: "Group created successfully", box };
    },
    // ── Fetch Messages ────────────────────────────────────────────────────────
    async getMessages(boxId, userId) {
        const box = await message_box_model_1.MessageBoxModel.findById(boxId).populate("messageIds");
        if (!box)
            throw new errors_1.NotFoundError("MessageBox not found", "BOX_NOT_FOUND");
        const results = await Promise.all(box.messageIds.map(async (msgId) => {
            const msg = await message_model_1.MessageModel.findOne({
                _id: msgId,
                [`visibility.${userId}`]: true,
            });
            if (!msg)
                return null;
            const populated = await msg.populate({
                path: "contentId",
                model: "File",
                options: { strictPopulate: false },
            });
            return (0, message_dto_1.toMessageResponse)(populated);
        }));
        return { success: true, messages: results.filter(Boolean) };
    },
    async getGroupMessages(boxId, userId) {
        const box = await message_box_model_1.MessageBoxModel.findById(boxId)
            .populate("messageIds")
            .populate("receiverIds", "name avatar");
        if (!box)
            throw new errors_1.NotFoundError("MessageBox not found", "BOX_NOT_FOUND");
        const results = await Promise.all(box.messageIds.map(async (msgId) => {
            const msg = await message_model_1.MessageModel.findOne({
                _id: msgId,
                [`visibility.${userId}`]: true,
            });
            if (!msg)
                return null;
            await msg.populate({
                path: "contentId",
                model: "File",
                options: { strictPopulate: false },
            });
            await msg.populate({
                path: "createBy",
                model: "User",
                select: "name avatar",
            });
            const sender = msg.createBy;
            return {
                id: msg._id.toString(),
                flag: msg.flag,
                isReact: msg.isReact,
                readedId: msg.readedId.map((id) => id.toString()),
                contentId: msg.flag
                    ? (msg.contentId[msg.contentId.length - 1] ??
                        undefined)
                    : undefined,
                text: msg.flag
                    ? (msg.text[msg.text.length - 1] ?? "")
                    : "unsent message",
                boxId: msg.boxId.toString(),
                createAt: msg.createAt,
                createBy: sender?._id?.toString() ?? sender?.toString(),
                createName: sender?.name ?? "Unknown",
                createAvatar: sender?.avatar ?? "",
            };
        }));
        return { success: true, messages: results.filter(Boolean) };
    },
    // ── Message Box Fetching ──────────────────────────────────────────────────
    async getDirectBoxes(userId) {
        const boxes = await message_box_model_1.MessageBoxModel.find({
            $and: [{ receiverIds: { $in: [userId] } }, { receiverIds: { $size: 2 } }],
        }).populate("receiverIds", "name avatar phoneNumber onlineStatus");
        if (!boxes.length)
            return { success: true, box: [] };
        const withDetails = await Promise.all(boxes.map(async (box) => {
            const filteredIds = await Promise.all(box.messageIds.map(async (msgId) => {
                const msg = await message_model_1.MessageModel.findById(msgId).select("visibility");
                return msg?.visibility?.get(userId) === true ? msgId : null;
            }));
            const validIds = filteredIds.filter(Boolean);
            const lastId = validIds[validIds.length - 1];
            if (!lastId)
                return { ...box.toObject(), lastMessage: null, readStatus: false };
            const lastMsg = await message_model_1.MessageModel.findById(lastId).populate({
                path: "contentId",
                model: "File",
                options: { strictPopulate: false },
            });
            if (!lastMsg)
                return { ...box.toObject(), lastMessage: null, readStatus: false };
            const readStatus = lastMsg.readedId.some((id) => id.toString() === userId);
            return {
                ...box.toObject(),
                lastMessage: (0, message_dto_1.toMessageResponse)(lastMsg),
                readStatus,
            };
        }));
        withDetails.sort((a, b) => {
            const dA = a.lastMessage?.createAt
                ? new Date(a.lastMessage.createAt).getTime()
                : 0;
            const dB = b.lastMessage?.createAt
                ? new Date(b.lastMessage.createAt).getTime()
                : 0;
            return dB - dA;
        });
        return { success: true, box: withDetails, adminId: userId };
    },
    async getBoxById(boxId) {
        const box = await message_box_model_1.MessageBoxModel.findById(boxId)
            .populate("senderId", "name avatar phoneNumber")
            .populate("receiverIds", "name avatar phoneNumber onlineStatus");
        if (!box)
            throw new errors_1.NotFoundError("MessageBox not found", "BOX_NOT_FOUND");
        const lastMsgId = box.messageIds[box.messageIds.length - 1];
        if (!lastMsgId)
            return { box: { ...box.toObject(), readStatus: false } };
        const lastMsg = await message_model_1.MessageModel.findById(lastMsgId).populate({
            path: "contentId",
            model: "File",
            select: "",
        });
        if (!lastMsg)
            return { box: { ...box.toObject(), readStatus: false } };
        return {
            box: { ...box.toObject(), readStatus: lastMsg.readedId.length > 0 },
        };
    },
    async getGroupBoxes(userId) {
        const boxes = await message_box_model_1.MessageBoxModel.find({
            $and: [
                { receiverIds: { $in: [userId] } },
                { $expr: { $gt: [{ $size: "$receiverIds" }, 2] } },
            ],
        })
            .populate("receiverIds", "name avatar phoneNumber onlineStatus")
            .populate("senderId", "name avatar phoneNumber");
        if (!boxes.length)
            return { success: true, box: [] };
        const withDetails = await Promise.all(boxes.map(async (box) => {
            const filteredIds = await Promise.all(box.messageIds.map(async (msgId) => {
                const msg = await message_model_1.MessageModel.findById(msgId).select("visibility");
                return msg?.visibility?.get(userId) === true ? msgId : null;
            }));
            const validIds = filteredIds.filter(Boolean);
            const lastId = validIds[validIds.length - 1];
            if (!lastId)
                return { ...box.toObject(), lastMessage: null, readStatus: false };
            const lastMsg = await message_model_1.MessageModel.findById(lastId).populate({
                path: "contentId",
                model: "File",
                select: "",
            });
            if (!lastMsg)
                return { ...box.toObject(), lastMessage: null, readStatus: false };
            const readStatus = lastMsg.readedId.some((id) => id.toString() === userId);
            return {
                ...box.toObject(),
                lastMessage: (0, message_dto_1.toMessageResponse)(lastMsg),
                readStatus,
            };
        }));
        return { success: true, box: withDetails, adminId: userId };
    },
    // ── Edit / Delete / Revoke ────────────────────────────────────────────────
    async editMessage(messageId, dto, userId) {
        const msg = await message_model_1.MessageModel.findOne({
            _id: messageId,
            [`visibility.${userId}`]: true,
            flag: true,
        });
        if (!msg)
            throw new errors_1.NotFoundError("Message not found", "MESSAGE_NOT_FOUND");
        if (msg.createBy.toString() !== userId) {
            throw new errors_1.ForbiddenError("Only the message author can edit this message", "NOT_MESSAGE_OWNER");
        }
        if (msg.contentId.length > 0) {
            throw new errors_1.ValidationError("Only text messages can be edited", "NOT_TEXT_MESSAGE");
        }
        msg.text.push(dto.newContent);
        msg.updatedAt = new Date();
        await msg.save();
        const updated = await message_model_1.MessageModel.findById(msg._id).populate("contentId");
        return { success: true, message: (0, message_dto_1.toMessageResponse)(updated) };
    },
    async deleteOrRevokeMessage(messageId, dto, userId) {
        const msg = await message_model_1.MessageModel.findById(messageId);
        if (!msg)
            throw new errors_1.NotFoundError("Message not found", "MESSAGE_NOT_FOUND");
        const isParticipant = msg.readedId.some((id) => id.toString() === userId);
        if (!isParticipant)
            throw new errors_1.ForbiddenError("User is not a participant of this message", "NOT_MESSAGE_PARTICIPANT");
        const { action } = dto;
        const boxId = msg.boxId.toString();
        const now = new Date().toISOString();
        if (action === "revoke") {
            msg.flag = false;
            await msg.save();
            const payload = {
                id: msg._id.toString(),
                flag: false,
                isReact: msg.isReact,
                text: "Message revoked",
                boxId,
                action: "revoke",
                createAt: now,
                createBy: userId,
            };
            await pusher_1.pusherServer
                .trigger(`private-${boxId}`, "revoke-message", payload)
                .catch((err) => console.error("Pusher error:", err));
            return { success: true, message: "Message revoked" };
        }
        if (action === "delete") {
            msg.visibility.set(userId, false);
            await msg.save();
            const payload = {
                id: msg._id.toString(),
                flag: msg.flag,
                visibility: false,
                isReact: msg.isReact,
                text: "Message deleted",
                boxId,
                action: "delete",
                createAt: now,
                createBy: userId,
            };
            await pusher_1.pusherServer
                .trigger(`private-${boxId}`, "delete-message", payload)
                .catch((err) => console.error("Pusher error:", err));
            return { success: true, message: "Message deleted" };
        }
        if (action === "unsend") {
            if (!Array.isArray(msg.readedId))
                throw new errors_1.ValidationError("Message receivers list is invalid", "INVALID_RECEIVERS");
            msg.readedId.forEach((receiverId) => {
                msg.visibility.set(receiverId.toString(), false);
            });
            await msg.save();
            const payload = {
                id: msg._id.toString(),
                flag: false,
                visibility: false,
                isReact: msg.isReact,
                text: "Message unsent",
                boxId,
                action: "unsend",
                createAt: now,
                createBy: userId,
            };
            await pusher_1.pusherServer
                .trigger(`private-${boxId}`, "unsend-message", payload)
                .catch((err) => console.error("Pusher error:", err));
            return { success: true, message: "Message unsent" };
        }
        throw new errors_1.ValidationError("Invalid action. Must be one of: revoke, delete, unsend", "INVALID_MESSAGE_ACTION");
    },
    // ── Read Status ───────────────────────────────────────────────────────────
    async markAsRead(boxId, userId) {
        const userExists = await user_model_1.UserModel.findById(userId);
        if (!userExists)
            throw new errors_1.NotFoundError("User not found", "USER_NOT_FOUND");
        const box = await message_box_model_1.MessageBoxModel.findById(boxId).populate("messageIds");
        if (!box)
            throw new errors_1.NotFoundError("Box not found", "BOX_NOT_FOUND");
        if (box.messageIds.length === 0)
            return null;
        const lastMsg = box.messageIds[box.messageIds.length - 1];
        const alreadyRead = lastMsg.readedId?.some((id) => id.toString() === userId);
        if (!alreadyRead) {
            await Promise.all(box.messageIds.map(async (msgId) => {
                const msg = await message_model_1.MessageModel.findById(msgId);
                if (msg &&
                    !msg.readedId.some((id) => id.toString() === userId)) {
                    msg.readedId.push(new mongoose_1.Types.ObjectId(userId));
                    await msg.save();
                }
            }));
            return { success: true, message: "Messages marked as read" };
        }
        return { success: true, message: "Messages already read" };
    },
    async checkReadStatus(boxIds, userId) {
        const userExists = await user_model_1.UserModel.findById(userId);
        if (!userExists)
            throw new errors_1.NotFoundError("User not found", "USER_NOT_FOUND");
        return Promise.all(boxIds.map(async (boxId) => {
            const box = await message_box_model_1.MessageBoxModel.findById(boxId).populate("messageIds");
            if (!box)
                return { boxId, isRead: false, message: "Box not found" };
            if (box.messageIds.length === 0)
                return { boxId, isRead: false, message: "No messages" };
            const lastMsg = box.messageIds[box.messageIds.length - 1];
            const isRead = lastMsg.readedId?.some((id) => id.toString() === userId);
            return { boxId, isRead: !!isRead };
        }));
    },
    // ── Media Lists ───────────────────────────────────────────────────────────
    async getImageList(boxId, userId) {
        const box = await message_box_model_1.MessageBoxModel.findById(boxId);
        if (!box)
            throw new errors_1.NotFoundError("MessageBox not found", "BOX_NOT_FOUND");
        const messages = await message_model_1.MessageModel.find({
            _id: { $in: box.messageIds },
            flag: true,
        }).select("contentId visibility");
        const visible = messages.filter((m) => m.visibility.get(userId) === true);
        const fileIds = visible.flatMap((m) => m.contentId);
        return message_file_model_1.MessageFileModel.find({ _id: { $in: fileIds }, type: "Image" });
    },
    async getVideoList(boxId, userId) {
        const box = await message_box_model_1.MessageBoxModel.findById(boxId);
        if (!box)
            throw new errors_1.NotFoundError("MessageBox not found", "BOX_NOT_FOUND");
        const messages = await message_model_1.MessageModel.find({
            _id: { $in: box.messageIds },
        }).select("contentId visibility");
        const visible = messages.filter((m) => m.visibility.get(userId) === true);
        const fileIds = visible.flatMap((m) => m.contentId);
        return message_file_model_1.MessageFileModel.find({ _id: { $in: fileIds }, type: "Video" });
    },
    async getAudioList(boxId) {
        const box = await message_box_model_1.MessageBoxModel.findById(boxId);
        if (!box)
            throw new errors_1.NotFoundError("MessageBox not found", "BOX_NOT_FOUND");
        const messages = await message_model_1.MessageModel.find({
            _id: { $in: box.messageIds },
        }).select("contentId");
        const fileIds = messages.flatMap((m) => m.contentId);
        return message_file_model_1.MessageFileModel.find({ _id: { $in: fileIds }, type: "Audio" });
    },
    async getOtherFileList(boxId, userId) {
        const box = await message_box_model_1.MessageBoxModel.findById(boxId);
        if (!box)
            throw new errors_1.NotFoundError("MessageBox not found", "BOX_NOT_FOUND");
        const messages = await message_model_1.MessageModel.find({
            _id: { $in: box.messageIds },
        }).select("contentId visibility");
        const visible = messages.filter((m) => m.visibility.get(userId) === true);
        const fileIds = visible.flatMap((m) => m.contentId);
        return message_file_model_1.MessageFileModel.find({ _id: { $in: fileIds }, type: "Other" });
    },
    // ── Box / Group Management ────────────────────────────────────────────────
    async updateGroupAvatar(boxId, url, publicId) {
        const group = await message_box_model_1.MessageBoxModel.findById(boxId);
        if (!group)
            throw new errors_1.NotFoundError("Box not found", "BOX_NOT_FOUND");
        if (group.groupAvaPublicId) {
            await cloudinary_1.v2.uploader
                .destroy(group.groupAvaPublicId)
                .catch((err) => console.error("Cloudinary destroy error:", err));
        }
        group.groupAva = url;
        group.groupAvaPublicId = publicId;
        await group.save();
        return { success: true, message: "Group avatar updated" };
    },
    async deleteBox(boxId) {
        const box = await message_box_model_1.MessageBoxModel.findById(boxId);
        if (!box)
            throw new errors_1.NotFoundError("Box not found", "BOX_NOT_FOUND");
        await message_box_model_1.MessageBoxModel.findByIdAndDelete(boxId);
        return { success: true, message: "Box deleted" };
    },
    // ── Online Status ─────────────────────────────────────────────────────────
    async setOnlineStatus(userId, status) {
        if (!mongoose_1.Types.ObjectId.isValid(userId)) {
            throw new errors_1.ValidationError("Invalid userId format", "INVALID_USER_ID");
        }
        const user = await user_model_1.UserModel.findById(userId);
        if (!user)
            throw new errors_1.NotFoundError("User not found", "USER_NOT_FOUND");
        await user_model_1.UserModel.updateOne({ _id: userId }, { $set: { onlineStatus: status } });
        const payload = { userId, status, createAt: new Date() };
        const event = status ? "online-status" : "offline-status";
        await pusher_1.pusherServer
            .trigger(`private-${userId}`, event, payload)
            .catch((err) => console.error("Pusher error:", err));
        return {
            success: true,
            message: `Status updated to ${status ? "online" : "offline"}`,
            payload,
        };
    },
    // ── Search ────────────────────────────────────────────────────────────────
    async searchMessagesInBox(boxId, query, userId) {
        const box = await message_box_model_1.MessageBoxModel.findById(boxId).populate("messageIds");
        if (!box)
            throw new errors_1.NotFoundError("Box not found", "BOX_NOT_FOUND");
        if (box.messageIds.length === 0)
            return { success: false, messages: [] };
        const messages = await message_model_1.MessageModel.find({
            _id: { $in: box.messageIds },
        }).populate({
            path: "contentId",
            model: "File",
            select: "fileName description",
            options: { strictPopulate: false },
        });
        const results = messages
            .filter((msg) => {
            const vis = msg.visibility;
            if (vis.has(userId) && vis.get(userId) === false)
                return false;
            let content = "";
            if (msg.text.length > 0 && msg.contentId.length === 0) {
                content = msg.text[msg.text.length - 1];
            }
            else if (msg.contentId.length > 0) {
                const last = msg.contentId[msg.contentId.length - 1];
                if ("fileName" in last)
                    content = last.fileName ?? "";
                else if ("description" in last)
                    content = last.description ?? "";
            }
            return content
                .replace(/\u00A0/g, " ")
                .trim()
                .toLowerCase()
                .includes(query.toLowerCase());
        })
            .map((msg) => (0, message_dto_1.toMessageResponse)(msg));
        return { success: true, messages: results };
    },
    // ── Admin Operations ──────────────────────────────────────────────────────
    async getAllMessages() {
        const all = await message_model_1.MessageModel.find();
        const withContent = await Promise.all(all.map(async (msg) => {
            const files = await message_file_model_1.MessageFileModel.find({
                _id: { $in: msg.contentId },
            });
            return { ...msg.toObject(), content: files };
        }));
        return { success: true, messages: withContent };
    },
    async getAllBoxes() {
        const boxes = await message_box_model_1.MessageBoxModel.find({}).populate("receiverIds", "name avatar");
        return { success: true, box: boxes };
    },
    async getBoxMessages(boxId) {
        const box = await message_box_model_1.MessageBoxModel.findById(boxId).populate("messageIds");
        if (!box)
            throw new errors_1.NotFoundError("MessageBox not found", "BOX_NOT_FOUND");
        const results = await Promise.all(box.messageIds.map(async (msgId) => {
            const populated = await message_model_1.MessageModel.findById(msgId).populate({
                path: "contentId",
                model: "File",
                options: { strictPopulate: false },
            });
            if (!populated)
                return null;
            return (0, message_dto_1.toMessageResponse)(populated);
        }));
        return { success: true, messages: results.filter(Boolean) };
    },
    async deleteMessage(messageId) {
        const msg = await message_model_1.MessageModel.findById(messageId);
        if (!msg)
            throw new errors_1.NotFoundError("Message not found", "MESSAGE_NOT_FOUND");
        await message_model_1.MessageModel.findByIdAndDelete(messageId);
        return { success: true, message: "Message deleted" };
    },
    async adminSearchMessages(id, query) {
        const conditions = {};
        if (id)
            conditions._id = id;
        const messages = await message_model_1.MessageModel.find(conditions).populate({
            path: "contentId",
            model: "File",
            options: { strictPopulate: false },
        });
        if (!query)
            return { success: true, messages };
        const filtered = messages.filter((msg) => {
            const last = msg.contentId?.[msg.contentId?.length - 1];
            let content = "";
            if (msg.text.length > 0) {
                content = msg.text[msg.text.length - 1];
            }
            else if (last && "fileName" in last) {
                content = last.fileName ?? "";
            }
            return content.toLowerCase().trim().includes(query.toLowerCase().trim());
        });
        return { success: true, messages: filtered };
    },
};
// ─── CallService ──────────────────────────────────────────────────────────────
exports.CallService = {
    async getCallHistory(userId) {
        const history = await call_model_1.CallModel.find({
            $or: [{ callerId: userId }, { receiverId: userId }],
        }).populate("callerId receiverId", "name phoneNumber avatar");
        return { success: true, callHistory: history };
    },
    async createCall(dto) {
        const { startTime, status, endTime } = dto;
        let duration = 0;
        if (status === "completed" ||
            status === "rejected" ||
            status === "missed") {
            if (endTime) {
                duration = Math.floor((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000);
            }
        }
        else if (status === "ongoing") {
            duration = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
        }
        const call = await call_model_1.CallModel.create({
            callerId: dto.callerId,
            receiverId: dto.receiverId,
            callType: dto.callType,
            startTime: dto.startTime,
            status,
            duration,
            createBy: dto.callerId,
        });
        return { success: true, message: "Call created", call };
    },
    async updateCallStatus(callId, dto) {
        const call = await call_model_1.CallModel.findById(callId);
        if (!call)
            throw new errors_1.NotFoundError("Call not found", "CALL_NOT_FOUND");
        const updateData = { ...dto };
        if (dto.endTime) {
            updateData.duration = Math.floor((new Date(dto.endTime).getTime() - call.startTime.getTime()) / 1000);
        }
        const updated = await call_model_1.CallModel.findByIdAndUpdate(callId, updateData, {
            new: true,
        });
        return updated;
    },
};
