import { Router } from "express";
import {
  createTeam,
  listTeams,
  getTeam,
  updateTeam,
  addTeamMember,
  removeTeamMember,
} from "../controllers/team.controller";
import { authenticateToken } from "../middleware/auth";

const router = Router();

router.use(authenticateToken);

router.post("/", createTeam);
router.get("/", listTeams);
router.get("/:id", getTeam);
router.patch("/:id", updateTeam);
router.post("/:id/members", addTeamMember);
router.delete("/:id/members/:userId", removeTeamMember);

export default router;