import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { generateReport } from "../controllers/ai.controller";
import { generateTasks, createAiTasks, getProjectMembers } from "../controllers/aiTasks.controller";
import { askWorkSphere } from "../controllers/aiAsk.controller";
import { planMyDay } from "../controllers/aiMyDay.controller";
import { summarizeChat } from "../controllers/aiSummary.controller";

const router = Router();

router.post("/report", authenticateToken, generateReport);
router.post("/tasks/generate", authenticateToken, generateTasks);
router.post("/tasks/create", authenticateToken, createAiTasks);
router.get("/project-members/:projectId", authenticateToken, getProjectMembers);
router.post("/ask", authenticateToken, askWorkSphere);
router.post("/my-day", authenticateToken, planMyDay);
router.post("/summarize-chat", authenticateToken, summarizeChat);

export default router;