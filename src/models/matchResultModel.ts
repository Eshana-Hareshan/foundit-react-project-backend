import mongoose, { Document, Schema } from "mongoose";

export interface IMatchResult extends Document {
    lostItemId: mongoose.Types.ObjectId;
    foundItemId: mongoose.Types.ObjectId;
    matchScore: number;
    isPossibleMatch: boolean;
    explanation: string;
    matchingDetails: string[];
    conflictingDetails: string[];
    modelName: string;
    analysisDate: Date;
    createdAt: Date;
    updatedAt: Date;
}

const matchResultSchema = new Schema<IMatchResult>(
    {
        lostItemId: {
            type: Schema.Types.ObjectId,
            ref: "Item",
            required: true
        },

        foundItemId: {
            type: Schema.Types.ObjectId,
            ref: "Item",
            required: true
        },

        matchScore: {
            type: Number,
            required: true,
            min: 0,
            max: 100
        },

        isPossibleMatch: {
            type: Boolean,
            required: true
        },

        explanation: {
            type: String,
            required: true
        },

        matchingDetails: {
            type: [String],
            default: []
        },

        conflictingDetails: {
            type: [String],
            default: []
        },

        modelName: {
            type: String,
            default: "gemini-3.5-flash-lite"
        },

        analysisDate: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

// Unique compound index so each (lostItemId, foundItemId) pair is cached once
matchResultSchema.index({ lostItemId: 1, foundItemId: 1 }, { unique: true });
matchResultSchema.index({ lostItemId: 1 });
matchResultSchema.index({ foundItemId: 1 });

const MatchResult = mongoose.model<IMatchResult>(
    "MatchResult",
    matchResultSchema
);

export default MatchResult;
