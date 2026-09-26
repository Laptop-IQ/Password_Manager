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
  let device = "💻 Desktop";
  if (/mobile|android|iphone/.test(ua)) device = "📱 Mobile";
  else if (/ipad|tablet/.test(ua)) device = "📱 Tablet";

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
    <div className="relative min-h-screen bg-[#0A0810] font-['Inter',sans-serif] text-[#F5F3FF]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-[420px] w-[420px] rounded-full bg-[#8B72FF]/20 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[300px] w-[300px] rounded-full bg-[#FBBF24]/10 blur-[120px]" />
      </div>

      <main className="relative max-w-[800px] mx-auto px-[20px] md:px-[32px] pt-[56px] pb-[100px]">
        <div className="mb-10">
          <h2 className="text-[32px] font-extrabold font-['Manrope',sans-serif] bg-gradient-to-r from-white to-[#C9BFFF] bg-clip-text text-transparent">
            Account Security
          </h2>
          <p className="text-[15px] text-[#A8A4BD] mt-1">
            Two-factor authentication and active sessions for your account.
          </p>
        </div>

        {/* ================= 2FA CARD ================= */}
        <section className="bg-white/[0.03] backdrop-blur-xl rounded-[20px] border border-white/10 p-6 mb-8">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <h3 className="text-[17px] font-bold flex items-center gap-2">
                🔐 Two-Factor Authentication
                {twoFactorEnabled && (
                  <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#0B2E21] text-[#34D399] border border-[#34D399]/20">
                    Enabled
                  </span>
                )}
              </h3>
              <p className="text-[13px] text-[#A8A4BD] mt-1 max-w-[480px]">
                Require a 6-digit code from an authenticator app (Google Authenticator, Authy, etc.) every time you log in.
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
                    className="px-4 py-2.5 rounded-[10px] bg-[#F87171]/15 hover:bg-[#F87171]/25 text-[#F87171] text-[13px] font-semibold transition-colors"
                  >
                    Disable 2FA
                  </button>
                ) : (
                  <form onSubmit={handleDisable} className="max-w-[320px] space-y-3">
                    <p className="text-[13px] text-[#A8A4BD]">Confirm your password to disable 2FA:</p>
                    <input
                      type="password"
                      value={disablePassword}
                      onChange={(e) => setDisablePassword(e.target.value)}
                      placeholder="Account password"
                      className="w-full bg-black/20 border border-white/10 text-[#F5F3FF] text-[14px] px-4 py-2.5 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#8B72FF]/25"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={disabling}
                        className="px-4 py-2.5 rounded-[10px] bg-[#F87171] hover:bg-[#B91C1C] text-[#1a0505] text-[13px] font-semibold disabled:opacity-50"
                      >
                        {disabling ? "Disabling..." : "Confirm disable"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDisableForm(false)}
                        className="px-4 py-2.5 rounded-[10px] bg-white/5 hover:bg-white/10 text-[13px] font-semibold"
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
                  className="bg-gradient-to-r from-[#8B72FF] to-[#6D5AE0] hover:from-[#9c86ff] hover:to-[#7c68ec] text-white px-5 py-2.5 rounded-[12px] text-[14px] font-semibold disabled:opacity-50 transition-all"
                >
                  {settingUp ? "Starting..." : "Enable 2FA"}
                </button>
              )}
            </div>
          )}

          {setupStep === "qr" && (
            <div className="mt-5 border-t border-white/10 pt-5">
              <p className="text-[13px] text-[#A8A4BD] mb-3">
                1. Scan this QR code with your authenticator app:
              </p>
              {qrCodeDataUrl && (
                <img
                  src={qrCodeDataUrl}
                  alt="2FA QR code"
                  className="w-[180px] h-[180px] rounded-[12px] border border-white/10 bg-white p-2 mb-3"
                />
              )}
              {manualSecret && (
                <p className="text-[12px] text-[#A8A4BD] mb-4">
                  Can't scan? Enter manually:{" "}
                  <span className="font-mono text-[#C9BFFF]">{manualSecret}</span>
                </p>
              )}
              <form onSubmit={confirmSetup} className="max-w-[280px] space-y-3">
                <p className="text-[13px] text-[#A8A4BD]">2. Enter the 6-digit code:</p>
                <input
                  type="text"
                  autoFocus
                  value={setupCode}
                  onChange={(e) => setSetupCode(e.target.value)}
                  placeholder="123456"
                  className="w-full bg-black/20 border border-white/10 text-[#F5F3FF] text-center text-[18px] tracking-[0.3em] px-4 py-2.5 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#8B72FF]/25"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={settingUp}
                    className="px-4 py-2.5 rounded-[10px] bg-gradient-to-r from-[#8B72FF] to-[#6D5AE0] text-white text-[13px] font-semibold disabled:opacity-50"
                  >
                    {settingUp ? "Verifying..." : "Verify & Enable"}
                  </button>
                  <button
                    type="button"
                    onClick={finishSetup}
                    className="px-4 py-2.5 rounded-[10px] bg-white/5 hover:bg-white/10 text-[13px] font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {setupStep === "recovery" && (
            <div className="mt-5 border-t border-white/10 pt-5">
              <p className="text-[13px] text-[#FBBF24] mb-3 font-semibold">
                ⚠️ Save these recovery codes — each works once if you lose access to your authenticator app.
              </p>
              <div className="grid grid-cols-2 gap-2 bg-black/20 border border-white/10 rounded-[12px] p-4 mb-4 font-mono text-[13px]">
                {recoveryCodes.map((code) => (
                  <div key={code} className="text-[#F5F3FF]">{code}</div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={copyRecoveryCodes}
                  className="px-4 py-2.5 rounded-[10px] bg-white/5 hover:bg-white/10 text-[13px] font-semibold"
                >
                  Copy codes
                </button>
                <button
                  type="button"
                  onClick={finishSetup}
                  className="px-4 py-2.5 rounded-[10px] bg-gradient-to-r from-[#8B72FF] to-[#6D5AE0] text-white text-[13px] font-semibold"
                >
                  I've saved these — Done
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ================= SESSIONS CARD ================= */}
        <section className="bg-white/[0.03] backdrop-blur-xl rounded-[20px] border border-white/10 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[17px] font-bold">💻 Active Sessions</h3>
            {sessions.length > 1 && (
              <button
                type="button"
                onClick={revokeOthers}
                disabled={revokingOthers}
                className="text-[12px] font-semibold text-[#F87171] hover:underline disabled:opacity-50"
              >
                {revokingOthers ? "Logging out..." : "Log out all other devices"}
              </button>
            )}
          </div>

          {sessionsLoading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-white/10 border-t-[#8B72FF] rounded-full animate-spin mx-auto" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-[13px] text-[#A8A4BD]">No active sessions found.</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <div
                  key={s._id}
                  className="flex items-center justify-between gap-3 bg-black/20 border border-white/10 rounded-[12px] px-4 py-3"
                >
                  <div>
                    <p className="text-[13px] font-semibold text-[#F5F3FF]">
                      {describeDevice(s.userAgent)}
                      {s.isCurrent && (
                        <span className="ml-2 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#8B72FF]/15 text-[#C9BFFF] border border-[#8B72FF]/20">
                          This device
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-[#A8A4BD] mt-0.5">
                      Active {formatRelativeTime(s.lastActiveAt)}
                    </p>
                  </div>
                  {!s.isCurrent && (
                    <button
                      type="button"
                      onClick={() => revokeSession(s._id)}
                      disabled={revokingId === s._id}
                      className="text-[12px] font-semibold text-[#F87171] hover:underline disabled:opacity-50 whitespace-nowrap"
                    >
                      {revokingId === s._id ? "..." : "Log out"}
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
