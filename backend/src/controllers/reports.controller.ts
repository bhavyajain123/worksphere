
import type { Response } from "express";
import mongoose from "mongoose";
import type { AuthRequest } from "../middleware/auth";
import Project from "../models/Project";
import Task from "../models/Task";
import Timesheet from "../models/Timesheet";
import Budget from "../models/Budget";
import Expense from "../models/Expense";
import Leave from "../models/Leave";
import User from "../models/User";
import Report from "../models/Report.js";



function parseDateRange(
  query: Record<string, unknown>
): { startDate?: Date; endDate?: Date; error?: string } {
  const { startDate, endDate } = query;

  if (startDate === undefined && endDate === undefined) {
    return {};
  }

  if (
    (startDate !== undefined && typeof startDate !== "string") ||
    (endDate !== undefined && typeof endDate !== "string")
  ) {
    return { error: "Dates must be strings in YYYY-MM-DD format" };
  }

  const isValidDate = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;

  if (
    (typeof startDate === "string" && !isValidDate(startDate)) ||
    (typeof endDate === "string" && !isValidDate(endDate))
  ) {
    return { error: "Invalid date. Use YYYY-MM-DD format." };
  }

  const start = typeof startDate === "string"
    ? new Date(`${startDate}T00:00:00.000Z`)
    : undefined;

  const end = typeof endDate === "string"
    ? new Date(`${endDate}T23:59:59.999Z`)
    : undefined;

  if (start && end && start > end) {
    return { error: "startDate must be before or equal to endDate" };
  }

  return { startDate: start, endDate: end };
}



export async function getOverview(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const { startDate, endDate } = req.query;

    const isValidDate = (value: unknown): value is string =>
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) &&
      new Date(`${value}T00:00:00.000Z`)
        .toISOString()
        .slice(0, 10) === value;

    if (
      (startDate !== undefined && !isValidDate(startDate)) ||
      (endDate !== undefined && !isValidDate(endDate))
    ) {
      res.status(400).json({
        success: false,
        message: "Dates must be valid YYYY-MM-DD values",
      });
      return;
    }

    const start = isValidDate(startDate)
      ? new Date(`${startDate}T00:00:00.000Z`)
      : undefined;

    const end = isValidDate(endDate)
      ? new Date(`${endDate}T23:59:59.999Z`)
      : undefined;

    if (start && end && start > end) {
      res.status(400).json({
        success: false,
        message: "startDate must be before or equal to endDate",
      });
      return;
    }

    const userId = new mongoose.Types.ObjectId(req.user.id);
    const role = req.user.role;

    const dateRange: Record<string, Date> = {};
    if (start) dateRange.$gte = start;
    if (end) dateRange.$lte = end;

    let projectFilter: Record<string, unknown> = {};
    let taskFilter: Record<string, unknown> = {};
    let timesheetFilter: Record<string, unknown> = {};

    if (role === "manager") {
      projectFilter = {
        $or: [{ owner: userId }, { members: userId }],
      };

      const accessibleProjects = await Project.find(projectFilter)
        .select("_id")
        .lean();

      const projectIds = accessibleProjects.map((p) => p._id);

      taskFilter = { project: { $in: projectIds } };
      timesheetFilter = { project: { $in: projectIds } };
    } else if (role === "employee") {
      taskFilter = { assignedTo: userId };
      timesheetFilter = { employee: userId };

      const assignedTasks = await Task.find(taskFilter)
        .select("project")
        .lean();

      const projectIds = [
        ...new Map(
          assignedTasks.map((task) => [
            String(task.project),
            task.project,
          ])
        ).values(),
      ];

      projectFilter = { _id: { $in: projectIds } };
    }

    // Project creation date, task creation date, and timesheet work date
    // represent different reporting dimensions.
    if (start || end) {
      projectFilter.createdAt = dateRange;
      taskFilter.createdAt = dateRange;
      timesheetFilter.workDate = dateRange;
    }

    const [projects, tasks, timesheets] = await Promise.all([
      Project.find(projectFilter).select("status").lean(),
      Task.find(taskFilter)
        .select("status dueDate priority project assignedTo")
        .lean(),
      Timesheet.find(timesheetFilter)
        .select("hours status workDate")
        .lean(),
    ]);

    const now = new Date();

    const countBy = <T,>(
      items: T[],
      getKey: (item: T) => string
    ): Record<string, number> => {
      const result: Record<string, number> = {};
      for (const item of items) {
        const key = getKey(item);
        result[key] = (result[key] ?? 0) + 1;
      }
      return result;
    };

    const projectStatuses = countBy(projects, (p) => p.status);
    const taskStatuses = countBy(tasks, (t) => t.status);

    const overdueTasks = tasks.filter(
      (task) =>
        task.status !== "done" &&
        task.dueDate != null &&
        new Date(task.dueDate) < now
    ).length;

    const completedTasks = tasks.filter(
      (task) => task.status === "done"
    ).length;

    const approvedTimesheets = timesheets.filter(
      (item) => item.status === "approved"
    );

    const loggedHours = approvedTimesheets.reduce(
      (total, item) => total + item.hours,
      0
    );

    res.status(200).json({
      success: true,
      data: {
        scope: role,
        filters: {
          startDate: start?.toISOString() ?? null,
          endDate: end?.toISOString() ?? null,
        },
        projects: {
          total: projects.length,
          byStatus: projectStatuses,
        },
        tasks: {
          total: tasks.length,
          completed: completedTasks,
          overdue: overdueTasks,
          completionRate:
            tasks.length === 0
              ? 0
              : Number(
                  ((completedTasks / tasks.length) * 100).toFixed(2)
                ),
          byStatus: taskStatuses,
        },
        timesheets: {
          total: timesheets.length,
          approved: approvedTimesheets.length,
          loggedHours,
        },
        generatedAt: now.toISOString(),
      },
    });
  } catch (error) {
    console.error("Reports overview error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate overview report",
    });
  }
}


export async function getProjectAnalytics(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const { projectId } = req.params;

    if (!mongoose.isValidObjectId(projectId)) {
      res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
      return;
    }

    const userId = new mongoose.Types.ObjectId(req.user.id);
    const role = req.user.role;

    const project = await Project.findById(projectId)
      .select("name status owner members startDate deadline")
      .lean();

    if (!project) {
      res.status(404).json({
        success: false,
        message: "Project not found",
      });
      return;
    }

   
    const isProjectOwner = String(project.owner) === String(userId);
    const isProjectMember = project.members.some(
      (member) => String(member) === String(userId)
    );

    let canAccess = role === "admin" || isProjectOwner || isProjectMember;

    if (role === "employee" && !canAccess) {
      canAccess = await Task.exists({
        project: project._id,
        assignedTo: userId,
      }).then(Boolean);
    }

    if (!canAccess) {
      res.status(403).json({
        success: false,
        message: "You do not have access to this project report",
      });
      return;
    }

    const [tasks, timesheets] = await Promise.all([
      Task.find({ project: project._id })
        .select("status priority dueDate")
        .lean(),

      Timesheet.find({ project: project._id })
        .select("employee hours status")
        .lean(),
    ]);

    const now = new Date();

    const countBy = <T,>(
      items: T[],
      getKey: (item: T) => string
    ): Record<string, number> => {
      const result: Record<string, number> = {};

      for (const item of items) {
        const key = getKey(item);
        result[key] = (result[key] ?? 0) + 1;
      }

      return result;
    };

    const completedTasks = tasks.filter(
      (task) => task.status === "done"
    ).length;

    const overdueTasks = tasks.filter(
      (task) =>
        task.status !== "done" &&
        task.dueDate != null &&
        new Date(task.dueDate) < now
    ).length;

    const approvedTimesheets = timesheets.filter(
      (timesheet) => timesheet.status === "approved"
    );

    const approvedHours = approvedTimesheets.reduce(
      (total, timesheet) => total + timesheet.hours,
      0
    );

    const totalLoggedHours = timesheets.reduce(
      (total, timesheet) => total + timesheet.hours,
      0
    );

    res.status(200).json({
      success: true,
      data: {
        project: {
          id: String(project._id),
          name: project.name,
          status: project.status,
          startDate: project.startDate ?? null,
          deadline: project.deadline ?? null,
        },
        tasks: {
          total: tasks.length,
          completed: completedTasks,
          pending: tasks.length - completedTasks,
          overdue: overdueTasks,
          completionRate:
            tasks.length === 0
              ? 0
              : Number(
                  ((completedTasks / tasks.length) * 100).toFixed(2)
                ),
          byStatus: countBy(tasks, (task) => task.status),
          byPriority: countBy(tasks, (task) => task.priority),
        },
        timesheets: {
          total: timesheets.length,
          approved: approvedTimesheets.length,
          totalLoggedHours,
          approvedHours,
        },
        generatedAt: now.toISOString(),
      },
    });
  } catch (error) {
    console.error("Project analytics error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to generate project analytics",
    });
  }
}


export async function getProjectFinancials(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const { projectId } = req.params;

    if (!mongoose.isValidObjectId(projectId)) {
      res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
      return;
    }
    
const { startDate, endDate } = req.query;

const isValidDate = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) &&
  new Date(`${value}T00:00:00.000Z`)
    .toISOString()
    .slice(0, 10) === value;

if (
  (startDate !== undefined && !isValidDate(startDate)) ||
  (endDate !== undefined && !isValidDate(endDate))
) {
  res.status(400).json({
    success: false,
    message: "Dates must be valid YYYY-MM-DD values",
  });
  return;
}

const start = isValidDate(startDate)
  ? new Date(`${startDate}T00:00:00.000Z`)
  : undefined;

const end = isValidDate(endDate)
  ? new Date(`${endDate}T23:59:59.999Z`)
  : undefined;

if (start && end && start > end) {
  res.status(400).json({
    success: false,
    message: "startDate must be before or equal to endDate",
  });
  return;
}


    const userId = new mongoose.Types.ObjectId(req.user.id);
    const role = req.user.role;

    const project = await Project.findById(projectId)
      .select("name owner members")
      .lean();

    if (!project) {
      res.status(404).json({
        success: false,
        message: "Project not found",
      });
      return;
    }

    const isOwner = String(project.owner) === String(userId);
    const isMember = project.members.some(
      (member) => String(member) === String(userId)
    );

    let canAccess = role === "admin" || isOwner || isMember;

    // Employees may also access reports for projects where
    // they have an assigned task.
    if (role === "employee" && !canAccess) {
      canAccess = Boolean(
        await Task.exists({
          project: project._id,
          assignedTo: userId,
        })
      );
    }

    if (!canAccess) {
      res.status(403).json({
        success: false,
        message: "You do not have access to this project report",
      });
      return;
    }

    const budget = await Budget.findOne({
      project: project._id,
    }).lean();

    if (!budget) {
      res.status(404).json({
        success: false,
        message: "No budget found for this project",
      });
      return;
    }

    
const baseExpenseFilter = {
  project: project._id,
  budget: budget._id,
};

const periodExpenseFilter: Record<string, unknown> = {
  ...baseExpenseFilter,
};

if (start || end) {
  const expenseDateRange: Record<string, Date> = {};

  if (start) expenseDateRange.$gte = start;
  if (end) expenseDateRange.$lte = end;

  periodExpenseFilter.expenseDate = expenseDateRange;
}

const [allExpenses, expenses] = await Promise.all([
  Expense.find(baseExpenseFilter)
    .select("description amount category expenseDate")
    .sort({ expenseDate: -1 })
    .lean(),

  Expense.find(periodExpenseFilter)
    .select("description amount category expenseDate")
    .sort({ expenseDate: -1 })
    .lean(),
]);




const totalSpent = allExpenses.reduce(
  (total, expense) => total + expense.amount,
  0
);

const periodSpent = expenses.reduce(
  (total, expense) => total + expense.amount,
  0
);

const remainingAmount = budget.allocatedAmount - totalSpent;

const periodRemaining = budget.allocatedAmount - periodSpent;

const categoryTotals: Record<string, number> = {};

for (const expense of expenses) {
  categoryTotals[expense.category] =
    (categoryTotals[expense.category] ?? 0) + expense.amount;
}


    res.status(200).json({
      success: true,
      data: {
        project: {
          id: String(project._id),
          name: project.name,
        },
         filters: {
      startDate: start?.toISOString() ?? null,
      endDate: end?.toISOString() ?? null,
    },
        financials: {
          allocatedAmount: budget.allocatedAmount,
          totalSpent: Number(totalSpent.toFixed(2)),
          remainingAmount: Number(remainingAmount.toFixed(2)),
          currency: budget.currency,
          periodSpent: Number(periodSpent.toFixed(2)),
periodRemaining: Number(periodRemaining.toFixed(2)),
periodUtilizationPercentage:
  budget.allocatedAmount === 0
    ? 0
    : Number(
        ((periodSpent / budget.allocatedAmount) * 100).toFixed(2)
      ),
          utilizationPercentage:
            budget.allocatedAmount === 0
              ? 0
              : Number(
                  (
                    (totalSpent / budget.allocatedAmount) *
                    100
                  ).toFixed(2)
                ),
          expenseCount: expenses.length,
          byCategory: categoryTotals,
        },
        expenses,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Project financial analytics error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to generate project financial report",
    });
  }
}


export async function getEmployeeAnalytics(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

   
const employeeId = req.params.employeeId;

if (
  typeof employeeId !== "string" ||
  !mongoose.isValidObjectId(employeeId)
) {
  res.status(400).json({
    success: false,
    message: "Invalid employee ID",
  });
  return;
}

const targetId = new mongoose.Types.ObjectId(employeeId);

    const requesterId = new mongoose.Types.ObjectId(req.user.id);
    const role = req.user.role;

    const employee = await User.findById(targetId)
      .select("name email role isActive")
      .lean();

    if (!employee) {
      res.status(404).json({
        success: false,
        message: "Employee not found",
      });
      return;
    }

    if (employee.role !== "employee") {
      res.status(400).json({
        success: false,
        message: "Analytics are available for employee accounts only",
      });
      return;
    }

   
    if (role === "employee" && String(targetId) !== String(requesterId)) {
      res.status(403).json({
        success: false,
        message: "You can only access your own report",
      });
      return;
    }

   
    if (role === "manager") {
      const managedProjects = await Project.find({
        $or: [{ owner: requesterId }, { members: requesterId }],
      })
        .select("_id")
        .lean();

      const projectIds = managedProjects.map((project) => project._id);

      const [hasAssignedTask, hasTimesheet] = await Promise.all([
        Task.exists({
          assignedTo: targetId,
          project: { $in: projectIds },
        }),
        Timesheet.exists({
          employee: targetId,
          project: { $in: projectIds },
        }),
      ]);

      if (!hasAssignedTask && !hasTimesheet) {
        res.status(403).json({
          success: false,
          message: "You do not have access to this employee report",
        });
        return;
      }
    }

    const [tasks, timesheets, leaves] = await Promise.all([
      Task.find({ assignedTo: targetId })
        .select("status priority dueDate project")
        .lean(),

      Timesheet.find({ employee: targetId })
        .select("hours status project")
        .lean(),

      Leave.find({ employee: targetId })
        .select("leaveType status startDate endDate")
        .lean(),
    ]);

    const now = new Date();

    const countBy = <T,>(
      items: T[],
      getKey: (item: T) => string
    ): Record<string, number> => {
      const result: Record<string, number> = {};

      for (const item of items) {
        const key = getKey(item);
        result[key] = (result[key] ?? 0) + 1;
      }

      return result;
    };

    const completedTasks = tasks.filter(
      (task) => task.status === "done"
    ).length;

    const overdueTasks = tasks.filter(
      (task) =>
        task.status !== "done" &&
        task.dueDate != null &&
        new Date(task.dueDate) < now
    ).length;

    const approvedTimesheets = timesheets.filter(
      (item) => item.status === "approved"
    );

    const totalLoggedHours = timesheets.reduce(
      (sum, item) => sum + item.hours,
      0
    );

    const approvedHours = approvedTimesheets.reduce(
      (sum, item) => sum + item.hours,
      0
    );

    res.status(200).json({
      success: true,
      data: {
        employee: {
          id: String(employee._id),
          name: employee.name,
          email: employee.email,
          isActive: employee.isActive,
        },
        tasks: {
          total: tasks.length,
          completed: completedTasks,
          pending: tasks.length - completedTasks,
          overdue: overdueTasks,
          completionRate:
            tasks.length === 0
              ? 0
              : Number(
                  ((completedTasks / tasks.length) * 100).toFixed(2)
                ),
          byStatus: countBy(tasks, (task) => task.status),
          byPriority: countBy(tasks, (task) => task.priority),
        },
        timesheets: {
          total: timesheets.length,
          approved: approvedTimesheets.length,
          pending: timesheets.filter(
            (item) => item.status === "submitted"
          ).length,
          rejected: timesheets.filter(
            (item) => item.status === "rejected"
          ).length,
          totalLoggedHours: Number(totalLoggedHours.toFixed(2)),
          approvedHours: Number(approvedHours.toFixed(2)),
        },
        leaves: {
          total: leaves.length,
          byStatus: countBy(leaves, (leave) => leave.status),
          byType: countBy(leaves, (leave) => leave.leaveType),
        },
        generatedAt: now.toISOString(),
      },
    });
  } catch (error) {
    console.error("Employee analytics error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to generate employee analytics",
    });
  }
}


export async function exportProjectFinancialsCsv(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const { projectId } = req.params;
    const { startDate, endDate } = req.query;

    if (!mongoose.isValidObjectId(projectId)) {
      res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
      return;
    }

    const isValidDate = (value: unknown): value is string =>
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) &&
      new Date(`${value}T00:00:00.000Z`)
        .toISOString()
        .slice(0, 10) === value;

    if (
      (startDate !== undefined && !isValidDate(startDate)) ||
      (endDate !== undefined && !isValidDate(endDate))
    ) {
      res.status(400).json({
        success: false,
        message: "Dates must be valid YYYY-MM-DD values",
      });
      return;
    }

    const start = isValidDate(startDate)
      ? new Date(`${startDate}T00:00:00.000Z`)
      : undefined;

    const end = isValidDate(endDate)
      ? new Date(`${endDate}T23:59:59.999Z`)
      : undefined;

    if (start && end && start > end) {
      res.status(400).json({
        success: false,
        message: "startDate must be before or equal to endDate",
      });
      return;
    }

    const userId = new mongoose.Types.ObjectId(req.user.id);
    const role = req.user.role;

    const project = await Project.findById(projectId)
      .select("name owner members")
      .lean();

    if (!project) {
      res.status(404).json({
        success: false,
        message: "Project not found",
      });
      return;
    }

    const isOwner = String(project.owner) === String(userId);
    const isMember = project.members.some(
      (member) => String(member) === String(userId)
    );

    let canAccess = role === "admin" || isOwner || isMember;

    if (role === "employee" && !canAccess) {
      canAccess = Boolean(
        await Task.exists({
          project: project._id,
          assignedTo: userId,
        })
      );
    }

    if (!canAccess) {
      res.status(403).json({
        success: false,
        message: "You do not have access to this project report",
      });
      return;
    }

    const budget = await Budget.findOne({
      project: project._id,
    }).lean();

    if (!budget) {
      res.status(404).json({
        success: false,
        message: "No budget found for this project",
      });
      return;
    }

    const expenseFilter: Record<string, unknown> = {
      project: project._id,
      budget: budget._id,
    };

    if (start || end) {
      const dateRange: Record<string, Date> = {};
      if (start) dateRange.$gte = start;
      if (end) dateRange.$lte = end;
      expenseFilter.expenseDate = dateRange;
    }

    const expenses = await Expense.find(expenseFilter)
      .select("description amount category expenseDate")
      .sort({ expenseDate: -1 })
      .lean();

    const escapeCsv = (value: unknown): string => {
      const text = value == null ? "" : String(value);
      return `"${text.replace(/"/g, '""')}"`;
    };

    const rows = [
      ["Project", project.name],
      ["Allocated Budget", budget.allocatedAmount],
      ["Currency", budget.currency],
      ["Start Date", startDate ?? "All dates"],
      ["End Date", endDate ?? "All dates"],
      [],
      ["Description", "Category", "Amount", "Expense Date"],
      ...expenses.map((expense) => [
        expense.description,
        expense.category,
        expense.amount,
        new Date(expense.expenseDate).toISOString(),
      ]),
      [],
      [
        "Total Period Spending",
        "",
        expenses.reduce((sum, expense) => sum + expense.amount, 0),
        "",
      ],
    ];

    const csv = rows
      .map((row) => row.map(escapeCsv).join(","))
      .join("\r\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="project-financial-report.csv"'
    );
    res.status(200).send("\uFEFF" + csv);
  } catch (error) {
    console.error("Project financial CSV export error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to export project financial report",
    });
  }
}


export async function saveReport(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const { title, type, projectId, employeeId, filters, data } =
      req.body;

    const allowedTypes = [
      "overview",
      "project",
      "project-financials",
      "employee",
    ];

    if (
      typeof title !== "string" ||
      !title.trim() ||
      !allowedTypes.includes(type) ||
      !data ||
      typeof data !== "object" ||
      Array.isArray(data)
    ) {
      res.status(400).json({
        success: false,
        message: "Valid title, report type, and report data are required",
      });
      return;
    }

    if (
      projectId !== undefined &&
      !mongoose.isValidObjectId(projectId)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
      return;
    }

    if (
      employeeId !== undefined &&
      !mongoose.isValidObjectId(employeeId)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid employee ID",
      });
      return;
    }

    if (
      filters !== undefined &&
      (filters === null ||
        typeof filters !== "object" ||
        Array.isArray(filters))
    ) {
      res.status(400).json({
        success: false,
        message: "Filters must be an object",
      });
      return;
    }

    
const parseDate = (
  value: unknown,
  fieldName: string
): Date | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a date string`);
  }

  
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);

  if (isDateOnly) {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new Error(`${fieldName} is not a valid date`);
    }

    return date;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} is not a valid date`);
  }

  return date;
};

let startDate: Date | undefined;
let endDate: Date | undefined;

try {
  startDate = parseDate(filters?.startDate, "startDate");
  endDate = parseDate(filters?.endDate, "endDate");

  
  if (
    endDate &&
    typeof filters?.endDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(filters.endDate)
  ) {
    endDate.setUTCHours(23, 59, 59, 999);
  }

  if (startDate && endDate && startDate > endDate) {
    res.status(400).json({
      success: false,
      message: "startDate cannot be later than endDate",
    });
    return;
  }
} catch (error) {
  res.status(400).json({
    success: false,
    message:
      error instanceof Error ? error.message : "Invalid report dates",
  });
  return;
}


    const userId = new mongoose.Types.ObjectId(req.user.id);
    const role = req.user.role;

    let project:
      | { _id: mongoose.Types.ObjectId; owner: unknown; members: unknown[] }
      | null = null;

    if (projectId) {
      project = await Project.findById(projectId)
        .select("owner members")
        .lean();

      if (!project) {
        res.status(404).json({
          success: false,
          message: "Project not found",
        });
        return;
      }

      const isOwner = String(project.owner) === String(userId);
      const isMember = project.members.some(
        (member) => String(member) === String(userId)
      );

      let canAccess = role === "admin" || isOwner || isMember;

      if (role === "employee" && !canAccess) {
        canAccess = Boolean(
          await Task.exists({
            project: project._id,
            assignedTo: userId,
          })
        );
      }

      if (!canAccess) {
        res.status(403).json({
          success: false,
          message: "You do not have access to this project",
        });
        return;
      }
    }

    if (employeeId && role !== "admin" && employeeId !== req.user.id) {
      res.status(403).json({
        success: false,
        message: "You cannot save a report for another employee",
      });
      return;
    }

   

    const report = await Report.create({
      title: title.trim(),
      type,
      ...(projectId ? { project: projectId } : {}),
      ...(employeeId ? { employee: employeeId } : {}),
    filters: {
  ...(startDate ? { startDate } : {}),
  ...(endDate ? { endDate } : {}),
},
      data,
      generatedBy: userId,
    });

    res.status(201).json({
      success: true,
      message: "Report saved successfully",
      data: report,
    });
  } catch (error) {
    console.error("Save report error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to save report",
    });
  }
}



export async function getSavedReports(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    
    const role = req.user.role;
    const userId = new mongoose.Types.ObjectId(req.user.id);

    const filter: Record<string, unknown> = {};

    if (role !== "admin") {
      filter.generatedBy = userId;
    }

    const reports = await Report.find(filter)
      .select("-data")
      .sort({ generatedAt: -1 })
      .limit(100)
      .lean();

    res.status(200).json({
      success: true,
      count: reports.length,
      data: reports,
    });
  } catch (error) {
    console.error("Get saved reports error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve saved reports",
    });
  }
}

export async function getSavedReportById(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const { reportId } = req.params;

    if (!mongoose.isValidObjectId(reportId)) {
      res.status(400).json({
        success: false,
        message: "Invalid report ID",
      });
      return;
    }

    const userId = new mongoose.Types.ObjectId(req.user.id);
    const role = req.user.role;

    const report = await Report.findById(reportId).lean();

    if (!report) {
      res.status(404).json({
        success: false,
        message: "Saved report not found",
      });
      return;
    }

    
    if (
      role !== "admin" &&
      String(report.generatedBy) !== String(userId)
    ) {
      res.status(403).json({
        success: false,
        message: "You do not have access to this saved report",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error("Get saved report by ID error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve saved report",
    });
  }
}


export async function deleteSavedReport(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const { reportId } = req.params;

    if (!mongoose.isValidObjectId(reportId)) {
      res.status(400).json({
        success: false,
        message: "Invalid report ID",
      });
      return;
    }

    const report = await Report.findById(reportId);

    if (!report) {
      res.status(404).json({
        success: false,
        message: "Saved report not found",
      });
      return;
    }

    const isAdmin = req.user.role === "admin";
    const isCreator =
      String(report.generatedBy) === String(req.user.id);

    if (!isAdmin && !isCreator) {
      res.status(403).json({
        success: false,
        message: "You do not have permission to delete this report",
      });
      return;
    }

    await report.deleteOne();

    res.status(200).json({
      success: true,
      message: "Saved report deleted successfully",
      data: {
        reportId: String(report._id),
      },
    });
  } catch (error) {
    console.error("Delete saved report error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete saved report",
    });
  }
}


export async function updateSavedReport(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const { reportId } = req.params;
    const { title, filters } = req.body;

    if (!mongoose.isValidObjectId(reportId)) {
      res.status(400).json({
        success: false,
        message: "Invalid report ID",
      });
      return;
    }

    if (
      title === undefined &&
      filters === undefined
    ) {
      res.status(400).json({
        success: false,
        message: "Provide a title or filters to update",
      });
      return;
    }

    if (
      title !== undefined &&
      (typeof title !== "string" || !title.trim())
    ) {
      res.status(400).json({
        success: false,
        message: "Title must be a non-empty string",
      });
      return;
    }

    if (
      filters !== undefined &&
      (filters === null ||
        typeof filters !== "object" ||
        Array.isArray(filters))
    ) {
      res.status(400).json({
        success: false,
        message: "Filters must be an object",
      });
      return;
    }

    const report = await Report.findById(reportId);

    if (!report) {
      res.status(404).json({
        success: false,
        message: "Saved report not found",
      });
      return;
    }

    const isAdmin = req.user.role === "admin";
    const isCreator =
      String(report.generatedBy) === String(req.user.id);

    if (!isAdmin && !isCreator) {
      res.status(403).json({
        success: false,
        message: "You do not have permission to update this report",
      });
      return;
    }

    if (title !== undefined) {
      report.title = title.trim();
    }

    if (filters !== undefined) {
      const parseDate = (
        value: unknown,
        fieldName: string
      ): Date | undefined => {
        if (value === undefined || value === null || value === "") {
          return undefined;
        }

        if (typeof value !== "string") {
          throw new Error(`${fieldName} must be a date string`);
        }

        const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
          throw new Error(`${fieldName} is not a valid date`);
        }

        if (dateOnly) {
          const [year, month, day] = value.split("-").map(Number);

          if (
            date.getUTCFullYear() !== year ||
            date.getUTCMonth() !== month - 1 ||
            date.getUTCDate() !== day
          ) {
            throw new Error(`${fieldName} is not a valid date`);
          }

          if (fieldName === "endDate") {
            date.setUTCHours(23, 59, 59, 999);
          }
        }

        return date;
      };

      let startDate: Date | undefined;
      let endDate: Date | undefined;

      try {
        startDate = parseDate(filters.startDate, "startDate");
        endDate = parseDate(filters.endDate, "endDate");
      } catch (error) {
        res.status(400).json({
          success: false,
          message:
            error instanceof Error ? error.message : "Invalid dates",
        });
        return;
      }

      if (startDate && endDate && startDate > endDate) {
        res.status(400).json({
          success: false,
          message: "startDate cannot be later than endDate",
        });
        return;
      }

      report.filters = {
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
      };
    }

    await report.save();

    res.status(200).json({
      success: true,
      message: "Saved report updated successfully",
      data: report,
    });
  } catch (error) {
    console.error("Update saved report error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update saved report",
    });
  }
}







