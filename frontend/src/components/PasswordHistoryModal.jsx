import axios from "axios";
import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";

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

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-8 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="w-full max-w-[440px] bg-[#130F1F]/95 backdrop-blur-xl rounded-[20px] shadow-2xl border border-white/10 my-auto">
        <div className="p-6 border-b border-white/10">
          <h3 className="text-[18px] font-bold text-[#F5F3FF]">Password history</h3>
          <p className="text-[13px] text-[#A8A4BD] mt-1">{websiteName}</p>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="text-center py-6">
              <div className="w-8 h-8 border-4 border-white/10 border-t-[#8B72FF] rounded-full animate-spin mx-auto" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-[13px] text-[#A8A4BD] text-center py-4">
              No previous passwords recorded yet — history is tracked from your next password change onward.
            </p>
          ) : (
            <div className="space-y-2.5">
              {history.map((entry, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 bg-black/20 border border-white/10 rounded-[12px] px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-[13px] text-[#F5F3FF] truncate">
                      {revealedIndex === i ? entry.password : "•".repeat(Math.max(entry.password?.length || 8, 8))}
                    </p>
                    <p className="text-[11px] text-[#A8A4BD] mt-0.5">
                      Changed {new Date(entry.changedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setRevealedIndex(revealedIndex === i ? null : i)}
                      className="text-[11px] text-[#C9BFFF] hover:text-white font-medium"
                    >
                      {revealedIndex === i ? "Hide" : "Show"}
                    </button>
                    <button
                      type="button"
                      onClick={() => copy(entry.password)}
                      className="text-[11px] text-[#C9BFFF] hover:text-white font-medium"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-black/20 border-t border-white/10 p-5 rounded-b-[20px] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-[14px] font-medium text-[#F5F3FF] hover:bg-white/5 rounded-[10px]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
