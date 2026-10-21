
import dotenv from "dotenv";
import path from "node:path";
import dns from "node:dns";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "./src/models/User";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function main() {
  const email = "employee.test@example.com";
  const newPassword = process.env.TEST_EMPLOYEE_PASSWORD;

  if (!newPassword || newPassword.length < 8 || newPassword.length > 72) {
    throw new Error(
      "Set TEST_EMPLOYEE_PASSWORD to a password of 8–72 characters."
    );
  }

  
  dns.setServers(["8.8.8.8", "8.8.4.4"]);

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI missing. Check your .env file.");
  }

  try {
    await mongoose.connect(uri);
    console.log("MongoDB connected.");

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      throw new Error(`Employee account not found: ${email}`);
    }

    if (user.role !== "employee") {
      throw new Error("The specified account is not an employee.");
    }

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    console.log(`Password reset successfully for ${email}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown error";

  console.error("Password reset failed:", message);
  process.exitCode = 1;
});
