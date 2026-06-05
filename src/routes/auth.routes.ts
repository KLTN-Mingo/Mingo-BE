// src/routes/auth.routes.ts
import { Router } from "express";
import {
  login,
  refresh,
  logout,
  register,
  googleLogin,
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor,
  completeTwoFactorLogin,
} from "../controllers/auth.controller";
import {
  sendEmailVerification,
  verifyEmail,
  sendPhoneOtp,
  verifyPhoneOtp,
  forgotPassword,
  resetPassword,
} from "../controllers/verification.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/google", googleLogin);
router.post("/2fa/setup", authMiddleware, setupTwoFactor);
router.post("/2fa/enable", authMiddleware, enableTwoFactor);
router.post("/2fa/disable", authMiddleware, disableTwoFactor);
router.post("/2fa/complete-login", completeTwoFactorLogin);
router.post("/refresh-token", refresh);
router.post("/logout", logout);

// ── Email verification ──────────────────────────────────────────────────────
router.post("/email/send-verification", authMiddleware, sendEmailVerification);
router.post("/email/verify", verifyEmail);

// ── Phone OTP ───────────────────────────────────────────────────────────────
router.post("/phone/send-otp", authMiddleware, sendPhoneOtp);
router.post("/phone/verify-otp", verifyPhoneOtp);

// ── Forgot / Reset password ─────────────────────────────────────────────────
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;
