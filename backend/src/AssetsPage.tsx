import { useEffect, useState } from "react";

type AssetFile = {
  _id: string;
  originalName: string;
  mimeType: string;
  extension?: string;
  size: number;
  category?: string;
  project: string;
  uploadedBy?: { name?: string };
  createdAt: string;
  projectName: string;
};

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("token");
  return { Authorization: "Bearer " + token };
}

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function AssetsPage({ onNotify }: { onNotify: (text: string) => void }) {
  const [files, setFiles] = useState<AssetFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  async function loadAssets() {
    setLoading(true);
    setError("");
    try {
      const pRes = await fetch("/api/projects", { headers: authHeaders() });
      const pData = await pRes.json();
      if (!pRes.ok) throw new Error(pData.message || "Projects load nahi hue");
      const projects: { _id: string; name: string }[] = pData.projects || [];

      const results = await Promise.all(
        projects.map(async (p) => {
          try {
            const r = await fetch("/api/files?projectId=" + p._id, { headers: authHeaders() });
            const d = await r.json();
            if (!r.ok) return [] as AssetFile[];
            return (d.files || []).map((f: Omit<AssetFile, "projectName">) => ({ ...f, projectName: p.name })) as AssetFile[];
          } catch {
            return [] as AssetFile[];
          }
        })
      );

      const all = results.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setFiles(all);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAssets();
  }, []);

  async function handleDownload(f: AssetFile) {
    try {
      const res = await fetch("/api/files/" + f._id + "/download", { headers: authHeaders() });
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
    } catch (e) {
      onNotify(e instanceof Error ? e.message : "Download failed");
    }
  }

  const categories = ["All", ...Array.from(new Set(files.map((f) => f.category || "other")))];
  const filtered = files.filter((f) => {
    const matchQuery =
      f.originalName.toLowerCase().includes(query.toLowerCase()) ||
      f.projectName.toLowerCase().includes(query.toLowerCase());
    const matchCategory = category === "All" || (f.category || "other") === category;
    return matchQuery && matchCategory;
  });
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginTop: 0 }}>Shared assets</h2>
      <p style={{ opacity: 0.7 }}>
        {files.length} files · {formatSize(totalSize)} total. Upload ya delete karne ke liye Files page use karo.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <input
          placeholder="Search file ya project..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ minWidth: 240 }}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button onClick={loadAssets}>Refresh</button>
      </div>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : filtered.length === 0 ? (
        <p>Koi asset nahi mila.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                <th style={{ padding: 8 }}>Asset</th>
                <th style={{ padding: 8 }}>Type</th>
                <th style={{ padding: 8 }}>Project</th>
                <th style={{ padding: 8 }}>Size</th>
                <th style={{ padding: 8 }}>Uploaded by</th>
                <th style={{ padding: 8 }}>Updated</th>
                <th style={{ padding: 8 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => (
                <tr key={f._id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 8 }}>{f.originalName}</td>
                  <td style={{ padding: 8 }}>{f.category || f.extension || "-"}</td>
                  <td style={{ padding: 8 }}>{f.projectName}</td>
                  <td style={{ padding: 8 }}>{formatSize(f.size)}</td>
                  <td style={{ padding: 8 }}>{f.uploadedBy?.name || "-"}</td>
                  <td style={{ padding: 8 }}>{new Date(f.createdAt).toLocaleDateString()}</td>
                  <td style={{ padding: 8 }}>
                    <button onClick={() => handleDownload(f)}>Download</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}