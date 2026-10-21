import type { Response } from "express";
import User from "../models/User";
import type { AuthRequest } from "../middleware/auth";


export async function getMyProfile(
    req:AuthRequest,
    res:Response
):Promise<void>{
    try{
        const user = await User.findById(req.user?.id).select(
            "name email role isActive createdAt updatedAt"
        );
        if(!user || !user.isActive){
            res.status(400).json({
                success:false,
                message:"User not found or inactive"
            });
            return;
        }
        res.status(200).json({
            success:true,
            user
        });
    }catch(error:unknown){
        console.error("profile fetch failed" , error);
        res.status(500).json({
            success:false,
            message:"unable to fetch profile"
        });
    }
}

export async function updateMyProfile(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";

    if (name.length < 2 || name.length > 80) {
      res.status(400).json({
        success: false,
        message: "Name must be between 2 and 80 characters"
      });
      return;
    }

    const user = await User.findOneAndUpdate(
      { _id: req.user?.id, isActive: true },
      { name },
      { new: true, runValidators: true }
    ).select("name email role isActive createdAt updatedAt");

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found or inactive"
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user
    });
  } catch (error: unknown) {
    console.error("profile update failed", error);
    res.status(500).json({
      success: false,
      message: "Unable to update profile"
    });
  }
}