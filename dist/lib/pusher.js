"use strict";
// // src/lib/pusher.ts
// import Pusher from "pusher";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pusherServer = void 0;
// export const pusherServer = new Pusher({
//   appId: process.env.PUSHER_APP_ID!,
//   key: process.env.PUSHER_APP_KEY!,
//   secret: process.env.PUSHER_APP_SECRET!,
//   cluster: process.env.PUSHER_APP_CLUSTER ?? "ap1",
//   useTLS: true,
// });
const pusher_1 = __importDefault(require("pusher"));
exports.pusherServer = new pusher_1.default({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.NEXT_PUBLIC_PUSHER_APP_KEY,
    secret: process.env.PUSHER_SECRET,
    cluster: "ap1",
    useTLS: true,
});
