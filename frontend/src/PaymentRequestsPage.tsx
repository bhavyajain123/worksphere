import { useEffect, useState } from "react";
import { api } from "./api";

type Status = "pending" | "verified" | "rejected";

export default function PaymentRequestsPage({ onChanged }: { onChanged?: () => void }) {
  const [status, setStatus] = useState<Status>("pending");
  const [items, setItems] = useState<any[]>([]);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setError("");
      const res = await api<any>(`/billing/payments?status=${status}`);
      setItems(res.data ?? []);
    } catch (e: any) {
      setError(e?.message || "Could not load payment requests.");
    }
  };

  useEffect(() => { load(); }, [status]);

  const review = async (id: string, action: "verify" | "reject") => {
    setBusyId(id);
    try {
      await api(`/billing/payments/${id}/${action}`, { method: "POST" });
      await load();
      onChanged?.();
    } catch (e: any) {
      setError(e?.message || "Action failed.");
    } finally {
      setBusyId("");
    }
  };

  const cell = { padding: "12px 8px", borderBottom: "1px solid #e3e5f0", textAlign: "left" as const };
  const btn = { padding: "6px 12px", borderRadius: 8, border: "1px solid #d5d8e8", background: "#fff", cursor: "pointer", marginLeft: 6 };

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ margin: 0 }}>Payment requests</h2>
      <p style={{ color: "#5b6078" }}>Check the UTR in your UPI app, then verify to activate Pro.</p>

      <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
        {(["pending", "verified", "rejected"] as Status[]).map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            style={{ ...btn, marginLeft: 0, background: status === s ? "#6c5ce7" : "#fff", color: status === s ? "#fff" : "#1f2340" }}>
            {s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {error && <div style={{ color: "#c0392b", marginBottom: 8 }}>{error}</div>}

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr>
            <th style={cell}>Workspace</th><th style={cell}>Requested by</th>
            <th style={cell}>Amount</th><th style={cell}>UTR</th>
            <th style={{ ...cell, textAlign: "right" }}>{status === "pending" ? "Action" : "Status"}</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && <tr><td style={cell} colSpan={5}>No {status} requests.</td></tr>}
          {items.map((r) => (
            <tr key={r._id}>
              <td style={cell}>{r.workspace?.name ?? "No workspace"}</td>
              <td style={cell}>{r.user?.name ?? "User"}<br /><small style={{ color: "#5b6078" }}>{r.user?.email}</small></td>
              <td style={cell}>₹{r.amount}</td>
              <td style={{ ...cell, fontFamily: "monospace" }}>{r.transactionId}</td>
              <td style={{ ...cell, textAlign: "right" }}>
                {status === "pending" ? (
                  <>
                    <button style={btn} disabled={busyId === r._id} onClick={() => review(r._id, "verify")}>Verify</button>
                    <button style={{ ...btn, color: "#c0392b" }} disabled={busyId === r._id} onClick={() => review(r._id, "reject")}>Reject</button>
                  </>
                ) : r.status}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}