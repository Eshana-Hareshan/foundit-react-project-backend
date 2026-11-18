import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
    getMyNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead
} from "../controllers/notificationController";

const router = Router();

// All notification routes require authentication
router.use(authenticate);

// Get notifications for the logged-in user
router.get("/", getMyNotifications);

// Mark all notifications as read (must precede /:id/read)
router.patch("/read-all", markAllNotificationsAsRead);

// Mark a single notification as read
router.patch("/:id/read", markNotificationAsRead);

export default router;
