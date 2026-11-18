
import { Request, Response } from "express";
import { UserModel,UserRole } from "../models/userModel";
import bcrypt from "bcryptjs";
import {
    signAccessToken,
    signRefreshToken,
    verifyRefreshToken
} from "../util/jwt";
import { AuthRequest } from "../middleware/auth";
import { OAuth2Client } from "google-auth-library";
import crypto from "crypto";
import { sendOTPEmail } from "../util/email";
import Settings from "../models/settingsModel";

// ========================================
// GOOGLE OAUTH CLIENT
// ========================================

const googleClient = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID
);

// ========================================
// OTP HELPER FUNCTIONS
// ========================================

// Hash OTP using SHA-256
const hashOTP = (otp: string): string => {
    return crypto
        .createHash("sha256")
        .update(otp)
        .digest("hex");
};

// Compare OTP hashes safely
const compareOTP = (
    enteredOTP: string,
    storedOTP: string
): boolean => {
    try {
        const enteredHash = Buffer.from(
            hashOTP(enteredOTP),
            "hex"
        );

        const storedHash = Buffer.from(
            storedOTP,
            "hex"
        );

        return (
            enteredHash.length === storedHash.length &&
            crypto.timingSafeEqual(
                enteredHash,
                storedHash
            )
        );
    } catch {
        return false;
    }
};

// Clear registration OTP information
const clearRegistrationOTP = (user: any) => {
    user.otp = undefined;
    user.otpExpires = undefined;
    user.otpAttempts = 0;
};

// Clear password reset OTP information
const clearPasswordResetOTP = (user: any) => {
    user.resetPasswordOTP = undefined;
    user.resetPasswordOTPExpires = undefined;
    user.resetPasswordOTPAttempts = 0;
    user.resetPasswordOTPSentAt = undefined;
};

export const register = async (
    req: Request,
    res: Response
) => {
    try {
        const { name, email, password } = req.body;

        // 1. Validate input
        if (
            typeof name !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string" ||
            !name.trim() ||
            !email.trim() ||
            !password.trim()
        ) {
            return res.status(400).json({
                message: "Name, email and password are required."
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                message: "Password must contain at least 6 characters."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // 2. Check registration settings
        const settings = await Settings.findOne();

        if (settings?.registrationEnabled === false) {
            return res.status(403).json({
                message: "Registration is currently disabled."
            });
        }

        // 3. Check email verification setting
        // Do not create or update any user details when disabled.
        if (settings?.emailVerification === false) {
            return res.status(403).json({
                message: "Registration is unavailable because email verification is disabled."
            });
        }

        // 4. Find existing account
        const existingUser = await UserModel.findOne({
            email: normalizedEmail
        });

        if (existingUser) {

            // A verified account cannot register again
            if (existingUser.isEmailVerified) {
                return res.status(409).json({
                    message: "An account with this email already exists."
                });
            }

            // An unverified account can receive a fresh OTP.
            // The previous active OTP will be replaced.
        }

        // 5. Hash password
        const hashedPassword = await bcrypt.hash(
            password,
            10
        );

        // 6. Generate new OTP
        const otp = crypto
            .randomInt(100000, 1000000)
            .toString();

        const hashedOTP = hashOTP(otp);

        const otpExpires = new Date(
            Date.now() + 5 * 60 * 1000
        );

        // 7. Create or update unverified account
        let user;

        if (existingUser) {

            // Update existing unverified account
            existingUser.name = name.trim();
            existingUser.password = hashedPassword;
            existingUser.otp = hashedOTP;
            existingUser.otpExpires = otpExpires;
            existingUser.otpAttempts = 0;

            user = await existingUser.save();

        } else {

            // Create a new unverified account
            user = await UserModel.create({
                name: name.trim(),
                email: normalizedEmail,
                password: hashedPassword,
                isEmailVerified: false,
                otp: hashedOTP,
                otpExpires,
                otpAttempts: 0
            });
        }

        // 8. Send OTP email
        try {

            await sendOTPEmail(normalizedEmail, otp);

        } catch (emailError) {

            console.error(
                "Registration OTP email error:",
                emailError
            );

            if (!existingUser) {

                // Remove newly created account if email fails
                await UserModel.findByIdAndDelete(user._id);

            } else {

                // Clear OTP if email sending fails
                clearRegistrationOTP(user);
                await user.save();
            }

            return res.status(500).json({
                message: "Failed to send verification email. Please try again."
            });
        }

        // 9. Successful registration response
        return res.status(201).json({
            message: "Registration successful. Please check your email for the OTP.",
            requiresVerification: true
        });

    } catch (error: any) {

        // Handle duplicate email race condition
        if (error.code === 11000) {
            return res.status(409).json({
                message: "An account with this email already exists."
            });
        }

        console.error("Registration error:", error);

        return res.status(500).json({
            message: "Registration failed."
        });
    }
};



export const verifyOTP = async (
    req: Request,
    res: Response
) => {
    try {
        const { email, otp } = req.body;

        // 1. Validate input
        if (
            typeof email !== "string" ||
            typeof otp !== "string" ||
            !email.trim() ||
            !otp.trim()
        ) {
            return res.status(400).json({
                message: "Email and OTP are required."
            });
        }

        if (!/^\d{6}$/.test(otp)) {
            return res.status(400).json({
                message: "OTP must contain exactly 6 digits."
            });
        }

        // 2. Find user
        const user = await UserModel.findOne({
            email: email.trim().toLowerCase()
        });

        if (!user) {
            return res.status(404).json({
                message: "Registration not found."
            });
        }

        // 3. Check verification status
        if (user.isEmailVerified) {
            return res.status(400).json({
                message: "Email is already verified."
            });
        }

        // 4. Check OTP availability
        if (!user.otp || !user.otpExpires) {
            return res.status(400).json({
                message: "No valid OTP found. Please register again."
            });
        }

        // 5. Check expiration
        if (user.otpExpires.getTime() <= Date.now()) {

            clearRegistrationOTP(user);
            await user.save();

            return res.status(400).json({
                message: "OTP has expired. Please register again."
            });
        }

        // 6. Check maximum attempts
        if (user.otpAttempts >= 5) {

            clearRegistrationOTP(user);
            await user.save();

            return res.status(429).json({
                message: "Too many incorrect attempts. Please register again."
            });
        }

        // 7. Compare OTP
        const isOTPValid = compareOTP(
            otp,
            user.otp
        );

        // 8. Handle incorrect OTP
        if (!isOTPValid) {

            user.otpAttempts += 1;

            const remainingAttempts =
                5 - user.otpAttempts;

            if (user.otpAttempts >= 5) {

                clearRegistrationOTP(user);
                await user.save();

                return res.status(429).json({
                    message: "Too many incorrect attempts. Please register again."
                });
            }

            await user.save();

            return res.status(400).json({
                message: `Invalid OTP. ${remainingAttempts} attempts remaining.`
            });
        }

        // 9. Verify email
        user.isEmailVerified = true;

        clearRegistrationOTP(user);

        await user.save();

        return res.status(200).json({
            message: "Email verified successfully. You can now log in."
        });

    } catch (error) {
        console.error("OTP verification error:", error);

        return res.status(500).json({
            message: "OTP verification failed."
        });
    }
};


// ========================================
// FORGOT PASSWORD
// ========================================

export const forgotPassword = async (
    req: Request,
    res: Response
) => {
    try {
        const { email } = req.body;

        // 1. Validate email
        if (
            typeof email !== "string" ||
            !email.trim()
        ) {
            return res.status(400).json({
                message: "Email is required."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // 2. Find user
        const user = await UserModel.findOne({
            email: normalizedEmail
        });

        if (!user) {
            return res.status(404).json({
                message: "User not found."
            });
        }

        // 3. Require verified email
        if (!user.isEmailVerified) {
            return res.status(403).json({
                message: "Please verify your email before resetting your password."
            });
        }

        // 4. Check OTP cooldown
        if (user.resetPasswordOTPSentAt) {

            const timeSinceLastOTP =
                Date.now() -
                user.resetPasswordOTPSentAt.getTime();

            const cooldownTime = 60 * 1000;

            if (timeSinceLastOTP < cooldownTime) {

                const remainingSeconds = Math.ceil(
                    (cooldownTime - timeSinceLastOTP) / 1000
                );

                return res.status(429).json({
                    message: `Please wait ${remainingSeconds} seconds before requesting another OTP.`
                });
            }
        }

        // 5. Generate OTP
        const otp = crypto
            .randomInt(100000, 1000000)
            .toString();

        const hashedOTP = hashOTP(otp);

        const otpExpires = new Date(
            Date.now() + 5 * 60 * 1000
        );

        // 6. Save OTP details
        user.resetPasswordOTP = hashedOTP;
        user.resetPasswordOTPExpires = otpExpires;
        user.resetPasswordOTPAttempts = 0;
        user.resetPasswordOTPSentAt = new Date();

        await user.save();

        // 7. Send OTP email
        try {
            await sendOTPEmail(normalizedEmail, otp);

        } catch (emailError) {

            console.error(
                "Password reset email error:",
                emailError
            );

            clearPasswordResetOTP(user);
            await user.save();

            return res.status(500).json({
                message: "Failed to send password reset OTP. Please try again."
            });
        }

        return res.status(200).json({
            message: "Password reset OTP sent successfully."
        });

    } catch (error) {
        console.error("Forgot password error:", error);

        return res.status(500).json({
            message: "Failed to process password reset request."
        });
    }
};


// ========================================
// RESET PASSWORD
// ========================================

export const resetPassword = async (
    req: Request,
    res: Response
) => {
    try {
        const { email, otp, newPassword } = req.body;

        // 1. Validate input
        if (
            typeof email !== "string" ||
            typeof otp !== "string" ||
            typeof newPassword !== "string" ||
            !email.trim() ||
            !otp.trim() ||
            !newPassword
        ) {
            return res.status(400).json({
                message: "Email, OTP and new password are required."
            });
        }

        if (!/^\d{6}$/.test(otp)) {
            return res.status(400).json({
                message: "OTP must contain exactly 6 digits."
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                message: "Password must contain at least 6 characters."
            });
        }

        // 2. Find user
        const user = await UserModel.findOne({
            email: email.trim().toLowerCase()
        });

        if (!user) {
            return res.status(404).json({
                message: "User not found."
            });
        }

        // 3. Require verified account
        if (!user.isEmailVerified) {
            return res.status(403).json({
                message: "Please verify your email before resetting your password."
            });
        }

        // 4. Check OTP availability
        if (
            !user.resetPasswordOTP ||
            !user.resetPasswordOTPExpires
        ) {
            return res.status(400).json({
                message: "Please request a password reset OTP."
            });
        }

        // 5. Check OTP expiration
        if (
            user.resetPasswordOTPExpires.getTime() <= Date.now()
        ) {
            clearPasswordResetOTP(user);
            await user.save();

            return res.status(400).json({
                message: "OTP has expired. Please request a new one."
            });
        }

        // 6. Check maximum attempts
        if (user.resetPasswordOTPAttempts >= 5) {

            clearPasswordResetOTP(user);
            await user.save();

            return res.status(429).json({
                message: "Too many incorrect attempts. Please request a new OTP."
            });
        }

        // 7. Compare OTP
        const isOTPValid = compareOTP(
            otp,
            user.resetPasswordOTP
        );

        // 8. Handle incorrect OTP
        if (!isOTPValid) {

            user.resetPasswordOTPAttempts += 1;

            const remainingAttempts =
                5 - user.resetPasswordOTPAttempts;

            if (user.resetPasswordOTPAttempts >= 5) {

                clearPasswordResetOTP(user);
                await user.save();

                return res.status(429).json({
                    message: "Too many incorrect attempts. Please request a new OTP."
                });
            }

            await user.save();

            return res.status(400).json({
                message: `Invalid OTP. ${remainingAttempts} attempts remaining.`
            });
        }

        // 9. Hash new password
        const hashedPassword = await bcrypt.hash(
            newPassword,
            10
        );

        // 10. Update password
        user.password = hashedPassword;

        // 11. Clear reset OTP details
        clearPasswordResetOTP(user);

        await user.save();

        return res.status(200).json({
            message: "Password reset successfully. Please log in."
        });

    } catch (error) {
        console.error("Reset password error:", error);

        return res.status(500).json({
            message: "Password reset failed."
        });
    }
};


// ========================================
// NORMAL LOGIN
// ========================================

export const login = async (
    req: Request,
    res: Response
) => {
    try {
        const { email, password } = req.body;

        // 1. Validate input
        if (
            typeof email !== "string" ||
            typeof password !== "string" ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                message: "Email and password are required."
            });
        }

        // 2. Find user
        const user = await UserModel.findOne({
            email: email.trim().toLowerCase()
        });

        if (!user) {
            return res.status(401).json({
                message: "Invalid credentials."
            });
        }

        // 3. Check password
        const isValid = await bcrypt.compare(
            password,
            user.password
        );

        if (!isValid) {
            return res.status(401).json({
                message: "Invalid credentials."
            });
        }

        // 4. Check email verification
        if (!user.isEmailVerified) {
            return res.status(403).json({
                message: "Please verify your email before logging in."
            });
        }

        // 5. Check suspension
        if (user.isSuspended) {
            return res.status(403).json({
                message: "Your account has been suspended. Please contact the administrator."
            });
        }

        // 6. Generate tokens
        return res.status(200).json({
            message: "Login successful.",
            data: {
                email: user.email,
                roles: user.roles,
                access_token: signAccessToken(user),
                refresh_token: signRefreshToken(user)
            }
        });

    } catch (error) {
        console.error("Login error:", error);

        return res.status(500).json({
            message: "Internal server error."
        });
    }
};


// ========================================
// GOOGLE LOGIN
// ========================================

export const loginGoogle = async (
    req: Request,
    res: Response
) => {
    try {
        const { credential } = req.body;

        // 1. Validate credential
        if (
            typeof credential !== "string" ||
            !credential.trim()
        ) {
            return res.status(400).json({
                message: "Google credential is required."
            });
        }

        if (!process.env.GOOGLE_CLIENT_ID) {
            return res.status(500).json({
                message: "Google Client ID is not configured."
            });
        }

        // 2. Verify Google ID token
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();

        if (
            !payload ||
            !payload.email ||
            !payload.email_verified
        ) {
            return res.status(401).json({
                message: "Invalid or unverified Google account."
            });
        }

        const email = payload.email.toLowerCase().trim();

        // 3. Find existing account
        let user = await UserModel.findOne({ email });

        console.log("Google account email:", email);
        console.log("Existing user found:", Boolean(user));
        console.log("Existing user roles:", user?.roles);
        console.log("UserRole enum:", UserRole);
        console.log("UserRole.USER:", UserRole.USER);

        // 4. Create account if it does not exist
        if (!user) {

            const settings = await Settings.findOne();

            if (settings?.registrationEnabled === false) {
                return res.status(403).json({
                    message: "New user registration is currently disabled."
                });
            }

            const randomPassword = crypto
                .randomBytes(32)
                .toString("hex");

            const hashedPassword = await bcrypt.hash(
                randomPassword,
                10
            );

            console.log("UserRole enum:", UserRole);
            console.log("UserRole.USER:", UserRole.USER);

            user = await UserModel.create({
                name: payload.name || email.split("@")[0],
                email,
                password: hashedPassword,
                roles: [UserRole.USER],
                isEmailVerified: true,
                otpAttempts: 0
            });
        }

        // 5. Check suspension before changing account
        if (user.isSuspended) {
            return res.status(403).json({
                message: "Your account has been suspended. Please contact the administrator."
            });
        }

        // 6. Verify an existing unverified account
        if (!user.isEmailVerified) {

            user.isEmailVerified = true;

            clearRegistrationOTP(user);

            await user.save();
        }

        // 7. Generate JWT tokens
        const access_token = signAccessToken(user);
        const refresh_token = signRefreshToken(user);

        return res.status(200).json({
            message: "Google login successful.",
            data: {
                email: user.email,
                roles: user.roles,
                access_token,
                refresh_token
            }
        });

    } catch (error) {
        console.error("Google login error:", error);

        return res.status(401).json({
            message: "Google authentication failed."
        });
    }
};


// ========================================
// GET MY DETAILS
// ========================================

export const getMyDetails = async (
    req: AuthRequest,
    res: Response
) => {
    if (!req.user?.sub) {
        return res.status(401).json({
            message: "Unauthorized."
        });
    }

    try {
        const user = await UserModel.findById(
            req.user.sub
        ).select("-password");

        if (!user) {
            return res.status(404).json({
                message: "User not found."
            });
        }

        if (user.isSuspended) {
            return res.status(403).json({
                message: "Your account has been suspended."
            });
        }

        return res.status(200).json({
            message: "User details retrieved successfully.",
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                roles: user.roles
            }
        });

    } catch (error) {
        console.error("Get my details error:", error);

        return res.status(500).json({
            message: "Internal server error."
        });
    }
};


// ========================================
// REFRESH ACCESS TOKEN
// ========================================

export const getRefreshToken = async (
    req: Request,
    res: Response
) => {
    try {
        const { refreshToken } = req.body;

        // 1. Validate refresh token
        if (
            typeof refreshToken !== "string" ||
            !refreshToken.trim()
        ) {
            return res.status(400).json({
                message: "Refresh token is required."
            });
        }

        // 2. Verify refresh token
        const payload = verifyRefreshToken(refreshToken);

        if (!payload?.sub) {
            return res.status(403).json({
                message: "Invalid refresh token."
            });
        }

        // 3. Find user
        const user = await UserModel.findById(
            payload.sub
        );

        if (!user) {
            return res.status(403).json({
                message: "Invalid refresh token."
            });
        }

        // 4. Check email verification
        if (!user.isEmailVerified) {
            return res.status(403).json({
                message: "Email verification is required."
            });
        }

        // 5. Check suspension
        if (user.isSuspended) {
            return res.status(403).json({
                message: "Your account has been suspended."
            });
        }

        // 6. Generate new access token
        return res.status(200).json({
            data: {
                accessToken: signAccessToken(user)
            }
        });

    } catch (error) {
        console.error("Refresh token error:", error);

        return res.status(403).json({
            message: "Invalid or expired refresh token."
        });
    }
};


// ========================================
// UPDATE USER PROFILE
// ========================================

export const updateProfile = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const userId = req.user?.sub;

        if (!userId) {
            return res.status(401).json({
                message: "Authentication required."
            });
        }

        const { name } = req.body;

        if (
            typeof name !== "string" ||
            !name.trim()
        ) {
            return res.status(400).json({
                message: "Username is required."
            });
        }

        const trimmedName = name.trim();

        if (trimmedName.length < 2 || trimmedName.length > 50) {
            return res.status(400).json({
                message: "Username must be between 2 and 50 characters."
            });
        }

        const user = await UserModel.findById(userId);

        if (!user) {
            return res.status(404).json({
                message: "User account not found."
            });
        }

        if (user.isSuspended) {
            return res.status(403).json({
                message: "Your account has been suspended."
            });
        }

        user.name = trimmedName;
        await user.save();

        return res.status(200).json({
            message: "Profile updated successfully.",
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                roles: user.roles
            }
        });

    } catch (error) {
        console.error("Update profile error:", error);

        return res.status(500).json({
            message: "Failed to update profile."
        });
    }
};


// ========================================
// CHANGE PASSWORD
// ========================================

export const changePassword = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const userId = req.user?.sub;

        if (!userId) {
            return res.status(401).json({
                message: "Authentication required."
            });
        }

        const { currentPassword, newPassword } = req.body;

        if (
            typeof currentPassword !== "string" ||
            typeof newPassword !== "string" ||
            !currentPassword ||
            !newPassword
        ) {
            return res.status(400).json({
                message: "Current password and new password are required."
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                message: "New password must contain at least 6 characters."
            });
        }

        const user = await UserModel.findById(userId);

        if (!user) {
            return res.status(404).json({
                message: "User account not found."
            });
        }

        if (user.isSuspended) {
            return res.status(403).json({
                message: "Your account has been suspended."
            });
        }

        // Verify current password
        const isCurrentMatch = await bcrypt.compare(
            currentPassword,
            user.password
        );

        if (!isCurrentMatch) {
            return res.status(400).json({
                message: "Current password is incorrect."
            });
        }

        // Prevent setting the exact same password
        const isSamePassword = await bcrypt.compare(
            newPassword,
            user.password
        );

        if (isSamePassword) {
            return res.status(400).json({
                message: "New password cannot be the same as your current password."
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        return res.status(200).json({
            message: "Password changed successfully."
        });

    } catch (error) {
        console.error("Change password error:", error);

        return res.status(500).json({
            message: "Failed to change password."
        });
    }
};
