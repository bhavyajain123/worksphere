import { Router } from "express";
import {
  createWorkspace,
  listWorkspaces,
  getWorkspace,
  updateWorkspace,
  deleteWorkspace,
  addWorkspaceMember,
  removeWorkspaceMember,
  listWorkspaceProjects,
  listWorkspaceTeams,
} from "../controllers/workspace.controller";
import { authenticateToken } from "../middleware/auth";
import { authorizeRoles } from "../middleware/authorizeRoles";

const router = Router();

router.use(authenticateToken);

router.post("/", authorizeRoles("admin", "manager"), createWorkspace);
router.get("/", listWorkspaces);
router.get("/:id/projects", listWorkspaceProjects);
router.get("/:id/teams", listWorkspaceTeams);
router.get("/:id", getWorkspace);
router.patch("/:id", updateWorkspace);
router.delete("/:id", deleteWorkspace);
router.post("/:id/members", addWorkspaceMember);
router.delete("/:id/members/:userId", removeWorkspaceMember);

export default router;