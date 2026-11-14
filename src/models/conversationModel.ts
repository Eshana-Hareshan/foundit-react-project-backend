
import mongoose, { Schema, Document } from "mongoose";

export interface IConversation extends Document {
    itemId: mongoose.Types.ObjectId;
    ownerId: mongoose.Types.ObjectId;
    requesterId: mongoose.Types.ObjectId;
    lastMessage?: string;
    lastMessageAt?: Date;
}

const conversationSchema = new Schema<IConversation>(
    {
        itemId: {
            type: Schema.Types.ObjectId,
            ref: "Item",
            required: true
        },

        ownerId: {
            type: Schema.Types.ObjectId,
            ref: "system_user",
            required: true
        },

        requesterId: {
            type: Schema.Types.ObjectId,
            ref: "system_user",
            required: true
        },

        lastMessage: {
            type: String,
            default: ""
        },

        lastMessageAt: {
            type: Date
        }
    },
    {
        timestamps: true
    }
);

// Prevent duplicate conversations for the same item and users.
conversationSchema.index(
    { itemId: 1, ownerId: 1, requesterId: 1 },
    { unique: true }
);

const Conversation = mongoose.model<IConversation>(
    "Conversation",
    conversationSchema
);

export default Conversation;
