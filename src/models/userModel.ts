
import { Document, model, Schema } from "mongoose";

export enum UserRole {
    ADMIN = "ADMIN",
    USER = "USER"
}

export interface IUser extends Document {
    name: string;
    email: string;
    password: string;
    roles: UserRole[];

    isEmailVerified: boolean;
    isSuspended: boolean;

    // Registration OTP
    otp?: string;
    otpExpires?: Date;
    otpAttempts: number;

    // Password reset OTP
    resetPasswordOTP?: string;
    resetPasswordOTPExpires?: Date;
    resetPasswordOTPAttempts: number;
    resetPasswordOTPSentAt?: Date;
}

const userSchema = new Schema<IUser>(
    {
        name: {
            type: String,
            required: true
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },

        password: {
            type: String,
            required: true
        },

        roles: {
            type: [String],
            enum: Object.values(UserRole),
            default: [UserRole.USER]
        },

        isEmailVerified: {
            type: Boolean,
            default: false
        },

        isSuspended: {
            type: Boolean,
            default: false
        },

        // Registration OTP fields
        otp: {
            type: String
        },

        otpExpires: {
            type: Date
        },

        otpAttempts: {
            type: Number,
            default: 0
        },

        // Password reset OTP fields
        resetPasswordOTP: {
            type: String
        },

        resetPasswordOTPExpires: {
            type: Date
        },

        resetPasswordOTPAttempts: {
            type: Number,
            default: 0
        },

        resetPasswordOTPSentAt: {
            type: Date
        }
    },
    {
        timestamps: true
    }
);

export const UserModel = model<IUser>(
    "system_user",
    userSchema
);
