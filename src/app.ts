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
import { pusherServer } from "./lib/pusher";
import { authMiddleware } from "./middleware/auth.middleware";
import cors from "cors";
export const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  cors({
    origin: "http://localhost:3001",
    credentials: true,
  })
);
app.use(auditMiddleware);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.post("/api/pusher/auth", authMiddleware, (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const socketId = req.body.socket_id;
    const channel = req.body.channel_name;
    const authResponse = pusherServer.authorizeChannel(socketId, channel, {
      user_id: userId,
    });

    res.send(authResponse);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      name: err?.name,
      message: err?.message,
      stack: err?.stack,
    });
  }
});

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
