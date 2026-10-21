import { Router } from "express";
import {
  createTimesheet,
  getMyTimesheets,
  getAllTimesheets,
  updateTimesheet,
  submitTimesheet,
  reviewTimesheet,
} from "../controllers/timesheet.controller";
import { authenticateToken } from "../middleware/auth";
import { authorizeRoles } from "../middleware/authorizeRoles";

const router = Router();

router.use(authenticateToken);

router.post("/", createTimesheet);
router.get("/my", getMyTimesheets);
router.patch("/:id", updateTimesheet);
router.patch("/:id/submit", submitTimesheet);

router.get(
  "/",
  authorizeRoles("admin", "manager"),
  getAllTimesheets
);

router.patch(
  "/:id/review",
  authorizeRoles("admin", "manager"),
  reviewTimesheet
);

export default router;