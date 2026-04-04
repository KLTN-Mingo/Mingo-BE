"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
// src/app.ts
const express_1 = __importDefault(require("express"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const post_routes_1 = __importDefault(require("./routes/post.routes"));
const comment_routes_1 = __importDefault(require("./routes/comment.routes"));
const follow_routes_1 = __importDefault(require("./routes/follow.routes"));
const media_routes_1 = __importDefault(require("./routes/media.routes"));
const notification_routes_1 = __importDefault(require("./routes/notification.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const interaction_routes_1 = __importDefault(require("./routes/interaction.routes"));
const message_routes_1 = __importDefault(require("./routes/message.routes"));
const report_routes_1 = __importDefault(require("./routes/report.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const culture_routes_1 = __importDefault(require("./routes/culture.routes"));
const error_handler_middleware_1 = require("./middleware/error-handler.middleware");
const cors_1 = __importDefault(require("cors"));
exports.app = (0, express_1.default)();
exports.app.use(express_1.default.json());
exports.app.use((0, cookie_parser_1.default)());
exports.app.use((0, cors_1.default)({
    origin: "http://localhost:3001",
    credentials: true,
}));
exports.app.use("/api/auth", auth_routes_1.default);
exports.app.use("/api/posts", post_routes_1.default);
exports.app.use("/api/comments", comment_routes_1.default);
exports.app.use("/api/follow", follow_routes_1.default);
exports.app.use("/api/media", media_routes_1.default);
exports.app.use("/api/notifications", notification_routes_1.default);
exports.app.use("/api/users", user_routes_1.default);
exports.app.use("/api/interactions", interaction_routes_1.default);
exports.app.use("/api/messages", message_routes_1.default);
exports.app.use("/api/reports", report_routes_1.default);
exports.app.use("/api/admin", admin_routes_1.default);
exports.app.use("/api/culture", culture_routes_1.default);
exports.app.use(error_handler_middleware_1.notFoundHandler);
exports.app.use(error_handler_middleware_1.errorHandler);
