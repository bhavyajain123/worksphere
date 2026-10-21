
import mongoose from "mongoose";
import dns from "node:dns";

export async function connectDatabase(): Promise<void> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is missing in .env");
  }

  dns.setServers(["8.8.8.8", "8.8.4.4"]);

  await mongoose.connect(uri);

  console.log("MongoDB Atlas connected successfully");
}
