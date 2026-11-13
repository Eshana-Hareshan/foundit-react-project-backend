import { Request, Response } from "express"
import { UserModel } from "../models/userModel"
import bcrypt from "bcryptjs"
import {signAccessToken,signRefreshToken,verifyRefreshToken} from "../util/jwt"
import { AuthRequest } from "../middleware/auth"
import { OAuth2Client } from "google-auth-library"
import crypto from "crypto"

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body
    const extUser = await UserModel.findOne({ email })

    if (extUser) {
      return res.status(400).json({ message: "User already exists" })
    }

    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    await UserModel.create({
      name,
      email,
      password: hashedPassword,
    //   approve: true
    })

    res.status(201).json({ message: "User registered successfully" })
  } catch (err) {
    res.status(500).json({ message: "Registration failed" })
  }
}

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ message: "Missing credentials" })
  }

  try {
    const user = await UserModel.findOne({ email })
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" })
    }

    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      return res.status(401).json({ message: "Invalid credentials" })
    }

    res.status(200).json({
      message: "OK",
      data: {
        email: user.email,
        roles: user.roles,
        access_token: signAccessToken(user),
        refresh_token: signRefreshToken(user)
      }
    })
  } catch (err) {
    res.status(500).json({ message: "Internal server error" })
  }
}

// Google OAuth client 
const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID
)


export const loginGoogle = async (req: Request, res: Response) => {
  try {
    const { credential } = req.body

    if (!credential) {
      return res.status(400).json({
        message: "Google credential is required"
      })
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({
        message: "Google Client ID is not configured"
      })
    }

    // 1. Verify Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    })

    const payload = ticket.getPayload()

    if (!payload || !payload.email || !payload.email_verified) {
      return res.status(401).json({
        message: "Invalid Google account"
      })
    }

    const email = payload.email.toLowerCase()

    // 2. Check whether this user already exists
    let user = await UserModel.findOne({ email })

    // 3. Create a new user if one does not exist
    if (!user) {
      const randomPassword = crypto.randomBytes(32).toString("hex")
      const hashedPassword = await bcrypt.hash(randomPassword, 10)

      user = await UserModel.create({
        name: payload.name || email.split("@")[0],
        email,
        password: hashedPassword
      })
    }

    // 4. Generate your application's JWT tokens
    const access_token = signAccessToken(user)
    const refresh_token = signRefreshToken(user)

    // 5. Return the same response structure as normal login
    return res.status(200).json({
      message: "Google login successful",
      data: {
        email: user.email,
        roles: user.roles,
        access_token,
        refresh_token
      }
    })

  } catch (err) {
    console.error("Google login error:", err)

    return res.status(401).json({
      message: "Google authentication failed"
    })
  }
}


export const getMyDetails = async (req: AuthRequest, res: Response) => {
  if (!req.user?.sub) return res.status(401).json({ message: "Unauthorized" })

  try {
    const user = await UserModel.findById(req.user.sub).select("-password")
    if (!user) return res.status(404).json({ message: "User not found" })

    res.status(200).json({
      message: "ok",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        roles: user.roles
      }
    })
  } catch (err) {
    res.status(500).json({ message: "Internal server error" })
  }
}

export const getRefreshToken = async (req: Request, res: Response) => {
  const { refreshToken } = req.body
  if (!refreshToken) return res.status(400).json({ message: "Token required" })

  try {
    const payload = verifyRefreshToken(refreshToken)
    const user = await UserModel.findById(payload.sub)

    if (!user) return res.status(403).json({ message: "Invalid token" })

    res.status(200).json({ data: { accessToken: signAccessToken(user) } })
  } catch (err) {
    res.status(403).json({ message: "Invalid or expired token" })
  }
}
