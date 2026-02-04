// scripts/generate-keys.ts
import { generateKeyPairSync } from "crypto";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: "spki",
    format: "pem",
  },
  privateKeyEncoding: {
    type: "pkcs8",
    format: "pem",
  },
});

// format để dùng trực tiếp trong .env
const privateKeyEnv = privateKey.replace(/\n/g, "\\n");
const publicKeyEnv = publicKey.replace(/\n/g, "\\n");

console.log("\n===== COPY VÀO FILE .env =====\n");

console.log(`JWT_PRIVATE_KEY="${privateKeyEnv}"\n`);
console.log(`JWT_PUBLIC_KEY="${publicKeyEnv}"`);

console.log("\n===== END =====\n");
