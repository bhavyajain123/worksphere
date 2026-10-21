import { useEffect, useState } from "react";

type TemplateTask = { title: string; description?: string; priority?: "low" | "medium" | "high" };
type TemplateItem = {
  _id: string;
  name: string;
  category: string;
  description?: string;
  tasks: TemplateTask[];
};

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("token");
  return { "Content-Type": "application/json", Authorization: "Bearer " + token };
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [tasksText, setTasksText] = useState("");

  async function loadTemplates() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/templates", { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load templates");
      setTemplates(data.templates || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  async function handleCreate() {
    setError("");
    const tasks = tasksText
      .split("\n")
      .map((t) => t.trim())
      .filter((t) => t.length >= 2)
      .map((title) => ({ title }));

    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          name: name.trim(),
          category: category.trim(),
          description: description.trim() || undefined,
          tasks,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Create failed");
      setName("");
      setCategory("");
      setDescription("");
      setTasksText("");
      setShowForm(false);
      await loadTemplates();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Is template ko delete karna hai?")) return;
    setError("");
    try {
      const res = await fetch("/api/templates/" + id, { method: "DELETE", headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Delete failed");
      await loadTemplates();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Templates</h2>
        <button onClick={() => setShowForm(!showForm)}>{showForm ? "Cancel" : "+ New template"}</button>
      </div>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {showForm && (
        <div style={{ display: "grid", gap: 8, maxWidth: 480, marginBottom: 24 }}>
          <input placeholder="Name (min 3 letters)" value={name} onChange={(e) => setName(e.target.value)} />
          <input placeholder="Category (e.g. Marketing)" value={category} onChange={(e) => setCategory(e.target.value)} />
          <textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <textarea
            placeholder={"Tasks, har line mein ek task\nDesign homepage\nWrite copy"}
            rows={5}
            value={tasksText}
            onChange={(e) => setTasksText(e.target.value)}
          />
          <button onClick={handleCreate}>Save template</button>
        </div>
      )}

      {loading ? (
        <p>Loading...</p>
      ) : templates.length === 0 ? (
        <p>Abhi koi template nahi hai.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
          {templates.map((t) => (
            <div key={t._id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong>{t.name}</strong>
                <span style={{ fontSize: 12, opacity: 0.7 }}>{t.category}</span>
              </div>
              {t.description && <p style={{ fontSize: 14 }}>{t.description}</p>}
              <p style={{ fontSize: 13, opacity: 0.8, margin: "8px 0" }}>{t.tasks.length} tasks</p>
              <ul style={{ paddingLeft: 18, margin: 0, fontSize: 13 }}>
                {t.tasks.slice(0, 5).map((task, i) => (
                  <li key={i}>{task.title}</li>
                ))}
              </ul>
              <button style={{ marginTop: 12 }} onClick={() => handleDelete(t._id)}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}