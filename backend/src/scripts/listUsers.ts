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
    const users = await User.find({})
      .select("name email role isActive")
.lean();
      

console.table(users.map((user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  isActive: user.isActive
})));
console.log(
  JSON.stringify(
    users.map((user) => ({
      id: user._id.toString(),
      name: user.name,
      role: user.role,
      isActive: user.isActive,
    })),
    null,
    2
  )
);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
