
import mongoose, { Document, Schema } from "mongoose";

export interface IReport extends Document {
    itemId: mongoose.Types.ObjectId;
    reporterId: mongoose.Types.ObjectId;
    ownerId: mongoose.Types.ObjectId;

    reason: string;
    description: string;

    status: "PENDING" | "REVIEWED" | "DISMISSED" | "ACTION_TAKEN";

    adminNote?: string;
    reviewedBy?: mongoose.Types.ObjectId;
    reviewedAt?: Date;
}

const reportSchema = new Schema<IReport>(
    {
        itemId: {
            type: Schema.Types.ObjectId,
            ref: "Item",
            required: true
        },

        reporterId: {
            type: Schema.Types.ObjectId,
            ref: "system_user",
            required: true
        },

        ownerId: {
            type: Schema.Types.ObjectId,
            ref: "system_user",
            required: true
        },

        reason: {
            type: String,
            required: true,
            enum: [
                "FRAUD",
                "FAKE_POST",
                "INAPPROPRIATE_CONTENT",
                "WRONG_INFORMATION",
                "DUPLICATE_POST",
                "OTHER"
            ]
        },

        description: {
            type: String,
            required: true,
            trim: true,
            maxlength: 1000
        },

        status: {
            type: String,
            enum: [
                "PENDING",
                "REVIEWED",
                "DISMISSED",
                "ACTION_TAKEN"
            ],
            default: "PENDING"
        },

        adminNote: {
            type: String,
            default: ""
        },

        reviewedBy: {
            type: Schema.Types.ObjectId,
            ref: "system_user"
        },

        reviewedAt: {
            type: Date
        }
    },
    {
        timestamps: true
    }
);

const Report = mongoose.model<IReport>("Report", reportSchema);

export default Report;

