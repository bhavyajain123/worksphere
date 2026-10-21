import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { getMyProfile, updateMyProfile } from "../controllers/user.controller";

const router = Router();

router.get("/me", authenticateToken, getMyProfile);
router.patch("/me", authenticateToken, updateMyProfile);

export default router;