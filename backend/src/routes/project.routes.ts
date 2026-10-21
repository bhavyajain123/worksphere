
import { Router } from "express";
import {
  createProject,
  listProjects,
  getProject,
  updateProject,
  archiveProject
} from "../controllers/project.controller";
import { authenticateToken } from "../middleware/auth";
import { authorizeRoles } from "../middleware/authorizeRoles";

const router = Router();

router.use(authenticateToken);

router.post(
  "/",
  authorizeRoles("admin", "manager"),
  createProject
);

router.get("/", listProjects);
router.get("/:id", getProject);

router.patch(
  "/:id",
  updateProject
);

router.patch(
  "/:id/archive",
  archiveProject
);

export default router;
