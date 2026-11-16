import axios from "axios";
import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import useEscapeKey from "../hooks/useEscapeKey";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  ""
).replace(/\/+$/, "");

const API_URL = `${API_BASE}/api`;

export default function PasswordHistoryModal({ passwordId, websiteName, token, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revealedIndex, setRevealedIndex] = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API_URL}/passwords/${passwordId}/history`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled) setHistory(Array.isArray(res?.data?.data) ? res.data.data : []);
      } catch (err) {
        console.error("FETCH HISTORY ERROR:", err);
        if (!cancelled) toast.error("Failed to load password history.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [passwordId, token]);

  const copy = async (value) => {
    try {
      await navigator.clipboard.writeText(value || "");
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy.");
    }
  };

  useEscapeKey(onClose, true);

  return (
    <div
      className="dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="dialog max-w-[440px]">
        <div className="flex items-start justify-between gap-4 border-b border-line p-6">
          <div className="min-w-0">
            <h3 id="dialog-title" className="text-lg font-semibold tracking-tight text-ink">Password history</h3>
            <p className="text-[13px] text-muted mt-1">{websiteName}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="icon-btn -mr-2 -mt-1 h-9 w-9 shrink-0 text-[22px]"><i className="ri-close-line" aria-hidden="true" /></button>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="text-center py-6">
              <div className="spinner w-8 h-8 mx-auto text-accent" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-[13px] text-muted text-center py-4">
              No earlier passwords yet. Changes are tracked from the next time you update this password.
            </p>
          ) : (
            <div className="space-y-2.5">
              {history.map((entry, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 bg-canvas border border-line rounded-lg px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-[13px] text-ink truncate">
                      {revealedIndex === i ? entry.password : "•".repeat(Math.max(entry.password?.length || 8, 8))}
                    </p>
                    <p className="text-[11px] text-muted mt-0.5">
                      Changed {new Date(entry.changedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setRevealedIndex(revealedIndex === i ? null : i)}
                      className="icon-btn h-8 w-8 text-[16px]"
                    >
                      <i className={revealedIndex === i ? "ri-eye-off-line" : "ri-eye-line"} aria-hidden="true" /><span className="sr-only">{revealedIndex === i ? "Hide" : "Show"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => copy(entry.password)}
                      className="icon-btn h-8 w-8 text-[16px]"
                    ><i className="ri-file-copy-line" aria-hidden="true" /><span className="sr-only">Copy</span></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-sunken/50 border-t border-line px-6 py-4 rounded-b-[14px] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
