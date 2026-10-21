import { Router } from "express";
import { createTask,  listTasks, getTask, updateTask,deleteTask} from "../controllers/task.controller";
import { authenticateToken } from "../middleware/auth";
import { authorizeRoles } from "../middleware/authorizeRoles";

const router = Router();
router.use(authenticateToken);

router.post("/", authorizeRoles("admin", "manager"), createTask);
router.get("/", listTasks);
router.get("/:id", getTask);
router.patch("/:id", updateTask);
router.delete("/:id", deleteTask);

export default router;