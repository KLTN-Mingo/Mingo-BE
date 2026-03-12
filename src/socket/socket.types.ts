// src/socket/socket.types.ts

/** Slim user info carried inside socket call payloads */
export interface SocketUser {
  userId: string;
  socketId: string;
  name?: string;
  avatar?: string;
}

export interface CallParticipants {
  caller: SocketUser;
  receiver: SocketUser;
}

export interface OngoingCall {
  participants: CallParticipants;
  boxId?: string;
  isVideoCall: boolean;
}

// ─── Inbound event payloads (client → server) ─────────────────────────────────

export interface CallPayload {
  participants: CallParticipants;
  isVideoCall: boolean;
  boxId?: string;
}

export interface CallAcceptedPayload {
  ongoingCall: OngoingCall;
}

export interface CallRejectedPayload {
  ongoingCall: OngoingCall;
  rejectedBy: string; // userId who rejected
}

export interface HangupPayload {
  ongoingCall: OngoingCall;
  userHangingupId: string;
}

export interface WebrtcSignalPayload {
  isCaller: boolean;
  ongoingCall: OngoingCall;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}
