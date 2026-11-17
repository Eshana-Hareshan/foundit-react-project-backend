
import { Request, Response } from "express";
import mongoose from "mongoose";
import { UserModel, UserRole } from "../models/userModel";
import Item from "../models/itemModel";
import Notification from "../models/notificationModel";
import Report from "../models/reportModel";
import ModerationHistory from "../models/moderationHistoryModel";

export const getDashboardStats = async (
    req: Request,
    res: Response
) => {
    try {
        const [
            totalUsers,
            totalAdmins,
            totalNormalUsers,
            unverifiedUsers,
            suspendedUsers,
            totalItems,
            lostItems,
            foundItems,
            resolvedItems,
            pendingReports
        ] = await Promise.all([

            UserModel.countDocuments(),

            UserModel.countDocuments({ roles: UserRole.ADMIN }),

            UserModel.countDocuments({ roles: UserRole.USER }),

            UserModel.countDocuments({ isEmailVerified: false }),

            UserModel.countDocuments({ isSuspended: true }),

            Item.countDocuments(),

            Item.countDocuments({ status: "LOST" }),

            Item.countDocuments({ status: "FOUND" }),

            Item.countDocuments({ isResolved: true }),

            Report.countDocuments({ status: "PENDING" })

        ]);

        return res.status(200).json({
            message: "Dashboard statistics retrieved successfully",

            data: {
                totalUsers,
                totalAdmins,
                totalNormalUsers,
                unverifiedUsers,
                suspendedUsers,
                totalItems,
                lostItems,
                foundItems,
                resolvedItems,
                pendingReports
            }
        });

    } catch (error) {

        console.error("Admin dashboard error:", error);

        return res.status(500).json({
            message: "Failed to retrieve dashboard statistics"
        });

    }
};


export const getAllUsers = async (
    req: Request,
    res: Response
) => {
    try {
        const search = req.query.search as string | undefined;

        // Build the search condition
        const filter: Record<string, unknown> = {};

        if (search && search.trim()) {
            const safeSearch = search.trim().replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
            );

            filter.$or = [
                { name: { $regex: safeSearch, $options: "i" } },
                { email: { $regex: safeSearch, $options: "i" } }
            ];
        }

        const users = await UserModel.find(filter)
            .select("name email roles isEmailVerified isSuspended createdAt")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            message: "Users retrieved successfully",
            data: users
        });

    } catch (error) {
        console.error("Admin users error:", error);

        return res.status(500).json({
            message: "Failed to retrieve users"
        });
    }
};


export const getAllAdminItems = async (
    req: Request,
    res: Response
) => {
    try {
        const search = req.query.search as string | undefined;
        const moderationStatus = req.query.moderationStatus as string | undefined;

        const filter: any = {};

        // Search by item name or location
        if (search && search.trim()) {
            const safeSearch = search.trim().replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
            );

            filter.$or = [
                { itemName: { $regex: safeSearch, $options: "i" } },
                { location: { $regex: safeSearch, $options: "i" } }
            ];
        }

        // Filter by moderation status
        if (moderationStatus && moderationStatus !== "ALL") {
            filter.moderationStatus = moderationStatus;
        }

        const items = await Item.find(filter)
            .populate("userId", "name email")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            message: "Admin items retrieved successfully",
            data: items
        });

    } catch (error) {
        console.error("Admin items error:", error);

        return res.status(500).json({
            message: "Failed to retrieve Admin items"
        });
    }
};


export const moderateItem = async (
    req: Request,
    res: Response
) => {
    try {
        const { id } = req.params;
        const { action, reason } = req.body;

        // Validate item ID
        if (typeof id !== "string" || !id.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({
                message: "Invalid item ID"
            });
        }

        // Validate action
        const allowedActions = [
            "REQUEST_EDIT",
            "RESTRICT",
            "REMOVE",
            "RESTORE"
        ];

        if (!allowedActions.includes(action)) {
            return res.status(400).json({
                message: "Invalid moderation action"
            });
        }

        // A reason is required for every action
        if (!reason || !reason.trim()) {
            return res.status(400).json({
                message: "Please provide a reason"
            });
        }

        // Find item
        const item = await Item.findById(id);

        if (!item) {
            return res.status(404).json({
                message: "Item not found"
            });
        }

        // Map Admin action to moderation status
        const statusMap: Record<string, string> = {
            REQUEST_EDIT: "EDIT_REQUESTED",
            RESTRICT: "RESTRICTED",
            REMOVE: "REMOVED",
            RESTORE: "ACTIVE"
        };

        item.moderationStatus = statusMap[action] as
            "ACTIVE" | "EDIT_REQUESTED" | "RESTRICTED" | "REMOVED";

        item.moderationReason = reason.trim();
        item.moderatedAt = new Date();
        item.moderatedBy = new (await import("mongoose")).default.Types.ObjectId(
            (req as any).user.sub
        );

        await item.save();

        // Save moderation history
        await ModerationHistory.create({
            adminId: (req as any).user.sub,
            itemId: item._id,
            action,
            reason: reason.trim(),
            source: "ITEM_MANAGEMENT"
        });

        // Create a notification for the post owner
        const notificationMessages: Record<string, string> = {
            REQUEST_EDIT: "The administrator has requested changes to your post.",
            RESTRICT: "Your post has been restricted by the administrator.",
            REMOVE: "Your post has been removed by the administrator.",
            RESTORE: "Your post has been restored by the administrator."
        };

        const notificationTitles: Record<string, string> = {
            REQUEST_EDIT: "Post Edit Required",
            RESTRICT: "Post Restricted",
            REMOVE: "Post Removed",
            RESTORE: "Post Restored"
        };

        const notificationTypes: Record<
            string,
            "EDIT_REQUESTED" | "RESTRICTED" | "REMOVED" | "RESTORED"
        > = {
            REQUEST_EDIT: "EDIT_REQUESTED",
            RESTRICT: "RESTRICTED",
            REMOVE: "REMOVED",
            RESTORE: "RESTORED"
        };

        await Notification.create({
            userId: item.userId,
            itemId: item._id,
            title: notificationTitles[action],
            message: `${notificationMessages[action]} Reason: ${reason.trim()}`,
            type: notificationTypes[action],
            isRead: false
        });

        return res.status(200).json({
            message: "Item moderation action and owner notification completed successfully",
            data: item
        });

    } catch (error) {
        console.error("Item moderation error:", error);

        return res.status(500).json({
            message: "Failed to moderate item"
        });
    }
};


export const updateUserSuspension = async (
    req: Request,
    res: Response
) => {
    try {
        const { id } = req.params;
        const { isSuspended } = req.body;

        // Validate user ID
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                message: "Invalid user ID"
            });
        }

        // Validate suspension value
        if (typeof isSuspended !== "boolean") {
            return res.status(400).json({
                message: "Invalid account status"
            });
        }

        // Find the target user
        const targetUser = await UserModel.findById(id);

        if (!targetUser) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        // Get logged-in Admin ID
        const adminId = (req as any).user?.sub;

        // Validate Admin ID
        if (!adminId || !mongoose.isValidObjectId(adminId)) {
            return res.status(401).json({
                message: "Admin authentication required"
            });
        }

        // Prevent Admin from suspending their own account
        if (targetUser._id.toString() === adminId) {
            return res.status(403).json({
                message: "You cannot restrict your own account"
            });
        }

        // Prevent changing another Admin's account
        if (targetUser.roles.includes(UserRole.ADMIN)) {
            return res.status(403).json({
                message: "Admin accounts cannot be suspended through this action"
            });
        }

        // Update account status
        targetUser.isSuspended = isSuspended;

        await targetUser.save();

        // Save account action in moderation history
        await ModerationHistory.create({
            adminId: new mongoose.Types.ObjectId(adminId),
            targetUserId: targetUser._id,
            action: isSuspended
                ? "SUSPEND_USER"
                : "REACTIVATE_USER",
            reason: isSuspended
                ? "User account suspended by administrator"
                : "User account reactivated by administrator",
            source: "USER_MANAGEMENT"
        });

        return res.status(200).json({
            message: isSuspended
                ? "User account suspended successfully"
                : "User account reactivated successfully",
            data: {
                _id: targetUser._id,
                name: targetUser.name,
                email: targetUser.email,
                isSuspended: targetUser.isSuspended
            }
        });

    } catch (error) {
        console.error("Update user suspension error:", error);

        return res.status(500).json({
            message: "Failed to update user account status"
        });
    }
};


export const getAllReports = async (
    req: Request,
    res: Response
) => {
    try {
        const status = req.query.status as string | undefined;

        const filter: Record<string, unknown> = {};

        if (
            status &&
            ["PENDING", "REVIEWED", "DISMISSED", "ACTION_TAKEN"].includes(status)
        ) {
            filter.status = status;
        }

        const reports = await Report.find(filter)
            .populate("itemId", "itemName status imageUrl moderationStatus")
            .populate("reporterId", "name email")
            .populate("ownerId", "name email")
            .populate("reviewedBy", "name email")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            message: "Reports retrieved successfully",
            data: reports
        });

    } catch (error) {
        console.error("Admin reports error:", error);

        return res.status(500).json({
            message: "Failed to retrieve reports"
        });
    }
};


export const reviewReport = async (
    req: Request,
    res: Response
) => {
    try {
        const { id } = req.params;
        const { action, adminNote } = req.body;

        const adminId = (req as any).user?.sub;

        // Validate report ID
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                message: "Invalid report ID"
            });
        }

        // Validate Admin ID
        if (!adminId || !mongoose.isValidObjectId(adminId)) {
            return res.status(401).json({
                message: "Admin authentication required"
            });
        }

        // Allowed review actions
        const allowedActions = [
            "DISMISS",
            "REQUEST_EDIT",
            "RESTRICT",
            "REMOVE"
        ];

        if (!allowedActions.includes(action)) {
            return res.status(400).json({
                message: "Invalid report review action"
            });
        }

        // Validate Admin note
        if (
            typeof adminNote !== "string" ||
            !adminNote.trim() ||
            adminNote.trim().length > 1000
        ) {
            return res.status(400).json({
                message: "Please provide an Admin note (maximum 1000 characters)"
            });
        }

        // Find report
        const report = await Report.findById(id);

        if (!report) {
            return res.status(404).json({
                message: "Report not found"
            });
        }

        // Prevent reviewing the same report again
        if (report.status !== "PENDING") {
            return res.status(400).json({
                message: "This report has already been reviewed"
            });
        }

        // Find reported item
        const item = await Item.findById(report.itemId);

        if (!item && action !== "DISMISS") {
            return res.status(404).json({
                message: "Reported item no longer exists"
            });
        }

        // Dismiss report without changing the item
        if (action === "DISMISS") {
            report.status = "DISMISSED";
        } else {
            // Map review action to item moderation action
            const statusMap: Record<string, "EDIT_REQUESTED" | "RESTRICTED" | "REMOVED"> = {
                REQUEST_EDIT: "EDIT_REQUESTED",
                RESTRICT: "RESTRICTED",
                REMOVE: "REMOVED"
            };

            const notificationTypes: Record<
                string,
                "EDIT_REQUESTED" | "RESTRICTED" | "REMOVED"
            > = {
                REQUEST_EDIT: "EDIT_REQUESTED",
                RESTRICT: "RESTRICTED",
                REMOVE: "REMOVED"
            };

            const notificationTitles: Record<string, string> = {
                REQUEST_EDIT: "Post Edit Required",
                RESTRICT: "Post Restricted",
                REMOVE: "Post Removed"
            };

            const notificationMessages: Record<string, string> = {
                REQUEST_EDIT: "The administrator has requested changes to your post.",
                RESTRICT: "Your post has been restricted by the administrator.",
                REMOVE: "Your post has been removed by the administrator."
            };

            item!.moderationStatus = statusMap[action];
            item!.moderationReason = adminNote.trim();
            item!.moderatedAt = new Date();
            item!.moderatedBy = new mongoose.Types.ObjectId(adminId);

            await item!.save();

            // Notify post owner
            await Notification.create({
                userId: report.ownerId,
                itemId: report.itemId,
                title: notificationTitles[action],
                message: `${notificationMessages[action]} Reason: ${adminNote.trim()}`,
                type: notificationTypes[action],
                isRead: false
            });

            // Save moderation history
            await ModerationHistory.create({
                adminId: new mongoose.Types.ObjectId(adminId),
                itemId: item!._id,
                reportId: report._id,
                action,
                reason: adminNote.trim(),
                source: "REPORT_REVIEW"
            });

            report.status = "ACTION_TAKEN";
        }

        // Save report review history
        report.adminNote = adminNote.trim();
        report.reviewedBy = new mongoose.Types.ObjectId(adminId);
        report.reviewedAt = new Date();

        await report.save();

        return res.status(200).json({
            message: "Report reviewed successfully",
            data: report
        });

    } catch (error) {
        console.error("Review report error:", error);

        return res.status(500).json({
            message: "Failed to review report"
        });
    }
};




export const getModerationHistory = async (
    req: Request,
    res: Response
) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(
            50,
            Math.max(1, Number(req.query.limit) || 10)
        );

        const skip = (page - 1) * limit;

        const [history, totalRecords] = await Promise.all([
            ModerationHistory.find()
                .select(
                    "adminId itemId targetUserId reportId action reason source createdAt"
                )
                .populate("adminId", "name email")
                .populate("itemId", "itemName status")
                .populate("targetUserId", "name email")
                .populate("reportId", "reason status")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),

            ModerationHistory.countDocuments()
        ]);

        return res.status(200).json({
            message: "Moderation history retrieved successfully",
            data: history,
            pagination: {
                currentPage: page,
                totalRecords,
                totalPages: Math.ceil(totalRecords / limit),
                limit
            }
        });

    } catch (error) {
        console.error("Moderation history error:", error);

        return res.status(500).json({
            message: "Failed to retrieve moderation history"
        });
    }
};

