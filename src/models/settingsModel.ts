
import mongoose, { Document, Schema } from "mongoose";

export interface ISettings extends Document {
    platformName: string;
    description: string;
    registrationEnabled: boolean;
    emailVerification: boolean;
}

const settingsSchema = new Schema<ISettings>(
    {
        platformName: {
            type: String,
            required: true,
            default: "Foundit"
        },

        description: {
            type: String,
            required: true,
            default: "Lost and Found Management Platform"
        },

        registrationEnabled: {
            type: Boolean,
            default: true
        },

        emailVerification: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

const Settings = mongoose.model<ISettings>(
    "Settings",
    settingsSchema
);

export default Settings;
