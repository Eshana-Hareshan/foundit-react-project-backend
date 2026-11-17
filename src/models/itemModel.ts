import mongoose, { Schema, Document } from "mongoose";

export interface IItem extends Document {
    itemName: string;
    category: string;
    location: string;
    description: string;
    dateFound: Date;
    additionalDetails?: string;
    imageUrl: string;
    userId: mongoose.Types.ObjectId;
    isResolved: boolean;
    status: "LOST" | "FOUND";
    moderationStatus:
    | "ACTIVE"
    | "EDIT_REQUESTED"
    | "RESTRICTED"
    | "REMOVED";

    moderationReason?: string;
    moderatedAt?: Date;
    moderatedBy?: mongoose.Types.ObjectId;
}

const itemSchema = new Schema<IItem>(
    {
        itemName: {type: String,required: true,trim: true},
        category: {type: String,required: true},
        location: {type: String,required: true},
        description: {type: String,required: true},
        dateFound: {type: Date,required: true},
        additionalDetails: {type: String},
        imageUrl: {type: String,required: true},
        userId: {type: Schema.Types.ObjectId, ref: "system_user",required: true},
        isResolved: {type: Boolean,default: false},
        status: {type: String,enum: ["LOST", "FOUND"],required: true},
        moderationStatus: {type: String,enum: ["ACTIVE", "EDIT_REQUESTED", "RESTRICTED", "REMOVED"],default: "ACTIVE"},
        moderationReason: {type: String,default: ""},
        moderatedAt: {type: Date},
        moderatedBy: {type: Schema.Types.ObjectId,ref: "system_user"}
    },
    {
        timestamps: true
    }
);

const Item = mongoose.model<IItem>("Item", itemSchema);

export default Item;