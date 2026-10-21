import type { Response } from "express";
import User from "../models/User";
import type { AuthRequest } from "../middleware/auth";

export async function session(req: AuthRequest, res: Response): Promise<void> {
  try {
    const user = await User.findById(req.user!.id);

    if (!user || !user.isActive) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Session failed:", error);
    res.status(500).json({ success: false, message: "Unable to load session" });
  }
}