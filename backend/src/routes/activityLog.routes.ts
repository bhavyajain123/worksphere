
import { Router } from "express";
import {
  listActivityLogs,
  getActivityLogById,
} from "../controllers/activityLog.controller";
import { authenticateToken } from "../middleware/auth";
import { authorizeRoles } from "../middleware/authorizeRoles";

const router = Router();

router.use(authenticateToken, authorizeRoles("admin"));

router.get("/", listActivityLogs);
router.get("/:id", getActivityLogById);

export default router;
