// src/socket/events/onWebrtcSignal.ts
import { Server } from "socket.io";
import { WebrtcSignalPayload } from "../socket.types";

/**
 * Relays WebRTC signaling data (SDP offer/answer, ICE candidates)
 * between caller and receiver so they can establish a peer-to-peer connection.
 */
const onWebrtcSignal = (io: Server, data: WebrtcSignalPayload) => {
  console.log("onWebrtcSignal →", { isCaller: data.isCaller });

  const { caller, receiver } = data.ongoingCall.participants;

  if (data.isCaller) {
    // Caller is sending a signal — forward it to the receiver
    if (receiver.socketId) {
      io.to(receiver.socketId).emit("webrtcSignal", data);
    }
  } else {
    // Receiver is sending a signal — forward it back to the caller
    if (caller.socketId) {
      io.to(caller.socketId).emit("webrtcSignal", data);
    }
  }
};

export default onWebrtcSignal;
