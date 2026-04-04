"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/server.ts
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: ".env.local" });
const node_dns_1 = __importDefault(require("node:dns"));
const http_1 = __importDefault(require("http"));
const mongoose_1 = __importDefault(require("mongoose"));
const app_1 = require("./app");
const hot_score_cron_service_1 = require("./services/hot-score-cron.service");
node_dns_1.default.setServers(["8.8.8.8", "1.1.1.1"]);
const socket_1 = require("./socket/socket");
const PORT = Number(process.env.PORT) || 3000;
async function startServer() {
    try {
        // Connect MongoDB
        await mongoose_1.default.connect(process.env.MONGO_URI, {
            tls: true,
        });
        mongoose_1.default.connection.once("connected", () => {
            (0, hot_score_cron_service_1.startHotScoreCron)();
        });
        console.log("MongoDB connected");
        // Create HTTP server
        const httpServer = http_1.default.createServer(app_1.app);
        // Init socket
        (0, socket_1.initSocketIO)(httpServer);
        httpServer.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    }
    catch (error) {
        console.error("MongoDB connection failed:", error);
        process.exit(1);
    }
}
startServer();
