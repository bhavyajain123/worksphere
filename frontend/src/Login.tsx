import { useState, type FormEvent } from "react";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Lock, Mail, User, Zap } from "lucide-react";
import { auth } from "./firebase";
import { api } from "./api";

type Mode = "signin" | "signup" | "reset";

function friendlyError(err: any): string {
  const code = String(err?.code || "");
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) return "Email ya password galat hai";
  if (code.includes("email-already-in-use")) return "Is email se account pehle se hai. Sign in karo.";
  if (code.includes("weak-password")) return "Password kam se kam 8 characters ka rakho";
  if (code.includes("invalid-email")) return "Email sahi nahi hai";
  if (code.includes("too-many-requests")) return "Bahut zyada koshish ho gayi. Thodi der baad try karo.";
  if (code.includes("network")) return "Internet ya network problem hai";
  return err?.message || "Something went wrong";
}

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError("");
    setInfo("");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const cleanEmail = email.trim();

      if (mode === "reset") {
        await sendPasswordResetEmail(auth, cleanEmail);
        setInfo("Password reset link email par bhej diya gaya hai");
        return;
      }

      if (mode === "signup") {
        if (name.trim().length < 2) throw new Error("Name kam se kam 2 letters ka hona chahiye");
        if (password.length < 8) throw new Error("Password kam se kam 8 characters ka rakho");
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        await updateProfile(cred.user, { displayName: name.trim() });
        await sendEmailVerification(cred.user);
        await signOut(auth);
        setMode("signin");
        setPassword("");
        setInfo("Account ban gaya hai, email se verification complete karo");
        return;
      }

      const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      if (!cred.user.emailVerified) {
        await sendEmailVerification(cred.user).catch(() => {});
        await signOut(auth);
        throw new Error("Email verify nahi hui. Verification link dobara bhej diya hai, inbox (aur spam) check karo.");
      }

      try {
        const token = await cred.user.getIdToken();
        localStorage.setItem("token", token);
        const data = await api<any>("/auth/session");
        localStorage.setItem("user", JSON.stringify(data.user));
      } catch (err) {
        await signOut(auth);
        throw err;
      }
      onLogin();
    } catch (err: any) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const title = mode === "signin" ? "Welcome back" : mode === "signup" ? "Create your account" : "Reset password";
  const subtitle =
    mode === "signin"
      ? "Apne WorkSphere account mein sign in karo"
      : mode === "signup"
      ? "Kuch hi seconds mein apna account banao"
      : "Email daalo, hum reset link bhej denge";
  const buttonText = mode === "signin" ? "Sign in" : mode === "signup" ? "Sign up" : "Send reset link";
  const loadingText = mode === "signin" ? "Signing in..." : mode === "signup" ? "Creating..." : "Sending...";

  return (
    <div className="auth-page">
      <div className="auth-glow auth-glow-one" />
      <div className="auth-glow auth-glow-two" />

      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-logo"><Zap size={22} /></span>
          <span className="auth-brand-name">WorkSphere</span>
        </div>

        <h2 className="auth-title">{title}</h2>
        <p className="auth-subtitle">{subtitle}</p>

        <form onSubmit={submit} className="auth-form">
          {mode === "signup" && (
            <label className="auth-field">
              <User size={18} className="auth-field-icon" />
              <input type="text" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} />
            </label>
          )}

          <label className="auth-field">
            <Mail size={18} className="auth-field-icon" />
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>

          {mode !== "reset" && (
            <label className="auth-field">
              <Lock size={18} className="auth-field-icon" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === "signup" ? 8 : 1}
              />
              <button type="button" className="auth-eye" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </label>
          )}

          {error && (
            <div className="auth-message auth-error">
              <AlertCircle size={16} /> <span>{error}</span>
            </div>
          )}
          {info && (
            <div className="auth-message auth-success">
              <CheckCircle2 size={16} /> <span>{info}</span>
            </div>
          )}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? loadingText : buttonText}
          </button>
        </form>

        <div className="auth-links">
          {mode === "signin" ? (
            <>
              <button type="button" className="auth-link" onClick={() => switchMode("signup")}>Create account</button>
              <button type="button" className="auth-link" onClick={() => switchMode("reset")}>Forgot password?</button>
            </>
          ) : (
            <button type="button" className="auth-link" onClick={() => switchMode("signin")}>← Back to sign in</button>
          )}
        </div>
      </div>
    </div>
  );
}