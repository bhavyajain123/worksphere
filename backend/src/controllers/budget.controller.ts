import type { Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import Budget from "../models/Budget";
import Expense from "../models/Expense";
import Project from "../models/Project";
import type { AuthRequest } from "../middleware/auth";

const createBudgetSchema = z.object({
  project: z.string().regex(/^[a-f\d]{24}$/i, "Invalid project ID"),
  allocatedAmount: z.number().finite().positive(),
  currency: z.string().trim().length(3).default("INR"),
});

const updateBudgetSchema = z.object({
  allocatedAmount: z.number().finite().positive().optional(),
  currency: z.string().trim().length(3).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "Provide at least one field to update",
});

function validId(id: string): boolean {
  return mongoose.isValidObjectId(id);
}

async function canManageProject(
  projectId: string,
  userId: string,
  role?: string
): Promise<boolean> {
  if (role === "admin") return true;

  const project = await Project.findById(projectId)
    .select("owner members");

  if (!project) return false;

 
  if (project.owner.toString() === userId) {
    return true;
  }

  
  if (role === "manager") {
    const isMember = project.members.some(
      (memberId) => memberId.toString() === userId
    );

    return isMember;
  }

  return false;
}

export async function createBudget(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const parsed = createBudgetSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid budget data",
      errors: parsed.error.issues,
    });
    return;
  }

  try {
    const { project: projectId, allocatedAmount, currency } = parsed.data;
    const userId = req.user!.id;

    const project = await Project.findById(projectId);

    if (!project) {
      res.status(404).json({
        success: false,
        message: "Project not found",
      });
      return;
    }

    if (
      !(await canManageProject(projectId, userId, req.user!.role))
    ) {
      res.status(403).json({
        success: false,
        message: "Only the project owner or admin can create its budget",
      });
      return;
    }

    const existing = await Budget.findOne({ project: projectId });

    if (existing) {
      res.status(409).json({
        success: false,
        message: "A budget already exists for this project",
      });
      return;
    }

    const budget = await Budget.create({
      project: projectId,
      allocatedAmount,
      currency: currency.toUpperCase(),
      createdBy: userId,
    });

    res.status(201).json({
      success: true,
      message: "Budget created successfully",
      budget,
    });
  } catch (error: unknown) {
    console.error("Create budget failed:", error);
    res.status(500).json({
      success: false,
      message: "Unable to create budget",
    });
  }
}
export async function listBudgets(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const filter = req.user!.role === "admin"
      ? {}
      : {
          project: {
            $in: await Project.find({
              members: new mongoose.Types.ObjectId(req.user!.id),
            }).distinct("_id"),
          },
        };

    const budgets = await Budget.find(filter)
      .populate("project", "name owner")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: budgets.length,
      budgets,
    });
  } catch (error: unknown) {
    console.error("List budgets failed:", error);
    res.status(500).json({
      success: false,
      message: "Unable to fetch budgets",
    });
  }
}

export async function getBudgetById(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const { id } = req.params;

  if (typeof id !== "string" || !validId(id)) {
    res.status(400).json({
      success: false,
      message: "Invalid budget ID",
    });
    return;
  }

  try {
    const budget = await Budget.findById(id)
      .populate("project", "name owner members")
      .populate("createdBy", "name email");

    if (!budget) {
      res.status(404).json({
        success: false,
        message: "Budget not found",
      });
      return;
    }

 const projectId =
  budget.project instanceof mongoose.Types.ObjectId
    ? budget.project
    : (budget.project as unknown as { _id: mongoose.Types.ObjectId })._id;

const project = await Project.findById(projectId).select("owner members");

const userId = req.user!.id;

const canView =
  req.user!.role === "admin" ||
  Boolean(
    project &&
      (
        project.owner.toString() === userId ||
        project.members.some(
          (memberId) => memberId.toString() === userId
        )
      )
  );

if (!canView) {
  res.status(403).json({
    success: false,
    message: "You do not have access to this budget",
  });
  return;
}

    const expenseResult = await Expense.aggregate([
      { $match: { budget: budget._id } },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: "$amount" },
        },
      },
    ]);

    const totalSpent = expenseResult[0]?.totalSpent ?? 0;

    res.status(200).json({
      success: true,
      budget,
      summary: {
        allocatedAmount: budget.allocatedAmount,
        totalSpent,
        remainingAmount: budget.allocatedAmount - totalSpent,
        currency: budget.currency,
      },
    });
  } catch (error: unknown) {
    console.error("Get budget failed:", error);
    res.status(500).json({
      success: false,
      message: "Unable to fetch budget",
    });
  }
}

export async function updateBudget(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const { id } = req.params;
  const parsed = updateBudgetSchema.safeParse(req.body);

  if (typeof id !== "string" || !validId(id)) {
    res.status(400).json({
      success: false,
      message: "Invalid budget ID",
    });
    return;
  }

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid budget update",
      errors: parsed.error.issues,
    });
    return;
  }
try {
    const budget = await Budget.findById(id);

    if (!budget) {
      res.status(404).json({
        success: false,
        message: "Budget not found",
      });
      return;
    }

    if (
      !(await canManageProject(
        budget.project.toString(),
        req.user!.id,
        req.user!.role
      ))
    ) {
      res.status(403).json({
        success: false,
        message: "Only the project owner or admin can update its budget",
      });
      return;
    }

    if (parsed.data.allocatedAmount !== undefined) {
      const expenseResult = await Expense.aggregate([
        { $match: { budget: budget._id } },
        {
          $group: {
            _id: null,
            totalSpent: { $sum: "$amount" },
          },
        },
      ]);

      const totalSpent = expenseResult[0]?.totalSpent ?? 0;

      if (parsed.data.allocatedAmount < totalSpent) {
        res.status(400).json({
          success: false,
          message: "Budget cannot be lower than total expenses",
        });
        return;
      }
    }

    if (parsed.data.allocatedAmount !== undefined) {
      budget.allocatedAmount = parsed.data.allocatedAmount;
    }

    if (parsed.data.currency !== undefined) {
      budget.currency = parsed.data.currency.toUpperCase();
    }

    await budget.save();

    res.status(200).json({
      success: true,
      message: "Budget updated successfully",
      budget,
    });
  } catch (error: unknown) {
    console.error("Update budget failed:", error);
    res.status(500).json({
      success: false,
      message: "Unable to update budget",
    });
  }
}


export async function createExpense(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const { id } = req.params;

  if (typeof id !== "string" || !validId(id)) {
    res.status(400).json({
      success: false,
      message: "Invalid budget ID",
    });
    return;
  }

  const parsed = z.object({
    description: z.string().trim().min(3).max(500),
    amount: z.number().positive(),
    category: z.string().trim().min(1).max(100),
    expenseDate: z.coerce.date().optional(),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid expense data",
      errors: parsed.error.issues,
    });
    return;
  }

  try {
    const budget = await Budget.findById(id);

    if (!budget) {
      res.status(404).json({
        success: false,
        message: "Budget not found",
      });
      return;
    }

    if (
      !(await canManageProject(
        budget.project.toString(),
        req.user!.id,
        req.user!.role
      ))
    ) {
      res.status(403).json({
        success: false,
        message: "You cannot record expenses for this project",
      });
      return;
    }

    const expense = await Expense.create({
      budget: budget._id,
      project: budget.project,
      description: parsed.data.description,
      amount: parsed.data.amount,
      category: parsed.data.category,
      expenseDate: parsed.data.expenseDate ?? new Date(),
      recordedBy: req.user!.id,
    });

    res.status(201).json({
      success: true,
      message: "Expense recorded successfully",
      expense,
    });
  } catch (error: unknown) {
    console.error("Create expense failed:", error);
    res.status(500).json({
      success: false,
      message: "Unable to record expense",
    });
  }
}

export async function listExpenses(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const { id } = req.params;

  if (typeof id !== "string" || !validId(id)) {
    res.status(400).json({
      success: false,
      message: "Invalid budget ID",
    });
    return;
  }

  try {
    const budget = await Budget.findById(id);

    if (!budget) {
      res.status(404).json({
        success: false,
        message: "Budget not found",
      });
      return;
    }

    const project = await Project.findById(budget.project)
      .select("owner members");

    const userId = req.user!.id;
    const canView =
      req.user!.role === "admin" ||
      Boolean(
        project &&
          (
            project.owner.toString() === userId ||
            project.members.some(
              (memberId) => memberId.toString() === userId
            )
          )
      );

    if (!canView) {
      res.status(403).json({
        success: false,
        message: "You do not have access to these expenses",
      });
      return;
    }

    const expenses = await Expense.find({ budget: budget._id })
      .populate("recordedBy", "name email")
      .sort({ expenseDate: -1 });

    const totalSpent = expenses.reduce(
      (total, expense) => total + expense.amount,
      0
    );

    res.status(200).json({
      success: true,
      count: expenses.length,
      expenses,
      summary: {
        allocatedAmount: budget.allocatedAmount,
        totalSpent,
        remainingAmount: budget.allocatedAmount - totalSpent,
        currency: budget.currency,
      },
    });
  } catch (error: unknown) {
    console.error("List expenses failed:", error);
    res.status(500).json({
      success: false,
      message: "Unable to fetch expenses",
    });
  }
}
