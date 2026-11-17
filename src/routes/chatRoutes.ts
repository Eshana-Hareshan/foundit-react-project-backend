
import { Router } from "express";

import {
    createConversation,
    getMyConversations
} from "../controllers/conversationController";

import {
    getConversationMessages,
    sendMessage,
    getUnreadMessageCount
} from "../controllers/messageController";

import { authenticate } from "../middleware/auth";

const router = Router();

router.post("/", authenticate, createConversation);
router.get("/", authenticate, getMyConversations);
router.get("/unread-count", authenticate, getUnreadMessageCount);
router.get("/:id/messages", authenticate, getConversationMessages);
router.post("/:id/messages", authenticate, sendMessage);

export default router;
