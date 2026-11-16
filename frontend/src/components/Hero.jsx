import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import AddNewPassword from "./Add";
import { TableSkeleton } from "./Skeleton";
import PasswordHistoryModal from "./PasswordHistoryModal";
import useEscapeKey from "../hooks/useEscapeKey";

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
   ANTI-PHISHING: URL SAFETY CHECK
   Flags entries that are plain HTTP (not encrypted) or whose
   domain looks like it's impersonating a well-known brand
   (e.g. "paypa1.com", "go0gle-secure.com").
============================================================ */

const WATCHED_BRANDS = [
  "google",
  "paypal",
  "amazon",
  "apple",
  "microsoft",
  "facebook",
  "instagram",
  "netflix",
  "bank",
  "chase",
  "wellsfargo",
  "coinbase",
  "binance",
];

const normalizeHomoglyphs = (s) =>
  s
    .toLowerCase()
    .replace(/1/g, "l")
    .replace(/0/g, "o")
    .replace(/5/g, "s")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/rn/g, "m");

const getUrlWarning = (rawUrl) => {
  if (!rawUrl) return null;

  let hostname = "";
  try {
    const withScheme = /^https?:\/\//i.test(rawUrl)
      ? rawUrl
      : `https://${rawUrl}`;
    hostname = new URL(withScheme).hostname.toLowerCase();
  } catch {
    return null;
  }

  const isPlainHttp = /^http:\/\//i.test(rawUrl);
  const isPunycode = hostname.includes("xn--");

  const normalized = normalizeHomoglyphs(hostname);
  const hasManyHyphens = (hostname.match(/-/g) || []).length >= 2;

  const looksLikeBrandLookalike = WATCHED_BRANDS.some((brand) => {
    if (hostname.includes(brand)) return false; // exact brand substring, not a lookalike
    return normalized.includes(brand) || (hasManyHyphens && normalized.includes(brand));
  });

  if (isPunycode) {
    return "This domain uses international characters that can mimic a trusted site (punycode). Verify it carefully before entering credentials.";
  }

  if (looksLikeBrandLookalike) {
    return "This domain resembles a well-known brand but isn't the official spelling. Double-check it's not a phishing site.";
  }

  if (isPlainHttp) {
    return "This site uses unencrypted HTTP, not HTTPS. Avoid entering credentials on it if possible.";
  }

  return null;
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
     SEARCH / FILTER / FAVORITES
  ========================================================== */

  const [searchQuery, setSearchQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [togglingFavoriteId, setTogglingFavoriteId] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null); // { id, websiteName }

  const filteredPasswords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return passwords.filter((p) => {
      if (favoritesOnly && !p.isFavorite) return false;
      if (!q) return true;
      return [p.websiteName, p.url, p.username, p.category, ...(p.tags || [])]
        .some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [passwords, searchQuery, favoritesOnly]);

  const toggleFavorite = async (item) => {
    const id = item._id || item.id;
    try {
      setTogglingFavoriteId(id);
      await axios.put(
        `${API_URL}/passwords/${id}`,
        { ...item, isFavorite: !item.isFavorite },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setPasswords((prev) =>
        prev.map((p) => ((p._id || p.id) === id ? { ...p, isFavorite: !p.isFavorite } : p)),
      );
    } catch (err) {
      console.error("TOGGLE FAVORITE ERROR:", err);
    } finally {
      setTogglingFavoriteId(null);
    }
  };

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

    setVisiblePasswords((prev) => {
      const willShow = !prev[id];

      // Security: auto-hide the revealed password after 10s so it
      // doesn't stay exposed on-screen (shoulder-surfing protection).
      if (willShow) {
        window.setTimeout(() => {
          setVisiblePasswords((current) =>
            current[id] ? { ...current, [id]: false } : current,
          );
        }, 10000);
      }

      return {
        ...prev,
        [id]: willShow,
      };
    });
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

        toast.info("Password copied — clipboard clears in 20s.", {
          autoClose: 1500,
        });

        window.setTimeout(() => {
          setCopiedId((current) => (current === id ? null : current));
        }, 1500);

        // Security: proactively clear the clipboard after a short delay
        // so a copied password doesn't linger there indefinitely and get
        // picked up by other apps/malware. Only clears it if the
        // clipboard still holds exactly what we put there.
        window.setTimeout(async () => {
          try {
            if (
              navigator.clipboard &&
              typeof navigator.clipboard.readText === "function"
            ) {
              const current = await navigator.clipboard.readText();
              if (current === password) {
                await copyText("");
              }
            }
          } catch {
            // Reading the clipboard may be blocked (permissions/focus) —
            // fail silently, this is a best-effort security measure.
          }
        }, 20000);
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
        await axios.delete(
          `${API_URL}/passwords/${encodeURIComponent(id)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            timeout: 15000,
          },
        );

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
        color: "text-muted",
        bg: "bg-sunken",
        bar: "bg-faint",
        width: "w-[20%]",
      };
    }

    if (password.length >= 16) {
      return {
        status: "Strong",
        color: "text-ok",
        bg: "bg-ok-tint",
        bar: "bg-ok",
        width: "w-full",
      };
    }

    if (password.length >= 12) {
      return {
        status: "Fair",
        color: "text-warn",
        bg: "bg-warn-tint",
        bar: "bg-warn",
        width: "w-[60%]",
      };
    }

    return {
      status: "Weak",
      color: "text-danger",
      bg: "bg-danger-tint",
      bar: "bg-danger",
      width: "w-[25%]",
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

  useEscapeKey(cancelDelete, Boolean(deleteTarget) && !deletingId);

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      {openModal && (
        <AddNewPassword
          handleOpenModal={handleCloseModal}
          onPasswordAdded={handlePasswordSaved}
          token={token}
          editPassword={editPassword}
        />
      )}

      {/* DELETE CONFIRMATION */}
      {deleteTarget && (
        <div
          className="dialog-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deletingId) {
              cancelDelete();
            }
          }}
        >
          <div className="dialog max-w-[420px] p-6">
            <div className="mb-4 grid h-10 w-10 place-items-center rounded-full bg-danger-tint text-danger">
              <i className="ri-delete-bin-6-line text-[20px]" aria-hidden="true" />
            </div>

            <h3
              id="delete-dialog-title"
              className="text-lg font-semibold tracking-tight text-ink"
            >
              Delete this password?
            </h3>

            <p className="mt-2 text-sm leading-6 text-muted">
              {deleteTarget?.websiteName
                ? `The saved login for ${deleteTarget.websiteName} will be permanently removed. This can’t be undone.`
                : "This saved login will be permanently removed. This can’t be undone."}
            </p>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                autoFocus
                onClick={cancelDelete}
                disabled={isDeletingTarget}
                className="btn btn-secondary"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleDelete(deleteTargetId)}
                disabled={!deleteTargetId || isDeletingTarget}
                className="btn btn-danger min-w-[96px]"
              >
                {isDeletingTarget ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    Deleting
                  </>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-[1200px] px-4 pb-24 pt-10 sm:px-8">
        {/* HEADER */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-ink">
              Passwords
            </h1>
            <p className="mt-1 text-sm text-muted">
              {loading
                ? "Loading…"
                : passwords.length === 0
                ? "Nothing saved yet"
                : `${passwords.length} saved ${passwords.length === 1 ? "login" : "logins"}, encrypted`}
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenModal}
            className="btn btn-primary"
          >
            <i className="ri-add-line text-[18px]" aria-hidden="true" />
            Add password
          </button>
        </div>

        {/* ERROR */}
        {error && (
          <div
            role="alert"
            className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-danger/25 bg-danger-tint p-4"
          >
            <div className="flex items-start gap-3">
              <i className="ri-error-warning-line mt-0.5 text-[18px] text-danger" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-danger">
                  Couldn’t load your passwords
                </p>
                <p className="mt-0.5 text-[13px] text-ink-soft">{error}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={fetchPasswords}
              disabled={loading}
              className="btn btn-secondary h-8 px-3 text-[13px]"
            >
              {loading ? "Retrying" : "Retry"}
            </button>
          </div>
        )}

        {/* SEARCH & FILTER */}
        {!loading && passwords.length > 0 && (
          <div className="mb-5 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <i
                className="ri-search-line pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[17px] text-faint"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by site, username, category or tag"
                aria-label="Search passwords"
                className="field pl-10"
              />
            </div>
            <button
              type="button"
              onClick={() => setFavoritesOnly((v) => !v)}
              aria-pressed={favoritesOnly}
              className={`btn ${
                favoritesOnly
                  ? "border-warn/40 bg-warn-tint text-warn"
                  : "btn-secondary"
              }`}
            >
              <i
                className={`${favoritesOnly ? "ri-star-fill" : "ri-star-line"} text-[16px]`}
                aria-hidden="true"
              />
              Favorites
            </button>
          </div>
        )}

        {loading ? (
          <TableSkeleton label="Loading your passwords" />
        ) : passwords.length === 0 ? (
          <div className="panel px-6 py-16 text-center">
            <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-xl bg-sunken text-ink-soft">
              <i className="ri-key-2-line text-[24px]" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-semibold tracking-tight">
              No passwords saved yet
            </h2>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
              Add a login and it’s stored encrypted, ready to copy when you need it.
            </p>
            <button
              type="button"
              onClick={handleOpenModal}
              className="btn btn-primary mt-6"
            >
              <i className="ri-add-line text-[18px]" aria-hidden="true" />
              Add your first password
            </button>
          </div>
        ) : filteredPasswords.length === 0 ? (
          <div className="panel px-6 py-14 text-center">
            <i className="ri-search-line text-[24px] text-faint" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-ink">No matches</p>
            <p className="mt-1 text-sm text-muted">
              Try a different search term or turn off the favorites filter.
            </p>
          </div>
        ) : (
          <div className="panel overflow-hidden">
            {/* TABLE HEADER */}
            <div
              role="row"
              className="hidden grid-cols-12 gap-4 border-b border-line bg-sunken/60 px-6 py-3 text-xs font-medium text-muted md:grid"
            >
              <div className="col-span-3">Website</div>
              <div className="col-span-2">Username</div>
              <div className="col-span-3">Password</div>
              <div className="col-span-2">Strength</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            <ul className="divide-y divide-line">
              {filteredPasswords.map((item, index) => {
                const realId = getPasswordId(item);
                const id = realId || `fallback-${index}`;
                const security = getSecurityStatus(item?.password);
                const urlWarning = getUrlWarning(item?.url);
                const isVisible = Boolean(visiblePasswords[id]);
                const isDeleting = deletingId === id;
                const siteName = item?.websiteName || "Unnamed website";

                return (
                  <li
                    key={id}
                    className={`grid grid-cols-1 items-center gap-3 px-4 py-4 transition-colors hover:bg-canvas/70 md:grid-cols-12 md:gap-4 md:px-6 ${
                      isDeleting ? "opacity-60" : ""
                    }`}
                  >
                    {/* WEBSITE */}
                    <div className="flex min-w-0 items-center gap-3 md:col-span-3">
                      <span
                        className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-accent-tint text-[15px] font-semibold text-accent"
                        aria-hidden="true"
                      >
                        {siteName.charAt(0).toUpperCase()}
                      </span>

                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-medium text-ink">
                          {siteName}
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
                            className="block truncate text-xs text-muted hover:text-accent hover:underline"
                            title={item.url}
                          >
                            {item.url}
                          </a>
                        ) : (
                          <p className="text-xs text-faint">No URL</p>
                        )}

                        {urlWarning ? (
                          <div
                            className="mt-1 inline-flex max-w-full items-center gap-1 rounded bg-warn-tint px-1.5 py-0.5 text-[11px] font-medium text-warn"
                            title={urlWarning}
                          >
                            <i className="ri-alert-line" aria-hidden="true" />
                            <span className="max-w-[180px] truncate">{urlWarning}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {/* USERNAME */}
                    <div className="flex min-w-0 items-center gap-1 md:col-span-2">
                      <span
                        className="flex-1 truncate text-sm text-ink-soft"
                        title={item?.username || ""}
                      >
                        {item?.username || "—"}
                      </span>

                      {item?.username && (
                        <button
                          type="button"
                          onClick={() => copyUsername(item.username, id)}
                          disabled={isDeleting}
                          className={`icon-btn flex-shrink-0 ${
                            copiedUsernameId === id ? "!text-ok" : ""
                          }`}
                          title={copiedUsernameId === id ? "Copied" : "Copy username"}
                          aria-label="Copy username"
                        >
                          <i
                            className={copiedUsernameId === id ? "ri-check-line" : "ri-file-copy-line"}
                            aria-hidden="true"
                          />
                        </button>
                      )}
                    </div>

                    {/* PASSWORD */}
                    <div className="flex min-w-0 items-center gap-1 md:col-span-3">
                      <div className="min-w-0 flex-1 rounded-md border border-line bg-canvas px-2.5 py-1.5">
                        <span className="block truncate font-mono text-[13px] text-ink">
                          {!item?.password
                            ? "Unavailable"
                            : isVisible
                              ? item.password
                              : "••••••••••••"}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility(id)}
                        disabled={!item?.password || isDeleting}
                        className="icon-btn flex-shrink-0"
                        title={isVisible ? "Hide password" : "Show password"}
                        aria-label={isVisible ? "Hide password" : "Show password"}
                        aria-pressed={isVisible}
                      >
                        <i
                          className={isVisible ? "ri-eye-off-line" : "ri-eye-line"}
                          aria-hidden="true"
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() => copyPassword(item?.password, id)}
                        disabled={!item?.password || isDeleting}
                        className={`icon-btn flex-shrink-0 ${
                          copiedId === id ? "!text-ok" : ""
                        }`}
                        title={copiedId === id ? "Copied" : "Copy password"}
                        aria-label="Copy password"
                      >
                        <i
                          className={copiedId === id ? "ri-check-line" : "ri-file-copy-line"}
                          aria-hidden="true"
                        />
                      </button>
                    </div>

                    {/* STRENGTH */}
                    <div className="flex items-center gap-2.5 md:col-span-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken">
                        <div
                          className={`h-full rounded-full ${security.bar} ${security.width}`}
                        />
                      </div>
                      <span
                        className={`w-12 text-xs font-medium ${security.color}`}
                      >
                        {security.status}
                      </span>
                    </div>

                    {/* ACTIONS */}
                    <div className="flex items-center justify-end gap-0.5 md:col-span-2">
                      <button
                        type="button"
                        onClick={() => toggleFavorite(item)}
                        disabled={togglingFavoriteId === realId}
                        className={`icon-btn ${item.isFavorite ? "!text-warn" : ""}`}
                        aria-label={item.isFavorite ? "Remove from favorites" : "Add to favorites"}
                        aria-pressed={Boolean(item.isFavorite)}
                        title={item.isFavorite ? "Remove from favorites" : "Add to favorites"}
                      >
                        <i
                          className={item.isFavorite ? "ri-star-fill" : "ri-star-line"}
                          aria-hidden="true"
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleEdit(item)}
                        disabled={isDeleting || !realId}
                        className="icon-btn"
                        aria-label="Edit password"
                        title="Edit"
                      >
                        <i className="ri-pencil-line" aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setHistoryTarget({ id: realId, websiteName: item.websiteName })
                        }
                        disabled={!realId}
                        className="icon-btn"
                        aria-label="View password history"
                        title="History"
                      >
                        <i className="ri-history-line" aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        onClick={() => confirmDelete(item)}
                        disabled={isDeleting || !realId}
                        className="icon-btn hover:!bg-danger-tint hover:!text-danger"
                        aria-label="Delete password"
                        title={isDeleting ? "Deleting…" : "Delete"}
                      >
                        {isDeleting ? (
                          <span className="spinner h-4 w-4" aria-hidden="true" />
                        ) : (
                          <i className="ri-delete-bin-6-line" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {historyTarget && (
          <PasswordHistoryModal
            passwordId={historyTarget.id}
            websiteName={historyTarget.websiteName}
            token={token}
            onClose={() => setHistoryTarget(null)}
          />
        )}
      </main>
    </div>
  );
}
