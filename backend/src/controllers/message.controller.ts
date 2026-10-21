
import type { Request, Response } from "express";
import mongoose from "mongoose";
import Message from "../models/Message";
import Team from "../models/Team";
import type { AuthRequest } from "../middleware/auth";

function isValidId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id) &&
    /^[a-f\d]{24}$/i.test(id);
}


type TeamAccessResult =
  | { error: string; status: number }
  | { team: { owner: mongoose.Types.ObjectId; members: mongoose.Types.ObjectId[] } };

async function getAuthorizedTeam(
  teamId: string,
  userId: string
): Promise<TeamAccessResult> {
  if (!isValidId(teamId)) {
    return { error: "Invalid team ID", status: 400 };
  }

  const team = await Team.findById(teamId).select("owner members");

  if (!team) {
    return { error: "Team not found", status: 404 };
  }

  const isOwner = String(team.owner) === userId;
  const isMember = team.members.some(
    (member) => String(member) === userId
  );

  if (!isOwner && !isMember) {
    return {
      error: "You do not have access to this team",
      status: 403,
    };
  }

  return { team };
}


export async function sendMessage(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const userId = req.user?.id;
    const { teamId, content } = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    if (typeof teamId !== "string" || !isValidId(teamId)) {
      res.status(400).json({
        success: false,
        message: "Invalid team ID",
      });
      return;
    }

    if (
      typeof content !== "string" ||
      content.trim().length === 0 ||
      content.trim().length > 5000
    ) {
      res.status(400).json({
        success: false,
        message: "Message must contain 1 to 5000 characters",
      });
      return;
    }

    const access = await getAuthorizedTeam(teamId, userId);

    if ("error" in access) {
      res.status(access.status).json({
        success: false,
        message: access.error,
      });
      return;
    }

    const message = await Message.create({
      team: teamId,
      sender: userId,
      content: content.trim(),
      readBy: [userId],
    });

    res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: message,
    });
  } catch (error: unknown) {
    console.error("Send message failed:", error);
    res.status(500).json({
      success: false,
      message: "Unable to send message",
    });
  }
}

export async function listMessages(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const userId = req.user?.id;
    const { teamId } = req.params;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    if (typeof teamId !== "string") {
      res.status(400).json({
        success: false,
        message: "Invalid team ID",
      });
      return;
    }

    const access = await getAuthorizedTeam(teamId, userId);

    if ("error" in access) {
      res.status(access.status).json({
        success: false,
        message: access.error,
      });
      return;
    }

    const messages = await Message.find({ team: teamId })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("sender", "name email role")
      .lean();

    res.status(200).json({
      success: true,
      count: messages.length,
      messages: messages.reverse(),
    });
  } catch (error: unknown) {
    console.error("List messages failed:", error);
    res.status(500).json({
      success: false,
      message: "Unable to fetch messages",
    });
  }
}

export async function markMessageRead(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    if (typeof id !== "string" || !isValidId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid message ID",
      });
      return;
    }

    const message = await Message.findById(id);

    if (!message) {
      res.status(404).json({
        success: false,
        message: "Message not found",
      });
      return;
    }

    const access = await getAuthorizedTeam(
      String(message.team),
      userId
    );

    if ("error" in access) {
      res.status(access.status).json({
        success: false,
        message: access.error,
      });
      return;
    }

    await Message.updateOne(
      { _id: message._id },
      { $addToSet: { readBy: userId } }
    );

    res.status(200).json({
      success: true,
      message: "Message marked as read",
    });
  } catch (error: unknown) {
    console.error("Mark message read failed:", error);
    res.status(500).json({
      success: false,
      message: "Unable to mark message as read",
    });
  }
}

export async function deleteMessage(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    if (typeof id !== "string" || !isValidId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid message ID",
      });
      return;
    }

    const message = await Message.findById(id);

    if (!message) {
      res.status(404).json({
        success: false,
        message: "Message not found",
      });
      return;
    }

    const access = await getAuthorizedTeam(
      String(message.team),
      userId
    );

    if ("error" in access) {
      res.status(access.status).json({
        success: false,
        message: access.error,
      });
      return;
    }

    const isSender = String(message.sender) === userId;
    const isAdmin = req.user?.role === "admin";

    if (!isSender && !isAdmin) {
      res.status(403).json({
        success: false,
        message: "Only the sender or an admin can delete this message",
      });
      return;
    }

    await Message.deleteOne({ _id: message._id });

    res.status(200).json({
      success: true,
      message: "Message deleted successfully",
    });
  } catch (error: unknown) {
    console.error("Delete message failed:", error);
    res.status(500).json({
      success: false,
      message: "Unable to delete message",
    });
  }
}
