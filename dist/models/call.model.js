"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallModel = void 0;
// src/models/call.model.ts
const mongoose_1 = require("mongoose");
const CallSchema = new mongoose_1.Schema({
    callerId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    receiverId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    callType: { type: String, enum: ["video", "voice"], required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    status: {
        type: String,
        enum: ["completed", "missed", "rejected", "ongoing"],
        default: "ongoing",
    },
    duration: { type: Number, default: 0 },
    createBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
    createAt: { type: Date, default: Date.now },
}, { timestamps: true });
exports.CallModel = mongoose_1.models.Call || (0, mongoose_1.model)("Call", CallSchema);
