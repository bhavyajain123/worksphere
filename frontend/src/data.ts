import type { Project, Task } from "./types";

export const initialProjects: Project[] = [
  {
    id: 1,
    name: "Website redesign",
    description: "Refresh the marketing website and improve conversion.",
    color: "purple",
    progress: 72,
    tasks: 18,
    team: ["AS", "MK", "JL", "RD"],
    status: "On track",
  },
  {
    id: 2,
    name: "Mobile app launch",
    description: "Ship the new mobile experience to customers.",
    color: "blue",
    progress: 48,
    tasks: 24,
    team: ["MK", "TS", "AS"],
    status: "At risk",
  },
  {
    id: 3,
    name: "Customer insights",
    description: "Centralize feedback and build a reporting dashboard.",
    color: "orange",
    progress: 91,
    tasks: 12,
    team: ["JL", "RD", "TS"],
    status: "On track",
  },
  {
    id: 4,
    name: "Internal operations",
    description: "Improve team processes and internal documentation.",
    color: "green",
    progress: 100,
    tasks: 9,
    team: ["AS", "JL"],
    status: "Completed",
  },
];

export const initialTasks: Task[] = [
  { id: 101, title: "Finalize homepage wireframes", project: "Website redesign", assignee: "Ayush Sharma", initials: "AS", due: "Today", status: "In progress", priority: "High" },
  { id: 102, title: "Review mobile navigation", project: "Mobile app launch", assignee: "Maya Kapoor", initials: "MK", due: "Tomorrow", status: "In review", priority: "High" },
  { id: 103, title: "Prepare customer interview notes", project: "Customer insights", assignee: "Jordan Lee", initials: "JL", due: "Oct 22", status: "Todo", priority: "Medium" },
  { id: 104, title: "Update component documentation", project: "Website redesign", assignee: "Riya Das", initials: "RD", due: "Oct 23", status: "Todo", priority: "Low" },
  { id: 105, title: "Create onboarding checklist", project: "Internal operations", assignee: "Ayush Sharma", initials: "AS", due: "Oct 18", status: "Done", priority: "Medium" },
  { id: 106, title: "Test checkout flow", project: "Mobile app launch", assignee: "Maya Kapoor", initials: "MK", due: "Oct 24", status: "In progress", priority: "High" },
];

export const teamMembers = [
  { name: "Ayush Sharma", role: "Workspace admin", email: "ayush@worksphere.dev", initials: "AS", color: "purple", status: "Online" },
  { name: "Maya Kapoor", role: "Product designer", email: "maya@worksphere.dev", initials: "MK", color: "pink", status: "Online" },
  { name: "Jordan Lee", role: "Frontend engineer", email: "jordan@worksphere.dev", initials: "JL", color: "blue", status: "Away" },
  { name: "Riya Das", role: "Project manager", email: "riya@worksphere.dev", initials: "RD", color: "orange", status: "Offline" },
  { name: "Theo Singh", role: "QA engineer", email: "theo@worksphere.dev", initials: "TS", color: "green", status: "Online" },
];

export const initialMessages = [
  { id: 1, author: "Maya Kapoor", initials: "MK", time: "10:42 AM", text: "I’ve uploaded the latest homepage concepts. Could everyone review them before stand-up?" },
  { id: 2, author: "Ayush Sharma", initials: "AS", time: "10:45 AM", text: "Looks great! I’ll add notes to the mobile layout this afternoon." },
  { id: 3, author: "Jordan Lee", initials: "JL", time: "11:03 AM", text: "The updated components are on the staging branch now." },
];

export const chartData = [
  { day: "Mon", completed: 12, created: 8 },
  { day: "Tue", completed: 18, created: 11 },
  { day: "Wed", completed: 14, created: 15 },
  { day: "Thu", completed: 23, created: 12 },
  { day: "Fri", completed: 19, created: 9 },
  { day: "Sat", completed: 8, created: 4 },
  { day: "Sun", completed: 11, created: 6 },
];
