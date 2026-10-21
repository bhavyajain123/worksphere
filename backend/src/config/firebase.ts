import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import * as fs from "fs";
import * as path from "path";

if (!getApps().length) {
  const keyPath = path.resolve(process.cwd(), "serviceAccountKey.json");
  const serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf8"));
  initializeApp({ credential: cert(serviceAccount) });
}

export const adminAuth = getAuth();