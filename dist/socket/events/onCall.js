"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const presence_1 = require("../presence");
/**
 * Handles an outgoing call initiated by a user.
 * Forwards the "incomingCall" event to the receiver's socket.
 * Nếu receiver.socketId trống, tra theo receiver.userId từ presence.
 */
const onCall = (io, payload) => {
    const { participants, isVideoCall, boxId } = payload;
    let receiverSocketId = participants.receiver.socketId;
    if (!receiverSocketId && participants.receiver.userId) {
        receiverSocketId = (0, presence_1.getSocketIdByUserId)(participants.receiver.userId);
    }
    console.log("onCall →", participants.receiver.userId, "socketId:", receiverSocketId, "boxId:", boxId);
    if (receiverSocketId) {
        const payloadForReceiver = {
            ...participants,
            receiver: { ...participants.receiver, socketId: receiverSocketId },
        };
        io.to(receiverSocketId).emit("incomingCall", payloadForReceiver, isVideoCall, boxId);
    }
};
exports.default = onCall;
