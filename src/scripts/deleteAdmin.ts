
import mongoose from "mongoose";
import dotenv from "dotenv";
import { UserModel, UserRole } from "../models/userModel";

dotenv.config();

const deleteAdmin = async () => {
    try {
        const mongoUrl = process.env.MONGO_LOCAL_URL;

        if (!mongoUrl) {
            throw new Error("MONGO_LOCAL_URL is missing from .env");
        }

        await mongoose.connect(mongoUrl);

        const email = process.env.ADMIN_EMAIL;

        if (!email) {
            throw new Error("ADMIN_EMAIL is missing from .env");
        }

        const result = await UserModel.deleteOne({
            email: email.toLowerCase().trim(),
            roles: UserRole.ADMIN
        });

        if (result.deletedCount === 1) {
            console.log("Admin account deleted successfully.");
        } else {
            console.log("No matching Admin account found.");
        }

    } catch (error) {
        console.error("Admin deletion failed:", error);
        process.exitCode = 1;

    } finally {
        await mongoose.disconnect();
    }
};

deleteAdmin();
