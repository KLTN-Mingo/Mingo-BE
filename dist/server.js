"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/server.ts
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: ".env.local" });
const mongoose_1 = __importDefault(require("mongoose"));
const app_1 = require("./app");
mongoose_1.default.connect(process.env.MONGO_URI, {
    tls: true,
});
app_1.app.listen(3000, () => {
    console.log("Server running on port 3000");
});
