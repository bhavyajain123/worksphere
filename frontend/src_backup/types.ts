export type TaskStatus = "Todo" | "In progress" | "In review" | "Done";

export type Project = {
  id: string | number;
  name: string;
  description: string;
  color: string;
  progress: number;
  tasks: number;
  team: string[];
   workspaceId?: string;
     apiStatus?: string;
  status: "On track" | "At risk" | "Completed";
};

export type Task = {
  id: string | number;
  projectId?: string;
  title: string;
  project: string;
  assignee: string;
  initials: string;
  due: string;
  dueDate?: string;
  createdAt?: string;
  updatedAt?: string;
  status: TaskStatus;
  priority: "High" | "Medium" | "Low" | "Urgent";
};