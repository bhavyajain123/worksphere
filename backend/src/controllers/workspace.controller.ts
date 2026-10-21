import { Response } from "express";
import mongoose from "mongoose";
import Workspace from "../models/Workspace";
import User from "../models/User";
import ActivityLog from "../models/ActivityLog";
import type { AuthRequest } from "../middleware/auth";
import Project from "../models/Project";
import Team from "../models/Team";

function isValidId(id: unknown): id is string {
  return typeof id === "string" && mongoose.isValidObjectId(id);
}

async function getActiveMembers(ids: string[]) {
  const uniqueIds = [...new Set(ids)];

  if (!uniqueIds.every(isValidId)) return null;

  const users = await User.find({
    _id: { $in: uniqueIds },
    isActive: true,
  }).select("_id");

  if (users.length !== uniqueIds.length) return null;

  return users.map((user) => user._id);
}

export async function createWorkspace(req: AuthRequest, res: Response) {
  try {
    const name =
      typeof req.body.name === "string" ? req.body.name.trim() : "";
    const description =
      typeof req.body.description === "string"
        ? req.body.description.trim()
        : "";

    if (name.length < 3 || name.length > 120) {
      return res.status(400).json({
        success: false,
        message: "Workspace name must be 3–120 characters",
      });
    }

    if (description.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Description cannot exceed 2000 characters",
      });
    }

    const requestedMembers = req.body.members ?? [];

    if (
      !Array.isArray(requestedMembers) ||
      !requestedMembers.every((id: unknown) => typeof id === "string")
    ) {
      return res.status(400).json({
        success: false,
        message: "Members must be an array of user IDs",
      });
    }

    const memberIds = [...new Set([req.user!.id, ...requestedMembers])];
    const validMembers = await getActiveMembers(memberIds);

    if (!validMembers) {
      return res.status(400).json({
        success: false,
        message: "One or more member IDs are invalid or inactive",
      });
    }

    const workspace = await Workspace.create({
      name,
      description,
      owner: req.user!.id,
      members: validMembers,
    });

    await ActivityLog.create({
      actor: req.user!.id,
      action: "created",
      entityType: "workspace",
      entityId: workspace._id,
      description: `Created workspace: ${workspace.name}`,
    });

    return res.status(201).json({
      success: true,
      message: "Workspace created successfully",
      workspace,
    });
  } catch (error) {
    console.error("Create workspace error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create workspace",
    });
  }
}

export async function listWorkspaces(req: AuthRequest, res: Response) {
  try {
    const filter =
      req.user!.role === "admin"
        ? {}
        : {
            $or: [
              { owner: req.user!.id },
              { members: req.user!.id },
            ],
          };

    const workspaces = await Workspace.find(filter)
      .populate("owner", "name email role")
      .populate("members", "name email role")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: workspaces.length,
      workspaces,
    });
  } catch (error) {
    console.error("List workspaces error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch workspaces",
    });
  }
}

export async function getWorkspace(req: AuthRequest, res: Response) {
  try {
    const id = req.params.id;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace ID",
      });
    }

    const filter: Record<string, unknown> = { _id: id };

    if (req.user!.role !== "admin") {
      filter.$or = [
        { owner: req.user!.id },
        { members: req.user!.id },
      ];
    }

    const workspace = await Workspace.findOne(filter)
      .populate("owner", "name email role")
      .populate("members", "name email role");

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found",
      });
    }

    return res.status(200).json({ success: true, workspace });
  } catch (error) {
    console.error("Get workspace error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch workspace",
    });
  }
}

export async function updateWorkspace(req: AuthRequest, res: Response) {
  try {
    const id = req.params.id;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace ID",
      });
    }

    const workspace = await Workspace.findById(id);

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found",
      });
    }

    if (
      req.user!.role !== "admin" &&
      workspace.owner.toString() !== req.user!.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Only the workspace owner or an admin can update it",
      });
    }

    const updates: Record<string, string> = {};

    if (req.body.name !== undefined) {
      if (
        typeof req.body.name !== "string" ||
        req.body.name.trim().length < 3 ||
        req.body.name.trim().length > 120
      ) {
        return res.status(400).json({
          success: false,
          message: "Workspace name must be 3–120 characters",
        });
      }

      updates.name = req.body.name.trim();
    }

    if (req.body.description !== undefined) {
      if (
        typeof req.body.description !== "string" ||
        req.body.description.trim().length > 2000
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid workspace description",
        });
      }

      updates.description = req.body.description.trim();
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide a valid name or description",
      });
    }

    Object.assign(workspace, updates);
    await workspace.save();

    await ActivityLog.create({
      actor: req.user!.id,
      action: "updated",
      entityType: "workspace",
      entityId: workspace._id,
      description: `Updated workspace: ${workspace.name}`,
    });

    return res.status(200).json({
      success: true,
      message: "Workspace updated successfully",
      workspace,
    });
  } catch (error) {
    console.error("Update workspace error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update workspace",
    });
  }
}

export async function deleteWorkspace(req: AuthRequest, res: Response) {
  try {
    const id = req.params.id;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace ID",
      });
    }

    const workspace = await Workspace.findById(id);

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found",
      });
    }

    if (
      req.user!.role !== "admin" &&
      workspace.owner.toString() !== req.user!.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Only the workspace owner or an admin can delete it",
      });
    }

    await ActivityLog.create({
      actor: req.user!.id,
      action: "deleted",
      entityType: "workspace",
      entityId: workspace._id,
      description: `Deleted workspace: ${workspace.name}`,
    });

    await workspace.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Workspace deleted successfully",
    });
  } catch (error) {
    console.error("Delete workspace error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete workspace",
    });
  }
}

export async function addWorkspaceMember(req: AuthRequest, res: Response) {
  try {
    const id = req.params.id;
    const rawUserId: unknown = req.body.userId;
    const rawEmail: unknown = req.body.email;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace ID",
      });
    }

    const workspace = await Workspace.findById(id);

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found",
      });
    }

    if (
      req.user!.role !== "admin" &&
      workspace.owner.toString() !== req.user!.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Only the workspace owner or an admin can manage members",
      });
    }

    let userId: string | null = null;

    if (typeof rawEmail === "string" && rawEmail.trim()) {
      const found = await User.findOne({
        email: rawEmail.trim().toLowerCase(),
        isActive: true,
      }).select("_id");

      if (!found) {
        return res.status(404).json({
          success: false,
          message: "No active user found with this email",
        });
      }

      userId = found._id.toString();
    } else if (typeof rawUserId === "string" && isValidId(rawUserId)) {
      userId = rawUserId;
    } else {
      return res.status(400).json({
        success: false,
        message: "Provide a valid email or userId",
      });
    }

    const validMembers = await getActiveMembers([userId]);

    if (!validMembers) {
      return res.status(400).json({
        success: false,
        message: "User does not exist or is inactive",
      });
    }

    if (workspace.members.some((member) => member.toString() === userId)) {
      return res.status(409).json({
        success: false,
        message: "User is already a workspace member",
      });
    }

    workspace.members.push(validMembers[0]);
    await workspace.save();

    await ActivityLog.create({
      actor: req.user!.id,
      action: "updated",
      entityType: "workspace",
      entityId: workspace._id,
      description: `Added member to workspace: ${workspace.name}`,
    });

    return res.status(200).json({
      success: true,
      message: "Workspace member added successfully",
      workspace,
    });
  } catch (error) {
    console.error("Add workspace member error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add workspace member",
    });
  }
}

export async function removeWorkspaceMember(req: AuthRequest, res: Response) {
  try {
    const id = req.params.id;
    const userId = req.params.userId;

    if (!isValidId(id) || !isValidId(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace or user ID",
      });
    }

    const workspace = await Workspace.findById(id);

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found",
      });
    }

    if (
      req.user!.role !== "admin" &&
      workspace.owner.toString() !== req.user!.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Only the workspace owner or an admin can manage members",
      });
    }

    if (workspace.owner.toString() === userId) {
      return res.status(400).json({
        success: false,
        message: "The workspace owner cannot be removed",
      });
    }

    if (!workspace.members.some((member) => member.toString() === userId)) {
      return res.status(404).json({
        success: false,
        message: "User is not a workspace member",
      });
    }

    workspace.members = workspace.members.filter(
      (member) => member.toString() !== userId
    );

    await workspace.save();

    await ActivityLog.create({
      actor: req.user!.id,
      action: "updated",
      entityType: "workspace",
      entityId: workspace._id,
      description: `Removed member from workspace: ${workspace.name}`,
    });

    return res.status(200).json({
      success: true,
      message: "Workspace member removed successfully",
      workspace,
    });
  } catch (error) {
    console.error("Remove workspace member error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to remove workspace member",
    });
  }
}


export async function listWorkspaceProjects(
  req: AuthRequest,
  res: Response
) {
  try {
    const id = req.params.id;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace ID",
      });
    }

    const filter: Record<string, unknown> = { _id: id };

    if (req.user!.role !== "admin") {
      filter.$or = [
        { owner: req.user!.id },
        { members: req.user!.id },
      ];
    }

    const workspace = await Workspace.findOne(filter).select("_id");

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found",
      });
    }

    const projects = await Project.find({ workspace: id })
      .populate("owner", "name email")
      .populate("members", "name email role")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: projects.length,
      projects,
    });
  } catch (error) {
    console.error("List workspace projects error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch workspace projects",
    });
  }
}

export async function listWorkspaceTeams(
  req: AuthRequest,
  res: Response
) {
  try {
    const id = req.params.id;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace ID",
      });
    }

    const filter: Record<string, unknown> = { _id: id };

    if (req.user!.role !== "admin") {
      filter.$or = [
        { owner: req.user!.id },
        { members: req.user!.id },
      ];
    }

    const workspace = await Workspace.findOne(filter).select("_id");

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found",
      });
    }

    const teams = await Team.find({ workspace: id })
      .populate("owner", "name email role")
      .populate("members", "name email role")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: teams.length,
      teams,
    });
  } catch (error) {
    console.error("List workspace teams error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch workspace teams",
    });
  }
}
