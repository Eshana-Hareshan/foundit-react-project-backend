// import mongoose from "mongoose";
// import bcrypt from "bcryptjs";
// import dotenv from "dotenv";
// import { UserModel, UserRole } from "../models/userModel";

// dotenv.config();

// const createAdmin = async () => {
//     try {
//         // Connect to MongoDB
//         const mongoUrl = process.env.MONGO_LOCAL_URL;

//         if (!mongoUrl) {
//             throw new Error("MONGO_LOCAL_URL is missing from .env");
//         }

//         await mongoose.connect(mongoUrl);

//         const email = process.env.ADMIN_EMAIL;
//         const password = process.env.ADMIN_PASSWORD;
//         const name = process.env.ADMIN_NAME;

//         if (!email || !password || !name) {
//             throw new Error("Admin environment variables are missing.");
//         }

//         // Check whether admin already exists
//         const existingAdmin = await UserModel.findOne({
//             email: email.toLowerCase().trim()
//         });

//         if (existingAdmin) {
//             console.log("Admin account already exists.");
//             return;
//         }

//         // Hash password
//         const hashedPassword = await bcrypt.hash(password, 10);

//         // Create admin
//         await UserModel.create({
//             name,
//             email: email.toLowerCase().trim(),
//             password: hashedPassword,
//             roles: [UserRole.ADMIN],
//             isEmailVerified: true
//         });

//         console.log("Admin account created successfully.");

//     } catch (error) {
//         console.error("Admin creation failed:", error);
//         process.exitCode = 1;

//     } finally {
//         await mongoose.disconnect();
//     }
// };

// createAdmin();