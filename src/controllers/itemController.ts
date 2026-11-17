import { Request, Response } from "express";
import mongoose from "mongoose";
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
            additionalDetails,
            status
        } = req.body;

        // Check required fields
        if (
            !itemName ||
            !category ||
            !location ||
            !description ||
            !dateFound ||
            !["LOST", "FOUND"].includes(status)
        ) {
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
            userId,
            status
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


export const getAllItems = async (
    req: Request,
    res: Response
) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.max(1, Number(req.query.limit) || 50);

        const category = req.query.category as string;
        const search = req.query.search as string;

        const filter: any = {
            moderationStatus: {
                $nin: ["RESTRICTED", "REMOVED"]
            }
        };

        // Category filter
        if (category && category !== "All") {
            filter.category = category;
        }

        // Search by item name, category, status, location and description
        if (search && search.trim()) {
            const safeSearch = search.trim().replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
            );

            filter.$or = [
                { itemName: { $regex: safeSearch, $options: "i" } },
                { category: { $regex: safeSearch, $options: "i" } },
                { status: { $regex: safeSearch, $options: "i" } },
                { location: { $regex: safeSearch, $options: "i" } },
                { description: { $regex: safeSearch, $options: "i" } }
            ];
        }

        const items = await Item.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const total = await Item.countDocuments(filter);

        return res.status(200).json({
            message: "Items retrieved successfully",
            data: items,
            total,
            currentPage: page,
            totalPages: Math.ceil(total / limit)
        });

    } catch (error) {
        console.error("Get All Items Error:", error);

        return res.status(500).json({
            message: "Failed to retrieve items"
        });
    }
};



export const getItemById = async (
    req: Request,
    res: Response
) => {
    try {
        const { id } = req.params;

        // Check whether the ID is valid
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                message: "Invalid item ID"
            });
        }

        // Find item and retrieve owner details
        const item = await Item.findOne({
            _id: id,
            moderationStatus: { $nin: ["RESTRICTED", "REMOVED"] }
        }).populate("userId", "name email");

        if (!item) {
            return res.status(404).json({
                message: "Item not found"
            });
        }

        return res.status(200).json({
            message: "Item retrieved successfully",
            data: item
        });

    } catch (error) {
        console.error("Get Item Error:", error);

        return res.status(500).json({
            message: "Failed to retrieve item"
        });
    }
};


export const updateItem = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { id } = req.params;

        // Check item ID
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                message: "Invalid item ID"
            });
        }

        // Get logged-in user ID
        const userId = req.user?.sub;

        if (!userId) {
            return res.status(401).json({
                message: "Authentication required"
            });
        }

        // Find the item
        const item = await Item.findById(id);

        if (!item) {
            return res.status(404).json({
                message: "Item not found"
            });
        }

        // Check item ownership
        if (item.userId.toString() !== userId) {
            return res.status(403).json({
                message: "You are not allowed to edit this item"
            });
        }

        // Prevent editing restricted or removed posts
        if (
            item.moderationStatus === "RESTRICTED" ||
            item.moderationStatus === "REMOVED"
        ) {
            return res.status(403).json({
                message: "This post cannot be edited because it has been restricted or removed. Please contact the administrator."
            });
        }

        // Get updated details
        const {
            itemName,
            category,
            location,
            description,
            dateFound,
            additionalDetails
        } = req.body;

        // Update item details
        item.itemName = itemName;
        item.category = category;
        item.location = location;
        item.description = description;
        item.dateFound = dateFound;
        item.additionalDetails = additionalDetails;

        // Upload new image only if provided
        if (req.file) {
            const imageUrl = await uploadToCloudinary(req.file);
            item.imageUrl = imageUrl;
        }

        // If Admin requested an edit, activate the post again
        if (item.moderationStatus === "EDIT_REQUESTED") {
            item.moderationStatus = "ACTIVE";
            item.moderationReason = "";
        }

        // Save updated item
        await item.save();

        return res.status(200).json({
            message: "Item updated successfully",
            data: item
        });

    } catch (error) {
        console.error("Update Item Error:", error);

        return res.status(500).json({
            message: "Failed to update item"
        });
    }
};



export const markItemAsResolved = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { id } = req.params;

        // 1. Validate item ID
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                message: "Invalid item ID"
            });
        }

        // 2. Get logged-in user ID
        const userId = req.user?.sub;

        if (!userId) {
            return res.status(401).json({
                message: "Authentication required"
            });
        }

        // 3. Find the item
        const item = await Item.findById(id);

        if (!item) {
            return res.status(404).json({
                message: "Item not found"
            });
        }

        // 4. Check whether logged-in user owns this item
        if (item.userId.toString() !== userId) {
            return res.status(403).json({
                message: "You are not allowed to resolve this item"
            });
        }

        // 5. Check whether already resolved
        if (item.isResolved) {
            return res.status(400).json({
                message: "This item is already resolved"
            });
        }

        // 6. Update item status
        item.isResolved = true;

        await item.save();

        return res.status(200).json({
            message: "Item marked as resolved successfully",
            data: item
        });

    } catch (error) {
        console.error("Resolve Item Error:", error);

        return res.status(500).json({
            message: "Failed to resolve item"
        });
    }
};

