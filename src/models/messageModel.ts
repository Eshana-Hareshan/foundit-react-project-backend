
import mongoose, { Schema, Document } from "mongoose";

export interface IMessage extends Document {
    conversationId: mongoose.Types.ObjectId;
    senderId: mongoose.Types.ObjectId;
    text: string;
}

const messageSchema = new Schema<IMessage>(
    {
        conversationId: {
            type: Schema.Types.ObjectId,
            ref: "Conversation",
            required: true
        },

        senderId: {
            type: Schema.Types.ObjectId,
            ref: "system_user",
            required: true
        },

        text: {
            type: String,
            required: true,
            trim: true
        }
    },
    {
        timestamps: true
    }
);

const Message = mongoose.model<IMessage>(
    "Message",
    messageSchema
);

export default Message;
