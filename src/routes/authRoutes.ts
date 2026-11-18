import { Router } from "express";
import {
  getMyDetails,
  getRefreshToken,
  login,
  loginGoogle,
  register,
  verifyOTP,
  forgotPassword,
  resetPassword,
  updateProfile,
  changePassword
} from "../controllers/authController";
import { authenticate } from "../middleware/auth";

const router = Router();

router.post("/register", register);
router.post("/verify-otp", verifyOTP);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/google", loginGoogle);
router.post("/refresh", getRefreshToken);
router.get("/me", authenticate, getMyDetails);

// Profile and Password management (Authenticated)
router.put("/profile", authenticate, updateProfile);
router.put("/change-password", authenticate, changePassword);

export default router;
