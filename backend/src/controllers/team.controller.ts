import { Request, Response } from "express";
import mongoose from "mongoose";
import Team from "../models/Team";
import User from "../models/User";
import type { AuthRequest } from "../middleware/auth";
import ActivityLog from "../models/ActivityLog";
import Workspace from "../models/Workspace";

function isValidId(id: unknown): id is string {
  return typeof id === "string" && mongoose.isValidObjectId(id);
}

async function activeUserIds(ids: string[]) {
  const uniqueIds = [...new Set(ids)];

  if (uniqueIds.some((id) => !isValidId(id))) {
    return null;
  }
   const users = await User.find({
    _id: { $in: uniqueIds },
    isActive: true,
  }).select("_id");

  if (users.length !== uniqueIds.length) {
    return null;
  }

  return users.map((user) => user._id);
}
export async function createTeam(req: AuthRequest, res: Response) {
  try {
    const name =
      typeof req.body.name === "string" ? req.body.name.trim() : "";
    const description =
      typeof req.body.description === "string"
        ? req.body.description.trim()
        : undefined;

        const workspaceId: unknown = req.body.workspace;

if (
  workspaceId !== undefined &&
  (typeof workspaceId !== "string" ||
    !mongoose.isValidObjectId(workspaceId))
) {
  return res.status(400).json({
    message: "Invalid workspace ID",
  });
}

    if (name.length < 2 || name.length > 100) {
      return res.status(400).json({
        message: "Team name must be between 2 and 100 characters",
      });
    }

    if (description && description.length > 500) {
      return res.status(400).json({
        message: "Description cannot exceed 500 characters",
      });
    }

     const requestedMembers = req.body.members ?? [];

    if (
      !Array.isArray(requestedMembers) ||
      !requestedMembers.every((id: unknown) => typeof id === "string")
    ) {
      return res.status(400).json({
        message: "Members must be an array of user IDs",
      });
    }

    const memberIds = [
      ...new Set<string>([req.user!.id, ...requestedMembers]),
    ];

    const validMembers = await activeUserIds(memberIds);

    if (!validMembers) {
      return res.status(400).json({
        message: "One or more member IDs are invalid or inactive",
      });
    }
    if (typeof workspaceId === "string") {
  const workspaceFilter: Record<string, unknown> = {
    _id: workspaceId,
  };

  if (req.user!.role !== "admin") {
    workspaceFilter.members = new mongoose.Types.ObjectId(
      req.user!.id
    );
  }

  const workspace = await Workspace.findOne(workspaceFilter).select(
    "_id members"
  );

  if (!workspace) {
    return res.status(404).json({
      message: "Workspace not found or you do not have access",
    });
  }

  const workspaceMemberIds = new Set(
    workspace.members.map((member) => member.toString())
  );

  if (memberIds.some((memberId) => !workspaceMemberIds.has(memberId))) {
    return res.status(400).json({
      message: "All selected team members must belong to the workspace",
    });
  }
}

const team = await Team.create({
  name,
  description,
  owner: req.user!.id,
  members: validMembers,
  ...(typeof workspaceId === "string"
    ? { workspace: workspaceId }
    : {}),
});

    await ActivityLog.create({
      actor: req.user!.id,
      action: "created",
      entityType: "team",
      entityId: team._id,
      description: `Created team: ${team.name}`,
    });

    return res.status(201).json({
      message: "Team created successfully",
      team,
    });
  } catch (error) {
    console.error("Create team error:", error);
    return res.status(500).json({
      message: "Failed to create team",
    });
  }
}

export async function listTeams(req: AuthRequest, res: Response) {
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

    const teams = await Team.find(filter)
      .populate("owner", "name email role")
      .populate("members", "name email role")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      count: teams.length,
      teams,
    });
  } catch (error) {
    console.error("List teams error:", error);
    return res.status(500).json({
      message: "Failed to fetch teams",
    });
  }
}


export async function getTeam(req: AuthRequest, res: Response) {
  try {
  const rawId = req.params.id;
const id = typeof rawId === "string" ? rawId : "";

if (!isValidId(id)) {
  return res.status(400).json({ message: "Invalid team ID" });
}
    const team = await Team.findById(id)
      .populate("owner", "name email role")
      .populate("members", "name email role");

    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    if (req.user!.role !== "admin" && team.workspace) {
  const hasWorkspaceAccess = await Workspace.exists({
    _id: team.workspace,
    members: new mongoose.Types.ObjectId(req.user!.id),
  });

  if (!hasWorkspaceAccess) {
    return res.status(404).json({
      message: "Team not found",
    });
  }
}

    const canView =
      req.user!.role === "admin" ||
      team.owner._id.toString() === req.user!.id ||
      team.members.some(
        (member: any) => member._id.toString() === req.user!.id
      );

    if (!canView) {
      return res.status(403).json({
        message: "You cannot access this team",
      });
    }

    return res.status(200).json({ team });
  } catch (error) {
    console.error("Get team error:", error);
    return res.status(500).json({
      message: "Failed to fetch team",
    });
  }
}


export async function updateTeam(req: AuthRequest, res: Response) {
  try {
const rawId = req.params.id;
const id = typeof rawId === "string" ? rawId : "";

if (!isValidId(id)) {
  return res.status(400).json({ message: "Invalid team ID" });
}

    const team = await Team.findById(id);

    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    if (
      req.user!.role !== "admin" &&
      team.owner.toString() !== req.user!.id
    ) {
      return res.status(403).json({
        message: "Only the team owner or an admin can update this team",
      });
    }

    const updates: Record<string, unknown> = {};
    if (req.body.workspace !== undefined) {
  const workspaceId = req.body.workspace;

  if (
    typeof workspaceId !== "string" ||
    !mongoose.isValidObjectId(workspaceId)
  ) {
    return res.status(400).json({
      message: "Invalid workspace ID",
    });
  }

  const workspaceFilter: Record<string, unknown> = {
    _id: workspaceId,
  };

  if (req.user!.role !== "admin") {
    workspaceFilter.members = new mongoose.Types.ObjectId(req.user!.id);
  }

  const workspace = await Workspace.findOne(workspaceFilter)
    .select("_id members")
    .lean();

  if (!workspace) {
    return res.status(404).json({
      message: "Workspace not found or you do not have access",
    });
  }

  const workspaceMemberIds = new Set(
    workspace.members.map((member) => member.toString())
  );

  const teamMemberIds = [
    team.owner.toString(),
    ...team.members.map((member) => member.toString()),
  ];

  if (teamMemberIds.some((memberId) => !workspaceMemberIds.has(memberId))) {
    return res.status(400).json({
      message: "Team owner and all team members must belong to the workspace",
    });
  }

  updates.workspace = workspace._id;
}

    if (req.body.name !== undefined) {
      if (
        typeof req.body.name !== "string" ||
        req.body.name.trim().length < 2 ||
        req.body.name.trim().length > 100
      ) {
        return res.status(400).json({ message: "Invalid team name" });
      }

      updates.name = req.body.name.trim();
    }

    if (req.body.description !== undefined) {
      if (
        typeof req.body.description !== "string" ||
        req.body.description.trim().length > 500
      ) {
        return res.status(400).json({
          message: "Invalid team description",
        });
      }

      updates.description = req.body.description.trim();
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "Provide a valid name or description to update",
      });
    }

    Object.assign(team, updates);
    await team.save();

    await ActivityLog.create({
      actor: req.user!.id,
      action: "updated",
      entityType: "team",
      entityId: team._id,
      description: `Updated team: ${team.name}`,
    });

    return res.status(200).json({
      message: "Team updated successfully",
      team,
    });
  } catch (error) {
    console.error("Update team error:", error);
    return res.status(500).json({
      message: "Failed to update team",
    });
  }
}

export async function addTeamMember(req: AuthRequest, res: Response) {
  try {
   const rawId = req.params.id;
const id = typeof rawId === "string" ? rawId : "";
const userId: unknown = req.body.userId;

    if (!isValidId(id)) {
      return res.status(400).json({ message: "Invalid team ID" });
    }

    if (typeof userId !== "string" || !isValidId(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const team = await Team.findById(id);

    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    if (
      req.user!.role !== "admin" &&
      team.owner.toString() !== req.user!.id
    ) {
      return res.status(403).json({
        message: "Only the team owner or an admin can manage members",
      });
    }

    const validUsers = await activeUserIds([userId]);

    if (!validUsers) {
      return res.status(400).json({
        message: "User does not exist or is inactive",
      });
    }
    if (team.workspace) {
  const workspace = await Workspace.findOne({
    _id: team.workspace,
    members: new mongoose.Types.ObjectId(userId),
  }).select("_id");

  if (!workspace) {
    return res.status(400).json({
      message: "The user must belong to the team's workspace",
    });
  }
}

    if (team.members.some((member) => member.toString() === userId)) {
      return res.status(409).json({
        message: "User is already a team member",
      });
    }

    team.members.push(validUsers[0]);
    await team.save();

    await ActivityLog.create({
      actor: req.user!.id,
      action: "updated",
      entityType: "team",
      entityId: team._id,
      description: `Added member to team: ${team.name}`,
    });

    return res.status(200).json({
      message: "Team member added successfully",
      team,
    });
  } catch (error) {
    console.error("Add team member error:", error);
    return res.status(500).json({
      message: "Failed to add team member",
    });
  }
}

export async function removeTeamMember(req: AuthRequest, res: Response) {
  try {
   const rawId = req.params.id;
const rawUserId = req.params.userId;

const id = typeof rawId === "string" ? rawId : "";
const userId = typeof rawUserId === "string" ? rawUserId : "";

if (!isValidId(id) || !isValidId(userId)) {
  return res.status(400).json({
    message: "Invalid team or user ID",
  });
}

    const team = await Team.findById(id);

    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    if (
      req.user!.role !== "admin" &&
      team.owner.toString() !== req.user!.id
    ) {
      return res.status(403).json({
        message: "Only the team owner or an admin can manage members",
      });
    }

    if (team.owner.toString() === userId) {
      return res.status(400).json({
        message: "Transfer team ownership before removing the owner",
      });
    }

    const memberExists = team.members.some(
      (member) => member.toString() === userId
    );

    if (!memberExists) {
      return res.status(404).json({
        message: "User is not a member of this team",
      });
    }

    team.members = team.members.filter(
      (member) => member.toString() !== userId
    );

    await team.save();

    await ActivityLog.create({
      actor: req.user!.id,
      action: "updated",
      entityType: "team",
      entityId: team._id,
      description: `Removed member from team: ${team.name}`,
    });

    return res.status(200).json({
      message: "Team member removed successfully",
      team,
    });
  } catch (error) {
    console.error("Remove team member error:", error);
    return res.status(500).json({
      message: "Failed to remove team member",
    });
  }
}