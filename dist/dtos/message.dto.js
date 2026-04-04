"use strict";
// src/dtos/message.dto.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.toMessageResponse = toMessageResponse;
exports.toGroupMessageResponse = toGroupMessageResponse;
exports.toFileResponse = toFileResponse;
// ─── Mapper helpers ───────────────────────────────────────────────────────────
function toMessageResponse(msg) {
    return {
        id: msg._id?.toString() ?? msg.id,
        flag: msg.flag,
        isReact: msg.isReact,
        readedId: (msg.readedId ?? []).map((id) => id.toString()),
        contentId: msg.flag
            ? msg.contentId?.[msg.contentId.length - 1] ?? undefined
            : undefined,
        text: msg.flag
            ? (msg.text?.[msg.text.length - 1] ?? "")
            : "Message unsent",
        boxId: msg.boxId?.toString(),
        createAt: msg.createAt,
        createBy: msg.createBy?._id?.toString() ?? msg.createBy?.toString(),
    };
}
function toGroupMessageResponse(msg, sender) {
    return {
        ...toMessageResponse(msg),
        createName: sender?.name ?? "Unknown",
        createAvatar: sender?.avatar ?? "",
    };
}
function toFileResponse(file) {
    return {
        _id: file._id?.toString(),
        fileName: file.fileName,
        url: file.url,
        publicId: file.publicId,
        bytes: file.bytes,
        width: file.width ?? "0",
        height: file.height ?? "0",
        format: file.format ?? "unknown",
        type: file.type,
    };
}
