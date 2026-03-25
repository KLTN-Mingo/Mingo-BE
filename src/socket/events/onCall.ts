// src/socket/events/onCall.ts
import { Server } from "socket.io";
import { CallPayload } from "../socket.types";
import { getSocketIdByUserId } from "../presence";

/**
 * Handles an outgoing call initiated by a user.
 * Forwards the "incomingCall" event to the receiver's socket.
 * Nếu receiver.socketId trống, tra theo receiver.userId từ presence.
 */
const onCall = (io: Server, payload: CallPayload) => {
  const { participants, isVideoCall, boxId } = payload;
  let receiverSocketId: string | undefined = participants.receiver.socketId;
  if (!receiverSocketId && participants.receiver.userId) {
    receiverSocketId = getSocketIdByUserId(participants.receiver.userId);
  }

  console.log("onCall →", participants.receiver.userId, "socketId:", receiverSocketId, "boxId:", boxId);

  if (receiverSocketId) {
    const payloadForReceiver = {
      ...participants,
      receiver: { ...participants.receiver, socketId: receiverSocketId },
    };
    io.to(receiverSocketId).emit(
      "incomingCall",
      payloadForReceiver,
      isVideoCall,
      boxId
    );
  }
};

export default onCall;
