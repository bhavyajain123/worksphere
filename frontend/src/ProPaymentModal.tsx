import { useState } from "react";
import type { CSSProperties } from "react";
import { api } from "./api";

const UPI_ID = "9310331240@pthdfc"; 
const PRO_PRICE = 799;

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
  members?: number;
};

export default function ProPaymentModal({ open, onClose, onSubmitted, members = 1 }: Props) {
  const [txnId, setTxnId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!open) return null;

  const amount = PRO_PRICE * members;

  const close = () => {
    setTxnId("");
    setError("");
    setDone(false);
    onClose();
  };

  const submit = async () => {
    const id = txnId.trim();
    if (!/^[A-Za-z0-9]{12,30}$/.test(id)) {
      setError("Sahi Transaction ID / UTR daalo (kam se kam 12 letters ya numbers).");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await api("/billing/payments", {
        method: "POST",
        body: JSON.stringify({ plan: "pro", amount, transactionId: id }),
      });
      setDone(true);
      onSubmitted?.();
    } catch (e: any) {
      setError(e?.message || "Submit nahi ho paya, dobara try karo.");
    } finally {
      setLoading(false);
    }
  };

  const overlay: CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
  };
  const card: CSSProperties = {
    background: "#fff", color: "#1f2340", borderRadius: 16, padding: 24,
    width: "min(420px, 92vw)", maxHeight: "92vh", overflowY: "auto",
    boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
  };

  return (
    <div style={overlay} onClick={close}>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: 0, fontSize: 20 }}>Pro plan ke liye payment karo</h3>

        {done ? (
          <>
            <p style={{ marginTop: 16, lineHeight: 1.5 }}>
              Aapki request submit ho gayi. Payment verify hone ke baad Pro activate hoga.
            </p>
            <button onClick={close} style={btn}>Theek hai</button>
          </>
        ) : (
          <>
            <p style={{ margin: "8px 0 12px", color: "#5b6078" }}>
              Total: <b>₹{amount}</b> ({members} member × ₹{PRO_PRICE})
            </p>
            <div style={{ textAlign: "center" }}>
              <img src="/upi-qr.png" alt="UPI QR" width={220} height={220}
                   style={{ objectFit: "contain", border: "1px solid #e3e5f0", borderRadius: 12 }} />
              <div style={{ marginTop: 8, fontSize: 14 }}>UPI ID: <b>{UPI_ID}</b></div>
            </div>
            <p style={{ fontSize: 13, color: "#5b6078", margin: "12px 0 6px" }}>
              QR scan karke pay karo, phir apne UPI app se Transaction ID / UTR copy karke yahan daalo.
            </p>
            <input
              value={txnId}
              onChange={(e) => setTxnId(e.target.value)}
              placeholder="Transaction ID / UTR"
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10,
                       border: "1px solid #d5d8e8", fontSize: 15, boxSizing: "border-box" }}
            />
            {error && <div style={{ color: "#c0392b", fontSize: 13, marginTop: 8 }}>{error}</div>}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={close} style={{ ...btn, background: "#eef0fa", color: "#1f2340" }}>Cancel</button>
              <button onClick={submit} disabled={loading} style={btn}>
                {loading ? "Submit ho raha hai..." : "Submit"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const btn: CSSProperties = {
  flex: 1, padding: "12px 16px", borderRadius: 10, border: "none",
  background: "#6c5ce7", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer",
};