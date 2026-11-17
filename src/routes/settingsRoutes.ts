
import { Router } from "express";
import {
    authenticate,
    requireAdmin
} from "../middleware/auth";

import {
    getSettings,
    updateSettings,
    getPublicSettings
} from "../controllers/settingsController";

const router = Router();

// Public route
router.get("/public", getPublicSettings);

// Admin-only routes
router.use(authenticate);
router.use(requireAdmin);

router.get("/", getSettings);
router.put("/", updateSettings);

export default router;
