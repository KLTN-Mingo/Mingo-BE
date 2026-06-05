// src/app.ts
import express from "express";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.routes";
import postRoutes from "./routes/post.routes";
import commentRoutes from "./routes/comment.routes";
import followRoutes from "./routes/follow.routes";
import mediaRoutes from "./routes/media.routes";
import notificationRoutes from "./routes/notification.routes";
import userRoutes from "./routes/user.routes";
import interactionRoutes from "./routes/interaction.routes";
import messageRoutes from "./routes/message.routes";
import reportRoutes from "./routes/report.routes";
import adminRoutes from "./routes/admin.routes";
import cultureRoutes from "./routes/culture.routes";
import searchRoutes from "./routes/search.routes";
import shareRoutes from "./routes/share.routes";
import { auditMiddleware } from "./middleware/audit.middleware";
import {
  errorHandler,
  notFoundHandler,
} from "./middleware/error-handler.middleware";
import cors, { type CorsOptions } from "cors";
export const app = express();

function parseCorsOriginOption(): CorsOptions["origin"] {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (!raw) return ["http://localhost:3001"];
  if (raw === "*") return true;
  const origins = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return origins.length ? origins : ["http://localhost:3001"];
}

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: parseCorsOriginOption(),
    credentials: true,
  })
);
app.use(auditMiddleware);
app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/follow", followRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/users", userRoutes);
app.use("/api/interactions", interactionRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/culture", cultureRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/shares", shareRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
