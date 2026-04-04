// src/socket/events/onCallAccepted.ts
import { Server } from "socket.io";
import { CallAcceptedPayload } from "../socket.types";

/**
 * Handles a receiver accepting an incoming call.
 * Notifies the original caller that the call was accepted.
 */
const onCallAccepted = (io: Server, data: CallAcceptedPayload) => {
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
  } else {
    console.error("onCallAccepted: caller socketId not found");
  }
};

export default onCallAccepted;
