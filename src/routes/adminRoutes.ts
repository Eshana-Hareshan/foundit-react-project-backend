
import { Router } from "express";

import {
    authenticate,
    requireAdmin
} from "../middleware/auth";

import {
    getDashboardStats,
    getAllUsers,
    updateUserSuspension,
    getAllAdminItems,
    moderateItem,
    getAllReports,
    reviewReport,
    getModerationHistory
} from "../controllers/adminController";

const router = Router();

// Protect every Admin endpoint
router.use(authenticate);
router.use(requireAdmin);

// Dashboard
router.get("/dashboard", getDashboardStats);

// User management
router.get("/users", getAllUsers);
router.patch("/users/:id/suspension", updateUserSuspension);

// Item management
router.get("/items", getAllAdminItems);
router.patch("/items/:id/moderation", moderateItem);

// Report management
router.get("/reports", getAllReports);
router.patch("/reports/:id/review", reviewReport);

// Moderation history
router.get("/moderation-history", getModerationHistory);

export default router;
