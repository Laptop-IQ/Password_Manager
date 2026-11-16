import axios from "axios";
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  ""
).replace(/\/+$/, "");

const USER_API = `${API_BASE}/api/user`;

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

const formatRelativeTime = (dateStr) => {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
};

const describeDevice = (userAgent = "") => {
  const ua = userAgent.toLowerCase();
  let device = "Desktop";
  if (/mobile|android|iphone/.test(ua)) device = "Mobile";
  else if (/ipad|tablet/.test(ua)) device = "Tablet";

  let browser = "Unknown browser";
  if (ua.includes("edg/")) browser = "Edge";
  else if (ua.includes("chrome/")) browser = "Chrome";
  else if (ua.includes("firefox/")) browser = "Firefox";
  else if (ua.includes("safari/")) browser = "Safari";

  return `${device} · ${browser}`;
};

export default function SecuritySettings({ token, twoFactorEnabled: initialEnabled }) {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(Boolean(initialEnabled));
  const [loadingMe, setLoadingMe] = useState(!initialEnabled === undefined);

  // 2FA setup flow state
  const [setupStep, setSetupStep] = useState(null); // null | "qr" | "recovery"
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState(null);
  const [manualSecret, setManualSecret] = useState(null);
  const [setupCode, setSetupCode] = useState("");
  const [settingUp, setSettingUp] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState([]);

  const [disablePassword, setDisablePassword] = useState("");
  const [showDisableForm, setShowDisableForm] = useState(false);
  const [disabling, setDisabling] = useState(false);

  // Sessions
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [revokingId, setRevokingId] = useState(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const fetchMe = useCallback(async () => {
    try {
      const res = await axios.get(`${USER_API}/me`, authHeaders);
      setTwoFactorEnabled(Boolean(res?.data?.user?.twoFactorEnabled));
    } catch (err) {
      console.error("FETCH ME ERROR:", err);
    } finally {
      setLoadingMe(false);
    }
  }, [token]);

  const fetchSessions = useCallback(async () => {
    try {
      setSessionsLoading(true);
      const res = await axios.get(`${USER_API}/sessions`, authHeaders);
      setSessions(Array.isArray(res?.data?.data) ? res.data.data : []);
    } catch (err) {
      console.error("FETCH SESSIONS ERROR:", err);
      toast.error(getErrorMessage(err, "Failed to load active sessions."));
    } finally {
      setSessionsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchMe();
    fetchSessions();
  }, [fetchMe, fetchSessions]);

  // ============================================================
  // 2FA SETUP
  // ============================================================

  const startSetup = async () => {
    try {
      setSettingUp(true);
      const res = await axios.post(`${USER_API}/2fa/setup`, {}, authHeaders);
      setQrCodeDataUrl(res.data.qrCodeDataUrl);
      setManualSecret(res.data.secret);
      setSetupStep("qr");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to start 2FA setup."));
    } finally {
      setSettingUp(false);
    }
  };

  const confirmSetup = async (e) => {
    e.preventDefault();
    if (!setupCode.trim()) {
      toast.error("Enter the 6-digit code from your app.");
      return;
    }

    try {
      setSettingUp(true);
      const res = await axios.post(
        `${USER_API}/2fa/verify-setup`,
        { code: setupCode.trim() },
        authHeaders,
      );
      setRecoveryCodes(res.data.recoveryCodes || []);
      setSetupStep("recovery");
      setTwoFactorEnabled(true);
      toast.success("Two-factor authentication enabled");
    } catch (err) {
      toast.error(getErrorMessage(err, "Invalid code. Please try again."));
    } finally {
      setSettingUp(false);
    }
  };

  const finishSetup = () => {
    setSetupStep(null);
    setSetupCode("");
    setQrCodeDataUrl(null);
    setManualSecret(null);
    setRecoveryCodes([]);
  };

  const handleDisable = async (e) => {
    e.preventDefault();
    if (!disablePassword) {
      toast.error("Enter your account password to confirm.");
      return;
    }

    try {
      setDisabling(true);
      await axios.post(`${USER_API}/2fa/disable`, { password: disablePassword }, authHeaders);
      setTwoFactorEnabled(false);
      setShowDisableForm(false);
      setDisablePassword("");
      toast.success("Two-factor authentication disabled");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to disable 2FA."));
    } finally {
      setDisabling(false);
    }
  };

  // ============================================================
  // SESSIONS
  // ============================================================

  const revokeSession = async (id) => {
    try {
      setRevokingId(id);
      await axios.delete(`${USER_API}/sessions/${id}`, authHeaders);
      setSessions((prev) => prev.filter((s) => s._id !== id));
      toast.success("Device logged out");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to log out that device."));
    } finally {
      setRevokingId(null);
    }
  };

  const revokeOthers = async () => {
    try {
      setRevokingOthers(true);
      await axios.post(`${USER_API}/sessions/logout-others`, {}, authHeaders);
      toast.success("Logged out from all other devices");
      await fetchSessions();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to log out other devices."));
    } finally {
      setRevokingOthers(false);
    }
  };

  const copyRecoveryCodes = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCodes.join("\n"));
      toast.success("Recovery codes copied");
    } catch {
      toast.error("Failed to copy.");
    }
  };

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <main className="mx-auto max-w-[800px] px-4 pb-24 pt-10 sm:px-8">
        <div className="mb-8">
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-ink">
            Account security
          </h1>
          <p className="mt-1 text-sm text-muted">
            Two-factor authentication and active sessions for your account.
          </p>
        </div>

        {/* ================= 2FA CARD ================= */}
        <section className="panel mb-6 p-6">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
                <i className="ri-shield-keyhole-line text-[20px] text-ink-soft" aria-hidden="true" />
                Two-factor authentication
                {twoFactorEnabled && (
                  <span className="rounded bg-ok-tint px-1.5 py-0.5 text-xs font-medium text-ok">
                    On
                  </span>
                )}
              </h2>
              <p className="text-[13px] text-muted mt-1 max-w-[480px]">
                Ask for a 6-digit code from an authenticator app each time you log in.
              </p>
            </div>
          </div>

          {!setupStep && !loadingMe && (
            <div className="mt-4">
              {twoFactorEnabled ? (
                !showDisableForm ? (
                  <button
                    type="button"
                    onClick={() => setShowDisableForm(true)}
                    className="btn btn-secondary !text-danger"
                  >
                    Turn off 2FA
                  </button>
                ) : (
                  <form onSubmit={handleDisable} className="max-w-[320px] space-y-3">
                    <p className="text-[13px] text-muted">Enter your password to turn off 2FA.</p>
                    <input
                      type="password"
                      value={disablePassword}
                      onChange={(e) => setDisablePassword(e.target.value)}
                      placeholder="Account password"
                      className="field"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={disabling}
                        className="btn btn-danger"
                      >
                        {disabling ? "Turning off" : "Turn off"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDisableForm(false)}
                        className="btn btn-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )
              ) : (
                <button
                  type="button"
                  onClick={startSetup}
                  disabled={settingUp}
                  className="btn btn-primary disabled:opacity-50"
                >
                  {settingUp ? "Starting" : "Turn on 2FA"}
                </button>
              )}
            </div>
          )}

          {setupStep === "qr" && (
            <div className="mt-5 border-t border-line pt-5">
              <p className="text-[13px] text-muted mb-3">
                Step 1. Scan this QR code with your authenticator app.
              </p>
              {qrCodeDataUrl && (
                <img
                  src={qrCodeDataUrl}
                  alt="2FA QR code"
                  className="h-[180px] w-[180px] rounded-lg border border-line bg-white p-2 mb-3"
                />
              )}
              {manualSecret && (
                <p className="text-[12px] text-muted mb-4">
                  Can’t scan? Enter this key instead:{" "}
                  <span className="font-mono text-ink">{manualSecret}</span>
                </p>
              )}
              <form onSubmit={confirmSetup} className="max-w-[280px] space-y-3">
                <p className="text-[13px] text-muted">Step 2. Enter the 6-digit code.</p>
                <input
                  type="text"
                  autoFocus
                  value={setupCode}
                  onChange={(e) => setSetupCode(e.target.value)}
                  placeholder="123456"
                  className="field text-center text-[18px] tracking-[0.3em]"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={settingUp}
                    className="btn btn-primary disabled:opacity-50"
                  >
                    {settingUp ? "Verifying" : "Verify and turn on"}
                  </button>
                  <button
                    type="button"
                    onClick={finishSetup}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {setupStep === "recovery" && (
            <div className="mt-5 border-t border-line pt-5">
              <p className="mb-3 flex items-start gap-2 rounded-lg bg-warn-tint px-3 py-2.5 text-[13px] font-medium text-warn">
                <i className="ri-error-warning-line mt-px text-[16px]" aria-hidden="true" />
                Save these recovery codes now. Each one works once if you lose your authenticator app.
              </p>
              <div className="grid grid-cols-2 gap-2 bg-canvas border border-line rounded-lg p-4 mb-4 font-mono text-[13px]">
                {recoveryCodes.map((code) => (
                  <div key={code} className="text-ink">{code}</div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={copyRecoveryCodes}
                  className="btn btn-secondary"
                >
                  <i className="ri-file-copy-line text-[16px]" aria-hidden="true" />
                  Copy codes
                </button>
                <button
                  type="button"
                  onClick={finishSetup}
                  className="btn btn-primary"
                >
                  I’ve saved them
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ================= SESSIONS CARD ================= */}
        <section className="panel p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
              <i className="ri-computer-line text-[20px] text-ink-soft" aria-hidden="true" />
              Active sessions
            </h2>
            {sessions.length > 1 && (
              <button
                type="button"
                onClick={revokeOthers}
                disabled={revokingOthers}
                className="btn btn-secondary h-8 px-3 text-[13px] !text-danger"
              >
                {revokingOthers ? "Logging out" : "Log out other devices"}
              </button>
            )}
          </div>

          {sessionsLoading ? (
            <div className="text-center py-8">
              <div className="spinner w-8 h-8 mx-auto text-accent" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-[13px] text-muted">No active sessions.</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <div
                  key={s._id}
                  className="flex items-center justify-between gap-3 bg-canvas border border-line rounded-lg px-4 py-3"
                >
                  <div>
                    <p className="text-[13px] font-semibold text-ink">
                      {describeDevice(s.userAgent)}
                      {s.isCurrent && (
                        <span className="ml-2 rounded bg-accent-tint px-1.5 py-0.5 text-xs font-medium text-accent">
                          This device
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      Active {formatRelativeTime(s.lastActiveAt)}
                    </p>
                  </div>
                  {!s.isCurrent && (
                    <button
                      type="button"
                      onClick={() => revokeSession(s._id)}
                      disabled={revokingId === s._id}
                      className="btn btn-secondary h-8 px-3 text-[13px] !text-danger"
                    >
                      {revokingId === s._id ? "Logging out" : "Log out"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
