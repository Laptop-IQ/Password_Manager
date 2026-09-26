import axios from "axios";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { checkManyPasswords } from "../utils/breachCheck";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  ""
).replace(/\/+$/, "");

const API_URL = `${API_BASE}/api`;

const getId = (item) => String(item?._id ?? item?.id ?? "");

const strengthOf = (password = "") => {
  if (password.length >= 16) return { label: "Strong", color: "#34D399" };
  if (password.length >= 12) return { label: "Good", color: "#8B72FF" };
  if (password.length >= 8) return { label: "Fair", color: "#FBBF24" };
  return { label: "Weak", color: "#F87171" };
};

export default function SecurityDashboard({ token }) {
  const [passwords, setPasswords] = useState([]);
  const [loading, setLoading] = useState(true);

  const [breachResults, setBreachResults] = useState({}); // { [id]: {breached, count} | {error} }
  const [breachChecking, setBreachChecking] = useState(false);
  const [breachProgress, setBreachProgress] = useState({ done: 0, total: 0 });
  const [breachRun, setBreachRun] = useState(false);

  const fetchPasswords = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/passwords`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000,
      });
      setPasswords(Array.isArray(res?.data?.data) ? res.data.data : []);
    } catch (err) {
      console.error("FETCH PASSWORDS (AUDIT) ERROR:", err);
      toast.error("Failed to load passwords for audit.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPasswords();
  }, [fetchPasswords]);

  // ============================================================
  // ANALYSIS
  // ============================================================

  const weakItems = useMemo(
    () => passwords.filter((p) => (p.password || "").length < 8),
    [passwords],
  );

  const duplicateGroups = useMemo(() => {
    const byPassword = {};
    passwords.forEach((p) => {
      if (!p.password) return;
      byPassword[p.password] = byPassword[p.password] || [];
      byPassword[p.password].push(p);
    });
    return Object.values(byPassword).filter((group) => group.length > 1);
  }, [passwords]);

  const duplicateIds = useMemo(
    () => new Set(duplicateGroups.flat().map(getId)),
    [duplicateGroups],
  );

  const breachedItems = useMemo(
    () => passwords.filter((p) => breachResults[getId(p)]?.breached),
    [passwords, breachResults],
  );

  const overallScore = useMemo(() => {
    if (passwords.length === 0) return 100;
    const issues = weakItems.length + duplicateIds.size + breachedItems.length;
    const score = Math.max(0, 100 - Math.round((issues / (passwords.length * 3)) * 100));
    return score;
  }, [passwords.length, weakItems.length, duplicateIds.size, breachedItems.length]);

  const scoreColor = overallScore >= 80 ? "#34D399" : overallScore >= 50 ? "#FBBF24" : "#F87171";

  // ============================================================
  // BREACH CHECK
  // ============================================================

  const runBreachCheck = async () => {
    if (passwords.length === 0) return;

    setBreachChecking(true);
    setBreachProgress({ done: 0, total: passwords.length });

    try {
      const items = passwords.map((p) => ({ id: getId(p), password: p.password }));
      const results = await checkManyPasswords(items, 4, (done, total) =>
        setBreachProgress({ done, total }),
      );
      setBreachResults(results);
      setBreachRun(true);

      const breachedCount = Object.values(results).filter((r) => r.breached).length;
      if (breachedCount > 0) {
        toast.warn(`${breachedCount} password(s) found in known data breaches.`);
      } else {
        toast.success("No breached passwords found.");
      }
    } catch (err) {
      console.error("BREACH CHECK ERROR:", err);
      toast.error("Breach check failed. Check your internet connection.");
    } finally {
      setBreachChecking(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#0A0810] font-['Inter',sans-serif] text-[#F5F3FF]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-[420px] w-[420px] rounded-full bg-[#8B72FF]/20 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[300px] w-[300px] rounded-full bg-[#F87171]/10 blur-[120px]" />
      </div>

      <main className="relative max-w-[900px] mx-auto px-[20px] md:px-[32px] pt-[56px] pb-[100px]">
        <div className="mb-8">
          <h2 className="text-[32px] font-extrabold font-['Manrope',sans-serif] bg-gradient-to-r from-white to-[#C9BFFF] bg-clip-text text-transparent">
            Security Dashboard
          </h2>
          <p className="text-[15px] text-[#A8A4BD] mt-1">
            Weak, reused, and breached password detection across your vault.
          </p>
        </div>

        {loading ? (
          <div className="bg-white/[0.03] backdrop-blur-xl rounded-[20px] border border-white/10 p-16 text-center">
            <div className="w-10 h-10 border-4 border-white/10 border-t-[#8B72FF] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-[15px] text-[#A8A4BD]">Analyzing your vault...</p>
          </div>
        ) : passwords.length === 0 ? (
          <div className="bg-white/[0.03] backdrop-blur-xl rounded-[20px] border border-white/10 p-16 text-center">
            <p className="text-[15px] text-[#A8A4BD]">Add some passwords first to run a security audit.</p>
          </div>
        ) : (
          <>
            {/* SCORE + SUMMARY */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <div className="bg-white/[0.03] backdrop-blur-xl rounded-[16px] border border-white/10 p-4 text-center">
                <p className="text-[28px] font-extrabold" style={{ color: scoreColor }}>
                  {overallScore}
                </p>
                <p className="text-[11px] text-[#A8A4BD] uppercase tracking-wide mt-1">Score</p>
              </div>
              <div className="bg-white/[0.03] backdrop-blur-xl rounded-[16px] border border-white/10 p-4 text-center">
                <p className="text-[28px] font-extrabold text-[#F87171]">{weakItems.length}</p>
                <p className="text-[11px] text-[#A8A4BD] uppercase tracking-wide mt-1">Weak</p>
              </div>
              <div className="bg-white/[0.03] backdrop-blur-xl rounded-[16px] border border-white/10 p-4 text-center">
                <p className="text-[28px] font-extrabold text-[#FBBF24]">{duplicateIds.size}</p>
                <p className="text-[11px] text-[#A8A4BD] uppercase tracking-wide mt-1">Reused</p>
              </div>
              <div className="bg-white/[0.03] backdrop-blur-xl rounded-[16px] border border-white/10 p-4 text-center">
                <p className="text-[28px] font-extrabold text-[#F87171]">
                  {breachRun ? breachedItems.length : "?"}
                </p>
                <p className="text-[11px] text-[#A8A4BD] uppercase tracking-wide mt-1">Breached</p>
              </div>
            </div>

            {/* BREACH CHECK CTA */}
            {!breachRun && (
              <div className="bg-white/[0.03] backdrop-blur-xl rounded-[16px] border border-white/10 p-5 mb-8 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-[14px] font-semibold text-[#F5F3FF]">
                    🌐 Check against known data breaches
                  </p>
                  <p className="text-[12px] text-[#A8A4BD] mt-1">
                    Uses Have I Been Pwned's k-anonymity API — your passwords never leave your browser in full.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={runBreachCheck}
                  disabled={breachChecking}
                  className="bg-gradient-to-r from-[#8B72FF] to-[#6D5AE0] hover:from-[#9c86ff] hover:to-[#7c68ec] text-white px-5 py-2.5 rounded-[12px] text-[13px] font-semibold disabled:opacity-60 transition-all whitespace-nowrap"
                >
                  {breachChecking
                    ? `Checking... ${breachProgress.done}/${breachProgress.total}`
                    : "Run breach check"}
                </button>
              </div>
            )}

            {/* WEAK PASSWORDS */}
            {weakItems.length > 0 && (
              <section className="mb-8">
                <h3 className="text-[15px] font-bold mb-3 text-[#F87171]">⚠️ Weak passwords ({weakItems.length})</h3>
                <div className="space-y-2">
                  {weakItems.map((p) => (
                    <div key={getId(p)} className="flex items-center justify-between bg-black/20 border border-white/10 rounded-[12px] px-4 py-3">
                      <div>
                        <p className="text-[13px] font-semibold text-[#F5F3FF]">{p.websiteName}</p>
                        <p className="text-[11px] text-[#A8A4BD]">{p.username || "—"}</p>
                      </div>
                      <span
                        className="text-[10px] font-bold uppercase px-2 py-1 rounded-full"
                        style={{ color: strengthOf(p.password).color, backgroundColor: `${strengthOf(p.password).color}20` }}
                      >
                        {strengthOf(p.password).label}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* DUPLICATE PASSWORDS */}
            {duplicateGroups.length > 0 && (
              <section className="mb-8">
                <h3 className="text-[15px] font-bold mb-3 text-[#FBBF24]">
                  ♻️ Reused passwords ({duplicateGroups.length} group{duplicateGroups.length > 1 ? "s" : ""})
                </h3>
                <div className="space-y-3">
                  {duplicateGroups.map((group, i) => (
                    <div key={i} className="bg-black/20 border border-white/10 rounded-[12px] px-4 py-3">
                      <p className="text-[11px] text-[#A8A4BD] mb-2">
                        Same password used on {group.length} accounts:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {group.map((p) => (
                          <span key={getId(p)} className="text-[12px] font-semibold text-[#F5F3FF] bg-[#FBBF24]/10 border border-[#FBBF24]/20 px-2.5 py-1 rounded-full">
                            {p.websiteName}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* BREACHED PASSWORDS */}
            {breachRun && breachedItems.length > 0 && (
              <section className="mb-8">
                <h3 className="text-[15px] font-bold mb-3 text-[#F87171]">
                  🚨 Found in data breaches ({breachedItems.length})
                </h3>
                <div className="space-y-2">
                  {breachedItems.map((p) => (
                    <div key={getId(p)} className="flex items-center justify-between bg-[#3F1013] border border-[#F87171]/20 rounded-[12px] px-4 py-3">
                      <div>
                        <p className="text-[13px] font-semibold text-[#F5F3FF]">{p.websiteName}</p>
                        <p className="text-[11px] text-[#A8A4BD]">{p.username || "—"}</p>
                      </div>
                      <span className="text-[11px] font-semibold text-[#F87171]">
                        Seen {breachResults[getId(p)]?.count?.toLocaleString() || "many"}× in breaches
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {weakItems.length === 0 && duplicateGroups.length === 0 && breachRun && breachedItems.length === 0 && (
              <div className="bg-[#0B2E21] border border-[#34D399]/20 rounded-[16px] p-6 text-center">
                <p className="text-[15px] font-semibold text-[#34D399]">
                  ✅ Great job — no weak, reused, or breached passwords found.
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
