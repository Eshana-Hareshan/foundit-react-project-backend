
import { IUser } from "../models/userModel";
import jwt, { JwtPayload } from "jsonwebtoken";
import "dotenv/config";

// Separate secrets for access and refresh tokens
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

// Validate environment variables
if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is missing from .env");
}

if (!JWT_REFRESH_SECRET) {
    throw new Error("JWT_REFRESH_SECRET is missing from .env");
}

// JWT payload structure
export interface AuthPayload extends JwtPayload {
    sub: string;
    roles?: string[];
}

// Generate access token
export const signAccessToken = (user: IUser): string => {
    return jwt.sign(
        {
            sub: user._id.toString(),
            roles: user.roles
        },
        JWT_SECRET,
        {
            expiresIn: "30m"
        }
    );
};

// Generate refresh token
export const signRefreshToken = (user: IUser): string => {
    return jwt.sign(
        {
            sub: user._id.toString()
        },
        JWT_REFRESH_SECRET,
        {
            expiresIn: "7d"
        }
    );
};

// Verify access token
export const verifyAccessToken = (token: string): AuthPayload => {
    return jwt.verify(
        token,
        JWT_SECRET
    ) as AuthPayload;
};

// Verify refresh token
export const verifyRefreshToken = (token: string): AuthPayload => {
    return jwt.verify(
        token,
        JWT_REFRESH_SECRET
    ) as AuthPayload;
};
