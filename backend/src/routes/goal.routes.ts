import { Router } from "express";
import {
  createGoal,
  getGoals,
  getGoalById,
  updateGoal,
  deleteGoal,
} from "../controllers/goal.controller";
import { authenticateToken } from "../middleware/auth";

const router = Router();

router.use(authenticateToken);

router.get("/", getGoals);
router.post("/", createGoal);
router.get("/:id", getGoalById);
router.patch("/:id", updateGoal);
router.delete("/:id", deleteGoal);

export default router;