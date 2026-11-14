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
        userId: {type: Schema.Types.ObjectId,required: true}
    },
    {
        timestamps: true
    }
);

const Item = mongoose.model<IItem>("Item", itemSchema);

export default Item;