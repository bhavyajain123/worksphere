import { auth, authReady } from "./firebase";

const BASE = "/api";

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  await authReady;

  const current = auth.currentUser;
  if (!current) {
    if (localStorage.getItem("token") || localStorage.getItem("user")) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.reload();
    }
    throw new Error("Please sign in again");
  }

  const token = await current.getIdToken();

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (res.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    await auth.signOut();
    window.location.reload();
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Error ${res.status}`);
  }
  return res.json();
}