
import { Response } from "express";
import Notification from "../models/notificationModel";
import { AuthRequest } from "../middleware/auth";

// Get notifications belonging to the logged-in user
export const getMyNotifications = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const userId = req.user?.sub;

        if (!userId) {
            return res.status(401).json({
                message: "Authentication required"
            });
        }

        const notifications = await Notification.find({ userId })
            .populate("itemId", "itemName status")
            .sort({ createdAt: -1 });

        const unreadCount = await Notification.countDocuments({
            userId,
            isRead: false
        });

        return res.status(200).json({
            message: "Notifications retrieved successfully",
            data: notifications,
            unreadCount
        });

    } catch (error) {
        console.error("Notification retrieval error:", error);

        return res.status(500).json({
            message: "Failed to retrieve notifications"
        });
    }
};


export const markNotificationAsRead = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { id } = req.params;
        const userId = req.user?.sub;

        if (!userId) {
            return res.status(401).json({
                message: "Authentication required"
            });
        }

        const notification = await Notification.findOneAndUpdate(
            {
                _id: id,
                userId: userId
            },
            {
                isRead: true
            },
            {
                new: true
            }
        );

        if (!notification) {
            return res.status(404).json({
                message: "Notification not found"
            });
        }

        return res.status(200).json({
            message: "Notification marked as read",
            data: notification
        });

    } catch (error) {
        console.error("Mark notification as read error:", error);

        return res.status(500).json({
            message: "Failed to update notification"
        });
    }
};

