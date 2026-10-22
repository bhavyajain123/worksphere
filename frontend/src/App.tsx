import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, CalendarDays,
  Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3,
  Command, FileText, FolderKanban, Gauge, LayoutDashboard, ListTodo,
  LogOut, Menu, MessageSquare, MoreHorizontal, Plus, Search, Send,
  Settings, ShieldCheck, SlidersHorizontal, Sparkles, Users, X, Zap,
  CheckCircle2, Circle, AlertCircle, Paperclip, Download, Filter, Eye,
  UserRound, CalendarCheck, BriefcaseBusiness, ChartNoAxesCombined, Flag, UsersRound, Building2, Layers3, Image, LockKeyhole, CreditCard,Moon, Sun,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis,
} from "recharts";

import type { Project, Task, TaskStatus } from "./types";
import { api, API_BASE } from "./api";
import ProPaymentModal from "./ProPaymentModal";
import Login from "./Login";
import { signOut } from "firebase/auth";
import { auth } from "./firebase";
import PaymentRequestsPage from "./PaymentRequestsPage";

import { toList, toProject, toTask, statusToApi, initialsOf } from "./mappers";
type Page =
  | "Overview" | "Projects" | "My Tasks" | "Team" | "Messages"
  | "Timesheets" | "Reports" | "Settings" | "Leave Requests" | "Files"
  | "Notifications" | "AI Reports" | "Calendar" | "Goals & OKRs"
  | "Budget & Expenses" | "Automations" | "Integrations" | "Audit Log" | "Help Center"
  | "Milestones" | "Workload" | "Clients" | "Templates" | "Assets" | "Security" | "Billing" | "Ask AI" | "Payment requests";
type Member = { id: string; name: string; role: string; email: string; initials: string; color: string; status: string };
const memberColors = ["purple", "pink", "blue", "orange", "green"];
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const fmtUtc = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const buildWeekChart = (tasks: Task[]) => {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
  return days.map((d) => {
    const key = ymd(d);
    const sameDay = (iso?: string) => !!iso && ymd(new Date(iso)) === key;
    return {
      day: d.toLocaleDateString("en-US", { weekday: "short" }),
      created: tasks.filter((t) => sameDay(t.createdAt)).length,
      completed: tasks.filter((t) => t.status === "Done" && sameDay(t.updatedAt)).length,
    };
  });
};

const navGroups: { label: string; items: { label: Page; icon: typeof LayoutDashboard; badge?: string }[] }[] = [
  { label: "Workspace", items: [
    { label: "Overview", icon: LayoutDashboard },
    { label: "Projects", icon: FolderKanban },
      { label: "My Tasks", icon: ListTodo },
    { label: "Team", icon: Users },
       { label: "Messages", icon: MessageSquare },
  ] },
  { label: "Manage", items: [
    { label: "Calendar", icon: CalendarDays },
    { label: "Timesheets", icon: Clock3 },
    { label: "Goals & OKRs", icon: Gauge },
    { label: "Budget & Expenses", icon: BriefcaseBusiness },
    { label: "Reports", icon: ChartNoAxesCombined },
    { label: "Leave Requests", icon: CalendarCheck },
    { label: "Files", icon: FileText },
  ] },
  { label: "Planning & admin", items: [
    { label: "Milestones", icon: Flag },
    { label: "Workload", icon: UsersRound },
    { label: "Clients", icon: Building2 },
    { label: "Templates", icon: Layers3 },
    { label: "Assets", icon: Image },
    { label: "Security", icon: LockKeyhole },
       { label: "Billing", icon: CreditCard },
    { label: "Payment requests", icon: ShieldCheck },
  ] },
];

const pageDescriptions: Record<Page, string> = {
  Overview: "Here’s what’s happening across your workspace today.",
  Calendar: "Plan milestones, meetings, deadlines, and team availability.",
  "Goals & OKRs": "Align company objectives with measurable team outcomes.",
  "Budget & Expenses": "Track project budgets, spend, and remaining runway.",
  Automations: "Automate repetitive workflow steps and team reminders.",
  Integrations: "Connect the tools your team already uses.",
  "Audit Log": "Review important workspace events and security activity.",
  "Help Center": "Find answers, onboarding guides, and support resources.",
  Milestones: "Track critical delivery dates and project checkpoints.",
  Workload: "Balance assignments across the team and spot capacity issues.",
  Clients: "Manage client accounts, contacts, and active engagements.",
  Templates: "Reuse proven project plans, task lists, and team workflows.",
  Assets: "Organize shared brand assets and project resources.",
  Security: "Review access controls, sessions, and workspace safeguards.",
  Billing: "Review your plan, invoices, seats, and payment settings.",
  Projects: "Track initiatives, milestones, and team progress.",
  "My Tasks": "Stay focused on your priorities and upcoming deadlines.",
  Team: "Meet your teammates and see what everyone is working on.",
  Messages: "Keep conversations moving and decisions in one place.",
  Timesheets: "Review your time entries and weekly workload.",
  Reports: "Understand delivery trends and team performance.",
  Settings: "Manage your workspace preferences and profile.",
  "Leave Requests": "Plan time away and manage approvals.",
  Files: "Find project documents, shared assets, and deliverables.",
  Notifications: "Catch up on updates that need your attention.",
  "AI Reports": "Turn project activity into a concise, actionable summary.",
  "Ask AI": "Ask questions about your tasks, projects, hours and budget.",
  "Payment requests": "Verify UPI payments to activate Pro for a workspace.",
};

function Avatar({ initials, color = "purple", small = false }: { initials: string; color?: string; small?: boolean }) {
  return <span className={`avatar avatar-${color} ${small ? "avatar-small" : ""}`}>{initials}</span>;
}

function StatusPill({ children }: { children: ReactNode }) {
 const value = String(children).toLowerCase().replace(/ /g, "-");
  return <span className={`status-pill status-${value}`}>{children}</span>;
}

function SectionTitle({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return (
    <div className="section-title">
      <div>
        <div className="eyebrow"><span className="live-dot" /> {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).toUpperCase()}</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action && <div className="title-actions">{action}</div>}
    </div>
  );
}

function Dashboard() {
  const currentUser = useMemo(() => {
  try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }
}, []);
  const [page, setPage] = useState<Page>("Overview");
  const [projects, setProjects] = useState<Project[]>([]);
const [tasks, setTasks] = useState<Task[]>([]);
const [teams, setTeams] = useState<any[]>([]);
const [unread, setUnread] = useState(0);

const loadUnread = async () => {
  try {
    const res = await api<any>("/notifications/unread-count");
    setUnread(Number(res.count ?? res.unreadCount ?? res.unread ?? res.data?.count ?? 0));
  } catch {  }
};

 
  const [search, setSearch] = useState("");
  const [showCommandPalette, setShowCommandPalette] = useState(false);
const [commandQuery, setCommandQuery] = useState("");
const [commandIndex, setCommandIndex] = useState(0);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [showCreateWorkspaceModal, setShowCreateWorkspaceModal] = useState(false);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [expandedHelp, setExpandedHelp] = useState<string | null>("Getting started");
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(() => {
    try { return localStorage.getItem("worksphere-active-workspace-id") || ""; }
    catch { return ""; }
  });
  const activeWs = workspaces.find((w) => String(w._id) === activeWorkspaceId) ?? workspaces[0];
  const activeWorkspace: string = activeWs?.name ?? "Workspace";
    const isPro = activeWs?.plan === "pro";
    console.log("activeWs:", activeWs, "id:", activeWs?._id, "len:", String(activeWs?._id).length);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [taskFilter, setTaskFilter] = useState("All tasks");
  const [toast, setToast] = useState("");

  const [theme, setTheme] = useState<"light" | "dark">(
  () => (localStorage.getItem("theme") as "light" | "dark") || "light"
);

useEffect(() => {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
}, [theme]);
 const [profileName, setProfileName] = useState(currentUser.name || "Ayush Sharma");


  const wsProjects = useMemo(
    () => (activeWs ? projects.filter((p) => p.workspaceId === String(activeWs._id)) : projects),
    [projects, activeWs]
  );
  const wsTasks = useMemo(() => {
    const ids = new Set(wsProjects.map((p) => String(p.id)));
    return tasks.filter((t) => ids.has(String(t.projectId)));
  }, [tasks, wsProjects]);

  const filteredTasks = useMemo(() => wsTasks.filter((task) => {
    const matchesSearch = `${task.title} ${task.project} ${task.assignee}`.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = taskFilter === "All tasks" || task.status === taskFilter;
    return matchesSearch && matchesFilter;
  }), [wsTasks, search, taskFilter]);

const loadData = async () => {
  try {
    const [pRes, tRes] = await Promise.all([api<any>("/projects"), api<any>("/tasks")]);
    const rawProjects = toList(pRes);
    const nameById: Record<string, string> = {};
    rawProjects.forEach((p: any) => { nameById[String(p._id ?? p.id)] = p.name; });

    const mappedTasks = toList(tRes).map((t: any) => toTask(t, nameById, currentUser));
    const mappedProjects = rawProjects.map((p: any, i: number) => {
      const project = toProject(p, i);
      const mine = mappedTasks.filter((t) => t.projectId === String(project.id));
      const done = mine.filter((t) => t.status === "Done").length;
      return {
        ...project,
        tasks: mine.length,
        progress: project.status === "Completed" ? 100 : mine.length ? Math.round((done / mine.length) * 100) : 0,
      };
    });
    setProjects(mappedProjects);
    setTasks(mappedTasks);
  } catch (err) {
    console.error(err);
  }
};

const loadTeams = async () => {
  try {
    const res = await api<any>("/teams");
    setTeams(toList(res));
  } catch (err) {
    console.error(err);
  }
};

const loadWorkspaces = async () => {
  try {
    const res = await api<any>("/workspaces");
    setWorkspaces(res.workspaces ?? toList(res));
  } catch (err) {
    console.error(err);
  }

};


useEffect(() => {
    loadData();
  loadTeams();
  loadWorkspaces();
  loadUnread();
  const timer = window.setInterval(loadUnread, 30000);
  return () => window.clearInterval(timer);
}, []);

useEffect(() => {
  const handleShortcut = (event: KeyboardEvent) => {
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === "k"
    ) {
      event.preventDefault();

      setShowCommandPalette((open) => !open);
      setCommandQuery("");
      setCommandIndex(0);
    }

    if (event.key === "Escape") {
      setShowCommandPalette(false);
    }
  };

  window.addEventListener("keydown", handleShortcut);

  return () => {
    window.removeEventListener("keydown", handleShortcut);
  };
}, []);

const members = useMemo(() => {
  const map = new Map<string, Member>();
  teams.forEach((team: any) => {
    [team.owner, ...(team.members ?? [])].forEach((u: any) => {
      if (!u || typeof u !== "object") return;
      const id = String(u._id);
      if (map.has(id)) return;
      map.set(id, {
        id,
        name: u.name ?? "User",
        email: u.email ?? "",
        role: String(u.role ?? "employee").replace(/^./, (c) => c.toUpperCase()),
        initials: initialsOf(u.name ?? ""),
        color: memberColors[map.size % memberColors.length],
        status: id === String(currentUser.id) ? "Online" : "Offline",
      });
    });
  });
  return Array.from(map.values());
}, [teams, currentUser]);

const createTeam = async (name: string, description: string): Promise<boolean> => {
  try {
    await api("/teams", {
      method: "POST",
      body: JSON.stringify({ name, ...(description ? { description } : {}) }),
    });
    await loadTeams();
    notify("Team created successfully");
    return true;
  } catch (err: any) {
    notify(err.message || "Could not create team");
    return false;
  }
};

  const notify = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(""), 2800);
  };

    const addWorkspace = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("workspaceName") || "").trim();
    if (!name) return;
    try {
      await api<any>("/workspaces", {
        method: "POST",
        body: JSON.stringify({ name, description: `${name} workspace` }),
      });
      await loadWorkspaces();
    

      setPage("Overview");
      setShowCreateWorkspaceModal(false);
      setShowWorkspaceMenu(false);
      notify(`${name} workspace created`);
    } catch (err: any) {
      notify(err.message || "Could not create workspace");
    }
  };

  const selectWorkspace = (id: string, name: string) => {
    setActiveWorkspaceId(id);
    try { localStorage.setItem("worksphere-active-workspace-id", id); } catch { /* ignore */ }
    setShowWorkspaceMenu(false);
    setPage("Overview");
    notify(`Switched to ${name}`);
  };

const addTask = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const title = String(form.get("title") || "").trim();
  if (!title) return;
  const dueDate = String(form.get("due") || "");
  try {
    await api("/tasks", {
      method: "POST",
      body: JSON.stringify({
        title,
        description: String(form.get("description") || ""),
        projectId: String(form.get("project") || ""),
        assignedTo: currentUser.id ?? currentUser._id,
        priority: String(form.get("priority") || "Medium").toLowerCase(),
        ...(dueDate ? { dueDate: new Date(`${dueDate}T00:00:00.000Z`).toISOString() } : {}),
      }),
    });
    setShowTaskModal(false);
    await loadData();
    notify("Task created successfully");
  } catch (err: any) {
    notify(err.message || "Could not create task");
  }
};

const addProject = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const name = String(form.get("name") || "").trim();
  if (!name) return;
  try {
    await api("/projects", {
      method: "POST",
      body: JSON.stringify({
        name,
                ...(activeWs?._id ? { workspace: String(activeWs._id) } : {}),
        description: String(form.get("description") || "").trim() || "A new workspace initiative.",
      }),
    });
    setShowProjectModal(false);
    await loadData();
    notify("Project created successfully");
  } catch (err: any) {
    notify(err.message || "Could not create project");
  }
};

const changeTaskStatus = async (id: string | number, status: TaskStatus) => {
  const previous = tasks;
  setTasks((current) => current.map((task) => (task.id === id ? { ...task, status } : task)));
  try {
    await api(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ status: statusToApi[status] }) });
    notify(`Task moved to ${status}`);
  } catch (err: any) {
    setTasks(previous);
    notify(err.message || "Could not update task");
  }
};

const editTask = async (id: string | number, data: { title: string; description: string; priority: string; dueDate: string }) => {
  try {
    await api(`/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: data.title,
        ...(data.description ? { description: data.description } : {}),
        priority: data.priority.toLowerCase(),
               ...(data.dueDate ? { dueDate: new Date(`${data.dueDate}T00:00:00.000Z`).toISOString() } : {}),
      }),
    });
    await loadData();
    notify("Task updated");
    return true;
  } catch (err: any) {
    notify(err.message || "Could not update task");
    return false;
  }
};

const deleteTask = async (id: string | number) => {
  if (!window.confirm("Delete this task?")) return;
  try {
    await api(`/tasks/${id}`, { method: "DELETE" });
    await loadData();
    notify("Task deleted");
  } catch (err: any) {
    notify(err.message || "Could not delete task");
  }
};
const saveProfile = async (name: string): Promise<boolean> => {
  try {
    const res = await api<any>("/users/me", {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
    const updated = res.user ?? { ...currentUser, name };
    const merged = { ...currentUser, name: updated.name ?? name };
    localStorage.setItem("user", JSON.stringify(merged));
    setProfileName(merged.name);
    notify("Profile updated");
    return true;
  } catch (err: any) {
    notify(err.message || "Could not update profile");
    return false;
  }
};

const editProject = async (id: string | number, data: { name: string; description: string; status: string }) => {
  try {
    await api(`/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: data.name,
        ...(data.description ? { description: data.description } : {}),
        status: data.status,
      }),
    });
    await loadData();
    notify("Project updated");
    return true;
  } catch (err: any) {
    notify(err.message || "Could not update project");
    return false;
  }
};

  

const renderPage = () => {
  switch (page) {
    case "Overview":
      return <Overview projects={wsProjects} tasks={wsTasks} setPage={setPage} onCreateTask={() => setShowTaskModal(true)} userName={profileName} />;
    case "Projects":
                 return <ProjectsPage projects={wsProjects} onCreate={() => setShowProjectModal(true)} onOpenTasks={() => setPage("My Tasks")} onEdit={editProject} />;
    case "My Tasks":
      return <TasksPage tasks={filteredTasks} filter={taskFilter} setFilter={setTaskFilter} onCreate={() => setShowTaskModal(true)} onStatus={changeTaskStatus} onEdit={editTask} onDelete={deleteTask} />;
    case "Team":
      return <TeamPage members={members} teams={teams} workspaceName={activeWorkspace} workspaceMembers={activeWs?.members ?? []} workspaceId={activeWs?._id ? String(activeWs._id) : undefined} canManageMembers={["admin", "manager"].includes(String(currentUser.role))} onCreateTeam={createTeam} onMessage={() => setPage("Messages")} onNotify={notify} />;
    case "Messages":
      return <MessagesPage teams={teams} currentUser={currentUser} onNotify={notify} />;
    case "Timesheets":
      return <TimesheetsPage projects={wsProjects} currentUser={currentUser} onNotify={notify} />;
    case "Reports":
      return <ReportsPage tasks={wsTasks} projects={wsProjects} />;
    case "Settings":
      return <SettingsPage profileName={profileName} currentUser={currentUser} onSaveProfile={saveProfile} onSave={() => notify("Settings saved")} />;
    case "Leave Requests":
      return <LeavePage currentUser={currentUser} onNotify={notify} />;
    case "Files":
      return <FilesPageLive projects={wsProjects} onNotify={notify} />;
    case "Notifications":
      return <NotificationsPage onOpen={setPage} onChanged={loadUnread} onNotify={notify} />;
    case "AI Reports":
      return <AIReportsPage tasks={wsTasks} projects={wsProjects} onNotify={notify} />;

          case "Ask AI":
      return <AskAIPage projects={wsProjects} workspaceName={activeWorkspace} />;
    case "Audit Log":
      return <AuditLogPage onNotify={notify} />;
    case "Calendar":
      return <CalendarPage onNotify={notify} />;
    case "Goals & OKRs":
      return <GoalsPage currentUser={currentUser} onNotify={notify} />;
    case "Budget & Expenses":
      return <BudgetPage projects={wsProjects} onNotify={notify} />;
       case "Milestones":
      return <MilestonesPage projects={wsProjects} currentUser={currentUser} onNotify={notify} />;
    case "Workload":
      return <WorkloadPage tasks={wsTasks} workspaceMembers={activeWs?.members ?? []} />;
    case "Clients":
      return <ClientsPage currentUser={currentUser} onNotify={notify} />;
    case "Templates":
      return <TemplatesPage currentUser={currentUser} onNotify={notify} onTasksCreated={loadData} />;
    case "Assets":
      return <AssetsPage onNotify={notify} />;
       case "Payment requests":
      return <PaymentRequestsPage onChanged={loadWorkspaces} />;
      case "Help Center":
      return <HelpCenterPage currentUser={currentUser} onNotify={notify} />;
    case "Automations":
    case "Integrations":
    case "Security":
    case "Billing":
      return <BusinessModulePage page={page} onNotify={notify} />;
    default:
      return <Overview projects={wsProjects} tasks={wsTasks} setPage={setPage} onCreateTask={() => setShowTaskModal(true)} userName={profileName} />;
  }
};
  return (
    <div className="app-shell">

      
{showCommandPalette && (
  <div
    className="command-overlay"
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) {
        setShowCommandPalette(false);
      }
    }}
  >
    <section className="command-panel" role="dialog" aria-modal="true">
      <div className="command-search-row">
        <Sparkles size={21} />
        <input
          autoFocus
          value={commandQuery}
          onChange={(event) => {
            setCommandQuery(event.target.value);
            setCommandIndex(0);
          }}
          placeholder="Search pages or actions..."
          aria-label="Search commands"
        />
        <button
          type="button"
          onClick={() => setShowCommandPalette(false)}
          aria-label="Close command palette"
        >
          <X size={18} />
        </button>
      </div>

      <p className="command-label">NAVIGATE</p>

      {([
        { label: "Overview", icon: LayoutDashboard, run: () => setPage("Overview") },
        { label: "Projects", icon: FolderKanban, run: () => setPage("Projects") },
        { label: "My Tasks", icon: ListTodo, run: () => setPage("My Tasks") },
        { label: "Team", icon: Users, run: () => setPage("Team") },
        { label: "Messages", icon: MessageSquare, run: () => setPage("Messages") },
        { label: "Calendar", icon: CalendarDays, run: () => setPage("Calendar") },
        { label: "Reports", icon: ChartNoAxesCombined, run: () => setPage("Reports") },
        { label: "Ask WorkSphere", icon: Sparkles, run: () => setPage("Ask AI") },
      ] as const)
        .filter((item) =>
          item.label.toLowerCase().includes(commandQuery.toLowerCase())
        )
        .map((item, index) => {
          const Icon = item.icon;

          return (
            <button
              type="button"
              key={item.label}
              className={`command-item ${
                commandIndex === index ? "command-item-active" : ""
              }`}
              onMouseEnter={() => setCommandIndex(index)}
              onClick={() => {
                item.run();
                setShowCommandPalette(false);
                setCommandQuery("");
              }}
            >
              <span className="command-item-icon">
                <Icon size={18} />
              </span>
              <span>{item.label}</span>
              <ArrowRight size={16} />
            </button>
          );
        })}

      <p className="command-empty">
        {commandQuery &&
          !([
            "Overview", "Projects", "My Tasks", "Team",
            "Messages", "Calendar", "Reports", "Ask WorkSphere",
          ].some((label) =>
            label.toLowerCase().includes(commandQuery.toLowerCase())
          ))
          ? "No matching commands found."
          : "Select an action to continue."}
      </p>

      <footer className="command-footer">
        <span><kbd>ESC</kbd> Close</span>
        <span>WORKSPHERE COMMAND CENTER</span>
      </footer>
    </section>
  </div>
)}

      {sidebarOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <button className="brand" onClick={() => { setPage("Overview"); setSidebarOpen(false); }}>
          <span className="brand-mark"><Command size={22} strokeWidth={2.7} /></span>
          <span>work<span>sphere</span></span>
        </button>

        <div className="workspace-menu-wrap">
          <button className={`workspace-switcher ${showWorkspaceMenu ? "workspace-switcher-open" : ""}`} aria-expanded={showWorkspaceMenu} onClick={() => setShowWorkspaceMenu((open) => !open)}>
            <span className="workspace-icon">{activeWorkspace.charAt(0)}</span>
            <span className="workspace-copy"><strong>{activeWorkspace}</strong><small>{(activeWs?.members ?? []).length} members</small></span>
            <ChevronDown size={16} className={showWorkspaceMenu ? "chevron-rotated" : ""} />
          </button>
          {showWorkspaceMenu && <div className="workspace-dropdown">
            <p className="dropdown-eyebrow">SWITCH WORKSPACE</p>
            {workspaces.map((ws, index) => (
              <button type="button" key={ws._id} className={`workspace-option ${activeWs?._id === ws._id ? "workspace-option-active" : ""}`} onClick={() => selectWorkspace(String(ws._id), ws.name)}>
                <span className={`workspace-option-avatar workspace-avatar-${index % 4}`}>{String(ws.name).charAt(0).toUpperCase()}</span>
                <span><strong>{ws.name}</strong><small>{(ws.members ?? []).length} members</small></span>
                {activeWs?._id === ws._id && <Check size={15} />}
              </button>
            ))}
            {workspaces.length === 0 && <p className="empty-column">No workspaces yet</p>}
            <div className="workspace-dropdown-divider" />
            <button type="button" className="workspace-option create-workspace-option" onClick={() => { setShowWorkspaceMenu(false); setShowCreateWorkspaceModal(true); }}>
              <span className="workspace-option-avatar plus-workspace"><Plus size={16} /></span>
              <span><strong>Create workspace</strong><small>Start a new team space</small></span>
            </button>
          </div>}
        </div>

        <nav className="sidebar-nav">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <p className="nav-label">{group.label}</p>
              {group.items
  .filter((item) => item.label !== "Payment requests" || currentUser.role === "admin")
  .map(({ label, icon: Icon, badge }) => (
                <button
                  key={label}
                  className={`nav-item ${page === label ? "nav-item-active" : ""}`}
                  onClick={() => { setPage(label); setSidebarOpen(false); }}
                >
                  <Icon size={18} strokeWidth={1.8} />
                  <span>{label}</span>
                  {badge && <span className={`nav-badge ${badge === "4" ? "nav-badge-dot" : ""}`}>{badge === "4" ? "" : badge}</span>}
                </button>
              ))}
            </div>
          ))}
          <div className="nav-group">
            <p className="nav-label">Admin & tools</p>
            {([
              { label: "Automations" as Page, icon: Zap },
              { label: "Integrations" as Page, icon: Activity },
              { label: "Audit Log" as Page, icon: ShieldCheck },
              { label: "Help Center" as Page, icon: CircleHelp },
            ]).map(({ label, icon: Icon }) => (
              <button key={label} className={`nav-item ${page === label ? "nav-item-active" : ""}`} onClick={() => { setPage(label); setSidebarOpen(false); }}>
                <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
              </button>
            ))}
          </div>
          <div className="nav-group">
            <p className="nav-label">Insights</p>
            <button className={`nav-item ${page === "AI Reports" ? "nav-item-active" : ""}`} onClick={() => { setPage("AI Reports"); setSidebarOpen(false); }}>
              <Sparkles size={18} /><span>AI Reports</span><span className="new-badge">NEW</span>
            </button>

                        <button className={`nav-item ${page === "Ask AI" ? "nav-item-active" : ""}`} onClick={() => { setPage("Ask AI"); setSidebarOpen(false); }}>
              <MessageSquare size={18} /><span>Ask WorkSphere</span><span className="new-badge">NEW</span>
            </button>

            <button className={`nav-item ${page === "Notifications" ? "nav-item-active" : ""}`} onClick={() => { setPage("Notifications"); setSidebarOpen(false); }}>
              <Bell size={18} /><span>Notifications</span>{unread > 0 && <span className="nav-count">{unread}</span>}
            </button>
          </div>
        </nav>

        <div className="sidebar-bottom">
          <div className="upgrade-card">
            <span className="upgrade-icon"><Zap size={17} fill="currentColor" /></span>
            <strong>Unlock your team's potential</strong>
            <p>Get advanced insights and unlimited project history.</p>
            <button onClick={() => setShowPlanModal(true)}>Explore plans <ArrowRight size={13} /></button>
          </div>
          <button className="help-link" onClick={() => setShowHelpModal(true)}><CircleHelp size={17} /> Help & support <ArrowUpRight size={15} /></button>
          <div className="profile-row">
  <Avatar initials={profileName.split(" ").map((part: string) => part[0]).join("").slice(0, 2).toUpperCase() || "U"} />
  <div className="profile-copy"><strong>{profileName}</strong><small>{currentUser.role || "Workspace member"}</small></div>
  <button
    className="icon-button"
    aria-label="Log out"
    title="Log out"
 onClick={async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout error:", error);
  }
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.reload();
}}
  >
    <LogOut size={18} />
  </button>
  <button className="icon-button" aria-label="Profile options" onClick={() => setPage("Settings")}><MoreHorizontal size={19} /></button>
</div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs">
            <button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
            <span>Workspace</span><ChevronRight size={14} /><strong>{page}</strong>
          </div>
          <div className="topbar-actions">
            <label className="global-search">
              <Search size={17} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search anything..." />
              <kbd>⌘ K</kbd>
            </label>
            <div className="notification-wrap">

              <button
  className="icon-button"
  aria-label="Toggle theme"
  title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
  onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
>
  {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
</button>
              <button className="icon-button notification-button" aria-label="Notifications" onClick={() => setShowNotifications(!showNotifications)}><Bell size={20} />{unread > 0 && <span />}</button>
              {showNotifications && <div className="notification-popover">
                <div className="popover-heading"><strong>Notifications</strong><button onClick={() => setShowNotifications(false)}><X size={16} /></button></div>
                               <p><span className="mini-dot purple-dot" /> {unread > 0 ? `You have ${unread} unread notification${unread > 1 ? "s" : ""}.` : "You're all caught up."}</p>
                <button className="text-button" onClick={() => { setPage("Notifications"); setShowNotifications(false); }}>View all notifications</button>
              </div>}
            </div>
            <button className="profile-avatar-button" aria-label="Open settings" onClick={() => setPage("Settings")}><Avatar initials={initialsOf(profileName)} /></button>
          </div>
        </header>

        <div className="page-content">{renderPage()}</div>
        <footer className="app-footer"><span>© 2026 WorkSphere</span><span><span className="live-dot" /> All systems operational</span><span>Made for teams that move work forward.</span></footer>
      </main>

      {showCreateWorkspaceModal && <Modal title="Create a workspace" subtitle="Set up a new space for a team or personal project." onClose={() => setShowCreateWorkspaceModal(false)}>
        <form className="modal-form" onSubmit={addWorkspace}>
          <label>Workspace name<input name="workspaceName" placeholder="e.g. Design Team" maxLength={48} required autoFocus /></label>
          <label>Workspace type<select name="workspaceType"><option>Team workspace</option><option>Personal workspace</option><option>Client workspace</option></select></label>
          
          <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setShowCreateWorkspaceModal(false)}>Cancel</button><button className="button button-primary" type="submit"><Plus size={16} /> Create workspace</button></div>
        </form>
      </Modal>}

      {showTaskModal && <Modal title="Create a task" subtitle="Add a task to your workspace." onClose={() => setShowTaskModal(false)}>
        <form className="modal-form" onSubmit={addTask}>
  <label>Task name<input name="title" placeholder="e.g. Review landing page" required minLength={3} autoFocus /></label>
  <label>Project<select name="project" required>{wsProjects.map((project) => <option key={project.id} value={String(project.id)}>{project.name}</option>)}</select></label>
  <div className="form-grid">
    <label>Priority<select name="priority"><option>Medium</option><option>High</option><option>Low</option><option>Urgent</option></select></label>
    <label>Due date<input name="due" type="date" /></label>
  </div>
  <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setShowTaskModal(false)}>Cancel</button><button className="button button-primary" type="submit"><Plus size={16} /> Create task</button></div>
</form>
      </Modal>}

      {showProjectModal && <Modal title="Create a project" subtitle="Give your next initiative a home." onClose={() => setShowProjectModal(false)}>
        <form className="modal-form" onSubmit={addProject}>
          <label>Project name<input name="name" placeholder="e.g. Q4 product launch" required autoFocus /></label>
          <label>Description<textarea name="description" placeholder="What is this project about?" rows={3} /></label>
          <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setShowProjectModal(false)}>Cancel</button><button className="button button-primary" type="submit"><Plus size={16} /> Create project</button></div>
        </form>
      </Modal>}



<ProPaymentModal
        open={showPayModal}
        workspaceId={activeWs?._id ? String(activeWs._id) : undefined}
        members={Math.max(1, activeWs?.members?.length ?? 1)}
        onClose={() => setShowPayModal(false)}
        onSubmitted={() => notify("Payment request submitted. Pro will be activated after verification.")}
      />
      {showPlanModal && <Modal title="Choose your WorkSphere plan" subtitle="Compare workspace plans. Pro is activated after we verify your UPI payment." onClose={() => setShowPlanModal(false)}>
        <div className="plan-options">
          <article className="plan-option">
            <span className="plan-tag">{isPro ? "STARTER" : "CURRENT PLAN"}</span><h3>Free</h3><p className="plan-price">₹0 <small>/ month</small></p><p className="plan-description">For small teams getting started.</p><ul><li><Check size={14} /> Up to 5 members</li><li><Check size={14} /> Basic project and task tracking</li><li><Check size={14} /> 3 active projects</li></ul><button className="button button-secondary" onClick={() => { setShowPlanModal(false); notify(isPro ? "Your workspace is on the Pro plan." : "You are already using the Free plan."); }}>{isPro ? "Included in Pro" : "Current plan"}</button>
          </article>
          <article className="plan-option plan-option-featured">
            <span className="plan-tag plan-tag-featured">{isPro ? "CURRENT PLAN" : "RECOMMENDED"}</span><h3>Pro</h3><p className="plan-price">₹799 <small>/ member / month</small></p><p className="plan-description">For growing teams that need more control.</p><ul><li><Check size={14} /> Unlimited projects</li><li><Check size={14} /> Advanced reports and insights</li><li><Check size={14} /> Automations and priority support</li></ul>
            {isPro ? (
              <button className="button button-secondary" disabled>Current plan</button>
            ) : (
              <button className="button button-primary" onClick={() => { setShowPlanModal(false); setShowPayModal(true); }}>Choose Pro <ArrowRight size={15} /></button>
            )}
          </article>
        </div>
        <p className="modal-footnote"><ShieldCheck size={14} /> Pay by UPI, then submit your transaction ID. Pro is activated after manual verification.</p>
      </Modal>}

      {showHelpModal && <Modal title="Help & support" subtitle="Find an answer or contact the WorkSphere support team." onClose={() => setShowHelpModal(false)}>
        <div className="help-modal-content">
          <label className="help-search"><Search size={16} /><input placeholder="Search help articles..." onChange={(event) => setExpandedHelp(event.target.value ? "Search results" : "Getting started")} /></label>
          {[
            { title: "Getting started", text: "Create a project, add tasks, and invite teammates from the Team section." },
            { title: "Manage projects and tasks", text: "Open Projects to track progress. Use My Tasks to update statuses and priorities." },
            { title: "Workspace, plans and billing", text: "Use the workspace dropdown to switch spaces. Plan details are available through Explore plans." },
          ].map((item) => <div className="help-faq" key={item.title}><button onClick={() => setExpandedHelp(expandedHelp === item.title ? null : item.title)}><strong>{item.title}</strong><ChevronDown size={16} className={expandedHelp === item.title ? "chevron-rotated" : ""} /></button>{expandedHelp === item.title && <p>{item.text}</p>}</div>)}
          <div className="help-contact-card"><span className="help-contact-icon"><CircleHelp size={18} /></span><div><strong>Still need a hand?</strong><p>Contact our support team and tell us what you need help with.</p><a href="mailto:support@worksphere.dev?subject=WorkSphere%20Support">Email support@worksphere.dev <ArrowUpRight size={13} /></a></div></div>
        </div>
      </Modal>}

      {toast && <div className="toast"><CheckCircle2 size={18} />{toast}</div>}
    </div>
  );
}

function Overview({ projects, tasks, setPage, onCreateTask, userName }: { projects: Project[]; tasks: Task[]; setPage: (page: Page) => void; onCreateTask: () => void; userName: string }) {
  const hour = new Date().getHours();
const greeting =
  hour >= 5 && hour < 12 ? "Good morning" :
  hour >= 12 && hour < 17 ? "Good afternoon" :
  hour >= 17 && hour < 21 ? "Good evening" :
  "Good night";
  const greetingEmoji = hour >= 5 && hour < 12 ? "☀️" : hour >= 12 && hour < 17 ? "🌤️" : hour >= 17 && hour < 21 ? "🌆" : "🌙";
const greetingSub =
  hour >= 5 && hour < 12 ? "Start your day strong. Here’s what’s on your plate." :
  hour >= 12 && hour < 17 ? "Halfway there. Here’s how your workspace is doing." :
  hour >= 17 && hour < 21 ? "Wrapping up? Here’s what got done today." :
  "Working late? Here’s a quick look at your workspace.";
  const completed = tasks.filter((task) => task.status === "Done").length;
  const inProgress = tasks.filter((task) => task.status === "In progress").length;

    const weekChart = buildWeekChart(tasks);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const isOverdue = (t: Task) => !!t.dueDate && new Date(t.dueDate) < startOfToday;
  const upcoming = tasks
    .filter((t) => t.status !== "Done" && t.dueDate)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, 4);
  const toneOf = (t: Task) => (t.due === "Today" || isOverdue(t) ? "urgent" : t.due === "Tomorrow" ? "soon" : "normal");
  return <>
   <SectionTitle title={`${greeting}, ${(userName || "there").split(" ")[0]} ${greetingEmoji}`} subtitle={greetingSub} action={<><button className="button button-secondary" onClick={() => setPage("Reports")}><CalendarDays size={16} /> This week <ChevronDown size={14} /></button><button className="button button-primary" onClick={onCreateTask}><Plus size={17} /> Create task</button></>} />
    <div className="welcome-banner">
      <div className="welcome-copy"><span className="welcome-kicker"><Sparkles size={14} /> YOUR WORKSPACE AT A GLANCE</span><h2>Big things happen when teams work in sync.</h2><p>You’ve made great progress this week. Here’s your team’s momentum at a glance.</p><button className="banner-button" onClick={() => setPage("Reports")}>View team report <ArrowRight size={15} /></button></div>
      <div className="banner-art"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-card"><ChartNoAxesCombined size={28} /><strong>+18.6%</strong><small>Team productivity</small><div className="art-bars"><i /><i /><i /><i /><i /><i /><i /></div></div><div className="floating-check"><Check size={18} /></div><div className="floating-star"><Sparkles size={18} /></div></div>
    </div>
   <div className="stats-grid">
  <StatCard label="Active projects" value={String(projects.filter((p) => p.status !== "Completed").length).padStart(2, "0")} change={`${projects.length} total projects`} icon={<FolderKanban size={19} />} tone="purple" trend="up" />
  <StatCard label="Tasks completed" value={String(completed)} change={`Out of ${tasks.length} tasks`} icon={<CheckCircle2 size={19} />} tone="green" trend="up" />
  <StatCard label="In progress" value={String(inProgress)} change="Tasks being worked on" icon={<Activity size={19} />} tone="blue" trend="up" />
  <StatCard label="Completion rate" value={`${Math.round((completed / Math.max(tasks.length, 1)) * 100)}%`} change="Done vs total tasks" icon={<Gauge size={19} />} tone="orange" trend="up" />
</div>
    <div className="dashboard-grid">
      <section className="panel productivity-panel">
        <div className="panel-heading"><div><h3>Productivity overview</h3><p>Task activity over the last 7 days</p></div><button className="select-button" onClick={() => setPage("Reports")}>This week <ChevronDown size={14} /></button></div>
        <div className="chart-legend"><span><i className="legend-purple" /> Completed tasks</span><span><i className="legend-lilac" /> New tasks</span></div>
        <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={weekChart} margin={{ top: 12, right: 8, left: -25, bottom: 0 }}><defs><linearGradient id="completedFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6d5dfc" stopOpacity={0.2} /><stop offset="95%" stopColor="#6d5dfc" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#edf0f7" vertical={false} /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#8b93a8", fontSize: 12 }} dy={10} /><Tooltip contentStyle={{ border: "1px solid #eceef6", borderRadius: 12, boxShadow: "0 8px 24px #27304b12" }} /><Area type="monotone" dataKey="completed" stroke="#6d5dfc" strokeWidth={2.5} fill="url(#completedFill)" /><Area type="monotone" dataKey="created" stroke="#b6adff" strokeWidth={2} strokeDasharray="5 5" fill="transparent" /></AreaChart></ResponsiveContainer></div>
      </section>
      <section className="panel projects-summary">
        <div className="panel-heading"><div><h3>Project progress</h3><p>Keep an eye on key initiatives</p></div><button className="icon-button" onClick={() => setPage("Projects")} aria-label="View projects"><ArrowRight size={18} /></button></div>
        <div className="project-progress-list">{projects.slice(0, 4).map((project) => <div className="project-progress-row" key={project.id}><div className={`project-symbol symbol-${project.color}`}><FolderKanban size={17} /></div><div className="project-progress-info"><div><strong>{project.name}</strong><span>{project.progress}%</span></div><div className="progress-track"><i className={`progress-${project.color}`} style={{ width: `${project.progress}%` }} /></div><small>{project.tasks} tasks · {project.status}</small></div></div>)}</div>
        <button className="panel-link" onClick={() => setPage("Projects")}>View all projects <ArrowRight size={15} /></button>
      </section>
    </div>
        <MyDayCard projects={projects} />
    <section className="panel tasks-panel">
      <div className="panel-heading"><div><h3>My tasks</h3><p>Here are the things that need your attention</p></div><button className="panel-link" onClick={() => setPage("My Tasks")}>View all tasks <ArrowRight size={15} /></button></div>
      <TaskTable tasks={tasks.slice(0, 5)} onStatus={() => setPage("My Tasks")} />
    </section>
    <div className="bottom-grid">
      <section className="panel activity-panel"><div className="panel-heading"><div><h3>Recent activity</h3><p>Latest updates from your team</p></div><button className="icon-button" onClick={() => setPage("Notifications")} aria-label="View activity"><ArrowRight size={17} /></button></div><ActivityFeed /></section>
            <section className="panel upcoming-panel"><div className="panel-heading"><div><h3>Upcoming deadlines</h3><p>Don’t let anything slip through</p></div><CalendarDays size={18} className="muted-icon" /></div>{upcoming.map((t) => <Deadline key={t.id} title={t.title} project={t.project} date={isOverdue(t) ? "Overdue" : t.due} tone={toneOf(t)} />)}{upcoming.length === 0 && <p className="empty-column">No upcoming deadlines</p>}<button className="panel-link" onClick={() => setPage("My Tasks")}>Open task list <ArrowRight size={15} /></button></section>
    </div>
  </>;
}

function useCountUp(target: number) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    let start: number | null = null;
    const step = (t: number) => {
      if (start === null) start = t;
      const p = Math.min((t - start) / 700, 1);
      setN(Math.round(target * p));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return n;
}

function AnimatedValue({ value }: { value: string }) {
  const match = value.match(/^(\D*)([\d,]+(?:\.\d+)?)(.*)$/);
  const num = match ? parseFloat(match[2].replace(/,/g, "")) : 0;
  const shown = useCountUp(Number.isFinite(num) ? num : 0);
  if (!match) return <>{value}</>;
  const pad = match[2].length > 1 && match[2].startsWith("0") && !match[2].includes(".");
  const text = pad ? String(shown).padStart(match[2].length, "0") : shown.toLocaleString("en-IN");
  return <>{match[1]}{text}{match[3]}</>;
}

function StatCard({ label, value, change, icon, tone }: { label: string; value: string; change: string; icon: ReactNode; tone: string; trend?: "up" | "down" }) {
  return <div className="stat-card"><div className="stat-top"><span className={`stat-icon stat-${tone}`}>{icon}</span><button className="icon-button subtle-icon" aria-label={`${label} details`}><MoreHorizontal size={18} /></button></div><p>{label}</p><div className="stat-value-row"><strong><AnimatedValue value={value} /></strong></div><small>{change}</small></div>;
}

function TaskTable({ tasks, onStatus }: { tasks: Task[]; onStatus: () => void }) {
  return <div className="table-scroll"><table className="data-table"><thead><tr><th>Task name</th><th>Project</th><th>Assignee</th><th>Due date</th><th>Priority</th><th>Status</th><th /></tr></thead><tbody>{tasks.map((task) => <tr key={task.id} onClick={onStatus} className="clickable-row"><td><span className={`task-check ${task.status === "Done" ? "task-check-done" : ""}`}>{task.status === "Done" && <Check size={12} />}</span><strong>{task.title}</strong></td><td><span className="project-cell-dot" />{task.project}</td><td><span className="assignee-cell"><Avatar initials={task.initials} small />{task.assignee}</span></td><td><span className={task.due === "Today" ? "due-today" : ""}>{task.due}</span></td><td><span className={`priority priority-${task.priority.toLowerCase()}`}><i />{task.priority}</span></td><td><StatusPill>{task.status}</StatusPill></td><td><MoreHorizontal size={17} className="muted-icon" /></td></tr>)}</tbody></table></div>;
}

function ActivityFeed() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
const [commandQuery, setCommandQuery] = useState("");
const [commandIndex, setCommandIndex] = useState(0);

  useEffect(() => {
    api<any>("/activity-logs")
      .then((res) => {
        const list = toList(res).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        setItems(list.slice(0, 5));
      })
      .catch(() => { /* employees may not have access */ })
      .finally(() => setLoading(false));
  }, []);

  const timeAgo = (iso: string) => {
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    if (mins < 1440) return `${Math.round(mins / 60)} hours ago`;
    return `${Math.round(mins / 1440)} days ago`;
  };
  const actorOf = (a: any) => String(a.user?.name ?? a.actor?.name ?? a.performedBy?.name ?? a.employee?.name ?? "Someone");
  const textOf = (a: any) => {
    if (a.description || a.message) return String(a.description ?? a.message);
    const verb = String(a.action ?? "updated").replace(/[-_]/g, " ");
    const thing = a.entityType ? String(a.entityType).replace(/[-_]/g, " ") : "an item";
    return `${verb} a ${thing}`;
  };

  return <div className="activity-list">
    {items.map((a, i) => <div className="activity-item" key={a._id ?? i}>
      <Avatar initials={initialsOf(actorOf(a))} color={memberColors[i % memberColors.length]} />
      <div className="activity-text"><p><strong>{actorOf(a)}</strong> {textOf(a)}</p><small>{a.createdAt ? timeAgo(a.createdAt) : ""}</small></div>
      <span className="activity-type"><Activity size={12} /></span>
    </div>)}
    {!loading && items.length === 0 && <p className="empty-column">No recent activity</p>}
  </div>;
}

function Deadline({ title, project, date, tone }: { title: string; project: string; date: string; tone: string }) {
  return <div className="deadline-row"><span className={`deadline-icon deadline-${tone}`}><CalendarDays size={16} /></span><div><strong>{title}</strong><small>{project}</small></div><span className={`deadline-date date-${tone}`}>{date}</span></div>;
}

function ProjectsPage({ projects, onCreate, onOpenTasks, onEdit }: { projects: Project[]; onCreate: () => void; onOpenTasks: () => void; onEdit: (id: string | number, data: { name: string; description: string; status: string }) => Promise<boolean> }) {
  const [view, setView] = useState("Grid");
  const [filter, setFilter] = useState("All");
  const [period, setPeriod] = useState("This week");
  const [editing, setEditing] = useState<Project | null>(null);
  const [query, setQuery] = useState("");
  const visible = projects.filter((project) =>
    (filter === "All" || project.status === filter) &&
    `${project.name} ${project.description}`.toLowerCase().includes(query.toLowerCase())
  );
  const completedCount = projects.filter((project) => project.status === "Completed").length;
  const atRiskCount = projects.filter(
  (project) => project.status === "At risk"
).length;
  const totalTasks = projects.reduce((sum, project) => sum + (project.tasks || 0), 0);
  const averageProgress = projects.length ? Math.round(projects.reduce((sum, project) => sum + (project.progress || 0), 0) / projects.length) : 0;

  const submitEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    const ok = await onEdit(editing.id, {
      name: String(form.get("name") || "").trim(),
      description: String(form.get("description") || "").trim(),
      status: String(form.get("status") || "planning"),
    });
    if (ok) setEditing(null);
  };

  return <>
    <SectionTitle title="Projects" subtitle="Track initiatives, milestones, and team progress." action={<><label className="period-select-wrap"><CalendarDays size={16} /><select aria-label="Project time period" className="period-select" value={period} onChange={(event) => setPeriod(event.target.value)}><option>This week</option><option>Last week</option><option>This month</option><option>This quarter</option><option>All time</option></select><ChevronDown size={14} /></label><button className="button button-primary" onClick={onCreate}><Plus size={17} /> Create project</button></>} />
    <section className="project-command-hero">
      <div className="project-command-copy"><span className="project-command-kicker"><Sparkles size={13} /> YOUR DELIVERY HUB</span><h2>Make progress <em>visible.</em></h2><p>Every initiative, milestone and teammate — all moving in one direction.</p><div className="project-hero-actions"><button className="project-hero-cta" onClick={onCreate}><Plus size={15} /> New initiative</button><button className="project-hero-link" onClick={onOpenTasks}>Open task board <ArrowUpRight size={15} /></button></div></div>
      <div className="project-hero-orbit" aria-hidden="true"><div className="project-orbit-ring ring-a"/><div className="project-orbit-ring ring-b"/><div className="project-orbit-core"><Layers3 size={25}/><strong>{projects.length.toString().padStart(2,"0")}</strong><small>initiatives</small></div><span className="orbit-chip orbit-chip-one"><CheckCircle2 size={13}/> Delivery</span><span className="orbit-chip orbit-chip-two"><Zap size={13}/> Momentum</span></div>
      <div className="project-hero-glow" aria-hidden="true" />
    </section>
    <section className="project-insight-strip" aria-label="Project insights">
      <article><span className="insight-icon insight-violet"><FolderKanban size={17}/></span><div><small>Active initiatives</small><strong>{projects.length - completedCount}</strong><span>Across this workspace</span></div></article>
      <article><span className="insight-icon insight-mint"><CheckCircle2 size={17}/></span><div><small>Completed</small><strong>{completedCount}</strong><span>Shipped projects</span></div></article>
      <article><span className="insight-icon insight-amber"><Activity size={17}/></span><div><small>Need attention</small><strong>{atRiskCount}</strong><span>At risk or on hold</span></div></article>
      <article><span className="insight-icon insight-blue"><ListTodo size={17}/></span><div><small>Tasks in projects</small><strong>{totalTasks}</strong><span>{averageProgress}% avg. progress</span></div><div className="insight-mini-ring" style={{"--ring-progress": `${averageProgress * 3.6}deg`} as React.CSSProperties}><span>{averageProgress}%</span></div></article>
    </section>
    <div className="project-toolbar-enhanced"><div><span className="toolbar-eyebrow">YOUR PORTFOLIO</span><h2>All initiatives <span>{visible.length}</span></h2></div><div className="project-toolbar-controls"><label className="project-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a project..." aria-label="Search projects"/><kbd>/</kbd></label><div className="filter-tabs">{["All", "On track", "At risk", "Completed"].map((item) => <button key={item} className={filter === item ? "tab-active" : ""} onClick={() => setFilter(item)}>{item}{item === "All" && <span>{projects.length}</span>}</button>)}</div><button className="button button-secondary button-compact" onClick={() => setView(view === "Grid" ? "List" : "Grid")}><SlidersHorizontal size={15} /> {view} view</button></div></div>
    <div className={view === "Grid" ? "project-grid" : "project-list"}>{visible.map((project) => <article className={`project-card project-card-${project.color} panel`} key={project.id}><div className="project-card-cover"><span className="project-cover-grid"/><span className="project-cover-label"><Sparkles size={12}/> WORKSPACE PROJECT</span><span className="project-cover-mark"><FolderKanban size={24}/></span><span className="project-cover-orbit"/></div><div className="project-card-top"><div className={`project-symbol symbol-${project.color}`}><FolderKanban size={20} /></div><button className="icon-button" aria-label="Edit project" title="Edit project" onClick={() => setEditing(project)}><MoreHorizontal size={19} /></button></div><div className="project-card-title"><h3>{project.name}</h3><StatusPill>{project.status}</StatusPill></div><p>{project.description}</p><div className="project-card-meta"><span><ListTodo size={15} /> {project.tasks} tasks</span><span><Users size={15} /> {project.team.length} members</span></div><div className="project-card-progress"><div><span>Delivery progress</span><strong>{project.progress}%</strong></div><div className="progress-track project-progress-track"><i className={`progress-${project.color}`} style={{ width: `${project.progress}%` }} /></div><div className="project-progress-caption"><span>{project.progress >= 100 ? "Ready to celebrate" : project.progress >= 60 ? "Almost there" : project.progress > 0 ? "Building momentum" : "Ready to get moving"}</span><span>{project.tasks} work items</span></div></div><div className="project-card-footer"><div className="avatar-stack">{project.team.map((person, index) => <Avatar key={person + index} initials={person} color={["purple", "pink", "blue", "orange"][index % 4]} small />)}</div><button className="text-button" onClick={onOpenTasks}>View tasks <ArrowRight size={14} /></button></div></article>)}</div>
    {visible.length === 0 && <EmptyState icon={<FolderKanban />} title="No projects in this view" text="Try another status filter or create a new project." />}
    {editing && <Modal title="Edit project" subtitle="Update the project details." onClose={() => setEditing(null)}>
      <form className="modal-form" onSubmit={submitEdit}>
        <label>Project name<input name="name" defaultValue={editing.name} required minLength={3} autoFocus /></label>
        <label>Description<textarea name="description" rows={3} defaultValue={editing.description} /></label>
        <label>Status<select name="status" defaultValue={editing.apiStatus ?? "planning"}><option value="planning">Planning</option><option value="active">Active</option><option value="on-hold">On hold</option><option value="completed">Completed</option><option value="archived">Archived</option></select></label>
        <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setEditing(null)}>Cancel</button><button className="button button-primary" type="submit"><Check size={16} /> Save changes</button></div>
      </form>
    </Modal>}
  </>;
}

function TasksPage({ tasks, filter, setFilter, onCreate, onStatus, onEdit, onDelete }: { tasks: Task[]; filter: string; setFilter: (value: string) => void; onCreate: () => void; onStatus: (id: string | number, status: TaskStatus) => void; onEdit: (id: string | number, data: { title: string; description: string; priority: string; dueDate: string }) => Promise<boolean>; onDelete: (id: string | number) => void }) {
  const columns: TaskStatus[] = ["Todo", "In progress", "In review", "Done"];
  const [layout, setLayout] = useState("Board");
  const [menuId, setMenuId] = useState<string | number | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [taskQuery, setTaskQuery] = useState("");
  const [draggingId, setDraggingId] = useState<string | number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const visibleTasks = tasks.filter((task) => `${task.title} ${task.project} ${task.assignee}`.toLowerCase().includes(taskQuery.toLowerCase()));
  const doneCount = tasks.filter((task) => task.status === "Done").length;
  const overdueCount = tasks.filter((task) => task.status !== "Done" && task.dueDate && new Date(task.dueDate) < new Date(new Date().setHours(0,0,0,0))).length;
  const submitEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    const ok = await onEdit(editing.id, {
      title: String(form.get("title") || "").trim(),
      description: String(form.get("description") || "").trim(),
      priority: String(form.get("priority") || "Medium"),
      dueDate: String(form.get("due") || ""),
    });
    if (ok) setEditing(null);
  };

  return <>
    <SectionTitle title="My tasks" subtitle="Stay focused on your priorities and upcoming deadlines." action={<button className="button button-primary" onClick={onCreate}><Plus size={17} /> Create task</button>} />
    <section className="task-command-strip"><div className="task-command-intro"><span className="task-command-orb"><Zap size={18}/></span><div><small>YOUR FOCUS, RIGHT NOW</small><strong>{overdueCount ? `${overdueCount} task${overdueCount === 1 ? "" : "s"} need attention` : "A little progress adds up."}</strong><p>{doneCount} of {tasks.length} tasks completed in this workspace</p></div></div><div className="task-command-progress"><div><span>Completion</span><strong>{tasks.length ? Math.round(doneCount / tasks.length * 100) : 0}%</strong></div><div className="progress-track"><i style={{width:`${tasks.length ? doneCount / tasks.length * 100 : 0}%`}}/></div></div><div className="task-streak"><Sparkles size={15}/><span><strong>{doneCount ? "Momentum building" : "Your next win starts here"}</strong><small>{overdueCount ? "Clear an overdue task to get back on track" : "Pick one task and move it forward"}</small></span></div></section>
    <div className="task-toolbar-enhanced"><div><span className="toolbar-eyebrow">WORKFLOW STUDIO</span><h2>Move work forward <span>{visibleTasks.length}</span></h2></div><div className="task-toolbar-controls"><label className="project-search"><Search size={16}/><input value={taskQuery} onChange={(event) => setTaskQuery(event.target.value)} placeholder="Search tasks..." aria-label="Search tasks"/><kbd>/</kbd></label><div className="filter-tabs">{["All tasks", ...columns].map((item) => <button key={item} className={filter === item ? "tab-active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div><button className="button button-secondary button-compact" onClick={() => setLayout(layout === "Board" ? "List" : "Board")}><SlidersHorizontal size={15} /> {layout} view</button></div></div>
    {layout === "Board" ? <div className="kanban-board">{columns.map((column) => { const columnTasks = visibleTasks.filter((task) => task.status === column); return <section className={`kanban-column kanban-${column.toLowerCase().replace(" ", "-")} ${dragOverColumn === column ? "kanban-column-drop" : ""}`} key={column} onDragOver={(event) => { event.preventDefault(); setDragOverColumn(column); }} onDragLeave={() => setDragOverColumn(null)} onDrop={(event) => { event.preventDefault(); const id = event.dataTransfer.getData("text/plain") || String(draggingId ?? ""); if (id) { const found = visibleTasks.find((task) => String(task.id) === id); if (found && found.status !== column) onStatus(found.id, column); } setDraggingId(null); setDragOverColumn(null); }}><div className="kanban-heading"><span className={`column-dot dot-${column.toLowerCase().replace(" ", "-")}`} /><strong>{column}</strong><span className="column-count">{columnTasks.length}</span><button className="icon-button" onClick={onCreate} aria-label={`Add task to ${column}`}><Plus size={16} /></button></div>{columnTasks.map((task) => <article className={`kanban-card ${draggingId === task.id ? "kanban-card-dragging" : ""}`} key={task.id} draggable onDragStart={(event) => { setDraggingId(task.id); event.dataTransfer.setData("text/plain", String(task.id)); event.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => { setDraggingId(null); setDragOverColumn(null); }} style={{ position: "relative" }}><div className="kanban-card-top"><span className={`priority priority-${task.priority.toLowerCase()}`}><i />{task.priority}</span><button className="icon-button" aria-label="Task options" onClick={() => setMenuId(menuId === task.id ? null : task.id)}><MoreHorizontal size={17} /></button></div>
      {menuId === task.id && <div style={{ position: "absolute", right: 12, top: 40, zIndex: 20, background: "#fff", border: "1px solid #eceef6", borderRadius: 12, boxShadow: "0 8px 24px #27304b1f", padding: 6, display: "grid", minWidth: 170 }}>
        <button className="text-button" style={{ textAlign: "left", padding: "8px 10px" }} onClick={() => { setMenuId(null); setEditing(task); }}>Edit task</button>
        <button className="text-button" style={{ textAlign: "left", padding: "8px 10px" }} onClick={() => { setMenuId(null); onStatus(task.id, columns[(columns.indexOf(column) + 1) % columns.length]); }}>Move to {columns[(columns.indexOf(column) + 1) % columns.length]}</button>
        <button className="text-button" style={{ textAlign: "left", padding: "8px 10px", color: "#d64545" }} onClick={() => { setMenuId(null); onDelete(task.id); }}>Delete task</button>
      </div>}
      <h4>{task.title}</h4><p>{task.project}</p><div className="kanban-card-footer"><span className={task.due === "Today" ? "due-today" : ""}><CalendarDays size={13} />{task.due}</span><span className="task-card-assignee"><Avatar initials={task.initials} small /><small>{task.assignee || "Unassigned"}</small></span></div></article>)}{columnTasks.length === 0 && <p className="empty-column">No tasks here yet</p>}<button className="add-column-task" onClick={onCreate}><Plus size={15} /> Add task</button></section>; })}</div> : <section className="panel task-list-panel"><TaskTable tasks={visibleTasks} onStatus={() => { const first = visibleTasks[0]; if (first) onStatus(first.id, first.status === "Done" ? "Todo" : "Done"); }} /></section>}
    {editing && <Modal title="Edit task" subtitle="Update the task details." onClose={() => setEditing(null)}>
      <form className="modal-form" onSubmit={submitEdit}>
        <label>Task name<input name="title" defaultValue={editing.title} required minLength={3} autoFocus /></label>
        <label>Description<textarea name="description" rows={3} placeholder="Optional details" /></label>
        <div className="form-grid">
          <label>Priority<select name="priority" defaultValue={editing.priority}><option>Medium</option><option>High</option><option>Low</option><option>Urgent</option></select></label>
          <label>Due date<input name="due" type="date" defaultValue={editing.dueDate ? editing.dueDate.slice(0, 10) : ""} /></label>
        </div>
        <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setEditing(null)}>Cancel</button><button className="button button-primary" type="submit"><Check size={16} /> Save changes</button></div>
      </form>
    </Modal>}
  </>;
}

function TeamPage({ members, teams, workspaceName, workspaceMembers, workspaceId, canManageMembers, onCreateTeam, onMessage, onMembersChanged, onNotify }: { members: Member[]; teams: any[]; workspaceName: string; workspaceMembers: any[]; workspaceId?: string; canManageMembers?: boolean; onCreateTeam: (name: string, description: string) => Promise<boolean>; onMessage: () => void; onMembersChanged?: () => void; onNotify?: (text: string) => void }) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("All roles");
  const [showModal, setShowModal] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);

  const wsPeople: Member[] = workspaceMembers
    .filter((u: any) => u && typeof u === "object")
    .map((u: any, i: number) => {
      const fromTeams = members.find((m) => m.id === String(u._id));
      return {
        id: String(u._id),
        name: u.name ?? "User",
        email: u.email ?? "",
        role: capitalize(String(u.role ?? "employee")),
        initials: initialsOf(u.name ?? ""),
        color: fromTeams?.color ?? memberColors[i % memberColors.length],
        status: fromTeams?.status ?? "Offline",
      };
    });

  const visible = wsPeople.filter((person) => `${person.name} ${person.email}`.toLowerCase().includes(query.toLowerCase()) && (role === "All roles" || person.role === role));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    if (name.length < 2) return;
    const ok = await onCreateTeam(name, String(form.get("description") || "").trim());
    if (ok) setShowModal(false);
  };

  const refreshAfterChange = () => {
    if (onMembersChanged) onMembersChanged();
    else window.location.reload();
  };

  const addMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!workspaceId) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    if (!email) return;
    try {
      await api(`/workspaces/${workspaceId}/members`, { method: "POST", body: JSON.stringify({ email }) });
      setShowAddMember(false);
      onNotify?.("Member added");
      refreshAfterChange();
    } catch (err: any) {
      onNotify?.(err.message || "Could not add member");
    }
  };

  const removeMember = async (person: Member) => {
    if (!workspaceId) return;
    if (!window.confirm(`Remove ${person.name} from this workspace?`)) return;
    try {
      await api(`/workspaces/${workspaceId}/members/${person.id}`, { method: "DELETE" });
      onNotify?.("Member removed");
      refreshAfterChange();
    } catch (err: any) {
      onNotify?.(err.message || "Could not remove member");
    }
  };

  const canAdd = Boolean(canManageMembers && workspaceId);

  return <>
    <SectionTitle title="Your team" subtitle="Meet your teammates and see what everyone is working on." action={<div style={{ display: "flex", gap: 10 }}>{canAdd && <button className="button button-secondary" onClick={() => setShowAddMember(true)}><Plus size={17} /> Add member</button>}<button className="button button-primary" onClick={() => setShowModal(true)}><Plus size={17} /> Create team</button></div>} />
    <div className="team-summary-grid">
      <StatCard label="Workspace members" value={String(wsPeople.length)} change={workspaceName} icon={<Users size={19} />} tone="purple" />
      <StatCard label="Teams" value={String(teams.length)} change="You belong to" icon={<UsersRound size={19} />} tone="green" />
      <StatCard label="Online now" value={String(wsPeople.filter((m) => m.status === "Online").length)} change="Live presence coming soon" icon={<Activity size={19} />} tone="blue" />
    </div>
    <div className="toolbar team-toolbar">
      <label className="inline-search"><Search size={16} /><input placeholder="Search team members..." value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <select className="select-control" value={role} onChange={(event) => setRole(event.target.value)}><option>All roles</option>{[...new Set(wsPeople.map((person) => person.role))].map((item) => <option key={item}>{item}</option>)}</select>
    </div>
    <div className="team-grid">{visible.map((person) => <article className="panel team-card" key={person.id}>
      <Avatar initials={person.initials} color={person.color} />
      <h3>{person.name}</h3><p>{person.role}</p>
      <span className={`presence presence-${person.status.toLowerCase()}`}><i />{person.status}</span>
      <div className="team-card-email"><span>{person.email}</span></div>
      <button className="button button-secondary team-message" onClick={onMessage}><MessageSquare size={15} /> Message</button>
      {canAdd && <button className="text-button" style={{ marginTop: 8 }} onClick={() => removeMember(person)}>Remove from workspace</button>}
    </article>)}</div>
    {visible.length === 0 && <EmptyState icon={<Users />} title="No members in this workspace" text="Switch workspace from the sidebar, or create a team to start collaborating." />}
    {showModal && <Modal title="Create a team" subtitle="You will be added as the owner and first member." onClose={() => setShowModal(false)}>
      <form className="modal-form" onSubmit={submit}>
        <label>Team name<input name="name" placeholder="e.g. Design Team" minLength={2} maxLength={100} required autoFocus /></label>
        <label>Description<textarea name="description" rows={3} maxLength={500} placeholder="What does this team do?" /></label>
        <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setShowModal(false)}>Cancel</button><button className="button button-primary" type="submit"><Plus size={16} /> Create team</button></div>
      </form>
    </Modal>}
    {showAddMember && <Modal title="Add member" subtitle={`Add a registered user to ${workspaceName} by email.`} onClose={() => setShowAddMember(false)}>
      <form className="modal-form" onSubmit={addMember}>
        <label>Email<input name="email" type="email" placeholder="employee.test@example.com" required autoFocus /></label>
        <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setShowAddMember(false)}>Cancel</button><button className="button button-primary" type="submit"><Plus size={16} /> Add member</button></div>
      </form>
    </Modal>}
  </>;
}

function MessagesPage({ teams, currentUser, onNotify }: { teams: any[]; currentUser: any; onNotify: (text: string) => void }) {
  const [activeTeamId, setActiveTeamId] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [conversationQuery, setConversationQuery] = useState("");
  const [messageQuery, setMessageQuery] = useState("");
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [summaryRange, setSummaryRange] = useState("50");
  const [summaryLanguage, setSummaryLanguage] = useState("English");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeTeamId && teams.length) setActiveTeamId(String(teams[0]._id));
  }, [teams, activeTeamId]);

  useEffect(() => {
    setSummary("");
    setShowSummary(false);
  }, [activeTeamId]);

  const loadMessages = async (teamId: string) => {
    try {
      const res = await api<any>(`/messages/${teamId}`);
      setMessages(res.messages ?? []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!activeTeamId) return;
    setMessages([]);
    loadMessages(activeTeamId);
    const timer = window.setInterval(() => loadMessages(activeTeamId), 5000);
    return () => window.clearInterval(timer);
  }, [activeTeamId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = text.trim();
    if (!content || !activeTeamId) return;
    try {
      await api("/messages", { method: "POST", body: JSON.stringify({ teamId: activeTeamId, content }) });
      setText("");
      await loadMessages(activeTeamId);
    } catch (err: any) {
      onNotify(err.message || "Could not send message");
    }
  };

  const visibleTeams = teams.filter((team) => String(team.name).toLowerCase().includes(conversationQuery.toLowerCase()));
  const activeTeam = teams.find((team) => String(team._id) === activeTeamId);
  const visibleMessages = messages.filter((m) => `${m.sender?.name ?? ""} ${m.content}`.toLowerCase().includes(messageQuery.toLowerCase()));

  const summarize = async () => {
    const recent = [...messages]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(-Number(summaryRange))
      .filter((m) => String(m.content ?? "").trim());
    if (recent.length < 3) {
      onNotify("Need at least 3 messages to summarize");
      return;
    }
    setSummarizing(true);
    try {
      const res = await api<any>("/ai/summarize-chat", {
        method: "POST",
        body: JSON.stringify({
          teamName: String(activeTeam?.name ?? "Team"),
          language: summaryLanguage === "Hinglish" ? "hinglish" : "english",
          messages: recent.map((m) => ({
            sender: String(m.sender?.name ?? "Unknown").slice(0, 80),
            content: String(m.content).slice(0, 2000),
            at: m.createdAt,
          })),
        }),
      });
      setSummary(String(res.summary ?? ""));
    } catch (err: any) {
      onNotify(err.message || "Could not summarize the chat");
    } finally {
      setSummarizing(false);
    }
  };

  return <>
    <SectionTitle title="Messages" subtitle="Keep conversations moving and decisions in one place." />
    {teams.length === 0 ? <EmptyState icon={<MessageSquare />} title="No team conversations yet" text="Create a team from the Team page to start chatting." /> :
    <div className="messages-layout panel">
      <aside className="chat-sidebar">
        <div className="chat-sidebar-title"><h3>Teams</h3></div>
        <label className="inline-search"><Search size={15} /><input placeholder="Search teams" value={conversationQuery} onChange={(event) => setConversationQuery(event.target.value)} /></label>
        <div className="conversation-list">
          {visibleTeams.map((team) => <button type="button" key={team._id} className={`conversation ${activeTeamId === String(team._id) ? "active-conversation" : ""}`} onClick={() => setActiveTeamId(String(team._id))}>
            <div className="conversation-avatar team-avatar"><Users size={17} /></div>
            <div><strong>{team.name}</strong><p>{(team.members ?? []).length} members</p></div>
          </button>)}
          {visibleTeams.length === 0 && <p className="empty-column">No teams found</p>}
        </div>
      </aside>
      <section className="chat-window">
        <div className="chat-header">
          <div className="conversation-avatar team-avatar"><Users size={17} /></div>
          <div><strong>{activeTeam?.name ?? "Team"}</strong><small><span className="live-dot" /> {(activeTeam?.members ?? []).length} members</small></div>
          <button type="button" className="button button-secondary button-compact" style={{ marginLeft: "auto" }} onClick={() => setShowSummary(true)} disabled={messages.length < 3} title={messages.length < 3 ? "Need at least 3 messages" : "Summarize this chat with AI"}><Sparkles size={15} /> Summarize</button>
        </div>
        <label className="message-search inline-search"><Search size={14} /><input placeholder="Search in this conversation..." value={messageQuery} onChange={(event) => setMessageQuery(event.target.value)} /></label>
        <div className="chat-messages">
          {visibleMessages.map((message, index) => {
            const senderName = message.sender?.name ?? "Unknown";
            const own = String(message.sender?._id ?? message.sender) === String(currentUser.id);
            return <div className={`chat-message ${own ? "chat-message-own" : ""}`} key={message._id ?? index}>
              <Avatar initials={initialsOf(senderName)} color={memberColors[index % memberColors.length]} small />
              <div className="chat-bubble-wrap">
                <div className="chat-meta"><strong>{senderName}</strong><small>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></div>
                <div className="chat-bubble">{message.content}</div>
              </div>
            </div>;
          })}
          {visibleMessages.length === 0 && <EmptyState icon={<MessageSquare />} title="No messages yet" text="Send the first message to start the conversation." />}
          <div ref={bottomRef} />
        </div>
        <form className="chat-composer" onSubmit={send}>
          <input value={text} onChange={(event) => setText(event.target.value)} placeholder={`Message ${activeTeam?.name ?? "team"}...`} aria-label="Message text" maxLength={5000} />
          <button className="send-button" type="submit" aria-label="Send message" disabled={!text.trim()}><Send size={17} /></button>
        </form>
      </section>
    </div>}
    {showSummary && <Modal title="Summarize chat" subtitle={`AI summary and action items for ${activeTeam?.name ?? "this team"}.`} onClose={() => setShowSummary(false)}>
      <div className="modal-form">
        <div className="form-grid">
          <label>Messages to include<select value={summaryRange} onChange={(event) => setSummaryRange(event.target.value)}><option value="30">Last 30</option><option value="50">Last 50</option><option value="100">Last 100</option><option value="200">Last 200</option></select></label>
          <label>Language<select value={summaryLanguage} onChange={(event) => setSummaryLanguage(event.target.value)}><option>English</option><option>Hinglish</option></select></label>
        </div>
        <p className="modal-footnote">{messages.length} messages loaded in this chat.</p>
        {summary && <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: 14, background: "#f4f5fb", borderRadius: 12, padding: "14px 16px", maxHeight: 320, overflowY: "auto" }}>{summary}</div>}
        <div className="modal-actions">
          {summary && <button type="button" className="button button-secondary" onClick={() => { navigator.clipboard?.writeText(summary); onNotify("Summary copied"); }}><FileText size={15} /> Copy</button>}
          <button type="button" className="button button-secondary" onClick={() => setShowSummary(false)}>Close</button>
          <button type="button" className="button button-primary" onClick={summarize} disabled={summarizing}><Sparkles size={16} /> {summarizing ? "Summarizing..." : summary ? "Summarize again" : "Summarize"}</button>
        </div>
      </div>
    </Modal>}
  </>;
}

function TimesheetsPage({ projects, currentUser, onNotify }: { projects: Project[]; currentUser: any; onNotify: (text: string) => void }) {
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const [weekOffset, setWeekOffset] = useState(0);
  const [entries, setEntries] = useState<any[]>([]);
  const [cells, setCells] = useState<Record<string, string>>({});
  const [note, setNote] = useState("Weekly work log");
  const [busy, setBusy] = useState(false);

  const weekDates = useMemo(() => {
    const start = new Date();
    start.setHours(12, 0, 0, 0);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7) + weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [weekOffset]);
  const dateKeys = useMemo(() => weekDates.map(ymd), [weekDates]);

  const fetchWeek = async (): Promise<any[]> => {
    const res = await api<any>(`/timesheets/my?from=${dateKeys[0]}&to=${dateKeys[6]}&limit=100`);
    return res.timesheets ?? [];
  };

  const applyEntries = (list: any[]) => {
    setEntries(list);
    const next: Record<string, string> = {};
    list.forEach((t) => {
      const pid = String(t.project?._id ?? t.project);
      next[`${pid}|${String(t.workDate).slice(0, 10)}`] = String(t.hours);
    });
    setCells(next);
  };

  useEffect(() => {
    fetchWeek().then(applyEntries).catch((err) => onNotify(err.message || "Could not load timesheets"));
  }, [weekOffset]);

  const findEntry = (projectId: string, date: string) =>
    entries.find((t) => String(t.project?._id ?? t.project) === projectId && String(t.workDate).slice(0, 10) === date);

  const editable = (entry: any) => !entry || ["draft", "rejected"].includes(entry.status);

  const saveWeek = async (): Promise<boolean> => {
    for (const project of projects) {
      for (const date of dateKeys) {
        const raw = (cells[`${project.id}|${date}`] ?? "").trim();
        if (!raw) continue;
        const hours = Number(raw);
        const existing = findEntry(String(project.id), date);
        if (!existing && hours === 0) continue;
        if (existing && (Number(existing.hours) === hours || !editable(existing))) continue;
        if (!Number.isFinite(hours) || hours < 0.25 || hours > 24) {
          onNotify(`Hours must be between 0.25 and 24 (${project.name}, ${date})`);
          return false;
        }
        try {
          if (existing) {
            await api(`/timesheets/${existing._id}`, { method: "PATCH", body: JSON.stringify({ hours }) });
          } else {
            await api("/timesheets", {
              method: "POST",
              body: JSON.stringify({ project: String(project.id), workDate: date, hours, description: note.trim() || "Weekly work log" }),
            });
          }
        } catch (err: any) {
          onNotify(err.message || "Could not save timesheet");
          return false;
        }
      }
    }
    return true;
  };

  const onSave = async () => {
    setBusy(true);
    const ok = await saveWeek();
    try { applyEntries(await fetchWeek()); } catch { /* ignore */ }
    if (ok) onNotify("Timesheet saved as draft");
    setBusy(false);
  };

  const onSubmitWeek = async () => {
    setBusy(true);
    try {
      const ok = await saveWeek();
      if (!ok) return;
      const fresh = await fetchWeek();
      const toSubmit = fresh.filter((t) => ["draft", "rejected"].includes(t.status));
      if (toSubmit.length === 0) { onNotify("Nothing to submit for this week"); return; }
      for (const t of toSubmit) {
        await api(`/timesheets/${t._id}/submit`, { method: "PATCH" });
      }
      applyEntries(await fetchWeek());
      onNotify(`${toSubmit.length} timesheet entries submitted for review`);
    } catch (err: any) {
      onNotify(err.message || "Could not submit timesheet");
    } finally {
      setBusy(false);
    }
  };

  const num = (v: string | undefined) => Number(v) || 0;
  const rowTotal = (projectId: string) => dateKeys.reduce((sum, d) => sum + num(cells[`${projectId}|${d}`]), 0);
  const totalHours = projects.reduce((sum, p) => sum + rowTotal(String(p.id)), 0);
  const submittedCount = entries.filter((t) => t.status === "submitted").length;
  const approvedHours = entries.filter((t) => t.status === "approved").reduce((s, t) => s + Number(t.hours), 0);
  const draftCount = entries.filter((t) => ["draft", "rejected"].includes(t.status)).length;
  const weekLabel = `${weekDates[0].toLocaleDateString("en-US", { month: "long", day: "numeric" })} – ${weekDates[6].toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
 
const canReview = ["admin", "manager"].includes(String(currentUser.role));

  return <>
    <SectionTitle title="Timesheets" subtitle="Review your time entries and weekly workload." action={<>
      <button className="button button-secondary" onClick={onSave} disabled={busy}>Save draft</button>
      <button className="button button-primary" onClick={onSubmitWeek} disabled={busy}><Check size={16} /> Submit week</button>
    </>} />
    <div className="stats-grid timesheet-stats">
      <StatCard label="Hours this week" value={`${totalHours.toFixed(1)}h`} change="Of 40h weekly target" icon={<Clock3 size={19} />} tone="purple" trend="up" />
      <StatCard label="Approved hours" value={`${approvedHours.toFixed(1)}h`} change="This week" icon={<BriefcaseBusiness size={19} />} tone="green" trend="up" />
      <StatCard label="Awaiting approval" value={String(submittedCount)} change={`${draftCount} draft entries`} icon={<AlertCircle size={19} />} tone="orange" trend="up" />
    </div>
    <section className="panel timesheet-panel">
      <div className="panel-heading"><div><h3>Weekly time log</h3><p>{weekLabel}</p></div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="button button-secondary button-compact" onClick={() => setWeekOffset((w) => w - 1)} aria-label="Previous week"><ChevronLeft size={15} /></button>
          <button className="button button-secondary button-compact" onClick={() => setWeekOffset(0)}>This week</button>
          <button className="button button-secondary button-compact" onClick={() => setWeekOffset((w) => w + 1)} aria-label="Next week"><ChevronRight size={15} /></button>
        </div>
      </div>
      <label style={{ display: "grid", gap: 6, margin: "4px 0 16px" }}>Notes for new entries
        <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder="What did you work on?" style={{ padding: 10, borderRadius: 10, border: "1px solid #dfe3ee" }} />
      </label>
      <div className="time-entry-header"><span>Project</span>{weekDates.map((d, i) => <span key={i}>{dayNames[i]} {d.getDate()}</span>)}<span>Total</span></div>
      {projects.length === 0 && <EmptyState icon={<Clock3 />} title="No projects yet" text="Create a project first, then log your hours here." />}
      {projects.map((project) => {
        const pid = String(project.id);
        return <div className="time-entry-row" key={pid}>
          <div className="time-project"><span className="project-cell-dot" /><div><strong>{project.name}</strong><small>{project.status}</small></div></div>
          {dateKeys.map((date, i) => {
            const entry = findEntry(pid, date);
            return <input
              key={date}
              aria-label={`${dayNames[i]} hours for ${project.name}`}
              type="number" min="0" max="24" step="0.25"
              title={entry ? `Status: ${entry.status}` : ""}
              disabled={!editable(entry)}
              value={cells[`${pid}|${date}`] ?? ""}
              onChange={(event) => setCells((current) => ({ ...current, [`${pid}|${date}`]: event.target.value }))}
            />;
          })}
          <strong>{rowTotal(pid).toFixed(1)}h</strong>
        </div>;
      })}
      <div className="timesheet-total"><span>Weekly total</span><strong>{totalHours.toFixed(1)} hours</strong></div>
      <div className="timesheet-note"><Clock3 size={16} /> Enter hours (minimum 0.25). Submitted or approved entries are locked. Use "Save draft" to keep working, "Submit week" to send for review.</div>
    </section>
    {canReview && <TimesheetApprovals onNotify={onNotify} />}
  </>;
}

function TimesheetApprovals({ onNotify }: { onNotify: (text: string) => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await api<any>("/timesheets?status=submitted&limit=100");
      setItems(toList(res).filter((t: any) => t.status === "submitted"));
    } catch (err: any) {
      onNotify(err.message || "Could not load submitted timesheets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const review = async (id: string, status: "approved" | "rejected") => {
    let comment = "";
    if (status === "rejected") {
      const answer = window.prompt("Reason for rejection (optional)");
      if (answer === null) return;
      comment = answer;
    }
    try {
      await api(`/timesheets/${id}/review`, { method: "PATCH", body: JSON.stringify({ status, reviewComment: comment }) });
      await load();
      onNotify(`Timesheet ${status}`);
    } catch (err: any) {
      onNotify(err.message || "Could not review timesheet");
    }
  };

  return (
    <section className="panel" style={{ marginTop: 22 }}>
      <div className="panel-heading"><div><h3>Timesheets awaiting approval</h3><p>Entries submitted by your team</p></div></div>
      <div className="table-scroll"><table className="data-table"><thead><tr>
        <th>Employee</th><th>Project</th><th>Date</th><th>Hours</th><th>Notes</th><th>Actions</th>
      </tr></thead><tbody>
        {items.map((t) => <tr key={t._id}>
          <td><strong>{t.employee?.name ?? "Employee"}</strong></td>
          <td>{t.project?.name ?? "—"}</td>
          <td>{fmtUtc(t.workDate)}</td>
          <td>{t.hours}h</td>
          <td>{t.description}</td>
          <td><span style={{ display: "flex", gap: 12 }}>
            <button className="text-button" onClick={() => review(t._id, "approved")}>Approve</button>
            <button className="text-button" onClick={() => review(t._id, "rejected")}>Reject</button>
          </span></td>
        </tr>)}
      </tbody></table>
      {!loading && items.length === 0 && <EmptyState icon={<CheckCircle2 />} title="Nothing to review" text="Submitted timesheets will show up here." />}
      </div>
    </section>
  );
}

function ReportsPage({ tasks, projects }: { tasks: Task[]; projects: Project[] }) {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api<any>("/reports/overview")
      .then((res) => setReport(res.data ?? res))
      .catch((err: any) => setError(err.message || "Could not load report"))
      .finally(() => setLoading(false));
  }, []);

  const t = report?.tasks ?? {};
  const ts = report?.timesheets ?? {};
  const total = Number(t.total ?? 0);
  const completed = Number(t.completed ?? 0);
  const rate = Math.round((completed / Math.max(total, 1)) * 100);
  const taskRows = Object.entries(t.byStatus ?? {}) as [string, number][];
  const projectRows = Object.entries(report?.projects?.byStatus ?? {}) as [string, number][];
  const pretty = (s: string) => capitalize(s.replace(/[-_]/g, " "));

  return <>
    <SectionTitle title="Reports & insights" subtitle="Understand delivery trends and team performance." action={<button className="button button-secondary" onClick={() => window.print()}><Download size={16} /> Export report</button>} />
    {error && <p className="empty-column">{error}</p>}
    <div className="stats-grid">
      <StatCard label="Completion rate" value={`${rate}%`} change={`${completed} of ${total} tasks done`} icon={<CheckCircle2 size={19} />} tone="green" />
      <StatCard label="Active projects" value={String(report?.projects?.byStatus?.active ?? 0)} change={`${report?.projects?.total ?? 0} total projects`} icon={<FolderKanban size={19} />} tone="purple" />
      <StatCard label="Overdue tasks" value={String(t.overdue ?? 0)} change="Past their due date" icon={<AlertCircle size={19} />} tone="orange" />
      <StatCard label="Logged hours" value={`${Number(ts.loggedHours ?? 0)}h`} change={`${ts.approved ?? 0} of ${ts.total ?? 0} entries approved`} icon={<Clock3 size={19} />} tone="blue" />
    </div>
    <div className="dashboard-grid">
      <section className="panel productivity-panel">
        <div className="panel-heading"><div><h3>Weekly task activity</h3><p>Tasks completed vs created</p></div><span className="report-chip">Last 7 days</span></div>
        <div className="chart-wrap report-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={buildWeekChart(tasks)}><CartesianGrid stroke="#edf0f7" vertical={false} /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#8b93a8", fontSize: 12 }} /><Tooltip /><Area type="monotone" dataKey="completed" stroke="#6d5dfc" strokeWidth={2.5} fill="#6d5dfc20" /><Area type="monotone" dataKey="created" stroke="#a6b4ff" strokeWidth={2} fill="#a6b4ff18" /></AreaChart></ResponsiveContainer></div>
      </section>
      <section className="panel">
        <div className="panel-heading"><div><h3>Tasks by status</h3><p>Where work currently sits</p></div></div>
        {taskRows.map(([status, count]) => <div className="health-row" key={status}>
          <div className="health-info"><strong>{pretty(status)} · {count}</strong><div className="progress-track"><i className="progress-purple" style={{ width: `${Math.round((count / Math.max(total, 1)) * 100)}%` }} /></div></div>
        </div>)}
        {!loading && taskRows.length === 0 && <p className="empty-column">No task data yet</p>}
      </section>
    </div>
    <section className="panel" style={{ marginTop: 22 }}>
      <div className="panel-heading"><div><h3>Project health</h3><p>Progress and delivery status</p></div></div>
      {projects.map((project) => <div className="health-row" key={project.id}><div className={`project-symbol symbol-${project.color}`}><FolderKanban size={16} /></div><div className="health-info"><strong>{project.name}</strong><div className="progress-track"><i className={`progress-${project.color}`} style={{ width: `${project.progress}%` }} /></div></div><StatusPill>{project.status}</StatusPill></div>)}
      {projectRows.length > 0 && <p className="empty-column" style={{ marginTop: 12 }}>{projectRows.map(([s, c]) => `${pretty(s)}: ${c}`).join(" · ")}</p>}
    </section>
  </>;
}

function LeavePage({ currentUser, onNotify }: { currentUser: any; onNotify: (text: string) => void }) {
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const today = ymd(new Date());
  const isEmployee = (currentUser.role || "employee") === "employee";

  const load = async () => {
    try {
      const res = await api<any>("/leaves");
      setLeaves(res.leaves ?? []);
    } catch (err: any) {
      onNotify(err.message || "Could not load leave requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      leaveType: String(form.get("leaveType")),
      startDate: String(form.get("startDate")),
      endDate: String(form.get("endDate")),
      reason: String(form.get("reason") || "").trim(),
    };
    setSubmitting(true);
    try {
      await api("/leaves", { method: "POST", body: JSON.stringify(body) });
      setShowForm(false);
      await load();
      onNotify("Leave request submitted");
    } catch (err: any) {
      onNotify(err.message || "Could not submit leave request");
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async (id: string) => {
    try {
      await api(`/leaves/${id}/cancel`, { method: "PATCH" });
      await load();
      onNotify("Leave request cancelled");
    } catch (err: any) {
      onNotify(err.message || "Could not cancel leave request");
    }
  };

  const review = async (id: string, status: "approved" | "rejected") => {
  let comment = "";
  if (status === "rejected") {
    const answer = window.prompt("Reason for rejection (optional)");
    if (answer === null) return;
    comment = answer;
  }
  try {
    await api(`/leaves/${id}/review`, { method: "PATCH", body: JSON.stringify({ status, reviewComment: comment }) });
    await load();
    onNotify(`Leave ${status}`);
  } catch (err: any) {
    onNotify(err.message || "Could not review leave request");
  }
};

  const daysOf = (l: any) => Math.round((new Date(l.endDate).getTime() - new Date(l.startDate).getTime()) / 86400000) + 1;
  const mine = (l: any) => String(l.employee?._id ?? l.employee) === String(currentUser.id);
  const pending = leaves.filter((l) => l.status === "pending").length;
  const approvedDays = leaves.filter((l) => l.status === "approved" && mine(l)).reduce((s, l) => s + daysOf(l), 0);

  return <>
    <SectionTitle title="Leave requests" subtitle="Plan time away and manage approvals." action={<button className="button button-primary" onClick={() => setShowForm(!showForm)}><Plus size={16} /> Request leave</button>} />
    <div className="stats-grid">
      <StatCard label="Pending requests" value={String(pending)} change="Waiting for review" icon={<Clock3 size={19} />} tone="orange" trend="up" />
      <StatCard label="Approved days" value={String(approvedDays)} change="Your approved leave" icon={<CalendarCheck size={19} />} tone="green" trend="up" />
      <StatCard label="Total requests" value={String(leaves.length)} change="Visible to you" icon={<CalendarDays size={19} />} tone="purple" trend="up" />
    </div>
    {showForm && <section className="panel leave-form-panel"><h3>New leave request</h3>
      <form className="inline-leave-form" onSubmit={submit}>
        <label>Leave type<select name="leaveType"><option value="casual">Casual</option><option value="sick">Sick</option><option value="earned">Earned</option><option value="unpaid">Unpaid</option></select></label>
        <label>Start date<input name="startDate" type="date" min={today} required /></label>
        <label>End date<input name="endDate" type="date" min={today} required /></label>
        <label>Reason<input name="reason" placeholder="At least 5 characters" minLength={5} maxLength={1000} required /></label>
        <button className="button button-primary" type="submit" disabled={submitting}>{submitting ? "Submitting..." : "Submit request"}</button>
      </form>
    </section>}
    <section className="panel">
      <div className="panel-heading"><div><h3>{isEmployee ? "Your requests" : "Leave requests"}</h3><p>History of submitted leave requests</p></div></div>
      <div className="table-scroll"><table className="data-table"><thead><tr>
        {!isEmployee && <th>Employee</th>}<th>Leave type</th><th>Dates</th><th>Duration</th><th>Reason</th><th>Status</th><th>Actions</th>
      </tr></thead><tbody>
        {leaves.map((l) => <tr key={l._id}>
          {!isEmployee && <td><strong>{l.employee?.name ?? "—"}</strong></td>}
          <td><strong>{capitalize(l.leaveType)}</strong></td>
          <td>{fmtUtc(l.startDate)}{l.startDate !== l.endDate ? ` – ${fmtUtc(l.endDate)}` : ""}</td>
          <td>{daysOf(l)} {daysOf(l) === 1 ? "day" : "days"}</td>
          <td>{l.reason}</td>
          <td><StatusPill>{capitalize(l.status)}</StatusPill></td>
          <td>
  {l.status === "pending" && mine(l)
    ? <button className="text-button" onClick={() => cancel(l._id)}>Cancel request</button>
    : l.status === "pending" && !isEmployee
      ? <span style={{ display: "flex", gap: 12 }}>
          <button className="text-button" onClick={() => review(l._id, "approved")}>Approve</button>
          <button className="text-button" onClick={() => review(l._id, "rejected")}>Reject</button>
        </span>
      : <span className="muted-icon">—</span>}
</td>
        </tr>)}
      </tbody></table>
      {!loading && leaves.length === 0 && <EmptyState icon={<CalendarDays />} title="No leave requests" text="Use the Request leave button to create one." />}
      </div>
    </section>
  </>;
}

function FilesPage({ onNotify }: { onNotify: (text: string) => void }) {
  const files = [{ name: "Brand guidelines.pdf", type: "PDF document", size: "2.4 MB", updated: "Today", initials: "PDF", tone: "pdf" }, { name: "Homepage wireframes.fig", type: "Design file", size: "18.2 MB", updated: "Yesterday", initials: "FIG", tone: "fig" }, { name: "Q4 product roadmap.xlsx", type: "Spreadsheet", size: "840 KB", updated: "Oct 16", initials: "XLS", tone: "xls" }, { name: "Launch checklist.docx", type: "Word document", size: "120 KB", updated: "Oct 15", initials: "DOC", tone: "doc" }];
  const [query, setQuery] = useState("");
  return <>
    <SectionTitle title="Files & documents" subtitle="Find project documents, shared assets, and deliverables." action={<button className="button button-primary" onClick={() => onNotify("File picker is not connected in this demo")}><Plus size={16} /> Upload file</button>} />
    <div className="toolbar"><label className="inline-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search files..." /></label><button className="button button-secondary button-compact"><Filter size={15} /> Filters</button></div>
    <section className="panel"><div className="files-header"><span>Name</span><span>Location</span><span>File size</span><span>Last updated</span><span /></div>{files.filter((file) => file.name.toLowerCase().includes(query.toLowerCase())).map((file) => <div className="file-row" key={file.name}><span className="file-name"><span className={`file-type file-${file.tone}`}>{file.initials}</span><span><strong>{file.name}</strong><small>{file.type}</small></span></span><span>Website redesign</span><span>{file.size}</span><span>{file.updated}</span><button className="icon-button" aria-label={`Download ${file.name}`} onClick={() => onNotify(`${file.name} is a sample file in this preview`)}><Download size={17} /></button></div>)}</section>
  </>;
}

function NotificationsPage({ onOpen, onChanged, onNotify }: { onOpen: (page: Page) => void; onChanged: () => void; onNotify: (text: string) => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await api<any>("/notifications");
      setItems(toList(res));
    } catch (err: any) {
      onNotify(err.message || "Could not load notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const isRead = (n: any) => Boolean(n.isRead ?? n.read ?? false);

  const timeAgo = (iso: string) => {
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    if (mins < 1440) return `${Math.round(mins / 60)} hours ago`;
    return `${Math.round(mins / 1440)} days ago`;
  };

  const targetOf = (link: string): Page => {
    const l = String(link || "");
    if (l.includes("timesheet")) return "Timesheets";
    if (l.includes("leave")) return "Leave Requests";
    if (l.includes("task")) return "My Tasks";
    if (l.includes("project")) return "Projects";
    if (l.includes("message")) return "Messages";
    return "Overview";
  };

  const iconOf = (type: string) => {
    const t = String(type || "");
    if (t.includes("timesheet")) return <Clock3 size={17} />;
    if (t.includes("leave")) return <CalendarCheck size={17} />;
    if (t.includes("task")) return <ListTodo size={17} />;
    if (t.includes("message")) return <MessageSquare size={17} />;
    return <Bell size={17} />;
  };

  const toneOf = (type: string) => {
    const t = String(type || "");
    if (t.includes("approved")) return "green";
    if (t.includes("rejected")) return "orange";
    if (t.includes("timesheet")) return "blue";
    return "purple";
  };

  const open = async (n: any) => {
    if (!isRead(n)) {
      try {
        await api(`/notifications/${n._id}/read`, { method: "PATCH" });
        setItems((cur) => cur.map((x) => (x._id === n._id ? { ...x, isRead: true, read: true } : x)));
        onChanged();
      } catch { /* ignore */ }
    }
    onOpen(targetOf(n.link));
  };

  const markAll = async () => {
    try {
      await api("/notifications/read-all", { method: "PATCH" });
      setItems((cur) => cur.map((x) => ({ ...x, isRead: true, read: true })));
      onChanged();
      onNotify("All notifications marked as read");
    } catch (err: any) {
      onNotify(err.message || "Could not mark all as read");
    }
  };

  return <>
    <SectionTitle title="Notifications" subtitle="Catch up on updates that need your attention." action={<button className="button button-secondary" onClick={markAll}><Check size={16} /> Mark all as read</button>} />
    <section className="panel notification-list">
      {items.map((n) => <button className="notification-item" key={n._id} onClick={() => open(n)}>
        <span className={`notification-icon notification-${toneOf(n.type)}`}>{iconOf(n.type)}</span>
        <span className="notification-copy"><strong>{n.title}</strong><span>{n.message}</span><small>{timeAgo(n.createdAt)}</small></span>
        {!isRead(n) && <span className="notification-unread" />}
      </button>)}
      {!loading && items.length === 0 && <EmptyState icon={<Bell />} title="You're all caught up" text="New updates will show up here." />}
    </section>
  </>;
}
function AIReportsPage({ projects, onNotify }: { tasks: Task[]; projects: Project[]; onNotify: (text: string) => void }) {
  const [report, setReport] = useState("");
  const [meta, setMeta] = useState("");
  const [period, setPeriod] = useState("This week");
  const [language, setLanguage] = useState("English");
  const [loading, setLoading] = useState(false);

  const periodKey: Record<string, string> = {
    "This week": "this-week",
    "Last week": "last-week",
    "This month": "this-month",
    "Quarter to date": "quarter",
  };

  const generate = async () => {
    if (projects.length === 0) {
      onNotify("Is workspace mein koi project nahi hai");
      return;
    }
    setLoading(true);
    try {
      const res = await api<any>("/ai/report", {
        method: "POST",
        body: JSON.stringify({
          period: periodKey[period] ?? "this-week",
          language: language === "Hinglish" ? "hinglish" : "english",
          projectIds: projects.map((p) => String(p.id)),
        }),
      });
      setReport(String(res.report ?? ""));
      const m = res.meta ?? {};
      setMeta(`${m.projects ?? 0} projects, ${m.tasks ?? 0} tasks analysed`);
      onNotify("Report generated");
    } catch (err: any) {
      onNotify(err.message || "Could not generate report");
    } finally {
      setLoading(false);
    }
  };

  const exportReport = () => {
    const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `worksphere-report-${ymd(new Date())}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return <>
    <SectionTitle title="AI reports" subtitle="Turn project activity into a concise, actionable summary." action={<span className="ai-powered"><Sparkles size={15} /> AI workspace tools</span>} />
    <div className="ai-layout">
      <section className="panel ai-config">
        <div className="ai-hero-icon"><Sparkles size={24} /></div>
        <h2>Make sense of your team's work.</h2>
        <p>AI reads your real workspace data (projects, tasks, timesheets and budget) and writes a short status report.</p>
        <label>Report period<select value={period} onChange={(event) => setPeriod(event.target.value)}><option>This week</option><option>Last week</option><option>This month</option><option>Quarter to date</option></select></label>
        <label>Language<select value={language} onChange={(event) => setLanguage(event.target.value)}><option>English</option><option>Hinglish</option></select></label>
        <div className="ai-includes"><strong>Report includes</strong><span><CheckCircle2 size={15} /> Delivery progress</span><span><CheckCircle2 size={15} /> Project risks and overdue work</span><span><CheckCircle2 size={15} /> Time and budget</span><span><CheckCircle2 size={15} /> Suggested next steps</span></div>
        <button className="button button-primary button-wide" onClick={generate} disabled={loading}><Sparkles size={16} /> {loading ? "Generating..." : "Generate report"}</button>
      </section>
      <section className="panel ai-output">
        <div className="panel-heading"><div><h3>Generated report</h3><p>{report ? meta : "Your summary will appear here"}</p></div><button className="icon-button" onClick={() => { if (report) { navigator.clipboard?.writeText(report); onNotify("Report copied"); } }} aria-label="Copy report"><FileText size={17} /></button></div>
        {loading ? <EmptyState icon={<Sparkles />} title="Writing your report..." text="Ye 5-15 second le sakta hai." /> : report ? <><pre className="generated-report">{report}</pre><button className="button button-secondary" onClick={exportReport}><Download size={15} /> Export report</button></> : <EmptyState icon={<Sparkles />} title="Ready when you are" text="Choose a reporting period and generate a summary of your team's progress." />}
      </section>
    </div>
  </>;
}

type AskMessage = { role: "user" | "assistant"; content: string; error?: boolean };

function AskAIPage({ projects, workspaceName }: { projects: Project[]; workspaceName: string }) {
  const [messages, setMessages] = useState<AskMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length, loading]);

  const suggestions = [
    "Which of my tasks are overdue?",
    "How many hours did everyone log this week?",
    "Which projects are at risk?",
    "Which tasks are high priority today?",
    "What is the budget status?",
    "Who is on leave?",
  ];

  const ask = async (raw: string) => {
    const question = raw.trim();
    if (!question || loading) return;
    const history = messages.filter((m) => !m.error).slice(-6).map(({ role, content }) => ({ role, content }));
    setMessages((cur) => [...cur, { role: "user", content: question }]);
    setText("");
    setLoading(true);
    try {
      const res = await api<any>("/ai/ask", {
        method: "POST",
        body: JSON.stringify({ question, history, projectIds: projects.map((p) => String(p.id)) }),
      });
      setMessages((cur) => [...cur, { role: "assistant", content: String(res.answer ?? "") }]);
    } catch (err: any) {
      setMessages((cur) => [...cur, { role: "assistant", content: err.message || "Could not get an answer", error: true }]);
    } finally {
      setLoading(false);
    }
  };

  const bubble = (m: AskMessage) => ({
    maxWidth: "78%",
    padding: "10px 14px",
    borderRadius: 14,
    whiteSpace: "pre-wrap" as const,
    lineHeight: 1.5,
    fontSize: 14,
    justifySelf: m.role === "user" ? "end" : "start",
    background: m.role === "user" ? "#6c5cff" : m.error ? "#fdecea" : "#f4f5fb",
    color: m.role === "user" ? "#fff" : m.error ? "#b3261e" : "#222a45",
  });

  return <>
    <SectionTitle title="Ask WorkSphere" subtitle="Ask questions about your tasks, projects, hours and budget." action={messages.length > 0 ? <button className="button button-secondary" onClick={() => setMessages([])}>Clear chat</button> : undefined} />
    <section className="panel" style={{ display: "flex", flexDirection: "column", height: 560 }}>
      <div style={{ flex: 1, overflowY: "auto", padding: 8, display: "grid", alignContent: "start", gap: 12 }}>
        {messages.length === 0 && <div style={{ display: "grid", gap: 14, justifyItems: "center", padding: "40px 12px", textAlign: "center" }}>
          <span className="ai-hero-icon"><Sparkles size={24} /></span>
          <h3 style={{ margin: 0 }}>What would you like to know?</h3>
          <p style={{ margin: 0 }}>Ask anything about your workspace. Answers come from your real data.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 640 }}>
            {suggestions.map((s) => <button key={s} className="button button-secondary button-compact" onClick={() => ask(s)}>{s}</button>)}
          </div>
        </div>}
        {messages.map((m, i) => <div key={i} style={bubble(m)}>{m.content}</div>)}
        {loading && <div style={{ ...bubble({ role: "assistant", content: "" }), color: "#6b7390" }}>Thinking...</div>}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={(event) => { event.preventDefault(); ask(text); }} style={{ display: "flex", gap: 10, padding: 8, borderTop: "1px solid #eceef6" }}>
        <input value={text} onChange={(event) => setText(event.target.value)} placeholder="Type your question..." maxLength={500} aria-label="Your question" style={{ flex: 1, padding: 12, borderRadius: 10, border: "1px solid #dfe3ee" }} />
        <button className="button button-primary" type="submit" disabled={loading || text.trim().length < 2}><Send size={16} /> Ask</button>
      </form>
      <small style={{ padding: "0 10px 8px", color: "#8b93a8" }}>Answers are based on the data in {workspaceName} that you have access to. AI can make mistakes, so double-check anything important.</small>
    </section>
  </>;
}

function MyDayCard({ projects }: { projects: Project[] }) {
  const [plan, setPlan] = useState("");
  const [meta, setMeta] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [language, setLanguage] = useState("English");

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api<any>("/ai/my-day", {
        method: "POST",
        body: JSON.stringify({
          language: language === "Hinglish" ? "hinglish" : "english",
          projectIds: projects.map((p) => String(p.id)),
        }),
      });
      setPlan(String(res.plan ?? ""));
      const m = res.meta ?? {};
      setMeta(`${m.openTasks ?? 0} open · ${m.overdue ?? 0} overdue · ${m.dueToday ?? 0} due today`);
    } catch (err: any) {
      setError(err.message || "Could not plan your day");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel" style={{ marginBottom: 22 }}>
      <div className="panel-heading">
        <div><h3>My day</h3><p>{plan && meta ? meta : "AI picks what to focus on first, based on your open tasks"}</p></div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select className="select-button" value={language} onChange={(event) => setLanguage(event.target.value)} aria-label="Plan language"><option>English</option><option>Hinglish</option></select>
          <button className="button button-primary" onClick={generate} disabled={loading}><Sparkles size={16} /> {loading ? "Planning..." : plan ? "Refresh plan" : "Plan my day"}</button>
        </div>
      </div>
      {error && <p style={{ color: "#b3261e", margin: "4px 0 0" }}>{error}</p>}
      {plan
        ? <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: 14, background: "#f4f5fb", borderRadius: 12, padding: "14px 16px" }}>{plan}</div>
        : !loading && !error && <p className="empty-column">Click "Plan my day" to get a short, prioritised plan for today.</p>}
    </section>
  );
}
function AuditLogPage({ onNotify }: { onNotify: (text: string) => void }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("All");

  useEffect(() => {
    api<any>("/activity-logs")
      .then((res) => setLogs(res.logs ?? toList(res)))
      .catch((err: any) => onNotify(err.message || "Could not load audit log"))
      .finally(() => setLoading(false));
  }, []);

  const todayKey = ymd(new Date());
  const eventsToday = logs.filter((l) => l.createdAt && ymd(new Date(l.createdAt)) === todayKey).length;
  const actors = new Set(logs.map((l) => String(l.actor?._id ?? l.actor ?? ""))).size;
  const areas = Array.from(new Set(logs.map((l) => capitalize(String(l.entityType ?? "other")))));

  const visible = logs.filter((l) => {
    const text = `${l.description ?? ""} ${l.actor?.name ?? ""} ${l.action ?? ""} ${l.entityType ?? ""}`.toLowerCase();
    const matchesArea = area === "All" || capitalize(String(l.entityType ?? "other")) === area;
    return text.includes(query.toLowerCase()) && matchesArea;
  });

  const when = (iso: string) =>
    new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  return <>
    <SectionTitle title="Workspace audit log" subtitle="A clear trail of important changes across members, projects, and settings." />
    <div className="stats-grid">
      <StatCard label="Total events" value={String(logs.length)} change="Visible to you" icon={<Activity size={19} />} tone="purple" />
      <StatCard label="Events today" value={String(eventsToday)} change="Since midnight" icon={<Clock3 size={19} />} tone="blue" />
      <StatCard label="Active members" value={String(actors)} change="Who made changes" icon={<Users size={19} />} tone="green" />
    </div>
    <section className="panel" style={{ marginTop: 22 }}>
      <div className="panel-heading"><div><h3>Recent workspace activity</h3><p>Search and review what happened.</p></div></div>
      <div className="table-toolbar">
        <label className="global-search table-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search audit log..." /></label>
        <select className="select-button" value={area} onChange={(event) => setArea(event.target.value)}>
          <option>All</option>
          {areas.map((a) => <option key={a}>{a}</option>)}
        </select>
      </div>
      <div className="table-scroll"><table className="data-table"><thead><tr>
        <th>Activity</th><th>Member</th><th>Area</th><th>Action</th><th>Time</th>
      </tr></thead><tbody>
        {visible.map((l, i) => <tr key={l._id ?? i}>
          <td><strong>{l.description ?? `${l.action} ${l.entityType}`}</strong></td>
          <td>{l.actor?.name ?? "—"}</td>
          <td>{capitalize(String(l.entityType ?? "—"))}</td>
          <td><StatusPill>{capitalize(String(l.action ?? "—"))}</StatusPill></td>
          <td>{l.createdAt ? when(l.createdAt) : "—"}</td>
        </tr>)}
      </tbody></table>
      {!loading && visible.length === 0 && <EmptyState icon={<Search />} title="No matching records" text="Try another search or filter." />}
      </div>
    </section>
  </>;
}
function BusinessModulePage({ page, onNotify }: { page: Page; onNotify: (text: string) => void }) {
  const [query, setQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [enabledItems, setEnabledItems] = useState<string[]>(["Weekly project digest", "Overdue task reminder"]);
  const [showActionModal, setShowActionModal] = useState(false);
  const [createdRows, setCreatedRows] = useState<Record<string, string[][]>>({});

  const configs: Record<string, { title: string; description: string; metrics: { label: string; value: string; detail: string }[]; columns: string[]; rows: string[][]; action: string }> = {
    Calendar: {
      title: "Team calendar", description: "A shared view of project milestones, meetings, and deadlines.", action: "Add event",
      metrics: [{ label: "Events this week", value: "18", detail: "+4 from last week" }, { label: "Project deadlines", value: "6", detail: "2 due in 48 hours" }, { label: "Team availability", value: "84%", detail: "Across 12 members" }],
      columns: ["Event", "Project", "Date", "Owner", "Status"], rows: [["Design review", "Website redesign", "Oct 20 · 10:00 AM", "Maya Kapoor", "Scheduled"], ["API milestone", "Mobile app launch", "Oct 21 · 2:30 PM", "Arjun Mehta", "Upcoming"]],
    },
    "Goals & OKRs": {
      title: "Goals & OKRs", description: "Connect company priorities to measurable outcomes and accountable owners.", action: "Create objective",
      metrics: [{ label: "Active objectives", value: "8", detail: "Across 3 teams" }, { label: "Key results on track", value: "72%", detail: "+8% this month" }, { label: "Needs attention", value: "2", detail: "Review owners" }],
      columns: ["Objective", "Owner", "Progress", "Target date", "Health"], rows: [["Improve customer onboarding", "Maya Kapoor", "78%", "Nov 15, 2026", "On track"], ["Ship mobile v1", "Arjun Mehta", "54%", "Nov 30, 2026", "At risk"]],
    },
    "Budget & Expenses": {
      title: "Budget & expenses", description: "Keep project spending transparent and catch budget overruns early.", action: "Add expense",
      metrics: [{ label: "Total budget", value: "₹24.0L", detail: "Across 6 projects" }, { label: "Spent to date", value: "₹13.8L", detail: "57.5% of budget" }, { label: "Remaining", value: "₹10.2L", detail: "Within forecast" }],
      columns: ["Project", "Budget", "Spent", "Remaining", "Health"], rows: [["Website redesign", "₹4,00,000", "₹2,15,000", "₹1,85,000", "On track"], ["Mobile app launch", "₹8,50,000", "₹5,90,000", "₹2,60,000", "Watch"]],
    },
    Automations: {
      title: "Workflow automations", description: "Reduce manual follow-ups with simple rules and scheduled actions.", action: "Create automation",
      metrics: [{ label: "Active workflows", value: "6", detail: "2 paused" }, { label: "Runs this month", value: "248", detail: "98% successful" }, { label: "Time saved", value: "17.5h", detail: "Estimated this month" }],
      columns: ["Workflow", "Trigger", "Action", "Last run", "Status"], rows: [["Weekly project digest", "Every Monday", "Send summary to team", "Today, 9:00 AM", "Active"], ["Overdue task reminder", "Task becomes overdue", "Notify task owner", "Today, 11:42 AM", "Active"]],
    },
    Integrations: {
      title: "Connected apps", description: "Bring project updates and team communication together in one workspace.", action: "Browse integrations",
      metrics: [{ label: "Connected apps", value: "4", detail: "Healthy connections" }, { label: "Available apps", value: "12", detail: "Ready to connect" }, { label: "Sync status", value: "Healthy", detail: "Last sync 4 min ago" }],
      columns: ["Application", "Category", "Connection", "Last sync", "Action"], rows: [["Google Calendar", "Scheduling", "Connected", "4 min ago", "Manage"], ["Slack", "Communication", "Connected", "8 min ago", "Manage"], ["Jira", "Issue tracking", "Not connected", "—", "Connect"]],
    },
    "Help Center": {
      title: "Help & support", description: "Get your team moving with practical guides and workspace support.", action: "Contact support",
      metrics: [{ label: "Help articles", value: "48", detail: "Across 6 categories" }, { label: "Typical response", value: "2h", detail: "Business hours" }, { label: "System status", value: "99.9%", detail: "30-day uptime" }],
      columns: ["Guide / resource", "Category", "Reading time", "Updated", "Action"], rows: [["Getting started with WorkSphere", "Onboarding", "5 min", "Oct 12, 2026", "Open guide"], ["Create projects and milestones", "Projects", "7 min", "Oct 10, 2026", "Open guide"]],
    },
    Milestones: {
      title: "Project milestones", description: "Keep important delivery checkpoints visible and accountable.", action: "Add milestone",
      metrics: [{ label: "Upcoming milestones", value: "12", detail: "Next 30 days" }, { label: "Completed this month", value: "9", detail: "+3 from last month" }, { label: "At risk", value: "2", detail: "Need owner review" }],
      columns: ["Milestone", "Project", "Owner", "Due date", "Status"], rows: [["Design sign-off", "Website redesign", "Maya Kapoor", "Oct 22, 2026", "On track"], ["Beta release", "Mobile app launch", "Arjun Mehta", "Oct 29, 2026", "At risk"]],
    },
    Workload: {
      title: "Team workload", description: "Review capacity and distribute work more evenly across your team.", action: "Assign work",
      metrics: [{ label: "Team capacity", value: "82%", detail: "Healthy overall load" }, { label: "Overloaded members", value: "2", detail: "Review assignments" }, { label: "Unassigned tasks", value: "7", detail: "Ready to allocate" }],
      columns: ["Team member", "Role", "Assigned tasks", "Capacity", "Availability"], rows: [["Maya Kapoor", "Product designer", "8", "92%", "Near capacity"], ["Jordan Lee", "Frontend engineer", "6", "76%", "Available"]],
    },
    Clients: {
      title: "Client directory", description: "Keep client contacts, engagement health, and account ownership together.", action: "Add client",
      metrics: [{ label: "Active clients", value: "14", detail: "Across 5 industries" }, { label: "Open engagements", value: "9", detail: "Currently in delivery" }, { label: "Renewals due", value: "3", detail: "Next 60 days" }],
      columns: ["Client", "Primary contact", "Engagement", "Owner", "Status"], rows: [["Northstar Retail", "Priya Malhotra", "Website redesign", "Ayush Sharma", "Active"], ["BluePeak Health", "Rohan Mehta", "Mobile app launch", "Maya Kapoor", "Active"]],
    },
    Templates: {
      title: "Project templates", description: "Start faster with repeatable project plans and task checklists.", action: "Create template",
      metrics: [{ label: "Available templates", value: "16", detail: "Across 4 categories" }, { label: "Used this month", value: "28", detail: "Across workspace" }, { label: "Time saved", value: "34h", detail: "Estimated" }],
      columns: ["Template", "Category", "Tasks included", "Last used", "Action"], rows: [["Website launch", "Marketing", "24", "Oct 17, 2026", "Use template"], ["Sprint planning", "Engineering", "18", "Oct 16, 2026", "Use template"]],
    },
    Assets: {
      title: "Shared assets", description: "Browse reusable design, brand, and delivery resources for your projects.", action: "Add asset",
      metrics: [{ label: "Shared assets", value: "248", detail: "Across 18 projects" }, { label: "Recently updated", value: "16", detail: "Last 7 days" }, { label: "Storage used", value: "6.8 GB", detail: "Of 20 GB" }],
      columns: ["Asset", "Type", "Project", "Updated", "Action"], rows: [["Brand guidelines", "PDF", "Website redesign", "Today", "Preview"], ["Mobile design system", "Figma", "Mobile app launch", "Yesterday", "Preview"]],
    },
    Security: {
      title: "Security & access", description: "Review workspace access and keep account safeguards up to date.", action: "Invite member",
      metrics: [{ label: "Workspace members", value: "12", detail: "2 pending invites" }, { label: "MFA enabled", value: "92%", detail: "11 of 12 members" }, { label: "Active sessions", value: "18", detail: "Across all members" }],
      columns: ["Member / event", "Access level", "Last activity", "MFA", "Status"], rows: [["Ayush Sharma", "Admin", "Now", "Enabled", "Active"], ["Maya Kapoor", "Member", "5 min ago", "Enabled", "Active"]],
    },
    Billing: {
      title: "Plan & billing", description: "Manage workspace subscription details and keep an eye on usage.", action: "Add billing note",
      metrics: [{ label: "Current plan", value: "Free", detail: "Workspace starter" }, { label: "Seats used", value: "12 / 15", detail: "3 seats available" }, { label: "Storage used", value: "34%", detail: "6.8 GB of 20 GB" }],
      columns: ["Invoice / item", "Period", "Amount", "Due date", "Status"], rows: [["Workspace starter", "Oct 2026", "₹0", "—", "Paid"], ["Plan review", "Nov 2026", "—", "Nov 01, 2026", "Upcoming"]],
    },
  };

  const config = configs[page] ?? configs.Calendar;
  const allRows = [...config.rows, ...(createdRows[page] ?? [])];
  const filteredRows = allRows.filter((row) => row.join(" ").toLowerCase().includes(query.toLowerCase()) && (selectedFilter === "All" || row.some((cell) => cell.toLowerCase().includes(selectedFilter.toLowerCase()))));
  const createModuleRow = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("itemName") ?? "").trim();
    if (!name) return;
    const newRow = config.columns.map((_, index) => {
      if (index === 0) return name;
      if (index === config.columns.length - 1) return page === "Integrations" ? "Not connected" : page === "Security" ? "Pending" : "Active";
      if (index === 1) return "General";
      return "—";
    });
    setCreatedRows((current) => ({ ...current, [page]: [newRow, ...(current[page] ?? [])] }));
    setShowActionModal(false);
    onNotify(`${name} added to ${page}`);
  };
  const toggleItem = (name: string) => setEnabledItems((items) => items.includes(name) ? items.filter((item) => item !== name) : [...items, name]);

  return <>
    <SectionTitle title={config.title} subtitle={config.description} action={<button className="button button-primary" onClick={() => setShowActionModal(true)}><Plus size={16} /> {config.action}</button>} />
    <div className="stats-grid">
      {config.metrics.map((metric, index) => <section className={`stat-card stat-${["purple", "blue", "green"][index]}`} key={metric.label}><div className="stat-top"><span>{metric.label}</span><span className="stat-icon">{index === 0 ? <Gauge size={17} /> : index === 1 ? <Activity size={17} /> : <CheckCircle2 size={17} />}</span></div><div className="stat-value-row"><strong>{metric.value}</strong></div><p>{metric.detail}</p></section>)}
    </div>
    <section className="panel" style={{ marginTop: 22 }}>
      <div className="panel-heading"><div><h3>Recommended resources</h3><p>Search, review, and manage workspace information.</p></div><button className="button button-secondary button-compact" onClick={() => { setQuery(""); setSelectedFilter("All"); }}><Filter size={14} /> Reset filters</button></div>
      <div className="table-toolbar"><label className="global-search table-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${page.toLowerCase()}...`} /></label><select className="select-button" value={selectedFilter} onChange={(event) => setSelectedFilter(event.target.value)}><option>All</option><option>On track</option><option>Active</option><option>Connected</option></select></div>
      <div className="table-scroll"><table className="data-table"><thead><tr>{config.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{filteredRows.map((row, rowIndex) => <tr key={`${row[0]}-${rowIndex}`}>{row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`}>{cellIndex === row.length - 1 && /^(Manage|Connect|Open guide|Use template|Preview)$/.test(cell) ? <button className="table-action-link" onClick={() => onNotify(`${row[0]}: ${cell} (demo)`)}>{cell} <ArrowRight size={13} /></button> : cellIndex === row.length - 1 ? <span className={`status-pill ${/risk|focus|blocked|paused|watch/i.test(cell) ? "status-at-risk" : /track|active|connected|success|scheduled|paid|included/i.test(cell) ? "status-on-track" : "status-pending"}`}>{cell}</span> : cell}</td>)}</tr>)}</tbody></table>{filteredRows.length === 0 && <EmptyState icon={<Search />} title="No matching records" text="Try another search or reset your filters." />}</div>
    </section>
    {page === "Automations" && <section className="panel settings-panel" style={{ marginTop: 20 }}><h3>Quick automation controls</h3><p>Toggle the sample workflows you want enabled in this demo workspace.</p>{["Weekly project digest", "Overdue task reminder"].map((item) => <div className="settings-toggle-row" key={item}><div><strong>{item}</strong></div><button className={`toggle ${enabledItems.includes(item) ? "toggle-on" : ""}`} onClick={() => { toggleItem(item); onNotify(`${item} updated`); }} aria-label={`Toggle ${item}`}><i /></button></div>)}</section>}
    {showActionModal && <Modal title={config.action} subtitle={`Add a new item to ${config.title.toLowerCase()}. This is stored in the current frontend session.`} onClose={() => setShowActionModal(false)}><form className="modal-form" onSubmit={createModuleRow}><label>{config.columns[0]}<input name="itemName" placeholder={`Enter ${config.columns[0].toLowerCase()}`} required autoFocus /></label><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setShowActionModal(false)}>Cancel</button><button type="submit" className="button button-primary"><Plus size={16} /> Add item</button></div></form></Modal>}
  </>;
}

function SettingsPage({ profileName, currentUser, onSaveProfile, onSave }: { profileName: string; currentUser: any; onSaveProfile: (name: string) => Promise<boolean>; onSave: () => void }) {
  const [nameDraft, setNameDraft] = useState(profileName);
  const [savingProfile, setSavingProfile] = useState(false);
  const saveName = async () => {
    setSavingProfile(true);
    await onSaveProfile(nameDraft.trim());
    setSavingProfile(false);
  };
  const [activeTab, setActiveTab] = useState<"Profile" | "Workspace" | "Notifications" | "Security">("Profile");

const [email, setEmail] = useState(currentUser.email || "");

  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [workspace, setWorkspace] = useState("Northstar Studio");
  const [weeklyDigest, setWeeklyDigest] = useState(true);
  const [taskNotifications, setTaskNotifications] = useState(true);
  const [messageNotifications, setMessageNotifications] = useState(true);
  const [securityAlerts, setSecurityAlerts] = useState(true);
  const tabs = [
    { label: "Profile" as const, icon: UserRound },
    { label: "Workspace" as const, icon: BriefcaseBusiness },
    { label: "Notifications" as const, icon: Bell },
    { label: "Security" as const, icon: ShieldCheck },
  ];
  const toggleRow = (title: string, description: string, checked: boolean, onChange: () => void) => (
    <div className="settings-toggle-row" key={title}>
      <div><strong>{title}</strong><small>{description}</small></div>
      <button type="button" className={`toggle ${checked ? "toggle-on" : ""}`} onClick={onChange} aria-pressed={checked} aria-label={`Toggle ${title}`}><i /></button>
    </div>
  );
  return <>
    <SectionTitle title="Settings" subtitle="Manage your workspace preferences and profile." action={<button className="button button-primary" onClick={activeTab === "Profile" ? saveName : onSave} disabled={savingProfile}><Check size={16} /> Save changes</button>} />
    <div className="settings-layout">
      <aside className="panel settings-nav" aria-label="Settings sections">
        {tabs.map(({ label, icon: Icon }) => <button type="button" key={label} className={activeTab === label ? "settings-nav-active" : ""} aria-current={activeTab === label ? "page" : undefined} onClick={() => setActiveTab(label)}><Icon size={17} /> {label}</button>)}
      </aside>
      <div className="settings-main">
        {activeTab === "Profile" && <section className="panel settings-panel">
          <div className="settings-panel-title"><div><h3>Personal profile</h3><p>Update your account information.</p></div><Avatar initials={profileName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "AS"} /></div>
          <div className="settings-form-grid">
            <label>Full name<input value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} minLength={2} maxLength={80} /></label>
            <label>Email address<input type="email" value={email} disabled /></label>
            <label>Role<input value={capitalize(String(currentUser.role || "employee"))} disabled /></label>
            <label>Timezone<select value={timezone} onChange={(event) => setTimezone(event.target.value)}><option value="Asia/Kolkata">India Standard Time (UTC+5:30)</option><option value="UTC">UTC</option><option value="America/New_York">Eastern Time</option></select></label>
          </div>
        </section>}
        {activeTab === "Workspace" && <section className="panel settings-panel">
          <div className="settings-panel-title"><div><h3>Workspace details</h3><p>Manage the workspace identity used across your team.</p></div><BriefcaseBusiness size={24} /></div>
          <label className="settings-single-label">Workspace name<input value={workspace} onChange={(event) => setWorkspace(event.target.value)} /></label>
          <div className="settings-info-card"><strong>Current plan</strong><span>Free workspace</span><small>Manage plan options from “Explore plans” in the sidebar.</small></div>
          <button type="button" className="button button-secondary" onClick={onSave}><Check size={16} /> Save workspace details</button>
        </section>}
        {activeTab === "Notifications" && <section className="panel settings-panel">
          <h3>Notification preferences</h3><p>Choose which workspace updates you want to receive.</p>
          {toggleRow("Weekly digest", "Receive a summary of activity every Monday.", weeklyDigest, () => setWeeklyDigest((value) => !value))}
          {toggleRow("Task notifications", "Get notified when someone assigns you a task.", taskNotifications, () => setTaskNotifications((value) => !value))}
          {toggleRow("Message notifications", "Show alerts for new team messages.", messageNotifications, () => setMessageNotifications((value) => !value))}
          <button type="button" className="button button-primary" onClick={onSave}><Check size={16} /> Save notification preferences</button>
        </section>}
        {activeTab === "Security" && <section className="panel settings-panel">
          <h3>Security & access</h3><p>Review account safeguards. These settings are demo-only until authentication is connected.</p>
          {toggleRow("Security alerts", "Show an alert for unusual sign-in activity.", securityAlerts, () => setSecurityAlerts((value) => !value))}
          <div className="settings-info-card"><strong>Current session</strong><span>This browser · Active now</span><small>Signed in as {email}</small></div>
          <div className="settings-security-actions"><button type="button" className="button button-secondary" onClick={() => window.alert("Password reset flow will be available after backend authentication is connected.")}>Change password</button><button type="button" className="button button-secondary" onClick={() => window.alert("No other active demo sessions were found.")}>Review sessions</button></div>
        </section>}
      </div>
    </div>
  </>;
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: ReactNode }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal"><div className="modal-heading"><div><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-button" onClick={onClose} aria-label="Close modal"><X size={19} /></button></div>{children}</section></div>;
}

function EmptyState({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <div className="empty-state"><span className="empty-icon">{icon}</span><h3>{title}</h3><p>{text}</p></div>;
}

function FilesPageLive({ projects, onNotify }: { projects: Project[]; onNotify: (text: string) => void }) {
  const [projectId, setProjectId] = useState("");
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!projectId && projects.length) setProjectId(String(projects[0].id));
  }, [projects, projectId]);

  const load = async (pid: string) => {
    setLoading(true);
    try {
      const res = await api<any>(`/files?projectId=${pid}`);
      setFiles(res.files ?? toList(res));
    } catch (err: any) {
      setFiles([]);
      onNotify(err.message || "Could not load files");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (projectId) load(projectId); }, [projectId]);

  const authHeader = () => ({ Authorization: "Bearer " + (localStorage.getItem("token") || "") });

  const upload = async (file: File) => {
    if (!projectId) { onNotify("Select a project first"); return; }
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("projectId", projectId);
      body.append("project", projectId);
   const res = await fetch(`${API_BASE}/files/upload`, { method: "POST", headers: authHeader(), body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Upload failed");
      await load(projectId);
      onNotify("File uploaded");
    } catch (err: any) {
      onNotify(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const download = async (f: any) => {
    try {
     const res = await fetch(`${API_BASE}/files/${f._id}/download`, { headers: authHeader() });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = f.originalName || "file";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      onNotify(err.message || "Download failed");
    }
  };

  const remove = async (f: any) => {
    if (!window.confirm(`Delete ${f.originalName}?`)) return;
    try {
      await api(`/files/${f._id}`, { method: "DELETE" });
      await load(projectId);
      onNotify("File deleted");
    } catch (err: any) {
      onNotify(err.message || "Could not delete file");
    }
  };

  const sizeText = (n: number) => {
    const v = Number(n || 0);
    if (v < 1024) return `${v} B`;
    if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
    return `${(v / 1024 / 1024).toFixed(1)} MB`;
  };

  const projectName = projects.find((p) => String(p.id) === projectId)?.name ?? "—";
  const visible = files.filter((f) => String(f.originalName ?? "").toLowerCase().includes(query.toLowerCase()));

  return <>
    <SectionTitle title="Files & documents" subtitle="Find project documents, shared assets, and deliverables." action={<>
      <input ref={fileInput} type="file" style={{ display: "none" }} onChange={(event) => { const f = event.target.files?.[0]; if (f) upload(f); }} />
      <button className="button button-primary" disabled={uploading || !projectId} onClick={() => fileInput.current?.click()}><Plus size={16} /> {uploading ? "Uploading..." : "Upload file"}</button>
    </>} />
    <div className="toolbar">
      <label className="inline-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search files..." /></label>
      <select className="select-control" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
        {projects.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
      </select>
    </div>
    <section className="panel">
      <div className="table-scroll"><table className="data-table"><thead><tr>
        <th>Name</th><th>Project</th><th>Size</th><th>Uploaded by</th><th>Uploaded</th><th>Actions</th>
      </tr></thead><tbody>
        {visible.map((f) => <tr key={f._id}>
          <td><strong>{f.originalName}</strong><br /><small>{f.mimeType}</small></td>
          <td>{projectName}</td>
          <td>{sizeText(f.size)}</td>
          <td>{f.uploadedBy?.name ?? "—"}</td>
          <td>{f.createdAt ? fmtUtc(f.createdAt) : "—"}</td>
          <td><span style={{ display: "flex", gap: 12 }}>
            <button className="text-button" onClick={() => download(f)}>Download</button>
            <button className="text-button" onClick={() => remove(f)}>Delete</button>
          </span></td>
        </tr>)}
      </tbody></table>
      {!loading && visible.length === 0 && <EmptyState icon={<FileText />} title="No files in this project" text="Use Upload file to add the first one." />}
      </div>
    </section>
  </>;
}

function CalendarPage({ onNotify }: { onNotify: (text: string) => void }) {
   
  const [showForm, setShowForm] = useState(false);
  const [reload, setReload] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("All");

  const base = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + monthOffset, 1);
  }, [monthOffset]);
  const label = base.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  useEffect(() => {
    const start = ymd(base);
    const end = ymd(new Date(base.getFullYear(), base.getMonth() + 1, 0));
    setLoading(true);
    api<any>(`/calendar/events?startDate=${start}&endDate=${end}`)
      .then((res) => setEvents(res.events ?? toList(res)))
      .catch((err: any) => onNotify(err.message || "Could not load calendar"))
      .finally(() => setLoading(false));
  }, [base, reload]);

  const typeLabel = (t: string) =>
    t === "project-start" ? "Project start" : t === "project-end" ? "Project end" : capitalize(String(t || "event").replace(/[-_]/g, " "));
  const dateOf = (e: any) => e.date ?? e.startDate;
  const detailOf = (e: any) => String(e.project?.name ?? e.employee?.name ?? e.assignedTo?.name ?? "—");
  const dateText = (e: any) => {
    const d = dateOf(e);
    if (!d) return "—";
    return e.endDate && e.endDate !== e.startDate ? `${fmtUtc(e.startDate)} – ${fmtUtc(e.endDate)}` : fmtUtc(d);
  };

  const types = Array.from(new Set(events.map((e) => String(e.type ?? "event"))));
  const sorted = [...events]
    .filter((e) => typeFilter === "All" || String(e.type) === typeFilter)
    .sort((a, b) => new Date(dateOf(a)).getTime() - new Date(dateOf(b)).getTime());

  const count = (t: string) => events.filter((e) => e.type === t).length;
  const submitEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const start = String(form.get("startDate") || "");
    const end = String(form.get("endDate") || start);
    try {
      await api("/calendar/events", {
        method: "POST",
        body: JSON.stringify({
          title: String(form.get("title") || "").trim(),
          description: String(form.get("description") || "").trim(),
          startDate: new Date(`${start}T00:00:00.000Z`).toISOString(),
          endDate: new Date(`${end}T23:59:59.000Z`).toISOString(),
        }),
      });
      setShowForm(false);
      setReload((n) => n + 1);
      onNotify("Event created");
    } catch (err: any) {
      onNotify(err.message || "Could not create event");
    }
  };


  return <>
    <SectionTitle title="Team calendar" subtitle="A shared view of project milestones, meetings, and deadlines." action={<button className="button button-primary" onClick={() => setShowForm(true)}><Plus size={16} /> Add event</button>} />
    <div className="stats-grid">
      <StatCard label="Events this month" value={String(events.length)} change={label} icon={<CalendarDays size={19} />} tone="purple" />
      <StatCard label="Task deadlines" value={String(count("task"))} change="Due this month" icon={<ListTodo size={19} />} tone="blue" />
      <StatCard label="Approved leaves" value={String(count("leave"))} change="Team time away" icon={<CalendarCheck size={19} />} tone="green" />
    </div>
    <section className="panel" style={{ marginTop: 22 }}>
      <div className="panel-heading"><div><h3>{label}</h3><p>Everything scheduled this month</p></div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="button button-secondary button-compact" onClick={() => setMonthOffset((m) => m - 1)} aria-label="Previous month"><ChevronLeft size={15} /></button>
          <button className="button button-secondary button-compact" onClick={() => setMonthOffset(0)}>Today</button>
          <button className="button button-secondary button-compact" onClick={() => setMonthOffset((m) => m + 1)} aria-label="Next month"><ChevronRight size={15} /></button>
        </div>
      </div>
      <div className="table-toolbar">
        <select className="select-button" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
          <option value="All">All types</option>
          {types.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
        </select>
      </div>
      <div className="table-scroll"><table className="data-table"><thead><tr>
        <th>Date</th><th>Event</th><th>Type</th><th>Details</th><th>Status</th>
      </tr></thead><tbody>
        {sorted.map((e, i) => <tr key={e.id ?? i}>
          <td>{dateText(e)}</td>
          <td><strong>{e.title}</strong></td>
          <td>{typeLabel(e.type)}</td>
          <td>{detailOf(e)}</td>
          <td>{e.status ? <StatusPill>{capitalize(String(e.status).replace(/[-_]/g, " "))}</StatusPill> : "—"}</td>
        </tr>)}
      </tbody></table>
      {!loading && sorted.length === 0 && <EmptyState icon={<CalendarDays />} title="Nothing scheduled" text="No events in this month. Try another month." />}
      </div>
    </section>

        {showForm && <Modal title="Add event" subtitle="Schedule something on the team calendar." onClose={() => setShowForm(false)}>
      <form className="modal-form" onSubmit={submitEvent}>
        <label>Title<input name="title" placeholder="e.g. Sprint planning" required minLength={3} autoFocus /></label>
        <label>Description<textarea name="description" rows={3} placeholder="Optional details" /></label>
        <div className="form-grid">
          <label>Start date<input name="startDate" type="date" required /></label>
          <label>End date<input name="endDate" type="date" /></label>
        </div>
        <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setShowForm(false)}>Cancel</button><button className="button button-primary" type="submit"><Plus size={16} /> Create event</button></div>
      </form>
    </Modal>}
  </>;
}

function GoalsPage({ currentUser, onNotify }: { currentUser: any; onNotify: (text: string) => void }) {
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    try {
      const res = await api<any>("/goals");
      setGoals(res.goals ?? toList(res));
    } catch (err: any) {
      onNotify(err.message || "Could not load goals");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const iso = (d: string) => new Date(`${d}T00:00:00.000Z`).toISOString();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const start = String(form.get("startDate") || "");
    const due = String(form.get("dueDate") || "");
    try {
      await api("/goals", {
        method: "POST",
        body: JSON.stringify({
          title: String(form.get("title") || "").trim(),
          description: String(form.get("description") || "").trim(),
          assignedTo: [currentUser.id],
          progress: Number(form.get("progress") || 0),
          ...(start ? { startDate: iso(start) } : {}),
          ...(due ? { dueDate: iso(due) } : {}),
        }),
      });
      setShowForm(false);
      await load();
      onNotify("Goal created");
    } catch (err: any) {
      onNotify(err.message || "Could not create goal");
    }
  };

  const avg = goals.length ? Math.round(goals.reduce((s, g) => s + Number(g.progress ?? 0), 0) / goals.length) : 0;
  const active = goals.filter((g) => g.status === "in-progress").length;
  const pretty = (s: string) => capitalize(String(s || "").replace(/[-_]/g, " "));

  return <>
    <SectionTitle title="Goals & OKRs" subtitle="Connect company priorities to measurable outcomes and accountable owners." action={<button className="button button-primary" onClick={() => setShowForm(true)}><Plus size={16} /> Create objective</button>} />
    <div className="stats-grid">
      <StatCard label="Total goals" value={String(goals.length)} change="Visible to you" icon={<Gauge size={19} />} tone="purple" />
      <StatCard label="In progress" value={String(active)} change="Currently active" icon={<Activity size={19} />} tone="blue" />
      <StatCard label="Average progress" value={`${avg}%`} change="Across all goals" icon={<CheckCircle2 size={19} />} tone="green" />
    </div>
    <section className="panel" style={{ marginTop: 22 }}>
      <div className="panel-heading"><div><h3>Objectives</h3><p>Owners, progress and target dates</p></div></div>
      <div className="table-scroll"><table className="data-table"><thead><tr>
        <th>Objective</th><th>Owner</th><th>Assigned to</th><th>Progress</th><th>Target date</th><th>Status</th>
      </tr></thead><tbody>
        {goals.map((g) => <tr key={g._id}>
          <td><strong>{g.title}</strong><br /><small>{g.description}</small></td>
          <td>{g.owner?.name ?? "—"}</td>
          <td>{(g.assignedTo ?? []).map((u: any) => u?.name).filter(Boolean).join(", ") || "—"}</td>
          <td style={{ minWidth: 140 }}><div className="progress-track"><i className="progress-purple" style={{ width: `${Number(g.progress ?? 0)}%` }} /></div><small>{Number(g.progress ?? 0)}%</small></td>
          <td>{g.dueDate ? fmtUtc(g.dueDate) : "—"}</td>
          <td><StatusPill>{pretty(g.status)}</StatusPill></td>
        </tr>)}
      </tbody></table>
      {!loading && goals.length === 0 && <EmptyState icon={<Gauge />} title="No goals yet" text="Use Create objective to add the first one." />}
      </div>
    </section>
    {showForm && <Modal title="Create objective" subtitle="Set a measurable goal for your team." onClose={() => setShowForm(false)}>
      <form className="modal-form" onSubmit={submit}>
        <label>Objective<input name="title" placeholder="e.g. Improve onboarding" required minLength={3} autoFocus /></label>
        <label>Description<textarea name="description" rows={3} placeholder="What does success look like?" /></label>
        <div className="form-grid">
          <label>Start date<input name="startDate" type="date" /></label>
          <label>Target date<input name="dueDate" type="date" /></label>
        </div>
        <label>Progress (%)<input name="progress" type="number" min="0" max="100" defaultValue={0} /></label>
        <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setShowForm(false)}>Cancel</button><button className="button button-primary" type="submit"><Plus size={16} /> Create goal</button></div>
      </form>
    </Modal>}
  </>;
}

function BudgetPage({ projects, onNotify }: { projects: Project[]; onNotify: (text: string) => void }) {
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBudget, setShowBudget] = useState(false);
  const [showExpense, setShowExpense] = useState(false);

  const load = async () => {
    try {
      const res = await api<any>("/budgets");
      const list = res.budgets ?? toList(res);
      const detailed = await Promise.all(list.map(async (b: any) => {
        try {
          const ex = await api<any>(`/budgets/${b._id}/expenses`);
          return { ...b, expenses: ex.expenses ?? [], summary: ex.summary ?? null };
        } catch {
          return { ...b, expenses: [], summary: null };
        }
      }));
      setBudgets(detailed);
    } catch (err: any) {
      onNotify(err.message || "Could not load budgets");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const submitBudget = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api("/budgets", {
        method: "POST",
        body: JSON.stringify({
          project: String(form.get("project") || ""),
          allocatedAmount: Number(form.get("amount") || 0),
          currency: "INR",
        }),
      });
      setShowBudget(false);
      await load();
      onNotify("Budget created");
    } catch (err: any) {
      onNotify(err.message || "Could not create budget");
    }
  };

  const submitExpense = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const budgetId = String(form.get("budget") || "");
    const date = String(form.get("date") || "");
    try {
      await api(`/budgets/${budgetId}/expenses`, {
        method: "POST",
        body: JSON.stringify({
          description: String(form.get("description") || "").trim(),
          amount: Number(form.get("amount") || 0),
          category: String(form.get("category") || "").trim() || "Other",
          ...(date ? { expenseDate: new Date(`${date}T00:00:00.000Z`).toISOString() } : {}),
        }),
      });
      setShowExpense(false);
      await load();
      onNotify("Expense added");
    } catch (err: any) {
      onNotify(err.message || "Could not add expense");
    }
  };

  const money = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
  const rows = budgets.map((b) => {
    const allocated = Number(b.summary?.allocatedAmount ?? b.allocatedAmount ?? 0);
    const spent = Number(b.summary?.totalSpent ?? 0);
    const remaining = Number(b.summary?.remainingAmount ?? allocated - spent);
    const used = allocated ? spent / allocated : 0;
    const health = used >= 0.9 ? "At risk" : used >= 0.7 ? "Watch" : "On track";
    return { b, allocated, spent, remaining, health };
  });
  const totalAllocated = rows.reduce((s, r) => s + r.allocated, 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);
  const expenses = budgets.flatMap((b) => (b.expenses ?? []).map((e: any) => ({ ...e, projectName: b.project?.name ?? "—" })))
    .sort((a: any, c: any) => new Date(c.expenseDate).getTime() - new Date(a.expenseDate).getTime());
  const budgeted = new Set(budgets.map((b) => String(b.project?._id ?? b.project)));
  const freeProjects = projects.filter((p) => !budgeted.has(String(p.id)));
  const today = ymd(new Date());

  return <>
    <SectionTitle title="Budget & expenses" subtitle="Keep project spending transparent and catch budget overruns early." action={<>
      <button className="button button-secondary" onClick={() => setShowBudget(true)}><Plus size={16} /> Add budget</button>
      <button className="button button-primary" onClick={() => setShowExpense(true)} disabled={budgets.length === 0}><Plus size={16} /> Add expense</button>
    </>} />
    <div className="stats-grid">
      <StatCard label="Total budget" value={money(totalAllocated)} change={`Across ${budgets.length} project${budgets.length === 1 ? "" : "s"}`} icon={<BriefcaseBusiness size={19} />} tone="purple" />
      <StatCard label="Spent to date" value={money(totalSpent)} change={`${totalAllocated ? Math.round((totalSpent / totalAllocated) * 100) : 0}% of budget`} icon={<Activity size={19} />} tone="blue" />
      <StatCard label="Remaining" value={money(totalAllocated - totalSpent)} change="Left to spend" icon={<CheckCircle2 size={19} />} tone="green" />
    </div>
    <section className="panel" style={{ marginTop: 22 }}>
      <div className="panel-heading"><div><h3>Project budget overview</h3><p>Allocated vs spent per project</p></div></div>
      <div className="table-scroll"><table className="data-table"><thead><tr>
        <th>Project</th><th>Budget</th><th>Spent</th><th>Remaining</th><th>Health</th>
      </tr></thead><tbody>
        {rows.map(({ b, allocated, spent, remaining, health }) => <tr key={b._id}>
          <td><strong>{b.project?.name ?? "—"}</strong></td>
          <td>{money(allocated)}</td>
          <td>{money(spent)}</td>
          <td>{money(remaining)}</td>
          <td><StatusPill>{health}</StatusPill></td>
        </tr>)}
      </tbody></table>
      {!loading && rows.length === 0 && <EmptyState icon={<BriefcaseBusiness />} title="No budgets yet" text="Use Add budget to set one for a project." />}
      </div>
    </section>
    <section className="panel" style={{ marginTop: 22 }}>
      <div className="panel-heading"><div><h3>Recent expenses</h3><p>Latest spending across projects</p></div></div>
      <div className="table-scroll"><table className="data-table"><thead><tr>
        <th>Description</th><th>Project</th><th>Category</th><th>Amount</th><th>Date</th><th>Recorded by</th>
      </tr></thead><tbody>
        {expenses.map((e: any) => <tr key={e._id}>
          <td><strong>{e.description}</strong></td>
          <td>{e.projectName}</td>
          <td>{e.category ?? "—"}</td>
          <td>{money(e.amount)}</td>
          <td>{e.expenseDate ? fmtUtc(e.expenseDate) : "—"}</td>
          <td>{e.recordedBy?.name ?? "—"}</td>
        </tr>)}
      </tbody></table>
      {!loading && expenses.length === 0 && <EmptyState icon={<Search />} title="No expenses yet" text="Recorded expenses will show up here." />}
      </div>
    </section>
    {showBudget && <Modal title="Add budget" subtitle="Allocate a budget to a project (one budget per project)." onClose={() => setShowBudget(false)}>
      <form className="modal-form" onSubmit={submitBudget}>
        <label>Project<select name="project" required>{freeProjects.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}</select></label>
        {freeProjects.length === 0 && <p className="modal-footnote">All projects in this workspace already have a budget.</p>}
        <label>Allocated amount (₹)<input name="amount" type="number" min="1" step="1" required /></label>
        <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setShowBudget(false)}>Cancel</button><button className="button button-primary" type="submit" disabled={freeProjects.length === 0}><Plus size={16} /> Create budget</button></div>
      </form>
    </Modal>}
    {showExpense && <Modal title="Add expense" subtitle="Record spending against a project budget." onClose={() => setShowExpense(false)}>
      <form className="modal-form" onSubmit={submitExpense}>
        <label>Project budget<select name="budget" required>{budgets.map((b) => <option key={b._id} value={b._id}>{b.project?.name ?? "Project"}</option>)}</select></label>
        <label>Description<input name="description" placeholder="e.g. Development tools" required minLength={2} autoFocus /></label>
        <div className="form-grid">
          <label>Amount (₹)<input name="amount" type="number" min="1" step="1" required /></label>
          <label>Category<input name="category" placeholder="e.g. Software" /></label>
        </div>
        <label>Date<input name="date" type="date" defaultValue={today} /></label>
        <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setShowExpense(false)}>Cancel</button><button className="button button-primary" type="submit"><Plus size={16} /> Add expense</button></div>
      </form>
    </Modal>}
  </>;
}

function MilestonesPage({ projects, currentUser, onNotify }: { projects: Project[]; currentUser: any; onNotify: (text: string) => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const canManage = ["admin", "manager"].includes(String(currentUser.role));

  const load = async () => {
    try {
      const res = await api<any>("/milestones");
      setItems(res.milestones ?? toList(res));
    } catch (err: any) {
      onNotify(err.message || "Could not load milestones");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const wsIds = new Set(projects.map((p) => String(p.id)));
  const visible = items.filter((m) => wsIds.has(String(m.project?._id ?? m.project)));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const due = String(form.get("dueDate") || "");
    try {
      await api("/milestones", {
        method: "POST",
        body: JSON.stringify({
          project: String(form.get("project") || ""),
          title: String(form.get("title") || "").trim(),
          description: String(form.get("description") || "").trim(),
          dueDate: new Date(`${due}T00:00:00.000Z`).toISOString(),
          status: String(form.get("status") || "upcoming"),
        }),
      });
      setShowForm(false);
      await load();
      onNotify("Milestone created");
    } catch (err: any) {
      onNotify(err.message || "Could not create milestone");
    }
  };

  const changeStatus = async (id: string, status: string) => {
    try {
      await api(`/milestones/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      await load();
      onNotify("Milestone updated");
    } catch (err: any) {
      onNotify(err.message || "Could not update milestone");
    }
  };

  const remove = async (m: any) => {
    if (!window.confirm(`Delete "${m.title}"?`)) return;
    try {
      await api(`/milestones/${m._id}`, { method: "DELETE" });
      await load();
      onNotify("Milestone deleted");
    } catch (err: any) {
      onNotify(err.message || "Could not delete milestone");
    }
  };

  const now = new Date();
  const upcoming = visible.filter((m) => m.status !== "completed").length;
  const completed = visible.filter((m) => m.status === "completed").length;
  const risky = visible.filter((m) => m.status === "at-risk" || (m.status !== "completed" && new Date(m.dueDate) < now)).length;
  const pretty = (s: string) => capitalize(String(s || "").replace(/[-_]/g, " "));

  return <>
    <SectionTitle title="Project milestones" subtitle="Keep important delivery checkpoints visible and accountable." action={canManage ? <button className="button button-primary" onClick={() => setShowForm(true)} disabled={projects.length === 0}><Plus size={16} /> Add milestone</button> : undefined} />
    <div className="stats-grid">
      <StatCard label="Open milestones" value={String(upcoming)} change="Not completed yet" icon={<Flag size={19} />} tone="purple" />
      <StatCard label="Completed" value={String(completed)} change="Delivered" icon={<CheckCircle2 size={19} />} tone="green" />
      <StatCard label="At risk / overdue" value={String(risky)} change="Need attention" icon={<AlertCircle size={19} />} tone="orange" />
    </div>
    <section className="panel" style={{ marginTop: 22 }}>
      <div className="panel-heading"><div><h3>All milestones</h3><p>For projects in this workspace</p></div></div>
      <div className="table-scroll"><table className="data-table"><thead><tr>
        <th>Milestone</th><th>Project</th><th>Due date</th><th>Status</th>{canManage && <th>Actions</th>}
      </tr></thead><tbody>
        {visible.map((m) => <tr key={m._id}>
          <td><strong>{m.title}</strong>{m.description ? <><br /><small>{m.description}</small></> : null}</td>
          <td>{m.project?.name ?? "—"}</td>
          <td>{m.dueDate ? fmtUtc(m.dueDate) : "—"}</td>
          <td>{canManage
            ? <select className="select-button" value={m.status} onChange={(event) => changeStatus(m._id, event.target.value)}>
                <option value="upcoming">Upcoming</option><option value="in-progress">In progress</option><option value="completed">Completed</option><option value="at-risk">At risk</option>
              </select>
            : <StatusPill>{pretty(m.status)}</StatusPill>}</td>
          {canManage && <td><button className="text-button" onClick={() => remove(m)}>Delete</button></td>}
        </tr>)}
      </tbody></table>
      {!loading && visible.length === 0 && <EmptyState icon={<Flag />} title="No milestones yet" text="Add a milestone to track a delivery checkpoint." />}
      </div>
    </section>
    {showForm && <Modal title="Add milestone" subtitle="Create a checkpoint for a project." onClose={() => setShowForm(false)}>
      <form className="modal-form" onSubmit={submit}>
        <label>Project<select name="project" required>{projects.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}</select></label>
        <label>Title<input name="title" placeholder="e.g. Beta release" required minLength={3} autoFocus /></label>
        <label>Description<textarea name="description" rows={2} placeholder="Optional details" /></label>
        <div className="form-grid">
          <label>Due date<input name="dueDate" type="date" required /></label>
          <label>Status<select name="status"><option value="upcoming">Upcoming</option><option value="in-progress">In progress</option><option value="at-risk">At risk</option><option value="completed">Completed</option></select></label>
        </div>
        <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setShowForm(false)}>Cancel</button><button className="button button-primary" type="submit"><Plus size={16} /> Create milestone</button></div>
      </form>
    </Modal>}
  </>;
}

function ClientsPage({ currentUser, onNotify }: { currentUser: any; onNotify: (text: string) => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const canManage = ["admin", "manager"].includes(String(currentUser.role));

  const load = async () => {
    if (!canManage) { setLoading(false); return; }
    try {
      const res = await api<any>("/clients");
      setItems(res.clients ?? toList(res));
    } catch (err: any) {
      onNotify(err.message || "Could not load clients");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api("/clients", {
        method: "POST",
        body: JSON.stringify({
          name: String(form.get("name") || "").trim(),
          contactName: String(form.get("contactName") || "").trim(),
          email: String(form.get("email") || "").trim(),
          phone: String(form.get("phone") || "").trim(),
          status: String(form.get("status") || "active"),
          notes: String(form.get("notes") || "").trim(),
        }),
      });
      setShowForm(false);
      await load();
      onNotify("Client added");
    } catch (err: any) {
      onNotify(err.message || "Could not add client");
    }
  };

  const changeStatus = async (id: string, status: string) => {
    try {
      await api(`/clients/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      await load();
      onNotify("Client updated");
    } catch (err: any) {
      onNotify(err.message || "Could not update client");
    }
  };

  const remove = async (c: any) => {
    if (!window.confirm(`Delete ${c.name}?`)) return;
    try {
      await api(`/clients/${c._id}`, { method: "DELETE" });
      await load();
      onNotify("Client deleted");
    } catch (err: any) {
      onNotify(err.message || "Could not delete client");
    }
  };

  const visible = items.filter((c) => `${c.name} ${c.contactName} ${c.email}`.toLowerCase().includes(query.toLowerCase()));
  const count = (s: string) => items.filter((c) => c.status === s).length;

  if (!canManage) {
    return <>
      <SectionTitle title="Client directory" subtitle="Keep client contacts, engagement health, and account ownership together." />
      <EmptyState icon={<LockKeyhole />} title="Admins and managers only" text="Client details are visible only to admins and managers." />
    </>;
  }

  return <>
    <SectionTitle title="Client directory" subtitle="Keep client contacts, engagement health, and account ownership together." action={<button className="button button-primary" onClick={() => setShowForm(true)}><Plus size={16} /> Add client</button>} />
    <div className="stats-grid">
      <StatCard label="Total clients" value={String(items.length)} change="In your directory" icon={<Building2 size={19} />} tone="purple" />
      <StatCard label="Active" value={String(count("active"))} change="Current engagements" icon={<CheckCircle2 size={19} />} tone="green" />
      <StatCard label="Prospects" value={String(count("prospect"))} change="Potential clients" icon={<Users size={19} />} tone="blue" />
    </div>
    <section className="panel" style={{ marginTop: 22 }}>
      <div className="panel-heading"><div><h3>Clients</h3><p>Contacts and status</p></div></div>
      <div className="table-toolbar"><label className="global-search table-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search clients..." /></label></div>
      <div className="table-scroll"><table className="data-table"><thead><tr>
        <th>Client</th><th>Contact</th><th>Email</th><th>Phone</th><th>Status</th><th>Actions</th>
      </tr></thead><tbody>
        {visible.map((c) => <tr key={c._id}>
          <td><strong>{c.name}</strong>{c.notes ? <><br /><small>{c.notes}</small></> : null}</td>
          <td>{c.contactName || "—"}</td>
          <td>{c.email || "—"}</td>
          <td>{c.phone || "—"}</td>
          <td><select className="select-button" value={c.status} onChange={(event) => changeStatus(c._id, event.target.value)}>
            <option value="active">Active</option><option value="prospect">Prospect</option><option value="inactive">Inactive</option>
          </select></td>
          <td><button className="text-button" onClick={() => remove(c)}>Delete</button></td>
        </tr>)}
      </tbody></table>
      {!loading && visible.length === 0 && <EmptyState icon={<Building2 />} title="No clients yet" text="Use Add client to create the first one." />}
      </div>
    </section>
    {showForm && <Modal title="Add client" subtitle="Save a client and their main contact." onClose={() => setShowForm(false)}>
      <form className="modal-form" onSubmit={submit}>
        <label>Client name<input name="name" placeholder="e.g. Northstar Retail" required minLength={2} autoFocus /></label>
        <div className="form-grid">
          <label>Contact person<input name="contactName" placeholder="e.g. Priya Malhotra" /></label>
          <label>Status<select name="status"><option value="active">Active</option><option value="prospect">Prospect</option><option value="inactive">Inactive</option></select></label>
        </div>
        <div className="form-grid">
          <label>Email<input name="email" type="email" placeholder="name@company.com" /></label>
          <label>Phone<input name="phone" placeholder="+91..." /></label>
        </div>
        <label>Notes<textarea name="notes" rows={2} placeholder="Optional" /></label>
        <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setShowForm(false)}>Cancel</button><button className="button button-primary" type="submit"><Plus size={16} /> Add client</button></div>
      </form>
    </Modal>}
  </>;
}
const assetSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

function TemplatesPage({ currentUser, onNotify, onTasksCreated }: { currentUser: any; onNotify: (text: string) => void; onTasksCreated?: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [query, setQuery] = useState("");
  const canManage = ["admin", "manager"].includes(String(currentUser.role));

  const load = async () => {
    try {
      const res = await api<any>("/templates");
      setItems(res.templates ?? toList(res));
    } catch (err: any) {
      onNotify(err.message || "Could not load templates");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const tasks = String(form.get("tasks") || "")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length >= 2)
      .map((title) => ({ title }));
    const description = String(form.get("description") || "").trim();
    try {
      await api("/templates", {
        method: "POST",
        body: JSON.stringify({
          name: String(form.get("name") || "").trim(),
          category: String(form.get("category") || "").trim(),
          ...(description ? { description } : {}),
          tasks,
        }),
      });
      setShowForm(false);
      await load();
      onNotify("Template created");
    } catch (err: any) {
      onNotify(err.message || "Could not create template");
    }
  };

  const remove = async (t: any) => {
    if (!window.confirm(`Delete ${t.name}?`)) return;
    try {
      await api(`/templates/${t._id}`, { method: "DELETE" });
      await load();
      onNotify("Template deleted");
    } catch (err: any) {
      onNotify(err.message || "Could not delete template");
    }
  };

  const visible = items.filter((t) => `${t.name} ${t.category}`.toLowerCase().includes(query.toLowerCase()));
  const categories = new Set(items.map((t) => t.category)).size;
  const totalTasks = items.reduce((sum, t) => sum + (t.tasks?.length || 0), 0);

  return <>
    <SectionTitle title="Project templates" subtitle="Start faster with repeatable project plans and task checklists." action={canManage ? <div style={{ display: "flex", gap: 10 }}><button className="button button-secondary" onClick={() => setShowAi(true)}><Sparkles size={16} /> Generate with AI</button><button className="button button-primary" onClick={() => setShowForm(true)}><Plus size={16} /> Create template</button></div> : undefined} />
    <div className="stats-grid">
      <StatCard label="Total templates" value={String(items.length)} change="In your library" icon={<Layers3 size={19} />} tone="purple" />
      <StatCard label="Categories" value={String(categories)} change="Template groups" icon={<FolderKanban size={19} />} tone="blue" />
      <StatCard label="Tasks included" value={String(totalTasks)} change="Across all templates" icon={<CheckCircle2 size={19} />} tone="green" />
    </div>
    <section className="panel" style={{ marginTop: 22 }}>
      <div className="panel-heading"><div><h3>Templates</h3><p>Reusable plans and checklists</p></div></div>
      <div className="table-toolbar"><label className="global-search table-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search templates..." /></label></div>
      <div className="table-scroll"><table className="data-table"><thead><tr>
        <th>Template</th><th>Category</th><th>Tasks</th><th>Created</th>{canManage && <th>Actions</th>}
      </tr></thead><tbody>
        {visible.map((t) => <tr key={t._id}>
          <td><strong>{t.name}</strong>{t.description ? <><br /><small>{t.description}</small></> : null}</td>
          <td>{t.category || "—"}</td>
          <td>{(t.tasks || []).length ? (t.tasks as any[]).slice(0, 3).map((task: any) => task.title).join(", ") + ((t.tasks as any[]).length > 3 ? ` +${(t.tasks as any[]).length - 3} more` : "") : "—"}</td>
          <td>{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "—"}</td>
          {canManage && <td><button className="text-button" onClick={() => remove(t)}>Delete</button></td>}
        </tr>)}
      </tbody></table>
      {!loading && visible.length === 0 && <EmptyState icon={<Layers3 />} title="No templates yet" text="Use Create template to add the first one." />}
      </div>
    </section>
    {showForm && <Modal title="Create template" subtitle="Save a reusable plan with its task checklist." onClose={() => setShowForm(false)}>
      <form className="modal-form" onSubmit={submit}>
        <div className="form-grid">
          <label>Template name<input name="name" placeholder="e.g. Website launch" required minLength={3} autoFocus /></label>
          <label>Category<input name="category" placeholder="e.g. Marketing" required /></label>
        </div>
        <label>Description<textarea name="description" rows={2} placeholder="Optional" /></label>
        <label>Tasks (one per line)<textarea name="tasks" rows={5} placeholder={"Design homepage\nWrite copy"} /></label>
        <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setShowForm(false)}>Cancel</button><button className="button button-primary" type="submit"><Plus size={16} /> Create template</button></div>
      </form>
    </Modal>}
    {showAi && <AiTaskGeneratorModal currentUser={currentUser} onClose={() => setShowAi(false)} onNotify={onNotify} onTemplateSaved={load} onTasksCreated={onTasksCreated ?? (() => {})} />}
  </>;
}

type AiTaskItem = { title: string; description: string; priority: string; selected: boolean };

function AiTaskGeneratorModal({ currentUser, onClose, onNotify, onTemplateSaved, onTasksCreated }: { currentUser: any; onClose: () => void; onNotify: (text: string) => void; onTemplateSaved: () => void; onTasksCreated: () => void }) {
  const [description, setDescription] = useState("");
  const [count, setCount] = useState("8");
  const [language, setLanguage] = useState("English");
  const [generating, setGenerating] = useState(false);
  const [items, setItems] = useState<AiTaskItem[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [projectId, setProjectId] = useState("");
  const [members, setMembers] = useState<any[]>([]);
  const [assigneeId, setAssigneeId] = useState("");
  const [saving, setSaving] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateCategory, setTemplateCategory] = useState("");

  useEffect(() => {
    api<any>("/projects")
      .then((res) => {
        const list = ((res.projects ?? toList(res)) as any[]).filter((p) => p.status !== "archived");
        setProjects(list);
        if (list.length) setProjectId(String(list[0]._id));
      })
      .catch((err: any) => onNotify(err.message || "Could not load projects"));
  }, []);

  useEffect(() => {
    if (!projectId) { setMembers([]); setAssigneeId(""); return; }
    api<any>(`/ai/project-members/${projectId}`)
      .then((res) => {
        const list = (res.members ?? []) as any[];
        setMembers(list);
        const me = list.find((m) => String(m.id) === String(currentUser.id));
        setAssigneeId(me ? String(me.id) : list.length ? String(list[0].id) : "");
      })
      .catch(() => { setMembers([]); setAssigneeId(""); });
  }, [projectId]);

  const selected = items.filter((item) => item.selected && item.title.trim().length >= 3);

  const updateItem = (index: number, patch: Partial<AiTaskItem>) =>
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const generate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (description.trim().length < 10) {
      onNotify("Description kam se kam 10 letters ki likho");
      return;
    }
    setGenerating(true);
    try {
      const res = await api<any>("/ai/tasks/generate", {
        method: "POST",
        body: JSON.stringify({
          description: description.trim(),
          count: Number(count),
          language: language === "Hinglish" ? "hinglish" : "english",
        }),
      });
      const list: AiTaskItem[] = ((res.tasks ?? []) as any[]).map((t) => ({
        title: String(t.title ?? ""),
        description: String(t.description ?? ""),
        priority: String(t.priority ?? "medium"),
        selected: true,
      }));
      if (list.length === 0) throw new Error("AI ne koi task nahi banaya");
      setItems(list);
    } catch (err: any) {
      onNotify(err.message || "Could not generate tasks");
    } finally {
      setGenerating(false);
    }
  };

  const createTasks = async () => {
    if (!projectId || !assigneeId) { onNotify("Project aur assignee chuno"); return; }
    if (selected.length === 0) { onNotify("Kam se kam ek task select karo"); return; }
    setSaving(true);
    try {
      const res = await api<any>("/ai/tasks/create", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          assignedTo: assigneeId,
          tasks: selected.map((item) => ({ title: item.title.trim(), description: item.description, priority: item.priority })),
        }),
      });
      onNotify(`${res.created ?? selected.length} tasks created`);
      onTasksCreated();
      onClose();
    } catch (err: any) {
      onNotify(err.message || "Could not create tasks");
    } finally {
      setSaving(false);
    }
  };

  const saveTemplate = async () => {
    if (templateName.trim().length < 3 || !templateCategory.trim()) { onNotify("Template name (3+ letters) aur category daalo"); return; }
    if (selected.length === 0) { onNotify("Kam se kam ek task select karo"); return; }
    setSaving(true);
    try {
      await api("/templates", {
        method: "POST",
        body: JSON.stringify({
          name: templateName.trim(),
          category: templateCategory.trim(),
          tasks: selected.map((item) => ({
            title: item.title.trim(),
            ...(item.description ? { description: item.description } : {}),
            priority: item.priority === "urgent" ? "high" : item.priority,
          })),
        }),
      });
      onNotify("Template saved");
      onTemplateSaved();
      onClose();
    } catch (err: any) {
      onNotify(err.message || "Could not save template");
    } finally {
      setSaving(false);
    }
  };

  if (items.length === 0) {
    return <Modal title="Generate tasks with AI" subtitle="Describe a project or feature and AI will break it into tasks." onClose={onClose}>
      <form className="modal-form" onSubmit={generate}>
        <label>Project or feature description<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} maxLength={2000} placeholder="e.g. E-commerce app ka login module: email/password login, forgot password, Google sign-in" required autoFocus /></label>
        <div className="form-grid">
          <label>Number of tasks<select value={count} onChange={(event) => setCount(event.target.value)}><option>5</option><option>8</option><option>10</option><option>12</option><option>15</option></select></label>
          <label>Language<select value={language} onChange={(event) => setLanguage(event.target.value)}><option>English</option><option>Hinglish</option></select></label>
        </div>
        <div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button className="button button-primary" type="submit" disabled={generating}><Sparkles size={16} /> {generating ? "Generating..." : "Generate tasks"}</button></div>
      </form>
    </Modal>;
  }

  return <Modal title="Review generated tasks" subtitle="Untick, edit or change priority, then create the tasks or save them as a template." onClose={onClose}>
    <div className="modal-form">
      <div style={{ maxHeight: 300, overflowY: "auto", border: "1px solid #eceef6", borderRadius: 12, padding: "0 12px" }}>
        {items.map((item, index) => <div key={index} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10, alignItems: "start", padding: "10px 0", borderBottom: "1px solid #eceef6" }}>
          <input type="checkbox" checked={item.selected} onChange={(event) => updateItem(index, { selected: event.target.checked })} aria-label={`Select ${item.title}`} />
          <div style={{ display: "grid", gap: 4 }}>
            <input value={item.title} maxLength={150} onChange={(event) => updateItem(index, { title: event.target.value })} />
            <small>{item.description}</small>
          </div>
          <select value={item.priority} onChange={(event) => updateItem(index, { priority: event.target.value })}>
            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
          </select>
        </div>)}
      </div>
      <p className="modal-footnote">{selected.length} of {items.length} tasks selected</p>

      <h4 style={{ margin: "6px 0 0" }}>Option 1: Create tasks in a project</h4>
      <div className="form-grid">
        <label>Project<select value={projectId} onChange={(event) => setProjectId(event.target.value)}>{projects.map((p) => <option key={p._id} value={String(p._id)}>{p.name}</option>)}</select></label>
        <label>Assign to<select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>{members.map((m) => <option key={m.id} value={String(m.id)}>{m.name}</option>)}</select></label>
      </div>
      {projectId && members.length === 0 && <p className="modal-footnote">Is project mein tasks banane ki permission nahi hai, ya koi member nahi hai.</p>}
      <button type="button" className="button button-primary" onClick={createTasks} disabled={saving || !projectId || !assigneeId}><Plus size={16} /> {saving ? "Working..." : `Create ${selected.length} tasks`}</button>

      <h4 style={{ margin: "10px 0 0" }}>Option 2: Save as template</h4>
      <div className="form-grid">
        <label>Template name<input value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="e.g. Login module" maxLength={120} /></label>
        <label>Category<input value={templateCategory} onChange={(event) => setTemplateCategory(event.target.value)} placeholder="e.g. Engineering" /></label>
      </div>
      <button type="button" className="button button-secondary" onClick={saveTemplate} disabled={saving}><Layers3 size={16} /> Save as template</button>

      <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setItems([])}>Generate again</button><button type="button" className="button button-secondary" onClick={onClose}>Close</button></div>
    </div>
  </Modal>;
}

function AssetsPage({ onNotify }: { onNotify: (text: string) => void }) {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const load = async () => {
    setLoading(true);
    try {
      const pres = await api<any>("/projects");
      const projects: any[] = pres.projects ?? toList(pres);
      const results = await Promise.all(projects.map(async (p) => {
        try {
          const res = await api<any>(`/files?projectId=${p._id}`);
          return ((res.files ?? []) as any[]).map((f) => ({ ...f, projectName: p.name }));
        } catch {
          return [] as any[];
        }
      }));
      setFiles(results.flat().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
    } catch (err: any) {
      onNotify(err.message || "Could not load assets");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const download = async (f: any) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/files/${f._id}/download`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = f.originalName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      onNotify(err.message || "Download failed");
    }
  };

  const categories = ["All", ...Array.from(new Set(files.map((f) => f.category || "other")))];
  const visible = files.filter((f) => {
    const matchQuery = `${f.originalName} ${f.projectName}`.toLowerCase().includes(query.toLowerCase());
    const matchCategory = category === "All" || (f.category || "other") === category;
    return matchQuery && matchCategory;
  });
  const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);
  const projectCount = new Set(files.map((f) => f.projectName)).size;

  return <>
    <SectionTitle title="Shared assets" subtitle="Browse reusable design, brand, and delivery resources for your projects." />
    <div className="stats-grid">
      <StatCard label="Total files" value={String(files.length)} change="Across all projects" icon={<FileText size={19} />} tone="purple" />
      <StatCard label="Storage used" value={assetSize(totalSize)} change="Total file size" icon={<Image size={19} />} tone="blue" />
      <StatCard label="Projects with files" value={String(projectCount)} change="Upload from Files page" icon={<FolderKanban size={19} />} tone="green" />
    </div>
    <section className="panel" style={{ marginTop: 22 }}>
      <div className="panel-heading"><div><h3>Assets</h3><p>Files from all your projects</p></div></div>
      <div className="table-toolbar" style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <label className="global-search table-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search files or projects..." /></label>
        <select className="select-button" value={category} onChange={(event) => setCategory(event.target.value)}>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="table-scroll"><table className="data-table"><thead><tr>
        <th>Asset</th><th>Type</th><th>Project</th><th>Size</th><th>Uploaded by</th><th>Updated</th><th>Actions</th>
      </tr></thead><tbody>
        {visible.map((f) => <tr key={f._id}>
          <td><strong>{f.originalName}</strong></td>
          <td>{f.category || f.extension || "—"}</td>
          <td>{f.projectName}</td>
          <td>{assetSize(f.size || 0)}</td>
          <td>{f.uploadedBy?.name || "—"}</td>
          <td>{f.createdAt ? new Date(f.createdAt).toLocaleDateString() : "—"}</td>
          <td><button className="text-button" onClick={() => download(f)}>Download</button></td>
        </tr>)}
      </tbody></table>
      {!loading && visible.length === 0 && <EmptyState icon={<Image />} title="No assets found" text="Upload files from the Files page and they will show up here." />}
      </div>
    </section>
  </>;
}

function HelpCenterPage({ currentUser, onNotify }: { currentUser: any; onNotify: (text: string) => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [reading, setReading] = useState<any | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const canManage = ["admin", "manager"].includes(String(currentUser.role));

  const load = async () => {
    try {
      const res = await api<any>("/articles");
      setItems(res.articles ?? toList(res));
    } catch (err: any) {
      onNotify(err.message || "Could not load articles");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api("/articles", {
        method: "POST",
        body: JSON.stringify({
          title: String(form.get("title") || "").trim(),
          category: String(form.get("category") || "").trim(),
          content: String(form.get("content") || "").trim(),
        }),
      });
      setShowForm(false);
      await load();
      onNotify("Article added");
    } catch (err: any) {
      onNotify(err.message || "Could not add article");
    }
  };

  const remove = async (a: any) => {
    if (!window.confirm(`Delete "${a.title}"?`)) return;
    try {
      await api(`/articles/${a._id}`, { method: "DELETE" });
      await load();
      onNotify("Article deleted");
    } catch (err: any) {
      onNotify(err.message || "Could not delete article");
    }
  };

  const categories = ["All", ...Array.from(new Set(items.map((a) => a.category)))];
  const visible = items.filter((a) => {
    const matchQuery = `${a.title} ${a.category}`.toLowerCase().includes(query.toLowerCase());
    const matchCategory = category === "All" || a.category === category;
    return matchQuery && matchCategory;
  });
  const latest = items.length ? new Date(items[0].updatedAt).toLocaleDateString() : "—";

  return <>
    <SectionTitle title="Help & support" subtitle="Get your team moving with practical guides and workspace support." action={canManage ? <button className="button button-primary" onClick={() => setShowForm(true)}><Plus size={16} /> Add article</button> : undefined} />
    <div className="stats-grid">
      <StatCard label="Help articles" value={String(items.length)} change="In the knowledge base" icon={<FileText size={19} />} tone="purple" />
      <StatCard label="Categories" value={String(categories.length - 1)} change="Topic groups" icon={<FolderKanban size={19} />} tone="blue" />
      <StatCard label="Last updated" value={latest} change="Most recent guide" icon={<Clock3 size={19} />} tone="green" />
    </div>
    <section className="panel" style={{ marginTop: 22 }}>
      <div className="panel-heading"><div><h3>Guides</h3><p>Practical how-tos for your workspace</p></div></div>
      <div className="table-toolbar" style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <label className="global-search table-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search guides..." /></label>
        <select className="select-button" value={category} onChange={(event) => setCategory(event.target.value)}>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="table-scroll"><table className="data-table"><thead><tr>
        <th>Guide</th><th>Category</th><th>Reading time</th><th>Updated</th><th>Actions</th>
      </tr></thead><tbody>
        {visible.map((a) => <tr key={a._id}>
          <td><strong>{a.title}</strong></td>
          <td>{a.category}</td>
          <td>{a.readingTime || 1} min</td>
          <td>{a.updatedAt ? new Date(a.updatedAt).toLocaleDateString() : "—"}</td>
          <td>
            <button className="text-button" onClick={() => setReading(a)}>Open guide</button>
            {canManage && <> · <button className="text-button" onClick={() => remove(a)}>Delete</button></>}
          </td>
        </tr>)}
      </tbody></table>
      {!loading && visible.length === 0 && <EmptyState icon={<CircleHelp />} title="No guides found" text={canManage ? "Use Add article to write the first guide." : "No guides have been published yet."} />}
      </div>
    </section>
    {reading && <Modal title={reading.title} subtitle={`${reading.category} · ${reading.readingTime || 1} min read`} onClose={() => setReading(null)}>
      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{reading.content}</div>
      <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setReading(null)}>Close</button></div>
    </Modal>}
    {showForm && <Modal title="Add article" subtitle="Write a help guide for your team." onClose={() => setShowForm(false)}>
      <form className="modal-form" onSubmit={submit}>
        <div className="form-grid">
          <label>Title<input name="title" placeholder="e.g. Getting started" required minLength={3} autoFocus /></label>
          <label>Category<input name="category" placeholder="e.g. Onboarding" required /></label>
        </div>
        <label>Content<textarea name="content" rows={8} placeholder="Write the guide here (min 10 characters)" required minLength={10} /></label>
        <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setShowForm(false)}>Cancel</button><button className="button button-primary" type="submit"><Plus size={16} /> Add article</button></div>
      </form>
    </Modal>}
  </>;
}

function WorkloadPage({ tasks, workspaceMembers }: { tasks: Task[]; workspaceMembers: any[] }) {
  const CAPACITY = 8;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const people = new Map<string, { name: string; role: string }>();
  workspaceMembers.forEach((u: any) => {
    if (u && typeof u === "object") people.set(String(u.name), { name: String(u.name), role: capitalize(String(u.role ?? "employee")) });
  });
  tasks.forEach((t) => { if (t.assignee && !people.has(t.assignee)) people.set(t.assignee, { name: t.assignee, role: "—" }); });

  const rows = Array.from(people.values()).map((p) => {
    const mine = tasks.filter((t) => t.assignee === p.name);
    const open = mine.filter((t) => t.status !== "Done");
    const overdue = open.filter((t) => t.dueDate && new Date(t.dueDate) < startOfToday).length;
    const urgent = open.filter((t) => t.priority === "High" || t.priority === "Urgent").length;
    const load = Math.round((open.length / CAPACITY) * 100);
    const availability = load >= 100 ? "Overloaded" : load >= 70 ? "Near capacity" : "Available";
    return { ...p, total: mine.length, open: open.length, overdue, urgent, load, availability };
  }).sort((a, b) => b.load - a.load);

  const overloaded = rows.filter((r) => r.load >= 100).length;
  const unassigned = tasks.filter((t) => t.status !== "Done" && (!t.assignee || t.assignee === "Teammate")).length;
  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + Math.min(r.load, 100), 0) / rows.length) : 0;

  return <>
    <SectionTitle title="Team workload" subtitle="Review capacity and distribute work more evenly across your team." />
    <div className="stats-grid">
      <StatCard label="Average load" value={`${avg}%`} change={`Capacity = ${CAPACITY} open tasks per person`} icon={<Gauge size={19} />} tone="purple" />
      <StatCard label="Overloaded members" value={String(overloaded)} change="At or above capacity" icon={<AlertCircle size={19} />} tone="orange" />
      <StatCard label="Unassigned open tasks" value={String(unassigned)} change="Need an owner" icon={<ListTodo size={19} />} tone="blue" />
    </div>
    <section className="panel" style={{ marginTop: 22 }}>
      <div className="panel-heading"><div><h3>Workload by member</h3><p>Based on open tasks in this workspace</p></div></div>
      <div className="table-scroll"><table className="data-table"><thead><tr>
        <th>Team member</th><th>Role</th><th>Open tasks</th><th>High priority</th><th>Overdue</th><th>Load</th><th>Availability</th>
      </tr></thead><tbody>
        {rows.map((r) => <tr key={r.name}>
          <td><span className="assignee-cell"><Avatar initials={initialsOf(r.name)} small />{r.name}</span></td>
          <td>{r.role}</td>
          <td>{r.open} <small>of {r.total}</small></td>
          <td>{r.urgent}</td>
          <td>{r.overdue}</td>
          <td style={{ minWidth: 140 }}><div className="progress-track"><i className="progress-purple" style={{ width: `${Math.min(r.load, 100)}%` }} /></div><small>{r.load}%</small></td>
          <td><StatusPill>{r.availability}</StatusPill></td>
        </tr>)}
      </tbody></table>
      {rows.length === 0 && <EmptyState icon={<UsersRound />} title="No workload data" text="Assign tasks to teammates to see their workload." />}
      </div>
    </section>
  </>;
}

function App() {
  const [loggedIn, setLoggedIn] = useState(!!localStorage.getItem("token"));
  if (!loggedIn) return <Login onLogin={() => setLoggedIn(true)} />;
  return <Dashboard />;
}

export default App;
