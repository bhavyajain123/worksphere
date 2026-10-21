import "dotenv/config";
import mongoose from "mongoose";
import dns from "node:dns";
import User from "../models/User";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI missing from .env");

  dns.setServers(["8.8.8.8", "8.8.4.4"]);
  await mongoose.connect(uri);

  try {
    const user = await User.findOneAndUpdate(
      {
        email: "manager.test@example.com",
        role: "employee"
      },
      { $set: { role: "manager" } },
      { new: true, runValidators: true }
    ).select("name email role isActive");

    if (!user) {
      throw new Error(
        "Manager account not found, or it is not currently an employee. No change made."
      );
    }

    console.log("Manager role assigned:", user);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error("Manager setup failed:", error.message);
  process.exitCode = 1;
});
