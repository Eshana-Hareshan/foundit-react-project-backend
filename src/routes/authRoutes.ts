import { Router } from "express"
import {
  getMyDetails,
  getRefreshToken,
  login,
  loginGoogle,
  register
} from "../controllers/authController"
import { authenticate } from "../middleware/auth"

const router = Router()

router.post("/register", register)
router.post("/login", login)
router.post("/google", loginGoogle)
router.post("/refresh", getRefreshToken)
router.get("/me", authenticate, getMyDetails)

export default router
