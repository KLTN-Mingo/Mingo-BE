"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/server.ts
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: ".env.local" });
const node_dns_1 = __importDefault(require("node:dns"));
const mongoose_1 = __importDefault(require("mongoose"));
const app_1 = require("./app");
const hot_score_cron_service_1 = require("./services/hot-score-cron.service");
node_dns_1.default.setServers(["8.8.8.8", "1.1.1.1"]);
mongoose_1.default.connect(process.env.MONGO_URI, {
    tls: true,
});
mongoose_1.default.connection.once("connected", () => {
    (0, hot_score_cron_service_1.startHotScoreCron)();
});
app_1.app.listen(3000, () => {
    console.log("Server running on port 3000");
});
