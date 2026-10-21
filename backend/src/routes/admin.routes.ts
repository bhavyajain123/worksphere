
import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { authorizeRoles } from "../middleware/authorizeRoles";

const router = Router();

router.get(
  "/test",
  authenticateToken,
  authorizeRoles("admin"),
  (_req, res) => {
    res.status(200).json({
      success: true,
      message: "Admin access verified"
    });
  }
);

export default router;