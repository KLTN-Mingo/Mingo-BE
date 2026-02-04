// src/app.ts
import express from "express";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.routes";
import {
  errorHandler,
  notFoundHandler,
} from "./middleware/error-handler.middleware";

export const app = express();

app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
