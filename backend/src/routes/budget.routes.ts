
import { Router } from "express";
import {
  createBudget,
  listBudgets,
  getBudgetById,
  updateBudget,
  createExpense,
  listExpenses,
} from "../controllers/budget.controller";
import { authenticateToken } from "../middleware/auth";

const router = Router();

router.use(authenticateToken);

router.get("/", listBudgets);
router.post("/", createBudget);
router.get("/:id", getBudgetById);
router.patch("/:id", updateBudget);
router.post("/:id/expenses", createExpense);
router.get("/:id/expenses", listExpenses);

export default router;
