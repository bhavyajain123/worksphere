import { useState, type FormEvent } from "react";
import { api } from "./api";

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api<any>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      const token = data.token ?? data.accessToken;
      if (!token) throw new Error("Response mein token nahi mila");
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(data.user));
      onLogin();
    } catch (err: any) {
      setError(err.message);
      
    } finally {

       setLoading(false);
    }

  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f7f8fc" }}>
      <form onSubmit={submit} style={{ width: 360, background: "#fff", padding: 32, borderRadius: 16, boxShadow: "0 8px 30px #27304b14", display: "grid", gap: 14 }}>
        <h2 style={{ margin: 0 }}>Sign in to WorkSphere</h2>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ padding: 12, borderRadius: 10, border: "1px solid #dfe3ee" }} />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ padding: 12, borderRadius: 10, border: "1px solid #dfe3ee" }} />
        {error && <p style={{ color: "#d93025", margin: 0, fontSize: 14 }}>{error}</p>}
        <button className="button button-primary" type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button>
      </form>
    </div>
  );
}