import { IUser } from "../models/userModel"
import jwt, { JwtPayload } from "jsonwebtoken"
import "dotenv/config"

const JWT_SECRET = process.env.JWT_SECRET as string
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is missing from .env")
}

if (!JWT_REFRESH_SECRET) {
  throw new Error("JWT_REFRESH_SECRET is missing from .env")
}

export interface AuthPayload extends JwtPayload {
  sub: string
  roles?: string[]
}

export const signAccessToken = (user: IUser): string => {
  return jwt.sign({ sub: user._id.toString(), roles: user.roles }, JWT_SECRET, {
    expiresIn: "30m"
  })
}

export const signRefreshToken = (user: IUser): string => {
  return jwt.sign({ sub: user._id.toString() }, JWT_REFRESH_SECRET, {
    expiresIn: "7d"
  })
}

export const verifyAccessToken = (token: string): AuthPayload => {
  return jwt.verify(token, JWT_SECRET) as AuthPayload
}

export const verifyRefreshToken = (token: string): AuthPayload => {
  return jwt.verify(token, JWT_REFRESH_SECRET) as AuthPayload
}
