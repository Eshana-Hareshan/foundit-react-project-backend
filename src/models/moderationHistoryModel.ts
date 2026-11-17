
import mongoose, { Document, Schema } from "mongoose";

export interface IModerationHistory extends Document {
    adminId: mongoose.Types.ObjectId;

    itemId?: mongoose.Types.ObjectId;
    targetUserId?: mongoose.Types.ObjectId;
    reportId?: mongoose.Types.ObjectId;

    action:
        | "REQUEST_EDIT"
        | "RESTRICT"
        | "REMOVE"
        | "RESTORE"
        | "SUSPEND_USER"
        | "REACTIVATE_USER";

    reason: string;

    source:
        | "ITEM_MANAGEMENT"
        | "REPORT_REVIEW"
        | "USER_MANAGEMENT";
}

const moderationHistorySchema = new Schema<IModerationHistory>(
    {
        adminId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            immutable: true
        },

        itemId: {
            type: Schema.Types.ObjectId,
            ref: "Item",
            immutable: true
        },

        targetUserId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            immutable: true
        },

        reportId: {
            type: Schema.Types.ObjectId,
            ref: "Report",
            immutable: true
        },

        action: {
            type: String,
            enum: [
                "REQUEST_EDIT",
                "RESTRICT",
                "REMOVE",
                "RESTORE",
                "SUSPEND_USER",
                "REACTIVATE_USER"
            ],
            required: true,
            immutable: true
        },

        reason: {
            type: String,
            required: true,
            trim: true,
            immutable: true
        },

        source: {
            type: String,
            enum: [
                "ITEM_MANAGEMENT",
                "REPORT_REVIEW",
                "USER_MANAGEMENT"
            ],
            required: true,
            immutable: true
        }
    },
    {
        timestamps: true
    }
);

// Validate history target and action source
moderationHistorySchema.pre("validate", function () {

    const isUserAction =
        this.action === "SUSPEND_USER" ||
        this.action === "REACTIVATE_USER";

    // Validate target
    if (isUserAction && !this.targetUserId) {
        this.invalidate(
            "targetUserId",
            "User management actions require a target user."
        );
    }

    if (!isUserAction && !this.itemId) {
        this.invalidate(
            "itemId",
            "Item moderation actions require an item."
        );
    }

    // Validate source
    if (isUserAction && this.source !== "USER_MANAGEMENT") {
        this.invalidate(
            "source",
            "User actions must use USER_MANAGEMENT source."
        );
    }

    if (
        !isUserAction &&
        this.source === "USER_MANAGEMENT"
    ) {
        this.invalidate(
            "source",
            "Item actions cannot use USER_MANAGEMENT source."
        );
    }
});

const ModerationHistory = mongoose.model<IModerationHistory>(
    "ModerationHistory",
    moderationHistorySchema
);

export default ModerationHistory;
