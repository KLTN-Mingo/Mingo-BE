"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Handles a receiver accepting an incoming call.
 * Notifies the original caller that the call was accepted.
 */
const onCallAccepted = (io, data) => {
    const { ongoingCall } = data;
    if (!ongoingCall?.participants) {
        console.error("onCallAccepted: missing participants");
        return;
    }
    const { caller } = ongoingCall.participants;
    console.log("onCallAccepted → caller:", caller.userId);
    if (caller.socketId) {
        io.to(caller.socketId).emit("callAccepted", {
            ongoingCall,
            message: "Call has been accepted",
        });
    }
    else {
        console.error("onCallAccepted: caller socketId not found");
    }
};
exports.default = onCallAccepted;
