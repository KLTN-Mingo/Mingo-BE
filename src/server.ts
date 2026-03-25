// src/server.ts
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import dns from "node:dns";

import http from "http";
import mongoose from "mongoose";
import { app } from "./app";
import { startHotScoreCron } from "./services/hot-score-cron.service";

dns.setServers(["8.8.8.8", "1.1.1.1"]);
import { initSocketIO } from "./socket/socket";

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  try {
    // Connect MongoDB
    await mongoose.connect(process.env.MONGO_URI!, {
      tls: true,
    });

    mongoose.connection.once("connected", () => {
      startHotScoreCron();
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
