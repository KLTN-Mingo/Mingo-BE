import { authenticator } from "otplib";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
  const authControllerPath = require.resolve("../controllers/auth.controller");
  const userModelPath = require.resolve("../models/user.model");
  const tokenServicePath = require.resolve("../lib/auth/token-service");
  const cookiesPath = require.resolve("../lib/auth/cookies");
  const jwtPath = require.resolve("../lib/auth/jwt");

  const userModelModule = require(userModelPath);
  const tokenServiceModule = require(tokenServicePath);
  const cookiesModule = require(cookiesPath);
  const jwtModule = require(jwtPath);

  const originalFindById = userModelModule.UserModel.findById;
  const originalCreateTokenPair = tokenServiceModule.createTokenPair;
  const originalSetRefreshTokenCookie = cookiesModule.setRefreshTokenCookie;
  const originalVerifyTwoFactorPendingToken = jwtModule.verifyTwoFactorPendingToken;
  const originalAuthenticatorOptions = authenticator.allOptions();

  // Generate a code from the previous 30-second slot, then verify it in the next slot.
  const previousSlotEpoch = Date.UTC(2026, 5, 16, 15, 16, 0);
  const currentSlotEpoch = previousSlotEpoch + 30_000;
  const secret = authenticator.generateSecret();
  const previousSlotAuthenticator = authenticator.create({
    ...originalAuthenticatorOptions,
    epoch: previousSlotEpoch,
    window: 0,
  });
  const codeFromPreviousSlot = previousSlotAuthenticator.generate(secret);

  authenticator.options = {
    ...originalAuthenticatorOptions,
    epoch: currentSlotEpoch,
    window: 0,
  };

  userModelModule.UserModel.findById = async () => ({
    _id: { toString: () => "user-123" },
    phoneNumber: "0123456789",
    email: "user@example.com",
    name: "Test User",
    avatar: undefined,
    role: "user",
    verified: true,
    twoFactorEnabled: true,
    twoFactorSecret: secret,
  });
  tokenServiceModule.createTokenPair = async () => ({
    accessToken: "new-access-token",
    refreshToken: "new-refresh-token",
  });
  cookiesModule.setRefreshTokenCookie = (_res: unknown, _token: string) => {};
  jwtModule.verifyTwoFactorPendingToken = (_pendingToken: string) => "user-123";

  delete require.cache[authControllerPath];
  const { completeTwoFactorLogin } = require(authControllerPath);

  let responseStatus: number | undefined;
  let responseBody: any;

  const req = {
    body: {
      pendingToken: "pending-token",
      code: codeFromPreviousSlot,
    },
  } as any;

  const res = {
    status(code: number) {
      responseStatus = code;
      return this;
    },
    json(body: unknown) {
      responseBody = body;
      return this;
    },
  } as any;

  try {
    await new Promise<void>((resolve, reject) => {
      completeTwoFactorLogin(req, res, (error?: unknown) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });

      setTimeout(resolve, 0);
    });

    assert(responseStatus === 200, "Expected complete login to succeed for previous-slot TOTP");
    assert(
      responseBody?.data?.accessToken === "new-access-token",
      "Expected controller to issue a new access token"
    );
  } finally {
    userModelModule.UserModel.findById = originalFindById;
    tokenServiceModule.createTokenPair = originalCreateTokenPair;
    cookiesModule.setRefreshTokenCookie = originalSetRefreshTokenCookie;
    jwtModule.verifyTwoFactorPendingToken = originalVerifyTwoFactorPendingToken;
    authenticator.options = originalAuthenticatorOptions;
    delete require.cache[authControllerPath];
  }
}

run()
  .then(() => {
    console.log("two-factor complete login window test passed");
  })
  .catch((error) => {
    console.error("two-factor complete login window test failed:", error);
    process.exit(1);
  });
