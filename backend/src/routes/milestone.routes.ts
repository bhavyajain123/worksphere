import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { listMilestones, createMilestone, updateMilestone, deleteMilestone } from "../controllers/milestone.controller";

const router = Router();

router.get("/", authenticateToken, listMilestones);
router.post("/", authenticateToken, createMilestone);
router.patch("/:id", authenticateToken, updateMilestone);
router.delete("/:id", authenticateToken, deleteMilestone);

export default router;