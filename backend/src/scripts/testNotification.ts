import "dotenv/config";
import mongoose from "mongoose";
import dns from "node:dns";
import { createNotification } from "../services/notification.service";

async function main() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is missing in .env");
  }
    const recipientId = process.argv[2];

  if (!recipientId || !mongoose.isValidObjectId(recipientId)) {
    throw new Error(
      "Pass a valid employee MongoDB ID as the first argument"
    );
  }

    dns.setServers(["8.8.8.8", "8.8.4.4"]);

  await mongoose.connect(uri);

  try {
    const notification = await createNotification({
      recipient: recipientId,
      type: "task_assigned",
      title: "Test notification",
      message: "Your WorkSphere notification system is working.",
      link: "/tasks",
    });

    console.log("Notification created successfully:");
    console.log(JSON.stringify(notification, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error("Notification test failed:", error);
  process.exitCode = 1;
});