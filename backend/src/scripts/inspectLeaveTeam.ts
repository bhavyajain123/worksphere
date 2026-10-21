
import "dotenv/config";
import mongoose from "mongoose";
import dns from "node:dns";
import User from "../models/User";
import Project from "../models/Project";
import Leave from "../models/Leave";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI missing from .env");

  dns.setServers(["8.8.8.8", "8.8.4.4"]);
  await mongoose.connect(uri);

  try {
    const projects = await Project.find({
      name: "WorkSphere Development Phase 1",
    })
      .select("name owner members status")
      .lean();

    const projectUserIds = new Set<string>();

    for (const project of projects) {
      projectUserIds.add(String(project.owner));
      for (const member of project.members) {
        projectUserIds.add(String(member));
      }
    }

    const users = await User.find({})
      .select("_id name email role isActive")
      .lean();

    const userMap = new Map(
      users.map((user) => [String(user._id), user])
    );

    const leaves = await Leave.find({})
      .select("_id employee leaveType status startDate endDate")
      .sort({ createdAt: -1 })
      .lean();

    console.log("Project users:");
    console.table(
      users
        .filter((user) => projectUserIds.has(String(user._id)))
        .map((user) => ({
          id: String(user._id),
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
        }))
    );

    console.log("Leave requests and team membership:");
    console.table(
      leaves.map((leave) => {
        const employeeId = String(leave.employee);
        const employee = userMap.get(employeeId);

        return {
          leaveId: String(leave._id),
          employeeId,
          employeeEmail: employee?.email ?? "Unknown",
          role: employee?.role ?? "Unknown",
          inProjectTeam: projectUserIds.has(employeeId),
          leaveType: leave.leaveType,
          status: leave.status,
          startDate: leave.startDate.toISOString().slice(0, 10),
          endDate: leave.endDate.toISOString().slice(0, 10),
        };
      })
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
