import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { authorizeRoles } from "../middleware/authorizeRoles";
import {
  createTemplate,
  getTemplates,
  getTemplateById,
  updateTemplate,
  deleteTemplate,
} from "../controllers/template.controller";

const router = Router();

router.use(authenticateToken);

router.get("/", getTemplates);
router.get("/:id", getTemplateById);
router.post("/", authorizeRoles("admin", "manager"), createTemplate);
router.patch("/:id", authorizeRoles("admin", "manager"), updateTemplate);
router.delete("/:id", authorizeRoles("admin", "manager"), deleteTemplate);

export default router;