// src/dtos/message.dto.ts

// ─── Request DTOs ──────────────────────────────────────────────────────────────

export interface SendMessageDto {
  boxId: string;
  /** Plain string for text messages, or a FileContentMetaDto object for file messages */
  content: string | FileContentMetaDto;
}

export interface FileContentMetaDto {
  fileName: string;
  format: string;
  type: string;
}

export interface CreateGroupDto {
  membersIds: string[];
  groupName: string;
  groupAva?: string;
}

export interface EditMessageDto {
  newContent: string;
}

export interface DeleteOrRevokeMessageDto {
  /** "revoke" hides message for everyone, "delete" hides for current user only, "unsend" hides for all readers */
  action: "revoke" | "delete" | "unsend";
}

export interface CheckReadStatusDto {
  boxIds: string[];
}

export interface UploadGroupAvatarDto {
  url: string;
  publicId: string;
}

export interface CreateCallDto {
  callerId: string;
  receiverId: string;
  callType: "video" | "voice";
  startTime: Date;
  status: "completed" | "missed" | "rejected" | "ongoing";
  endTime?: Date;
}

export interface UpdateCallStatusDto {
  status?: "completed" | "missed" | "rejected" | "ongoing";
  endTime?: Date;
}

// ─── Response DTOs ────────────────────────────────────────────────────────────

export interface FileResponseDto {
  _id: string;
  fileName: string;
  url: string;
  publicId: string;
  bytes: string;
  width: string;
  height: string;
  format: string;
  type: string;
}

export interface UserInfoDto {
  _id: string;
  name?: string;
  avatar?: string;
  phoneNumber?: string;
  onlineStatus?: boolean;
}

export interface MessageResponseDto {
  id: string;
  flag: boolean;
  isReact: boolean;
  readedId: string[];
  contentId?: FileResponseDto;
  text: string;
  boxId: string;
  createAt: Date | string;
  createBy: string;
}

export interface GroupMessageResponseDto extends MessageResponseDto {
  createName: string;
  createAvatar: string;
}

export interface MessageBoxResponseDto {
  _id: string;
  senderId: string;
  receiverIds: UserInfoDto[];
  messageIds: string[];
  groupName: string;
  groupAva: string;
  flag: boolean;
  pin: boolean;
  createAt: string;
  createBy: string;
  lastMessage: MessageResponseDto | null;
  readStatus: boolean;
  adminId?: string;
}

export interface GroupBoxResponseDto {
  _id: string;
  senderId: UserInfoDto;
  receiverIds: UserInfoDto[];
  messageIds: string[];
  groupName: string;
  groupAva: string;
  flag: boolean;
  pin: boolean;
  createAt: string;
  createBy: string;
  lastMessage: MessageResponseDto | null;
  readStatus: boolean;
}

export interface OnlineStatusResponseDto {
  userId: string;
  status: boolean;
  createAt: Date;
}

// ─── Pusher Event Payloads ────────────────────────────────────────────────────

export interface PusherNewMessageDto {
  id: string;
  flag: boolean;
  isReact: boolean;
  readedId: string[];
  contentId?: FileResponseDto;
  text: string;
  boxId: string;
  createAt: string;
  createBy: string;
  createName?: string;
  createAvatar?: string;
}

export interface PusherRevokeDto {
  id: string;
  flag: boolean;
  isReact: boolean;
  text: string;
  boxId: string;
  action: "revoke";
  createAt: string;
  createBy: string;
}

export interface PusherDeleteDto {
  id: string;
  flag: boolean;
  visibility: boolean;
  isReact: boolean;
  text: string;
  boxId: string;
  action: "delete" | "unsend";
  createAt: string;
  createBy: string;
}

// ─── Mapper helpers ───────────────────────────────────────────────────────────

export function toMessageResponse(msg: any): MessageResponseDto {
  return {
    id: msg._id?.toString() ?? msg.id,
    flag: msg.flag,
    isReact: msg.isReact,
    readedId: (msg.readedId ?? []).map((id: any) => id.toString()),
    contentId: msg.flag
      ? msg.contentId?.[msg.contentId.length - 1] ?? undefined
      : undefined,
    text: msg.flag
      ? (msg.text?.[msg.text.length - 1] ?? "")
      : "Message unsent",
    boxId: msg.boxId?.toString(),
    createAt: msg.createAt,
    createBy: msg.createBy?._id?.toString() ?? msg.createBy?.toString(),
  };
}

export function toGroupMessageResponse(
  msg: any,
  sender: any
): GroupMessageResponseDto {
  return {
    ...toMessageResponse(msg),
    createName: sender?.name ?? "Unknown",
    createAvatar: sender?.avatar ?? "",
  };
}

export function toFileResponse(file: any): FileResponseDto {
  return {
    _id: file._id?.toString(),
    fileName: file.fileName,
    url: file.url,
    publicId: file.publicId,
    bytes: file.bytes,
    width: file.width ?? "0",
    height: file.height ?? "0",
    format: file.format ?? "unknown",
    type: file.type,
  };
}
