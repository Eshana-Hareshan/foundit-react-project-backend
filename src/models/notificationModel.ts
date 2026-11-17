
import mongoose, { Document, Schema } from "mongoose";

export interface INotification extends Document {
    userId: mongoose.Types.ObjectId;
    itemId: mongoose.Types.ObjectId;
    title: string;
    message: string;
    type: "EDIT_REQUESTED" | "RESTRICTED" | "REMOVED" | "RESTORED";
    isRead: boolean;
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
            required: true
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
                "RESTORED"
            ],
            required: true
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

const Notification = mongoose.model<INotification>(
    "Notification",
    notificationSchema
);

export default Notification;
