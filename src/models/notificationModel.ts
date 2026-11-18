import mongoose, { Document, Schema } from "mongoose";

export interface INotification extends Document {
    userId: mongoose.Types.ObjectId;
    itemId?: mongoose.Types.ObjectId;
    lostItemId?: mongoose.Types.ObjectId;
    foundItemId?: mongoose.Types.ObjectId;
    title: string;
    message: string;
    type: "EDIT_REQUESTED" | "RESTRICTED" | "REMOVED" | "RESTORED" | "ITEM_MATCH_FOUND";
    matchScore?: number;
    matchExplanation?: string;
    matchingDetails?: string[];
    conflictingDetails?: string[];
    isRead: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "system_user",
            required: true
        },

        itemId: {
            type: Schema.Types.ObjectId,
            ref: "Item",
            required: false
        },

        lostItemId: {
            type: Schema.Types.ObjectId,
            ref: "Item",
            required: false
        },

        foundItemId: {
            type: Schema.Types.ObjectId,
            ref: "Item",
            required: false
        },

        title: {
            type: String,
            required: true
        },

        message: {
            type: String,
            required: true
        },

        type: {
            type: String,
            enum: [
                "EDIT_REQUESTED",
                "RESTRICTED",
                "REMOVED",
                "RESTORED",
                "ITEM_MATCH_FOUND"
            ],
            required: true
        },

        matchScore: {
            type: Number,
            required: false
        },

        matchExplanation: {
            type: String,
            required: false
        },

        matchingDetails: {
            type: [String],
            default: []
        },

        conflictingDetails: {
            type: [String],
            default: []
        },

        isRead: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
);

// Prevent duplicate notifications for the same recipient, lost item, found item, and notification type
notificationSchema.index(
    { userId: 1, lostItemId: 1, foundItemId: 1, type: 1 },
    {
        unique: true,
        partialFilterExpression: { type: "ITEM_MATCH_FOUND" }
    }
);

notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ createdAt: -1 });

const Notification = mongoose.model<INotification>(
    "Notification",
    notificationSchema
);

export default Notification;
