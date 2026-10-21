import type { Request, Response, NextFunction } from "express";
import { adminAuth } from "../config/firebase";
import User from "../models/User";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: "admin" | "manager" | "employee";
  };
}

export async function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      message: "Authentication token required",
    });
    return;
  }

  const token = authorization.slice(7);

  let decoded;
  try {
        decoded = await adminAuth.verifyIdToken(token);
  } catch {
    res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token",
    });
    return;
  }

  if (!decoded.email || decoded.email_verified !== true) {
    res.status(403).json({
      success: false,
      message: "Please verify your email before using WorkSphere",
    });
    return;
  }
  try {
    const email = decoded.email.toLowerCase();
    let user = await User.findOne({ firebaseUid: decoded.uid });

    if (!user) {
      user = await User.findOne({ email });

      if (user) {
        if (user.firebaseUid && user.firebaseUid !== decoded.uid) {
          res.status(403).json({
            success: false,
            message: "This email is linked to a different account",
          });
          return;
        }
        user.firebaseUid = decoded.uid;
        await user.save();
      } else {
        const rawName = typeof decoded.name === "string" ? decoded.name.trim() : "";
        const fallback = email.split("@")[0].padEnd(2, "_");
        const name = (rawName.length >= 2 ? rawName : fallback).slice(0, 80);

        try {
          user = await User.create({
            name,
            email,
            firebaseUid: decoded.uid,
            role: "employee",
          });
        } catch (error: unknown) {
          if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            (error as { code?: number }).code === 11000
          ) {
            user = await User.findOne({
              $or: [{ firebaseUid: decoded.uid }, { email }],
            });
          } else {
            throw error;
          }
        }

      }
    }
    if (!user || !user.isActive) {
      res.status(403).json({
        success: false,
        message: "Account is inactive or not found",
      });
      return;
    }

    req.user = {
      id: user._id.toString(),
      role: user.role,
    };

    next();
  } catch (error) {
    console.error("Authentication failed:", error);
    res.status(500).json({
      success: false,
      message: "Unable to authenticate",
    });
  }

}