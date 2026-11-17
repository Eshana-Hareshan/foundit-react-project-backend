import { Router } from "express"
import {
  getMyDetails,
  getRefreshToken,
  login,
  loginGoogle,
  register,
  verifyOTP,
  forgotPassword,
  resetPassword
} from "../controllers/authController"
import { authenticate } from "../middleware/auth"

const router = Router()

router.post("/register", register)
router.post("/verify-otp", verifyOTP);
router.post("/login", login)
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/google", loginGoogle)
router.post("/refresh", getRefreshToken)
router.get("/me", authenticate, getMyDetails)

export default router
