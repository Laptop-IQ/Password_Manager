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
  if (password.length >= 16) return { label: "Strong", color: "#17734a" };
  if (password.length >= 12) return { label: "Good", color: "#2f4fb8" };
  if (password.length >= 8) return { label: "Fair", color: "#96590a" };
  return { label: "Weak", color: "#b42318" };
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

  const scoreColor = overallScore >= 80 ? "#17734a" : overallScore >= 50 ? "#96590a" : "#b42318";

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

  const scoreLabel =
    overallScore >= 80 ? "Healthy" : overallScore >= 50 ? "Needs attention" : "At risk";

  const SectionTitle = ({ icon, tone, children }) => (
    <h2 className={`mb-3 flex items-center gap-2 text-[15px] font-semibold tracking-tight ${tone}`}>
      <i className={`${icon} text-[18px]`} aria-hidden="true" />
      {children}
    </h2>
  );

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <main className="mx-auto max-w-[900px] px-4 pb-24 pt-10 sm:px-8">
        <div className="mb-8">
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight">
            Security audit
          </h1>
          <p className="mt-1 text-sm text-muted">
            Weak, reused and breached passwords across your vault.
          </p>
        </div>

        {loading ? (
          <div className="panel flex items-center justify-center gap-3 p-12 text-muted" role="status">
            <span className="spinner text-accent" aria-hidden="true" />
            <p className="text-sm">Analyzing your vault…</p>
          </div>
        ) : passwords.length === 0 ? (
          <div className="panel px-6 py-16 text-center">
            <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-xl bg-sunken text-ink-soft">
              <i className="ri-radar-line text-[24px]" aria-hidden="true" />
            </div>
            <p className="text-lg font-semibold tracking-tight">Nothing to audit yet</p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
              Save a few passwords first, then come back to check how strong they are.
            </p>
          </div>
        ) : (
          <>
            {/* SCORE + SUMMARY */}
            <div className="panel mb-6 grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x">
              <div className="col-span-2 border-b border-line p-5 sm:col-span-1 sm:border-b-0">
                <p className="text-xs text-muted">Vault score</p>
                <p className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-[34px] font-semibold leading-none tabular-nums" style={{ color: scoreColor }}>
                    {overallScore}
                  </span>
                  <span className="text-sm text-muted">/ 100</span>
                </p>
                <p className="mt-1 text-xs font-medium" style={{ color: scoreColor }}>{scoreLabel}</p>
              </div>
              <div className="p-5">
                <p className="text-xs text-muted">Weak</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{weakItems.length}</p>
              </div>
              <div className="p-5">
                <p className="text-xs text-muted">Reused</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{duplicateIds.size}</p>
              </div>
              <div className="p-5">
                <p className="text-xs text-muted">Breached</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
                  {breachRun ? breachedItems.length : "Not run"}
                </p>
              </div>
            </div>

            {/* BREACH CHECK CTA */}
            {!breachRun && (
              <div className="panel mb-8 flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">Check against known data breaches</p>
                  <p className="mt-1 max-w-[520px] text-[13px] text-muted">
                    Uses the Have I Been Pwned range API. Only a short hash prefix is sent, never the full password.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={runBreachCheck}
                  disabled={breachChecking}
                  className="btn btn-primary"
                >
                  {breachChecking ? (
                    <>
                      <span className="spinner" aria-hidden="true" />
                      Checking {breachProgress.done}/{breachProgress.total}
                    </>
                  ) : (
                    <>
                      <i className="ri-search-eye-line text-[16px]" aria-hidden="true" />
                      Run breach check
                    </>
                  )}
                </button>
              </div>
            )}

            {/* WEAK PASSWORDS */}
            {weakItems.length > 0 && (
              <section className="mb-8">
                <SectionTitle icon="ri-error-warning-line" tone="text-danger">
                  Weak passwords ({weakItems.length})
                </SectionTitle>
                <ul className="panel divide-y divide-line">
                  {weakItems.map((p) => {
                    const st = strengthOf(p.password);
                    return (
                      <li key={getId(p)} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">{p.websiteName}</p>
                          <p className="truncate text-xs text-muted">{p.username || "—"}</p>
                        </div>
                        <span
                          className="shrink-0 rounded px-1.5 py-0.5 text-xs font-medium"
                          style={{ color: st.color, backgroundColor: `${st.color}1a` }}
                        >
                          {st.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* DUPLICATE PASSWORDS */}
            {duplicateGroups.length > 0 && (
              <section className="mb-8">
                <SectionTitle icon="ri-file-copy-2-line" tone="text-warn">
                  Reused passwords ({duplicateGroups.length} group{duplicateGroups.length > 1 ? "s" : ""})
                </SectionTitle>
                <ul className="space-y-3">
                  {duplicateGroups.map((group, i) => (
                    <li key={i} className="panel px-4 py-3">
                      <p className="mb-2 text-xs text-muted">
                        Same password on {group.length} accounts
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {group.map((p) => (
                          <span
                            key={getId(p)}
                            className="rounded-md bg-warn-tint px-2 py-1 text-[13px] font-medium text-ink"
                          >
                            {p.websiteName}
                          </span>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* BREACHED PASSWORDS */}
            {breachRun && breachedItems.length > 0 && (
              <section className="mb-8">
                <SectionTitle icon="ri-spam-2-line" tone="text-danger">
                  Found in data breaches ({breachedItems.length})
                </SectionTitle>
                <ul className="divide-y divide-danger/15 overflow-hidden rounded-xl border border-danger/25 bg-danger-tint">
                  {breachedItems.map((p) => (
                    <li key={getId(p)} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{p.websiteName}</p>
                        <p className="truncate text-xs text-ink-soft">{p.username || "—"}</p>
                      </div>
                      <span className="shrink-0 text-xs font-medium text-danger">
                        Seen {breachResults[getId(p)]?.count?.toLocaleString() || "many"} times
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {weakItems.length === 0 &&
              duplicateGroups.length === 0 &&
              breachRun &&
              breachedItems.length === 0 && (
                <div className="flex items-center gap-3 rounded-xl border border-ok/25 bg-ok-tint p-5">
                  <i className="ri-shield-check-line text-[22px] text-ok" aria-hidden="true" />
                  <p className="text-sm font-medium text-ok">
                    No weak, reused or breached passwords found.
                  </p>
                </div>
              )}
          </>
        )}
      </main>
    </div>
  );
}
