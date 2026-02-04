// src/server.ts
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import { app } from "./app";

mongoose.connect(process.env.MONGO_URI!, {
  tls: true,
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
