
import { Response } from "express";

import Message from "../models/messageModel";
import Conversation from "../models/conversationModel";
import { AuthRequest } from "../middleware/auth";
import mongoose from "mongoose";

export const getConversationMessages = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        // 1. Get conversation ID from URL
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                message: "Invalid conversation ID."
            });
        }

        // 2. Get logged-in user's ID
        const userId = req.user?.sub;

        if (!userId) {
            return res.status(401).json({
                message: "Please login first."
            });
        }

        // 3. Find the conversation
        // Make sure the logged-in user belongs to it
        const conversation = await Conversation.findOne({
            _id: id,
            $or: [
                { ownerId: userId },
                { requesterId: userId }
            ]
        });

        if (!conversation) {
            return res.status(404).json({
                message: "Conversation not found."
            });
        }

        // 4. Mark incoming messages as read
        await Message.updateMany(
            {
                conversationId: id,
                senderId: { $ne: userId },
                readBy: { $ne: userId }
            },
            {
                $addToSet: {
                    readBy: userId
                }
            }
        );

        // 5. Retrieve messages
        const messages = await Message.find({
            conversationId: id
        })
            .populate("senderId", "name")
            .sort({ createdAt: 1 });

        // 6. Return messages
        return res.status(200).json({
            message: "Messages retrieved successfully.",
            messages
        });

    } catch (error) {
        console.error("Get Messages Error:", error);

        return res.status(500).json({
            message: "Failed to retrieve messages."
        });
    }
};

export const sendMessage = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { id } = req.params;
        const { text } = req.body;

        // Check conversation ID
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                message: "Invalid conversation ID."
            });
        }

        // Check message text
        if (typeof text !== "string" || !text.trim()) {
            return res.status(400).json({
                message: "Message text is required."
            });
        }

        // Get logged-in user ID from JWT
        const senderId = req.user?.sub;

        if (!senderId) {
            return res.status(401).json({
                message: "Please login first."
            });
        }

        // Check whether this user belongs to the conversation
        const conversation = await Conversation.findOne({
            _id: id,
            $or: [
                { ownerId: senderId },
                { requesterId: senderId }
            ]
        });

        if (!conversation) {
            return res.status(404).json({
                message: "Conversation not found."
            });
        }

        // Save the new message
        const newMessage = await Message.create({
            conversationId: conversation._id,
            senderId,
            text: text.trim(),
            readBy: [senderId]
        });

        // Update the conversation's latest message
        conversation.lastMessage = text.trim();
        conversation.lastMessageAt = new Date();

        await conversation.save();

        // Get sender's name
        await newMessage.populate("senderId", "name");

        return res.status(201).json({
            message: "Message sent successfully.",
            newMessage
        });

    } catch (error) {
        console.error("Send Message Error:", error);

        return res.status(500).json({
            message: "Failed to send message."
        });
    }
};

export const getUnreadMessageCount = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        // 1. Get logged-in user's ID
        const userId = req.user?.sub;

        if (!userId) {
            return res.status(401).json({
                message: "Please login first."
            });
        }

        // 2. Find conversations where this user participates
        const conversations = await Conversation.find({
            $or: [
                { ownerId: userId },
                { requesterId: userId }
            ]
        }).select("_id");

        // 3. Extract conversation IDs
        const conversationIds = conversations.map(
            conversation => conversation._id
        );

        // 4. Count unread messages
        const unreadCount = await Message.countDocuments({
            conversationId: { $in: conversationIds },
            senderId: { $ne: userId },
            readBy: { $ne: userId }
        });

        // 5. Return unread count
        return res.status(200).json({
            unreadCount
        });

    } catch (error) {
        console.error("Unread Message Count Error:", error);

        return res.status(500).json({
            message: "Failed to get unread message count."
        });
    }
};