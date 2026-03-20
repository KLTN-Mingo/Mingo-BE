// src/server.ts
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import dns from "node:dns";
import mongoose from "mongoose";
import { app } from "./app";
import { startHotScoreCron } from "./services/hot-score-cron.service";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

mongoose.connect(process.env.MONGO_URI!, {
  tls: true,
});

mongoose.connection.once("connected", () => {
  startHotScoreCron();
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
