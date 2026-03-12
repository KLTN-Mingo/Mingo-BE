// src/server.ts
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import http from "http";
import mongoose from "mongoose";
import { app } from "./app";
import { initSocketIO } from "./socket/socket";

mongoose.connect(process.env.MONGO_URI!, {
  tls: true,
});

const PORT = Number(process.env.PORT) || 3000;

// Create a plain HTTP server so Socket.IO can share the same port as Express
const httpServer = http.createServer(app);

initSocketIO(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
