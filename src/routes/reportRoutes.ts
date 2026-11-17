
import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { createReport } from "../controllers/reportController";

const router = Router();

// All report routes require authentication
router.use(authenticate);

// Submit a report for an item
router.post("/:itemId", createReport);

export default router;
