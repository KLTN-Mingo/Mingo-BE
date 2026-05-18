// src/server.ts
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();
import dns from "node:dns";

import http from "http";
import mongoose from "mongoose";
import { app } from "./app";
import { startHotScoreCron } from "./services/hot-score-cron.service";

import { initSocketIO } from "./socket/socket";

const PORT = Number(process.env.PORT) || 3000;
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const MONGO_DNS_SERVERS = process.env.MONGO_DNS_SERVERS;
const DEFAULT_FALLBACK_DNS = ["1.1.1.1", "8.8.8.8"];

function isSrvDnsRefusedError(error: unknown): boolean {
  const err = error as NodeJS.ErrnoException;
  return err?.code === "ECONNREFUSED" && err?.syscall === "querySrv";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectMongoWithRetry(uri: string): Promise<void> {
  const connectOptions = {
    tls: true,
    serverSelectionTimeoutMS: 15000,
  };

  try {
    await mongoose.connect(uri, connectOptions);
    return;
  } catch (firstError) {
    if (!isSrvDnsRefusedError(firstError)) {
      throw firstError;
    }

    console.warn(
      "MongoDB SRV DNS lookup failed (ECONNREFUSED). Retrying with fallback DNS servers..."
    );

    dns.setServers(DEFAULT_FALLBACK_DNS);
    await sleep(500);

    await mongoose.connect(uri, connectOptions);
  }
}

if (MONGO_DNS_SERVERS) {
  const servers = MONGO_DNS_SERVERS.split(",")
    .map((server) => server.trim())
    .filter(Boolean);

  if (servers.length > 0) {
    dns.setServers(servers);
  }
}

async function startServer() {
  try {
    if (!MONGO_URI) {
      throw new Error(
        "Missing MongoDB URI. Set MONGO_URI (or MONGODB_URI) in .env/.env.local."
      );
    }

    // Connect MongoDB
    await connectMongoWithRetry(MONGO_URI);

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
