
import { Router } from "express";
import {
  applyLeave,
  listLeaves,
  getLeave,
  reviewLeave,
  cancelLeave,
} from "../controllers/leave.controller";
import { authenticateToken } from "../middleware/auth";
import { authorizeRoles } from "../middleware/authorizeRoles";

const router = Router();

router.use(authenticateToken);

router.post("/", applyLeave);
router.get("/", listLeaves);
router.get("/:id", getLeave);

router.patch(
  "/:id/review",
  authorizeRoles("admin", "manager"),
  reviewLeave
);

router.patch("/:id/cancel", cancelLeave);

export default router;
