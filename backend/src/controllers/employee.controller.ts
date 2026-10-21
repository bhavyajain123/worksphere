
import type { Response } from "express";
import { z } from "zod";
import User from "../models/User";
import type { AuthRequest } from "../middleware/auth";

const employeeQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(80).optional()
});

const updateEmployeeSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  role: z.enum(["admin", "manager", "employee"]).optional()
}).refine(
  (data) => data.name !== undefined || data.role !== undefined,
  { message: "Provide at least one field to update" }
);
const employeeFields = "name email role isActive createdAt updatedAt";
export async function listEmployees(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const parsed = employeeQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid pagination or search parameters"
    });
    return;
  }
    try {
    const { page, limit, search } = parsed.data;
    const filter: Record<string, unknown> = {};

    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    const [employees, total] = await Promise.all([
      User.find(filter)
        .select(employeeFields)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      employees,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: unknown) {
    console.error("List employees failed:", error);
    res.status(500).json({
      success: false,
      message: "Unable to fetch employees"
    });
  }
}
export async function getEmployee(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const employee = await User.findById(req.params.id)
      .select(employeeFields)
      .lean();

    if (!employee) {
      res.status(404).json({
        success: false,
        message: "Employee not found"
      });
      return;
    }

    res.status(200).json({
      success: true,
      employee
    });
  } catch (error: unknown) {
    res.status(400).json({
      success: false,
      message: "Invalid employee ID"
    });
  }
}

export async function updateEmployee(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const parsed = updateEmployeeSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid update data",
      errors: parsed.error.issues
    });
    return;
  }
try{
     const employee = await User.findByIdAndUpdate(
      req.params.id,
      { $set: parsed.data },
      {
        new: true,
        runValidators: true
      }
    )
     .select(employeeFields)
      .lean();

       if (!employee) {
      res.status(404).json({
        success: false,
        message: "Employee is not found"
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Employee updated successfully",
      employee
    });
}catch (error: unknown) {
    console.error("Update employee failed:", error);
    res.status(400).json({
      success: false,
      message: "Unable to update the  employee"
    });
  }
}
const statusSchema = z.object({
  isActive: z.boolean()
});
export async function updateEmployeeStatus(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const parsed = statusSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "isActive must be true or false"
    });
    return;
  }
   try {
    if (req.params.id === req.user?.id && !parsed.data.isActive) {
      res.status(400).json({
        success: false,
        message: "You cannot deactivate your own account"
      });
      return;
    }

    const employee = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { isActive: parsed.data.isActive } },
      { new: true, runValidators: true }
    )
      .select(employeeFields)
      .lean();

    if (!employee) {
      res.status(404).json({
        success: false,
        message: "Employee not found"
      });
      return;
    }
     res.status(200).json({
      success: true,
      message: "Employee status updated successfully",
      employee
    });
  } catch (error: unknown) {
    console.error("Update employee status failed:", error);
    res.status(400).json({
      success: false,
      message: "Unable to update employee status"
    });
  }
}