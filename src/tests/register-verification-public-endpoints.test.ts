import authRouter from "../routes/auth.routes";
import { UserModel } from "../models/user.model";
import { VerificationService, VerificationConfig } from "../services/verification.service";
import {
  sendRegisterEmailOtp,
  sendRegisterPhoneOtp,
  verifyRegisterEmailOtp,
  verifyRegisterPhoneOtp,
} from "../controllers/verification.controller";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

type MockResponse = {
  statusCode: number;
  body: unknown;
  status: (code: number) => MockResponse;
  json: (payload: unknown) => MockResponse;
};

function createMockResponse(): MockResponse {
  return {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
}

async function invokeHandler(
  handler: (req: any, res: any, next: (err?: unknown) => void) => void,
  req: Record<string, unknown>
) {
  const res = createMockResponse();
  let nextError: unknown;

  await new Promise<void>((resolve) => {
    handler(req as any, res as any, (err?: unknown) => {
      nextError = err;
      resolve();
    });
    setImmediate(resolve);
  });

  return { res, nextError };
}

function findPostRoute(path: string) {
  return authRouter.stack.find(
    (layer: any) => layer.route?.path === path && layer.route.methods?.post
  )?.route;
}

async function testRouterExposesPublicRegisterVerificationEndpoints() {
  const expectedPaths = [
    "/email/send-register-otp",
    "/email/verify-register-otp",
    "/phone/send-register-otp",
    "/phone/verify-register-otp",
  ];

  for (const path of expectedPaths) {
    const route = findPostRoute(path);
    assert(route, `Expected POST ${path} to exist`);
    const handlerNames = route.stack.map((layer: any) => layer.name);
    assert(
      !handlerNames.includes("authMiddleware"),
      `Expected POST ${path} to be public`
    );
  }
}

async function testSendRegisterEmailOtpReturnsExpiresMinutes() {
  const originalFindOne = UserModel.findOne;
  const originalIssue = VerificationService.issue;

  (UserModel as any).findOne = () => ({
    select: () => ({
      lean: async () => null,
    }),
  });
  (VerificationService as any).issue = async () => ({
    rawToken: "token",
    otp: "123456",
    expiresAt: new Date(Date.now() + 60_000),
  });

  try {
    const { res, nextError } = await invokeHandler(sendRegisterEmailOtp, {
      body: { email: "new-user@example.com" },
    });

    assert(!nextError, `Did not expect error, got: ${String(nextError)}`);
    assert(res.statusCode === 200, "Expected status 200");
    const payload = res.body as any;
    assert(payload?.success === true, "Expected success response");
    assert(
      payload?.data?.expiresInMinutes ===
        VerificationConfig.DEFAULT_VERIFY_LINK_EXPIRES_MIN,
      "Expected register email OTP response to include expiresInMinutes"
    );
  } finally {
    (UserModel as any).findOne = originalFindOne;
    (VerificationService as any).issue = originalIssue;
  }
}

async function testSendRegisterPhoneOtpReturnsExpiresMinutes() {
  const originalFindOne = UserModel.findOne;
  const originalIssue = VerificationService.issue;

  (UserModel as any).findOne = () => ({
    select: () => ({
      lean: async () => null,
    }),
  });
  (VerificationService as any).issue = async () => ({
    rawToken: "123456",
    expiresAt: new Date(Date.now() + 60_000),
  });

  try {
    const { res, nextError } = await invokeHandler(sendRegisterPhoneOtp, {
      body: { phoneNumber: "0912345678" },
    });

    assert(!nextError, `Did not expect error, got: ${String(nextError)}`);
    assert(res.statusCode === 200, "Expected status 200");
    const payload = res.body as any;
    assert(payload?.success === true, "Expected success response");
    assert(
      payload?.data?.expiresInMinutes === VerificationConfig.DEFAULT_OTP_EXPIRES_MIN,
      "Expected register phone OTP response to include expiresInMinutes"
    );
  } finally {
    (UserModel as any).findOne = originalFindOne;
    (VerificationService as any).issue = originalIssue;
  }
}

async function testVerifyRegisterEmailOtpReturnsVerified() {
  const originalVerify = VerificationService.verify;

  (VerificationService as any).verify = async () => ({
    userId: null,
    identifier: "new-user@example.com",
  });

  try {
    const { res, nextError } = await invokeHandler(verifyRegisterEmailOtp, {
      body: { email: "new-user@example.com", code: "123456" },
    });

    assert(!nextError, `Did not expect error, got: ${String(nextError)}`);
    const payload = res.body as any;
    assert(payload?.success === true, "Expected success response");
    assert(payload?.data?.verified === true, "Expected verified=true");
  } finally {
    (VerificationService as any).verify = originalVerify;
  }
}

async function testVerifyRegisterPhoneOtpReturnsVerified() {
  const originalVerify = VerificationService.verify;

  (VerificationService as any).verify = async () => ({
    userId: null,
    identifier: "0912345678",
  });

  try {
    const { res, nextError } = await invokeHandler(verifyRegisterPhoneOtp, {
      body: { phoneNumber: "0912345678", code: "123456" },
    });

    assert(!nextError, `Did not expect error, got: ${String(nextError)}`);
    const payload = res.body as any;
    assert(payload?.success === true, "Expected success response");
    assert(payload?.data?.verified === true, "Expected verified=true");
  } finally {
    (VerificationService as any).verify = originalVerify;
  }
}

Promise.resolve()
  .then(testRouterExposesPublicRegisterVerificationEndpoints)
  .then(testSendRegisterEmailOtpReturnsExpiresMinutes)
  .then(testSendRegisterPhoneOtpReturnsExpiresMinutes)
  .then(testVerifyRegisterEmailOtpReturnsVerified)
  .then(testVerifyRegisterPhoneOtpReturnsVerified)
  .then(() => console.log("register verification public endpoints test passed"))
  .catch((err) => {
    console.error("register verification public endpoints test failed:", err);
    process.exit(1);
  });
