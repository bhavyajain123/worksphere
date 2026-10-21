import { Router } from "express";
import {
  uploadProjectFile,
  listProjectFiles,
  getProjectFile,
  downloadProjectFile,
  updateProjectFile,
  deleteProjectFile,
} from "../controllers/files.controller";
import { authenticateToken } from "../middleware/auth";
import upload from "../middleware/upload";

const router = Router();
router.use(authenticateToken);
router.post("/upload", upload.single("file"), uploadProjectFile);
router.get("/", listProjectFiles);
router.get("/:fileId", getProjectFile);
router.get("/:fileId/download", downloadProjectFile);
router.patch("/:fileId", updateProjectFile);
router.delete("/:fileId", deleteProjectFile);

export default router;