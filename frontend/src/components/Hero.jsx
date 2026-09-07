import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import AddNewPassword from "./Add";

/* ============================================================
   API CONFIG
============================================================ */

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  ""
).replace(/\/+$/, "");

const API_URL = `${API_BASE}/api`;

/* ============================================================
   HELPERS
============================================================ */

const getPasswordId = (item) => {
  if (!item) return null;

  const id = item._id ?? item.id ?? null;

  if (id === null || id === undefined || id === "") {
    return null;
  }

  return String(id);
};

const getErrorMessage = (
  error,
  fallback = "Something went wrong. Please try again.",
) => {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  );
};

/* ============================================================
   COMPONENT
============================================================ */

export default function Hero({ token }) {
  /* ==========================================================
     MODAL STATE
  ========================================================== */

  const [openModal, setOpenModal] = useState(false);
  const [editPassword, setEditPassword] = useState(null);

  /* ==========================================================
     DELETE CONFIRMATION STATE
  ========================================================== */

  const [deleteTarget, setDeleteTarget] = useState(null);

  /* ==========================================================
     PASSWORD STATE
  ========================================================== */

  const [passwords, setPasswords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* ==========================================================
     PASSWORD UI STATE
  ========================================================== */

  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [copiedId, setCopiedId] = useState(null);
  const [copiedUsernameId, setCopiedUsernameId] = useState(null);

  /* ==========================================================
     DELETE STATE
  ========================================================== */

  const [deletingId, setDeletingId] = useState(null);

  /* ==========================================================
     FETCH PASSWORDS
  ========================================================== */

  const fetchPasswords = useCallback(async () => {
    if (!token) {
      setPasswords([]);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(`${API_URL}/passwords`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: 15000,
      });

      const data = response?.data?.data;

      if (!Array.isArray(data)) {
        throw new Error("Invalid password data received from server.");
      }

      setPasswords(data);
    } catch (err) {
      console.error("FETCH PASSWORDS ERROR:", err);

      const message = getErrorMessage(
        err,
        "Failed to load passwords. Please try again.",
      );

      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  /* ==========================================================
     INITIAL FETCH
  ========================================================== */

  useEffect(() => {
    fetchPasswords();
  }, [fetchPasswords]);

  /* ==========================================================
     MODAL
  ========================================================== */

  const handleOpenModal = useCallback(() => {
    setEditPassword(null);
    setOpenModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setOpenModal(false);
    setEditPassword(null);
  }, []);

  const handlePasswordSaved = useCallback(async () => {
    handleCloseModal();
    await fetchPasswords();
  }, [fetchPasswords, handleCloseModal]);

  /* ==========================================================
     SHOW / HIDE PASSWORD
  ========================================================== */

  const togglePasswordVisibility = useCallback((id) => {
    if (!id) return;

    setVisiblePasswords((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }, []);

  /* ==========================================================
     COPY HELPER
  ========================================================== */

  const copyText = useCallback(async (text) => {
    if (!text) {
      throw new Error("Nothing to copy.");
    }

    /* Modern Clipboard API */
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      await navigator.clipboard.writeText(String(text));
      return;
    }

    /* Fallback */
    if (typeof document === "undefined") {
      throw new Error("Clipboard is not available.");
    }

    const textarea = document.createElement("textarea");

    textarea.value = String(text);
    textarea.setAttribute("readonly", "");

    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "0";
    textarea.style.width = "1px";
    textarea.style.height = "1px";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";

    document.body.appendChild(textarea);

    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    const successful = document.execCommand("copy");

    document.body.removeChild(textarea);

    if (!successful) {
      throw new Error("Copy failed.");
    }
  }, []);

  /* ==========================================================
     COPY PASSWORD
  ========================================================== */

  const copyPassword = useCallback(
    async (password, id) => {
      if (!password) {
        toast.warning("Password is not available.");
        return;
      }

      try {
        await copyText(password);

        setCopiedId(id);

        toast.success("Password copied to clipboard.", {
          autoClose: 1500,
        });

        window.setTimeout(() => {
          setCopiedId((current) => (current === id ? null : current));
        }, 1500);
      } catch (err) {
        console.error("COPY PASSWORD ERROR:", err);
        toast.error("Failed to copy password.");
      }
    },
    [copyText],
  );

  /* ==========================================================
     COPY USERNAME
  ========================================================== */

  const copyUsername = useCallback(
    async (username, id) => {
      if (!username) {
        toast.warning("Username is not available.");
        return;
      }

      try {
        await copyText(username);

        setCopiedUsernameId(id);

        toast.success("Username copied to clipboard.", {
          autoClose: 1500,
        });

        window.setTimeout(() => {
          setCopiedUsernameId((current) => (current === id ? null : current));
        }, 1500);
      } catch (err) {
        console.error("COPY USERNAME ERROR:", err);
        toast.error("Failed to copy username.");
      }
    },
    [copyText],
  );

  /* ==========================================================
     EDIT
  ========================================================== */

  const handleEdit = useCallback((item) => {
    if (!item) {
      toast.error("Unable to edit this password.");
      return;
    }

    const id = getPasswordId(item);

    if (!id) {
      toast.error("Invalid password ID.");
      return;
    }

    setEditPassword({
      ...item,
      _id: id,
    });

    setOpenModal(true);
  }, []);

  /* ==========================================================
     OPEN DELETE CONFIRMATION
  ========================================================== */

  const confirmDelete = useCallback(
    (item) => {
      if (!item) {
        toast.error("Unable to delete this password.");
        return;
      }

      const id = getPasswordId(item);

      if (!id) {
        toast.error("Invalid password ID.");
        return;
      }

      if (deletingId === id) {
        return;
      }

      setDeleteTarget({
        ...item,
        _id: id,
      });
    },
    [deletingId],
  );

  /* ==========================================================
     CLOSE DELETE CONFIRMATION
  ========================================================== */

  const cancelDelete = useCallback(() => {
    if (deletingId) {
      return;
    }

    setDeleteTarget(null);
  }, [deletingId]);

  /* ==========================================================
     DELETE
  ========================================================== */

  const handleDelete = useCallback(
    async (id) => {
      if (!id) {
        toast.error("Invalid password ID.");
        return;
      }

      if (!token) {
        toast.error("Authentication required. Please login again.");
        return;
      }

      if (deletingId === id) {
        return;
      }

      const previousPasswords = [...passwords];

      try {
        setDeletingId(id);

        /* Close confirmation modal */
        setDeleteTarget(null);

        /* Optimistic update */
        setPasswords((prev) =>
          prev.filter((item) => getPasswordId(item) !== id),
        );

        /* DELETE API */
        const response = await axios.delete(
          `${API_URL}/passwords/${encodeURIComponent(id)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            timeout: 15000,
          },
        );

        console.log("DELETE PASSWORD SUCCESS:", response?.data);

        /* Cleanup UI state */
        setVisiblePasswords((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });

        setCopiedId((current) => (current === id ? null : current));

        setCopiedUsernameId((current) => (current === id ? null : current));

        toast.success("Password deleted successfully.", {
          autoClose: 2000,
        });
      } catch (err) {
        console.error("DELETE PASSWORD ERROR:", err);

        /* Rollback */
        setPasswords(previousPasswords);

        const status = err?.response?.status;

        if (status === 401) {
          toast.error("Session expired. Please login again.");
        } else if (status === 403) {
          toast.error("You are not allowed to delete this password.");
        } else if (status === 404) {
          try {
            await fetchPasswords();
          } catch (refreshError) {
            console.error("REFRESH AFTER DELETE 404 ERROR:", refreshError);
          }

          toast.info("Password was already deleted.");
        } else {
          const message = getErrorMessage(
            err,
            "Failed to delete password. Please try again.",
          );

          toast.error(message);
        }
      } finally {
        setDeletingId(null);
      }
    },
    [deletingId, fetchPasswords, passwords, token],
  );

  /* ==========================================================
     SECURITY STATUS
  ========================================================== */

  const getSecurityStatus = useCallback((password) => {
    if (!password) {
      return {
        status: "Unknown",
        color: "text-gray-500",
        bg: "bg-gray-100",
        bar: "bg-gray-400",
        width: "w-[20%]",
      };
    }

    if (password.length >= 16) {
      return {
        status: "Secure",
        color: "text-[#059669]",
        bg: "bg-[#d1fae5]",
        bar: "bg-[#059669]",
        width: "w-[85%]",
      };
    }

    if (password.length >= 12) {
      return {
        status: "Fair",
        color: "text-[#b45309]",
        bg: "bg-[#fef3c7]",
        bar: "bg-[#f59e0b]",
        width: "w-[60%]",
      };
    }

    return {
      status: "Weak",
      color: "text-[#ba1a1a]",
      bg: "bg-[#ffdad6]",
      bar: "bg-[#ba1a1a]",
      width: "w-[20%]",
    };
  }, []);

  /* ==========================================================
     DELETE TARGET INFO
  ========================================================== */

  const deleteTargetId = useMemo(
    () => getPasswordId(deleteTarget),
    [deleteTarget],
  );

  const isDeletingTarget = deletingId === deleteTargetId;

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <div className="min-h-screen bg-[#f9f9ff] font-['Inter',sans-serif] text-[#191b23]">
      {/* ======================================================
          ADD / EDIT MODAL
      ====================================================== */}

      {openModal && (
        <AddNewPassword
          handleOpenModal={handleCloseModal}
          onPasswordAdded={handlePasswordSaved}
          token={token}
          editPassword={editPassword}
        />
      )}

      {/* ======================================================
          DELETE CONFIRMATION MODAL
      ====================================================== */}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deletingId) {
              cancelDelete();
            }
          }}
        >
          <div className="w-full max-w-[420px] bg-white rounded-[16px] shadow-2xl border border-[#e1e2ec] p-[24px]">
            <div className="w-[48px] h-[48px] rounded-full bg-[#ffdad6] flex items-center justify-center mb-[16px]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ba1a1a"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-2-2-2-2H7c0-2-2-2-2-2V6" />
                <path d="M8 6V4c0-1.1.9-2 2-2h4c1.1 0 2 2 2 2v2" />
              </svg>
            </div>

            <h3
              id="delete-dialog-title"
              className="text-[20px] font-bold text-[#191b23]"
            >
              Delete password?
            </h3>

            <p className="text-[14px] text-[#727785] mt-[8px] leading-6">
              {deleteTarget?.websiteName
                ? `Are you sure you want to permanently delete the password for ${deleteTarget.websiteName}?`
                : "Are you sure you want to permanently delete this password?"}
            </p>

            <p className="text-[13px] text-[#ba1a1a] mt-[12px]">
              This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-[10px] mt-[24px]">
              <button
                type="button"
                onClick={cancelDelete}
                disabled={isDeletingTarget}
                className="px-[16px] py-[10px] rounded-[8px] bg-[#f2f3fd] hover:bg-[#e1e2ec] text-[#191b23] text-[14px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleDelete(deleteTargetId)}
                disabled={!deleteTargetId || isDeletingTarget}
                className="min-w-[90px] px-[16px] py-[10px] rounded-[8px] bg-[#ba1a1a] hover:bg-[#93000a] text-white text-[14px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-[8px]"
              >
                {isDeletingTarget ? (
                  <>
                    <span
                      className="w-[15px] h-[15px] border-2 border-white/30 border-t-white rounded-full animate-spin"
                      aria-hidden="true"
                    />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================
          MAIN
      ====================================================== */}

      <main className="max-w-[1200px] mx-auto px-[20px] md:px-[32px] pt-[48px] pb-[120px]">
        {/* ====================================================
            HEADER
        ==================================================== */}

        <div className="mb-[32px]">
          <h2 className="text-[32px] font-bold font-['Manrope',sans-serif] text-[#191b23]">
            Password Vault
          </h2>

          <p className="text-[16px] text-[#424754] mt-[8px]">
            {passwords.length} password
            {passwords.length !== 1 ? "s" : ""} stored securely
          </p>
        </div>

        {/* ====================================================
            ERROR
        ==================================================== */}

        {error && (
          <div className="bg-[#ffdad6] border border-[#ba1a1a] rounded-[12px] p-[16px] mb-[24px] flex items-start justify-between gap-4">
            <div>
              <p className="text-[14px] font-semibold text-[#ba1a1a]">
                Error loading passwords
              </p>

              <p className="text-[13px] text-[#ba1a1a]/80 mt-[4px]">{error}</p>
            </div>

            <button
              type="button"
              onClick={fetchPasswords}
              disabled={loading}
              className="text-[12px] font-semibold text-[#ba1a1a] hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer whitespace-nowrap"
            >
              {loading ? "Loading..." : "Retry"}
            </button>
          </div>
        )}

        {/* ====================================================
            LOADING
        ==================================================== */}

        {loading ? (
          <div className="bg-white rounded-[16px] border border-[#e1e2ec] p-[48px] text-center">
            <div className="inline-block">
              <div className="w-[40px] h-[40px] border-4 border-[#e1e2ec] border-t-[#0058be] rounded-full animate-spin mb-[16px]" />

              <p className="text-[16px] text-[#727785] font-medium">
                Loading your vault...
              </p>
            </div>
          </div>
        ) : passwords.length === 0 ? (
          /* ==================================================
             EMPTY STATE
          ================================================== */

          <div className="bg-white rounded-[16px] border border-[#e1e2ec] p-[64px] text-center">
            <div className="w-[56px] h-[56px] bg-[#e0e7ff] rounded-full flex items-center justify-center mx-auto mb-[24px] text-[24px]">
              🔐
            </div>

            <h3 className="text-[20px] font-semibold text-[#191b23] mb-[8px]">
              No passwords yet
            </h3>

            <p className="text-[16px] text-[#727785] mb-[24px]">
              Start by adding your first password to get started
            </p>

            <button
              type="button"
              onClick={handleOpenModal}
              className="bg-[#0058be] hover:bg-[#004395] text-white px-[24px] py-[12px] rounded-[8px] text-[14px] font-semibold cursor-pointer transition-colors"
            >
              + Add your first password
            </button>
          </div>
        ) : (
          /* ==================================================
             PASSWORD TABLE
          ================================================== */

          <div className="bg-white rounded-[16px] border border-[#e1e2ec] shadow-[0_4px_20px_rgba(15,23,42,0.03)] overflow-hidden">
            {/* TABLE HEADER */}

            <div className="hidden md:grid grid-cols-12 gap-[16px] px-[24px] py-[16px] border-b border-[#e1e2ec] bg-[#f9f9ff]/50 text-[12px] font-semibold text-[#727785] uppercase tracking-[0.02em]">
              <div className="col-span-3">Website</div>

              <div className="col-span-2">Username</div>

              <div className="col-span-3">Password</div>

              <div className="col-span-2">Security</div>

              <div className="col-span-2 text-right">Actions</div>
            </div>

            {/* ITEMS */}

            <div className="flex flex-col divide-y divide-[#e1e2ec]">
              {passwords.map((item, index) => {
                const realId = getPasswordId(item);

                const id = realId || `fallback-${index}`;

                const security = getSecurityStatus(item?.password);

                const isVisible = Boolean(visiblePasswords[id]);

                const isDeleting = deletingId === id;

                return (
                  <div
                    key={id}
                    className={`grid grid-cols-1 md:grid-cols-12 gap-[16px] items-center px-[20px] md:px-[24px] py-[20px] hover:bg-[#f2f3fd]/50 transition-colors ${
                      isDeleting ? "opacity-60" : ""
                    }`}
                  >
                    {/* ==================================================
                        WEBSITE
                    ================================================== */}

                    <div className="md:col-span-3 flex items-center gap-[12px] min-w-0">
                      <div className="w-[40px] h-[40px] rounded-[8px] bg-[#e0e7ff] flex items-center justify-center flex-shrink-0">
                        🔗
                      </div>

                      <div className="min-w-0">
                        <h3 className="text-[14px] font-semibold text-[#191b23] truncate">
                          {item?.websiteName || "Unnamed Website"}
                        </h3>

                        {item?.url ? (
                          <a
                            href={
                              /^https?:\/\//i.test(item.url)
                                ? item.url
                                : `https://${item.url}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[12px] text-[#0058be] hover:text-[#004395] hover:underline truncate block"
                            title={item.url}
                          >
                            {item.url}
                          </a>
                        ) : (
                          <p className="text-[12px] text-[#727785]">No URL</p>
                        )}
                      </div>
                    </div>

                    {/* ==================================================
                        USERNAME
                    ================================================== */}

                    <div className="md:col-span-2 min-w-0">
                      <div className="flex items-center gap-[6px]">
                        <span
                          className="text-[14px] text-[#424754] truncate flex-1"
                          title={item?.username || ""}
                        >
                          {item?.username || "—"}
                        </span>

                        {item?.username && (
                          <button
                            type="button"
                            onClick={() => copyUsername(item.username, id)}
                            disabled={isDeleting}
                            className={`p-[6px] rounded-[6px] flex-shrink-0 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                              copiedUsernameId === id
                                ? "text-[#059669] bg-[#d1fae5]"
                                : "text-[#0058be] hover:bg-[#e0e7ff]"
                            }`}
                            title={
                              copiedUsernameId === id
                                ? "Copied"
                                : "Copy username"
                            }
                            aria-label="Copy username"
                          >
                            {copiedUsernameId === id ? (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="15"
                                height="15"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                            ) : (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="15"
                                height="15"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <rect
                                  width="14"
                                  height="14"
                                  x="8"
                                  y="8"
                                  rx="2"
                                />

                                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* ==================================================
                        PASSWORD
                    ================================================== */}

                    <div className="md:col-span-3 min-w-0">
                      <div className="flex items-center gap-[6px]">
                        <div className="flex-1 min-w-0 bg-[#f2f3fd] border border-[#e1e2ec] rounded-[8px] px-[10px] py-[8px]">
                          <span className="text-[13px] font-mono truncate block">
                            {!item?.password
                              ? "Unavailable"
                              : isVisible
                                ? item.password
                                : "••••••••••••"}
                          </span>
                        </div>

                        {/* SHOW / HIDE */}

                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility(id)}
                          disabled={!item?.password || isDeleting}
                          className="p-[8px] rounded-[6px] text-[#0058be] hover:bg-[#e0e7ff] cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          title={isVisible ? "Hide password" : "Show password"}
                          aria-label={
                            isVisible ? "Hide password" : "Show password"
                          }
                        >
                          {isVisible ? (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="17"
                              height="17"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          ) : (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="17"
                              height="17"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M3 3l18 18" />
                              <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                              <path d="M9.9 4.2A10.5 10.5 0 0 1 12 4c7 0 10 7 10 7a18 18 0 0 1-3.2 4.5" />
                              <path d="M6.6 6.6C3.8 8.5 2 12 2 12s3 7 10 7a10 10 0 0 0 3-.4" />
                            </svg>
                          )}
                        </button>

                        {/* COPY PASSWORD */}

                        <button
                          type="button"
                          onClick={() => copyPassword(item?.password, id)}
                          disabled={!item?.password || isDeleting}
                          className={`p-[8px] rounded-[6px] cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                            copiedId === id
                              ? "text-[#059669] bg-[#d1fae5]"
                              : "text-[#0058be] hover:bg-[#e0e7ff]"
                          }`}
                          title="Copy password"
                          aria-label="Copy password"
                        >
                          {copiedId === id ? (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="17"
                              height="17"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          ) : (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="17"
                              height="17"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <rect width="14" height="14" x="8" y="8" rx="2" />

                              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* ==================================================
                        SECURITY
                    ================================================== */}

                    <div className="md:col-span-2 flex items-center gap-[8px]">
                      <div className="flex-1 h-[6px] bg-[#ecedf7] rounded-full overflow-hidden">
                        <div
                          className={`h-full ${security.bar} ${security.width} rounded-full`}
                        />
                      </div>

                      <span
                        className={`px-[8px] py-[4px] rounded-[12px] text-[10px] font-bold uppercase whitespace-nowrap ${security.bg} ${security.color}`}
                      >
                        {security.status}
                      </span>
                    </div>

                    {/* ==================================================
                        ACTIONS
                    ================================================== */}

                    <div className="md:col-span-2 flex items-center justify-end gap-[4px]">
                      {/* EDIT */}

                      <button
                        type="button"
                        onClick={() => handleEdit(item)}
                        disabled={isDeleting || !realId}
                        className="text-[#0058be] hover:text-[#004395] hover:bg-[#e0e7ff] disabled:opacity-40 disabled:cursor-not-allowed p-[8px] rounded-[6px] transition-colors cursor-pointer"
                        aria-label="Edit password"
                        title="Edit"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="17"
                          height="17"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
                        </svg>
                      </button>

                      {/* DELETE */}

                      <button
                        type="button"
                        onClick={() => confirmDelete(item)}
                        disabled={isDeleting || !realId}
                        className="text-[#ba1a1a] hover:text-[#93000a] hover:bg-[#ffdad6] disabled:opacity-40 disabled:cursor-not-allowed p-[8px] rounded-[6px] transition-colors cursor-pointer"
                        aria-label="Delete password"
                        title={isDeleting ? "Deleting..." : "Delete"}
                      >
                        {isDeleting ? (
                          <span
                            className="block w-[17px] h-[17px] border-2 border-[#ba1a1a]/30 border-t-[#ba1a1a] rounded-full animate-spin"
                            aria-hidden="true"
                          />
                        ) : (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="17"
                            height="17"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-2-2-2-2H7c0-2-2-2-2-2V6" />
                            <path d="M8 6V4c0-1.1.9-2 2-2h4c1.1 0 2 2 2 2v2" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* ======================================================
          ANDROID STYLE FLOATING ACTION BUTTON
      ====================================================== */}

      {!openModal && !deleteTarget && (
        <button
          type="button"
          onClick={handleOpenModal}
          aria-label="Add new password"
          title="Add New Password"
          className="
            fixed
            right-[20px]
            bottom-[20px]
            md:right-[32px]
            md:bottom-[32px]
            z-[50]

            h-[56px]
            w-[56px]
            md:w-auto
            md:min-w-[56px]

            md:px-[20px]

            rounded-full
            md:rounded-[16px]

            bg-[#0058be]
            hover:bg-[#004395]
            active:bg-[#003b82]

            text-white

            flex
            items-center
            justify-center
            gap-[8px]

            shadow-[0_8px_24px_rgba(0,88,190,0.35)]
            hover:shadow-[0_10px_28px_rgba(0,88,190,0.45)]

            transition-all
            duration-200
            ease-out

            hover:-translate-y-[2px]
            active:translate-y-0

            focus:outline-none
            focus-visible:ring-4
            focus-visible:ring-[#0058be]/30

            cursor-pointer
            select-none
          "
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="flex-shrink-0"
          >
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>

          <span className="hidden md:inline text-[14px] font-semibold">
            Add New
          </span>
        </button>
      )}
    </div>
  );
}
