
import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { getMyNotifications, markNotificationAsRead } from "../controllers/notificationController";

const router = Router();

// All notification routes require authentication
router.use(authenticate);

// Get notifications for the logged-in user
router.get("/", getMyNotifications);

// Mark a notification as read
router.patch("/:id/read", markNotificationAsRead);

export default router;
