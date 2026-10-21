
import type { Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import Project from "../models/Project";
import User from "../models/User";

import type { AuthRequest } from "../middleware/auth";
import { createActivityLog } from "../services/activityLog.service";
import Workspace from "../models/Workspace";

const createProjectSchema = z.object({
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().min(1).max(3000),
  members: z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(100).default([]),
  startDate: z.coerce.date().optional(),
  deadline: z.coerce.date().optional(),
  workspace: z.string().regex(/^[a-f\d]{24}$/i).optional(),
});


const updateProjectSchema = z.object({
  name: z.string().trim().min(3).max(120).optional(),
  description: z.string().trim().max(3000).optional(),
  workspace: z.string().regex(/^[a-f\d]{24}$/i, "Invalid workspace ID").optional(),
  members: z.array(
    z.string().regex(/^[a-f\d]{24}$/i, "Invalid member ID")
  ).max(100).optional(),
  startDate: z.coerce.date().optional(),
  deadline: z.coerce.date().optional(),
status: z.enum([
  "planning",
  "active",
  "on-hold",
  "completed",
  "archived"
]).optional()
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "Provide at least one field to update" }
);


function isValidId(id: string): boolean {
  return mongoose.isValidObjectId(id);
}

export async function createProject(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const parsed = createProjectSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid project data",
      errors: parsed.error.issues
    });
    return;
  }

  try {
const {
  name,
  description,
  members,
  startDate,
  deadline,
  workspace: workspaceId,
} = parsed.data;

    if (
      startDate &&
      deadline &&
      deadline < startDate
    ) {
      res.status(400).json({
        success: false,
        message: "Deadline cannot be before the start date"
      });
      return;
    }

    const memberIds = [...new Set([
      req.user!.id,
      ...members
    ])];

    const activeUsers = await User.find({
      _id: { $in: memberIds },
      isActive: true
    }).select("_id");

    if (activeUsers.length !== memberIds.length) {
      res.status(400).json({
        success: false,
        message: "One or more members do not exist or are inactive"
      });
      return;
    }

    if (workspaceId) {
  const workspaceFilter: Record<string, unknown> = {
    _id: workspaceId,
  };

  if (req.user!.role !== "admin") {
    workspaceFilter.members = new mongoose.Types.ObjectId(
      req.user!.id
    );
  }

  const workspace = await Workspace.findOne(workspaceFilter).select(
    "_id owner members"
  );

  if (!workspace) {
    res.status(404).json({
      success: false,
      message: "Workspace not found or you do not have access",
    });
    return;
  }

  const workspaceMemberIds = new Set(
    workspace.members.map((id) => id.toString())
  );

  const invalidMembers = members.filter(
    (memberId) => !workspaceMemberIds.has(memberId)
  );

  if (invalidMembers.length > 0) {
    res.status(400).json({
      success: false,
      message: "All selected project members must belong to the workspace",
    });
    return;
  }
}

const project = await Project.create({
  name,
  description,
  owner: req.user!.id,
  members: memberIds,
  workspace: workspaceId,
  startDate,
  deadline,
  status: "planning",
});
    try {
  await createActivityLog({
    actor: req.user!.id,
    action: "created",
    entityType: "project",
    entityId: project._id.toString(),
    description: `Created project: ${project.name}`,
    details: {
      memberCount: project.members.length,
      status: project.status,
    },
  });
} catch (activityLogError) {
  console.error("Project creation activity log failed:", activityLogError);
}

    res.status(201).json({
      success: true,
      message: "Project created successfully",
      project
    });
  } catch (error: unknown) {
    console.error("Create project failed:", error);
    res.status(500).json({
      success: false,
      message: "Unable to create project"
    });
  }
}

export async function listProjects(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const filter = req.user!.role === "admin"
      ? {}
      : { members: new mongoose.Types.ObjectId(req.user!.id) };

    const projects = await Project.find(filter)
      .populate("owner", "name email")
      .populate("members", "name email role")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: projects.length,
      projects
    });
  } catch (error: unknown) {
    console.error("List projects failed:", error);
    res.status(500).json({
      success: false,
      message: "Unable to fetch projects"
    });
  }
}

export async function getProject(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const { id } = req.params;

  if (typeof id !== "string" || !isValidId(id)) {
    res.status(400).json({
      success: false,
      message: "Invalid project ID"
    });
    return;
  }

  try {
    const project = await Project.findById(id)
      .populate("owner", "name email")
      .populate("members", "name email role")
      .lean();

    if (!project) {
      res.status(404).json({
        success: false,
        message: "Project not found"
      });
      return;
    }

    const isMember = project.members.some(
      (member) => {
        const memberId =
          typeof member === "object" && member !== null && "_id" in member
            ? String(member._id)
            : String(member);

        return memberId === req.user!.id;
      }
    );

    if (req.user!.role !== "admin" && !isMember) {
      res.status(403).json({
        success: false,
        message: "You do not have access to this project"
      });
      return;
    }

    res.status(200).json({
      success: true,
      project
    });
  } catch (error: unknown) {
    console.error("Get project failed:", error);
    res.status(500).json({
      success: false,
      message: "Unable to fetch project"
    });
  }
}

export async function updateProject(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const { id } = req.params;
  const parsed = updateProjectSchema.safeParse(req.body);

  if (typeof id !== "string" || !isValidId(id)) {
    res.status(400).json({
      success: false,
      message: "Invalid project ID"
    });
    return;
  }

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid update data",
      errors: parsed.error.issues
    });
    return;
  }

  try {
    const project = await Project.findById(id);

    if (!project) {
      res.status(404).json({
        success: false,
        message: "Project not found"
      });
      return;
    }

    const isOwner = project.owner.toString() === req.user!.id;

    if (req.user!.role !== "admin" && !isOwner) {
      res.status(403).json({
        success: false,
        message: "Only the project owner or admin can update it"
      });
      return;
    }

    const updates = parsed.data;

    if (updates.workspace !== undefined) {
  const workspaceFilter: Record<string, unknown> = {
    _id: updates.workspace,
  };

  if (req.user!.role !== "admin") {
    workspaceFilter.members = new mongoose.Types.ObjectId(req.user!.id);
  }

  const workspace = await Workspace.findOne(workspaceFilter)
    .select("_id members")
    .lean();

  if (!workspace) {
    res.status(404).json({
      success: false,
      message: "Workspace not found or you do not have access",
    });
    return;
  }

  const workspaceMemberIds = new Set(
    workspace.members.map((member) => member.toString())
  );

  const existingMemberIds = [
    project.owner.toString(),
    ...project.members.map((member) => member.toString()),
  ];

  if (existingMemberIds.some((memberId) => !workspaceMemberIds.has(memberId))) {
    res.status(400).json({
      success: false,
      message: "Project owner and all project members must belong to the workspace",
    });
    return;
  }
}

    if (updates.members !== undefined && project.workspace) {
  const workspace = await Workspace.findById(project.workspace)
    .select("_id members")
    .lean();

  if (!workspace) {
    res.status(400).json({
      success: false,
      message: "The project's workspace no longer exists",
    });
    return;
  }

  const workspaceMemberIds = new Set(
    workspace.members.map((member) => member.toString())
  );

  const allMemberIds = [
    ...new Set([
      project.owner.toString(),
      ...updates.members.map((member) => String(member)),
    ]),
  ];

  if (allMemberIds.some((memberId) => !workspaceMemberIds.has(memberId))) {
    res.status(400).json({
      success: false,
      message: "All project members must belong to the linked workspace",
    });
    return;
  }
}
    
if (updates.members !== undefined) {
  const memberIds = [...new Set(updates.members)];

  const activeUsers = await User.find({
    _id: { $in: memberIds },
    isActive: true,
  }).select("_id");

  if (activeUsers.length !== memberIds.length) {
    res.status(400).json({
      success: false,
      message: "One or more members do not exist or are inactive",
    });
    return;
  }

  updates.members = [
    ...new Set([
      project.owner.toString(),
      ...memberIds,
    ]),
  ] as typeof updates.members;
}


    const nextStart = updates.startDate ?? project.startDate;
    const nextDeadline = updates.deadline ?? project.deadline;

    if (
      nextStart &&
      nextDeadline &&
      nextDeadline < nextStart
    ) {
      res.status(400).json({
        success: false,
        message: "Deadline cannot be before the start date"
      });
      return;
    }

    Object.assign(project, updates);
    await project.save();
    try {
  await createActivityLog({
    actor: req.user!.id,
    action: "updated",
    entityType: "project",
    entityId: project._id.toString(),
    description: `Updated project: ${project.name}`,
    details: {
      updatedFields: Object.keys(updates),
      status: project.status,
    },
  });
} catch (activityLogError) {
  console.error("Project update activity log failed:", activityLogError);
}

    res.status(200).json({
      success: true,
      message: "Project updated successfully",
      project
    });
  } catch (error: unknown) {
    console.error("Update project failed:", error);
    res.status(500).json({
      success: false,
      message: "Unable to update project"
    });
  }
}

export async function archiveProject(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const { id } = req.params;

  if (typeof id !== "string" || !isValidId(id)) {
    res.status(400).json({
      success: false,
      message: "Invalid project ID"
    });
    return;
  }

  try {
    const project = await Project.findById(id);

    if (!project) {
      res.status(404).json({
        success: false,
        message: "Project not found"
      });
      return;
    }

    if (req.user!.role !== "admin" && project.workspace) {
  const hasWorkspaceAccess = await Workspace.exists({
    _id: project.workspace,
    members: new mongoose.Types.ObjectId(req.user!.id),
  });

  if (!hasWorkspaceAccess) {
    res.status(404).json({
      success: false,
      message: "Project not found",
    });
    return;
  }
}

    const isOwner = project.owner.toString() === req.user!.id;

    if (req.user!.role !== "admin" && !isOwner) {
      res.status(403).json({
        success: false,
        message: "Only the project owner or admin can archive it"
      });
      return;
    }

    project.status = "archived";
    await project.save();
    try {
  await createActivityLog({
    actor: req.user!.id,
    action: "archived",
    entityType: "project",
    entityId: project._id.toString(),
    description: `Archived project: ${project.name}`,
    details: {
      previousStatus: "active",
      newStatus: "archived",
    },
  });
} catch (activityLogError) {
  console.error("Project archive activity log failed:", activityLogError);
}

    res.status(200).json({
      success: true,
      message: "Project archived successfully",
      project
    });
  } catch (error: unknown) {
    console.error("Archive project failed:", error);
    res.status(500).json({
      success: false,
      message: "Unable to archive project"
    });
  }
}
