import type { Project, Task, TaskStatus } from "./types";

export const toList = (res: any): any[] => {
  if (Array.isArray(res)) return res;
  if (res && typeof res === "object") {
    for (const v of Object.values(res)) {
      if (Array.isArray(v)) return v;
      if (v && typeof v === "object") {
        for (const w of Object.values(v as any)) if (Array.isArray(w)) return w as any[];
      }
    }
  }
  return [];
};

const colors = ["purple", "blue", "orange", "green"];

export const initialsOf = (name: string) =>
  (name || "?").split(" ").filter(Boolean).map((s) => s[0]).join("").slice(0, 2).toUpperCase() || "?";

const normalize = (v: any) => String(v ?? "").toLowerCase().replace(/[-_\s]+/g, " ").trim();

const taskStatusMap: Record<string, TaskStatus> = {
  "todo": "Todo",
  "in progress": "In progress",
  "review": "In review",
  "done": "Done",
};

export const statusToApi: Record<TaskStatus, string> = {
  "Todo": "todo",
  "In progress": "in-progress",
  "In review": "review",
  "Done": "done",
};

const projectStatusMap: Record<string, Project["status"]> = {
  "planning": "On track",
  "active": "On track",
  "on hold": "At risk",
  "completed": "Completed",
  "archived": "Completed",
};

const formatDue = (d: any) => {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return String(d);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return "Today";
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export const toProject = (p: any, i: number): Project => ({
  id: String(p._id ?? p.id),
  workspaceId: p.workspace ? String(p.workspace?._id ?? p.workspace) : undefined,
    apiStatus: String(p.status ?? "planning"),
  name: p.name ?? "Untitled",
  description: p.description ?? "",
  color: colors[i % 4],
  progress: 0,
  tasks: 0,
  team: (p.members ?? []).map((m: any) => (m && typeof m === "object" ? initialsOf(m.name) : "U")),
  status: projectStatusMap[normalize(p.status)] ?? "On track",
});

export const toTask = (t: any, nameById: Record<string, string>, currentUser: any): Task => {
  const projectId = String(t.project?._id ?? t.project ?? "");
  const projectName = t.project?.name ?? nameById[projectId] ?? "—";

  const assigned = t.assignedTo;
  const assignedId = String(assigned?._id ?? assigned ?? "");
  const assigneeName =
    assigned?.name ?? (assignedId && assignedId === String(currentUser?.id) ? currentUser?.name : "Teammate");

  const priority = String(t.priority ?? "medium");

  return {
    id: String(t._id ?? t.id),
    projectId,
    title: t.title ?? "Untitled task",
    project: projectName,
    assignee: String(assigneeName),
    initials: initialsOf(String(assigneeName)),
    due: formatDue(t.dueDate),
    dueDate: t.dueDate ? String(t.dueDate) : undefined,
    createdAt: t.createdAt ? String(t.createdAt) : undefined,
    updatedAt: t.updatedAt ? String(t.updatedAt) : undefined,
    status: taskStatusMap[normalize(t.status)] ?? "Todo",
    priority: (priority.charAt(0).toUpperCase() + priority.slice(1)) as Task["priority"],
  };
};