import { Router } from "express";
import { addItem } from "../controllers/itemController";
import { authenticate } from "../middleware/auth";
import { upload } from "../middleware/upload";

const router = Router();

router.post("/",authenticate,upload.single("image"),addItem
);

export default router;