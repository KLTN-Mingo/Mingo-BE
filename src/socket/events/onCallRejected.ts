// src/socket/events/onCallRejected.ts
import { Server } from "socket.io";
import { CallRejectedPayload } from "../socket.types";

/**
 * Handles a receiver rejecting an incoming call.
 * Notifies the original caller that the call was rejected.
 */
const onCallRejected = (io: Server, data: CallRejectedPayload) => {
  const { ongoingCall, rejectedBy } = data;

  if (!ongoingCall?.participants) {
    console.error("onCallRejected: missing participants");
    return;
  }

  const { caller } = ongoingCall.participants;
  console.log("onCallRejected → caller:", caller.userId);

  if (caller.socketId) {
    io.to(caller.socketId).emit("callRejected", {
      rejectedBy,
      ongoingCall,
      message: "Call has been rejected",
    });
  } else {
    console.error("onCallRejected: caller socketId not found");
  }
};

export default onCallRejected;
