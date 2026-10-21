import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { authorizeRoles } from "../middleware/authorizeRoles";
import {
  createArticle,
  getArticles,
  getArticleById,
  updateArticle,
  deleteArticle,
} from "../controllers/article.controller";

const router = Router();

router.use(authenticateToken);

router.get("/", getArticles);
router.get("/:id", getArticleById);
router.post("/", authorizeRoles("admin", "manager"), createArticle);
router.patch("/:id", authorizeRoles("admin", "manager"), updateArticle);
router.delete("/:id", authorizeRoles("admin", "manager"), deleteArticle);

export default router;