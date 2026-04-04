"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Handles a user hanging up.
 * Notifies the other participant to end the call on their side.
 */
const onHangup = (io, data) => {
    const { ongoingCall, userHangingupId } = data;
    const { caller, receiver } = ongoingCall.participants;
    // Send "hangup" to whichever participant did NOT hang up
    const targetSocketId = caller.userId === userHangingupId ? receiver.socketId : caller.socketId;
    console.log("onHangup → notifying:", targetSocketId);
    if (targetSocketId) {
        io.to(targetSocketId).emit("hangup");
    }
};
exports.default = onHangup;
