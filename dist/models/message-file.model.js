"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageFileModel = void 0;
// src/models/message-file.model.ts
const mongoose_1 = require("mongoose");
const MessageFileSchema = new mongoose_1.Schema({
    fileName: { type: String, required: true },
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    bytes: { type: String, required: true },
    width: { type: String, default: "0" },
    height: { type: String, default: "0" },
    format: { type: String, default: "unknown" },
    type: {
        type: String,
        enum: ["Image", "Video", "Audio", "Other"],
        required: true,
    },
    duration: { type: Number, default: 0 },
    createBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    createAt: { type: Date, default: Date.now },
});
// Register as "File" to match the legacy ref used in Message.contentId
exports.MessageFileModel = mongoose_1.models.File || (0, mongoose_1.model)("File", MessageFileSchema);
