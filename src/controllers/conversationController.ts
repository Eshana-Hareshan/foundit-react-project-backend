
import { Request, Response } from "express";
import mongoose from "mongoose";

import Item from "../models/itemModel";
import Conversation from "../models/conversationModel";
import { AuthRequest } from "../middleware/auth";

export const createConversation = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        // 1. Get item ID from frontend
        const { itemId } = req.body;

        if (!itemId || !mongoose.isValidObjectId(itemId)) {
            return res.status(400).json({
                message: "Valid item ID is required."
            });
        }

        // 2. Get logged-in user ID from JWT
        const requesterId = req.user?.sub;

        if (!requesterId) {
            return res.status(401).json({
                message: "Please login first."
            });
        }

        // 3. Find the item
        const item = await Item.findById(itemId);

        if (!item) {
            return res.status(404).json({
                message: "Item not found."
            });
        }

        // 4. Get item owner's ID
        const ownerId = item.userId.toString();

        // 5. Prevent users from chatting with themselves
        if (ownerId === requesterId.toString()) {
            return res.status(400).json({
                message: "You cannot start a conversation about your own item."
            });
        }

        // 6. Check whether a conversation already exists
        let conversation = await Conversation.findOne({
            itemId: item._id,
            ownerId: ownerId,
            requesterId: requesterId
        });

        // 7. Create a conversation if one does not exist
        if (!conversation) {
            try {
                conversation = await Conversation.create({
                    itemId: item._id,
                    ownerId: ownerId,
                    requesterId: requesterId
                });
            } catch (error) {
                // Handle duplicate creation requests
                if ((error as { code?: number }).code !== 11000) {
                    throw error;
                }

                conversation = await Conversation.findOne({
                    itemId: item._id,
                    ownerId: ownerId,
                    requesterId: requesterId
                });

                if (!conversation) {
                    throw error;
                }
            }
        }

        // 8. Get item and user details
        await conversation.populate([
            {
                path: "itemId",
                select: "itemName category imageUrl location"
            },
            {
                path: "ownerId",
                select: "name email"
            },
            {
                path: "requesterId",
                select: "name email"
            }
        ]);

        return res.status(200).json({
            message: "Conversation retrieved successfully.",
            conversation
        });

    } catch (error) {
        console.error("Create Conversation Error:", error);

        return res.status(500).json({
            message: "Failed to create conversation."
        });
    }
};


export const getMyConversations = async (
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

        // 2. Find conversations where the user is involved
        const conversations = await Conversation.find({
            $or: [
                { ownerId: userId },
                { requesterId: userId }
            ]
        })
            // 3. Get related item and user details
            .populate("itemId", "itemName category imageUrl location")
            .populate("ownerId", "name email")
            .populate("requesterId", "name email")

            // 4. Show latest conversations first
            .sort({
                lastMessageAt: -1,
                updatedAt: -1
            });

        // 5. Send conversations to frontend
        return res.status(200).json({
            message: "Conversations retrieved successfully.",
            conversations
        });

    } catch (error) {
        console.error("Get Conversations Error:", error);

        return res.status(500).json({
            message: "Failed to retrieve conversations."
        });
    }
};

