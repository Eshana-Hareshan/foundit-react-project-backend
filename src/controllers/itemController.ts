import { Request, Response } from "express";
import Item from "../models/itemModel";
import { AuthRequest } from "../middleware/auth";
import { uploadToCloudinary } from "../util/cloudinary";

export const addItem = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const {
            itemName,
            category,
            location,
            description,
            dateFound,
            additionalDetails
        } = req.body;

        // Check required fields
        if (
            !itemName ||
            !category ||
            !location ||
            !description ||
            !dateFound) {
            return res.status(400).json({
                message: "Please provide all required item details."
            });
        }

        // Check image
        if (!req.file) {
            return res.status(400).json({
                message: "Please upload an item photo."
            });
        }

        // Get logged-in user ID from JWT
        const userId = req.user?.sub;

        if (!userId) {
            return res.status(401).json({
                message: "User authentication required."
            });
        }

        // Upload image to Cloudinary
        const imageUrl = await uploadToCloudinary(req.file);

        // Save item in MongoDB
        const newItem = await Item.create({
            itemName,
            category,
            location,
            description,
            dateFound,
            additionalDetails,
            imageUrl,
            userId
        });

        return res.status(201).json({
            message: "Found item added successfully!",
            item: newItem
        });

    } catch (error) {
        console.error("Add Item Error:", error);

        return res.status(500).json({
            message: "Failed to add found item."
        });
    }
};