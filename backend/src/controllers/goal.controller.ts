import { Request, Response } from "express";
import mongoose from "mongoose";
import Goal from "../models/Goal";
import User from "../models/User";

interface AuthRequest extends Request {
  user?: {
    id?: string;
    _id?: string;
    role?: string;
  };
}

const getUserId = (req: AuthRequest): string | undefined => {
  return req.user?.id ?? req.user?._id;
};

const isValidId = (id: string): boolean =>
  mongoose.Types.ObjectId.isValid(id);
export const createGoal = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = getUserId(req);

    if (!userId || !isValidId(userId)) {
      res.status(401).json({
        success: false,
        message: "Invalid authenticated user",
      });
      return;
    }

    const {
      title,
      description,
      assignedTo = [],
      startDate,
      dueDate,
    } = req.body;

    if (!title || typeof title !== "string" || title.trim().length < 3) {
      res.status(400).json({
        success: false,
        message: "Goal title must contain at least 3 characters",
      });
      return;
    }

    if (!Array.isArray(assignedTo)) {
      res.status(400).json({
        success: false,
        message: "assignedTo must be an array of user IDs",
      });
      return;
    }

    if (assignedTo.some((id: unknown) => typeof id !== "string" || !isValidId(id))) {
      res.status(400).json({
        success: false,
        message: "One or more assigned user IDs are invalid",
      });
      return;
    }

    if (new Set(assignedTo).size !== assignedTo.length) {
      res.status(400).json({
        success: false,
        message: "Duplicate assigned user IDs are not allowed",
      });
      return;
    }

    if (assignedTo.length > 0) {
      const users = await User.find({
        _id: { $in: assignedTo },
      }).select("_id");

      if (users.length !== assignedTo.length) {
        res.status(400).json({
          success: false,
          message: "One or more assigned users do not exist",
        });
        return;
      }
    }
    const start = new Date(startDate);
    const due = new Date(dueDate);

    if (
      !startDate ||
      !dueDate ||
      Number.isNaN(start.getTime()) ||
      Number.isNaN(due.getTime())
    ) {
      res.status(400).json({
        success: false,
        message: "Valid startDate and dueDate are required",
      });
      return;
    }

    if (due < start) {
      res.status(400).json({
        success: false,
        message: "dueDate cannot be earlier than startDate",
      });
      return;
    }

    const goal = await Goal.create({
      title: title.trim(),
      description,
      owner: userId,
      assignedTo,
      startDate: start,
      dueDate: due,
    });

    res.status(201).json({
      success: true,
      message: "Goal created successfully",
      goal,
    });
  } catch (error) {
    console.error("Create goal error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create goal",
    });
  }
};

export const getGoals = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = getUserId(req);
    const role = req.user?.role?.toLowerCase();

    if (!userId || !isValidId(userId)) {
      res.status(401).json({
        success: false,
        message: "Invalid authenticated user",
      });
      return;
    }

    const filter =
      role === "admin"
        ? {}
        : {
            $or: [
              { owner: userId },
              { assignedTo: userId },
            ],
          };

    const goals = await Goal.find(filter)
      .populate("owner", "name email")
      .populate("assignedTo", "name email")
      .sort({ dueDate: 1 });

    res.status(200).json({
      success: true,
      count: goals.length,
      goals,
    });
  } catch (error) {
    console.error("Get goals error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch goals",
    });
  }
};

export const getGoalById = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = getUserId(req);
    const role = req.user?.role?.toLowerCase();
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid goal ID",
      });
      return;
    }

    const goal = await Goal.findById(id)
      .populate("owner", "name email")
      .populate("assignedTo", "name email");

    if (!goal) {
      res.status(404).json({
        success: false,
        message: "Goal not found",
      });
      return;
    }

    const canView =
      role === "admin" ||
      goal.owner._id.toString() === userId ||
      goal.assignedTo.some((user) => user._id.toString() === userId);

    if (!canView) {
      res.status(403).json({
        success: false,
        message: "You are not allowed to view this goal",
      });
      return;
    }

    res.status(200).json({
      success: true,
      goal,
    });
  } catch (error) {
    console.error("Get goal error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch goal",
    });
  }
};
export const updateGoal = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = getUserId(req);
    const role = req.user?.role?.toLowerCase();
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid goal ID",
      });
      return;
    }

    const goal = await Goal.findById(id);

    if (!goal) {
      res.status(404).json({
        success: false,
        message: "Goal not found",
      });
      return;
    }

    if (role !== "admin" && goal.owner.toString() !== userId) {
      res.status(403).json({
        success: false,
        message: "Only the goal owner or admin can update this goal",
      });
      return;
    }

    const allowedFields = [
      "title",
      "description",
      "assignedTo",
      "startDate",
      "dueDate",
      "status",
      "progress",
    ];

    const invalidFields = Object.keys(req.body).filter(
      (field) => !allowedFields.includes(field)
    );

    if (invalidFields.length > 0) {
      res.status(400).json({
        success: false,
        message: "Unsupported update fields",
        fields: invalidFields,
      });
      return;
    }

    if (req.body.title !== undefined) {
      if (
        typeof req.body.title !== "string" ||
        req.body.title.trim().length < 3 ||
        req.body.title.trim().length > 150
      ) {
        res.status(400).json({
          success: false,
          message: "Title must contain 3 to 150 characters",
        });
        return;
      }

      goal.title = req.body.title.trim();
    }

    if (req.body.description !== undefined) {
      if (
        typeof req.body.description !== "string" ||
        req.body.description.length > 3000
      ) {
        res.status(400).json({
          success: false,
          message: "Description must be a string of at most 3000 characters",
        });
        return;
      }

      goal.description = req.body.description;
    }

    if (req.body.assignedTo !== undefined) {
      const assignedTo = req.body.assignedTo;

      if (
        !Array.isArray(assignedTo) ||
        assignedTo.some(
          (id: unknown) => typeof id !== "string" || !isValidId(id)
        )
      ) {
        res.status(400).json({
          success: false,
          message: "assignedTo must contain valid user IDs",
        });
        return;
      }

      if (new Set(assignedTo).size !== assignedTo.length) {
        res.status(400).json({
          success: false,
          message: "Duplicate assigned user IDs are not allowed",
        });
        return;
      }

      if (assignedTo.length > 0) {
        const users = await User.find({
          _id: { $in: assignedTo },
        }).select("_id");

        if (users.length !== assignedTo.length) {
          res.status(400).json({
            success: false,
            message: "One or more assigned users do not exist",
          });
          return;
        }
      }

      goal.assignedTo = assignedTo.map(
        (id: string) => new mongoose.Types.ObjectId(id)
      );
    }

    for (const field of ["startDate", "dueDate"] as const) {
      if (req.body[field] !== undefined) {
        const date = new Date(req.body[field]);

        if (Number.isNaN(date.getTime())) {
          res.status(400).json({
            success: false,
            message: `${field} must be a valid date`,
          });
          return;
        }

        goal[field] = date;
      }
    }

    if (req.body.status !== undefined) {
      const validStatuses = [
        "not-started",
        "in-progress",
        "completed",
        "cancelled",
      ];

      if (!validStatuses.includes(req.body.status)) {
        res.status(400).json({
          success: false,
          message: "Invalid goal status",
        });
        return;
      }

      goal.status = req.body.status;
    }

    if (req.body.progress !== undefined) {
      if (
        typeof req.body.progress !== "number" ||
        !Number.isFinite(req.body.progress) ||
        req.body.progress < 0 ||
        req.body.progress > 100
      ) {
        res.status(400).json({
          success: false,
          message: "Progress must be a number between 0 and 100",
        });
        return;
      }

      goal.progress = req.body.progress;
    }

    if (goal.dueDate < goal.startDate) {
      res.status(400).json({
        success: false,
        message: "dueDate cannot be earlier than startDate",
      });
      return;
    }

    await goal.save();

    res.status(200).json({
      success: true,
      message: "Goal updated successfully",
      goal,
    });
  } catch (error) {
    console.error("Update goal error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update goal",
    });
  }
};

export const deleteGoal = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = getUserId(req);
    const role = req.user?.role?.toLowerCase();
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid goal ID",
      });
      return;
    }

    const goal = await Goal.findById(id);

    if (!goal) {
      res.status(404).json({
        success: false,
        message: "Goal not found",
      });
      return;
    }

    if (role !== "admin" && goal.owner.toString() !== userId) {
      res.status(403).json({
        success: false,
        message: "Only the goal owner or admin can delete this goal",
      });
      return;
    }

    await goal.deleteOne();

    res.status(200).json({
      success: true,
      message: "Goal deleted successfully",
    });
  } catch (error) {
    console.error("Delete goal error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete goal",
    });
  }
};