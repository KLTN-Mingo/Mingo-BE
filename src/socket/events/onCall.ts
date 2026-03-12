// src/socket/events/onCall.ts
import { Server } from "socket.io";
import { CallPayload } from "../socket.types";

/**
 * Handles an outgoing call initiated by a user.
 * Forwards the "incomingCall" event to the receiver's socket.
 */
const onCall = (io: Server, payload: CallPayload) => {
  const { participants, isVideoCall, boxId } = payload;

  console.log("onCall →", participants, boxId);

  if (participants.receiver.socketId) {
    io.to(participants.receiver.socketId).emit(
      "incomingCall",
      participants,
      isVideoCall,
      boxId
    );
  }
};

export default onCall;
