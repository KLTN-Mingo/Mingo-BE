// src/server.ts
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import http from "http";
import mongoose from "mongoose";
import { app } from "./app";
import { initSocketIO } from "./socket/socket";

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  try {
    // Connect MongoDB
    await mongoose.connect(process.env.MONGO_URI!, {
      tls: true,
    });

    console.log("MongoDB connected");

    // Create HTTP server
    const httpServer = http.createServer(app);

    // Init socket
    initSocketIO(httpServer);

    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    process.exit(1);
  }
}

startServer();
