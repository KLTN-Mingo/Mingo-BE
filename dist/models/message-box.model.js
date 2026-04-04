"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageBoxModel = void 0;
// src/models/message-box.model.ts
const mongoose_1 = require("mongoose");
const MessageBoxSchema = new mongoose_1.Schema({
    senderId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
    receiverIds: [{ type: mongoose_1.Schema.Types.ObjectId, ref: "User" }],
    messageIds: [{ type: mongoose_1.Schema.Types.ObjectId, ref: "Message" }],
    groupName: { type: String, default: "" },
    groupAva: { type: String, default: "" },
    groupAvaPublicId: { type: String },
    flag: { type: Boolean, default: true },
    pin: { type: Boolean, default: false },
    status: { type: Boolean, default: true },
    createBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
    createAt: { type: Date, default: Date.now },
}, { timestamps: true });
exports.MessageBoxModel = mongoose_1.models.MessageBox || (0, mongoose_1.model)("MessageBox", MessageBoxSchema);
