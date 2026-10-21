import "dotenv/config";
import mongoose from "mongoose";
import dns from "node:dns";
import User from "../models/User";

async function makeAdmin(): Promise<void>{
     try {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      throw new Error("MONGODB_URI missing from .env");
    }
     dns.setServers(["8.8.8.8", "8.8.4.4"]);
    await mongoose.connect(uri);

    const email = "bhavya.test@example.com";

    const user = await User.findOneAndUpdate(
      { email },
      { $set: { role: "admin" } },
      { returnDocument: "after", runValidators: true }
    ).select("name email role isActive");

    if (!user) {
      throw new Error(
        "User not found. Register the account first."
      );
    }
    console.log("Admin role assigned:", {
      name: user.name,
      email: user.email,
      role: user.role
    });
  } catch (error) {
    console.error("Admin setup failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }

}
void makeAdmin();