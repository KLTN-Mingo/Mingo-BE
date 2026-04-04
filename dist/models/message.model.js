"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageModel = void 0;
// src/models/message.model.ts
const mongoose_1 = require("mongoose");
const MessageSchema = new mongoose_1.Schema({
    boxId: { type: mongoose_1.Schema.Types.ObjectId, ref: "MessageBox" },
    status: { type: Boolean, default: true },
    readedId: [{ type: mongoose_1.Schema.Types.ObjectId, ref: "User" }],
    contentId: [{ type: mongoose_1.Schema.Types.ObjectId, ref: "File" }],
    text: [{ type: String }],
    flag: { type: Boolean, required: true, default: true },
    isReact: { type: Boolean, default: false },
    visibility: {
        type: Map,
        of: Boolean,
        default: () => new Map(),
    },
    createBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    createAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});
exports.MessageModel = mongoose_1.models.Message || (0, mongoose_1.model)("Message", MessageSchema);
