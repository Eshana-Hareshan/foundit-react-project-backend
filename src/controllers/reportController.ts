
import { Response } from "express";
import mongoose from "mongoose";
import Report from "../models/reportModel";
import Item from "../models/itemModel";
import { AuthRequest } from "../middleware/auth";

export const createReport = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { itemId } = req.params;
        const { reason, description } = req.body;

        const reporterId = req.user?.sub;

        // Check authentication
        if (!reporterId) {
            return res.status(401).json({
                message: "Please log in to report a post."
            });
        }

        // Validate item ID
        if (typeof itemId !== "string" || !mongoose.isValidObjectId(itemId)) {
            return res.status(400).json({
                message: "Invalid item ID."
            });
        }

        // Validate reason
        const allowedReasons = [
            "FRAUD",
            "FAKE_POST",
            "INAPPROPRIATE_CONTENT",
            "WRONG_INFORMATION",
            "DUPLICATE_POST",
            "OTHER"
        ];

        if (!allowedReasons.includes(reason)) {
            return res.status(400).json({
                message: "Please select a valid report reason."
            });
        }

        // Validate description
        if (
            typeof description !== "string" ||
            !description.trim() ||
            description.trim().length > 1000
        ) {
            return res.status(400).json({
                message: "Description is required and must not exceed 1000 characters."
            });
        }

        // Find the reported item
        const item = await Item.findById(itemId);

        if (!item) {
            return res.status(404).json({
                message: "Item not found."
            });
        }

        // Prevent reporting your own post
        if (item.userId.toString() === reporterId) {
            return res.status(403).json({
                message: "You cannot report your own post."
            });
        }

        // Prevent reports against restricted or removed posts
        if (
            item.moderationStatus === "RESTRICTED" ||
            item.moderationStatus === "REMOVED"
        ) {
            return res.status(400).json({
                message: "This post cannot be reported."
            });
        }

        // Prevent duplicate pending reports from the same user
        const existingReport = await Report.findOne({
            itemId,
            reporterId,
            status: "PENDING"
        });

        if (existingReport) {
            return res.status(409).json({
                message: "You have already reported this post. Please wait for Admin review."
            });
        }

        // Create report
        const report = await Report.create({
            itemId,
            reporterId,
            ownerId: item.userId,
            reason,
            description: description.trim()
        });

        return res.status(201).json({
            message: "Your report has been submitted successfully.",
            data: report
        });

    } catch (error) {
        console.error("Create report error:", error);

        return res.status(500).json({
            message: "Failed to submit report."
        });
    }
};
