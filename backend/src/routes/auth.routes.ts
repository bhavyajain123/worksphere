import { Router } from "express";
import { session } from "../controllers/auth.controller";
import { authenticateToken } from "../middleware/auth";

const router = Router();

router.get("/session", authenticateToken, session);

export default router;