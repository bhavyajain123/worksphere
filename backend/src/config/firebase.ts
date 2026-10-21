import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import * as fs from "fs";
import * as path from "path";

function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  }
  const keyPath = path.resolve(process.cwd(), "serviceAccountKey.json");
  return JSON.parse(fs.readFileSync(keyPath, "utf8"));
}

if (!getApps().length) {
  initializeApp({ credential: cert(loadServiceAccount()) });
}

export const adminAuth = getAuth();