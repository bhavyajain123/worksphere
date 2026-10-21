import type { Response, NextFunction } from "express";
import User, { type UserRole } from "../models/User";
import type { AuthRequest } from "./auth";

export function authorizeRoles(...allowedRoles: UserRole[]) {
      return async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          message: "Authentication required"
        });
        return;
      }
       const user = await User.findById(req.user.id)
        .select("role isActive");

      if (!user || !user.isActive) {
        res.status(401).json({
          success: false,
          message: "User account is unavailable"
        });
        return;
      }
        req.user.role = user.role;

      if (!allowedRoles.includes(user.role)) {
        res.status(403).json({
          success: false,
          message: "You do not have permission to access this resource"
        });
        return;
      }

      next();
    } catch (error: unknown) {
      console.error("Role authorization failed:", error);

      res.status(500).json({
        success: false,
        message: "Unable to verify permissions"
      });
    }
  };
}
