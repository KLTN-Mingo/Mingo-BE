import { TokenExpiredError } from "jsonwebtoken";
import { TokenError } from "../errors";
import * as jwtModule from "../lib/auth/jwt";
import { authMiddleware } from "../middleware/auth.middleware";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
  const originalVerifyAccessToken = jwtModule.verifyAccessToken;

  (jwtModule as any).verifyAccessToken = (() => {
    throw new TokenExpiredError("jwt expired", new Date("2026-06-14T14:06:50.000Z"));
  }) as typeof jwtModule.verifyAccessToken;

  try {
    const req = {
      headers: {
        authorization: "Bearer expired-token",
      },
    } as any;

    const res = {} as any;

    let forwardedError: unknown;

    await authMiddleware(req, res, (error?: unknown) => {
      forwardedError = error;
    });

    assert(forwardedError instanceof TokenError, "Expected TokenError for expired access token");
    assert(forwardedError.statusCode === 401, "Expected expired access token to map to 401");
    assert(forwardedError.errorCode === "TOKEN_INVALID", "Expected TOKEN_INVALID error code");
    assert(forwardedError.message === "Access token đã hết hạn", "Expected expired token message");
  } finally {
    (jwtModule as any).verifyAccessToken = originalVerifyAccessToken;
  }
}

run()
  .then(() => {
    console.log("auth middleware expired token test passed");
  })
  .catch((error) => {
    console.error("auth middleware expired token test failed:", error);
    process.exit(1);
  });
