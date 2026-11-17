import { Router } from "express";
import { addItem,getAllItems,getItemById ,updateItem,markItemAsResolved} from "../controllers/itemController";
import { authenticate } from "../middleware/auth";
import { upload } from "../middleware/upload";

const router = Router();

// Get all items
router.get("/", getAllItems);

// Get one item by ID
router.get("/:id", getItemById);

// Update an existing item
router.put("/:id",authenticate,upload.single("image"),updateItem);

// Mark an item as resolved
router.patch("/:id/resolve", authenticate, markItemAsResolved);

// Add a new item
router.post("/",authenticate,upload.single("image"),addItem);

export default router;