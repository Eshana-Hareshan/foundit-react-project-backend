
import {
    NextFunction,
    Response,
    Request
} from "express";

import { UserModel } from "../models/userModel";
import { verifyAccessToken, AuthPayload } from "../util/jwt";

// Authenticated user information attached to each request
export interface AuthenticatedUser extends AuthPayload {
    roles: string[];
}

// Extend Express Request
export interface AuthRequest extends Request {
    user?: AuthenticatedUser;
}

// Authentication middleware
export const authenticate = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        // 1. Get the Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                message: "Authentication token not found."
            });
        }

        // 2. Extract the access token
        const token = authHeader.substring(7).trim();

        if (!token) {
            return res.status(401).json({
                message: "Authentication token not found."
            });
        }

        // 3. Verify the access token
        let payload: AuthPayload;

        try {
            payload = verifyAccessToken(token);
        } catch {
            return res.status(401).json({
                message: "Invalid or expired access token."
            });
        }

        // 4. Check the token payload
        if (!payload.sub || typeof payload.sub !== "string") {
            return res.status(401).json({
                message: "Invalid token payload."
            });
        }

        // 5. Find the current user in MongoDB
        const user = await UserModel.findById(payload.sub);

        if (!user) {
            return res.status(401).json({
                message: "User account not found."
            });
        }

        // 6. Reject suspended accounts
        if (user.isSuspended) {
            return res.status(403).json({
                message: "Your account has been suspended."
            });
        }

        // 7. Attach current user information to the request
        req.user = {
            ...payload,
            sub: user._id.toString(),
            roles: user.roles
        };

        // 8. Continue to the next middleware or controller
        next();

    } catch (error) {
        console.error("Authentication middleware error:", error);

        return res.status(500).json({
            message: "Authentication service error."
        });
    }
};

// Admin authorization middleware
export const requireAdmin = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    // 1. Check authentication
    if (!req.user) {
        return res.status(401).json({
            message: "Authentication required."
        });
    }

    // 2. Check admin role
    if (!req.user.roles.includes("ADMIN")) {
        return res.status(403).json({
            message: "Access denied. Admin privileges required."
        });
    }

    // 3. Allow admin access
    next();
};
