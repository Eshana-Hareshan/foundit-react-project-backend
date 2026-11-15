import { Router } from "express";
import { addItem,getAllItems,getItemById ,updateItem} from "../controllers/itemController";
import { authenticate } from "../middleware/auth";
import { upload } from "../middleware/upload";

const router = Router();

// Get all items
router.get("/", getAllItems);

// Get one item by ID
router.get("/:id", getItemById);

// Update an existing item
router.put("/:id",authenticate,upload.single("image"),updateItem);

// Add a new item
router.post("/",authenticate,upload.single("image"),addItem);

export default router;