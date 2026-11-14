
import { Router } from "express";

import {
    createConversation,
    getMyConversations
} from "../controllers/conversationController";

import {
    getConversationMessages
} from "../controllers/messageController";

import { authenticate } from "../middleware/auth";

const router = Router();

router.post("/", authenticate, createConversation);

router.get("/", authenticate, getMyConversations);

router.get("/:id/messages", authenticate, getConversationMessages);

export default router;
