import axios from "axios";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { CardGridSkeleton, TableSkeleton } from "./Skeleton";
import CardForm from "./CardForm";
import SecretForm, { SECRET_TYPES } from "./SecretForm";
import AuthenticatorForm from "./AuthenticatorForm";
import { generateTotpCode, secondsRemainingInPeriod } from "../utils/totp";
import useEscapeKey from "../hooks/useEscapeKey";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  ""
).replace(/\/+$/, "");

const API_URL = `${API_BASE}/api`;

const getId = (item) => String(item?._id ?? item?.id ?? "");

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

// ============================================================
// LIVE TOTP CODE DISPLAY (self-updating, one per authenticator card)
// ============================================================

function TotpCodeDisplay({ secret }) {
  const [code, setCode] = useState("······");
  const [secondsLeft, setSecondsLeft] = useState(secondsRemainingInPeriod());

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      const remaining = secondsRemainingInPeriod();
      setSecondsLeft(remaining);
      const newCode = await generateTotpCode(secret);
      if (!cancelled) setCode(newCode || "Invalid");
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [secret]);

  const pct = (secondsLeft / 30) * 100;

  return (
    <div className="flex items-center justify-between rounded-lg border border-line bg-canvas px-3.5 py-2.5">
      <span className="font-mono text-[22px] font-medium tracking-[0.12em] text-ink">
        {code.match(/.{1,3}/g)?.join(" ") || code}
      </span>

      <div className="relative h-8 w-8 shrink-0" title={`Refreshes in ${secondsLeft}s`}>
        <svg viewBox="0 0 36 36" className="h-8 w-8 -rotate-90" aria-hidden="true">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="#e3dfd3" strokeWidth="3" />
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            stroke={secondsLeft <= 5 ? "#b42318" : "#2f4fb8"}
            strokeWidth="3"
            strokeDasharray={`${(pct / 100) * 97.4} 97.4`}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-muted">
          {secondsLeft}
        </span>
      </div>
    </div>
  );
}

const secretTypeLabel = (value) =>
  SECRET_TYPES.find((t) => t.value === value)?.label || "Other";

// ============================================================
// ICON BUTTONS (favorite / edit / delete)
// ============================================================

function FavoriteButton({ active, onClick, disabled }) {
  return (
    <button
      type="button"
      title={active ? "Remove from favorites" : "Add to favorites"}
      aria-label={active ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      className={`icon-btn ${active ? "!text-warn" : ""}`}
    >
      <i className={active ? "ri-star-fill" : "ri-star-line"} aria-hidden="true" />
    </button>
  );
}

function EditIconButton({ onClick, disabled, label = "Edit" }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="icon-btn"
    >
      <i className="ri-pencil-line" aria-hidden="true" />
    </button>
  );
}

function DeleteIconButton({ onClick, disabled, label = "Delete" }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="icon-btn hover:!bg-danger-tint hover:!text-danger"
    >
      <i className="ri-delete-bin-6-line" aria-hidden="true" />
    </button>
  );
}

// Small text action used for Show / Hide / Copy inside value rows.
function RowAction({ onClick, title, icon, children }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-ink-soft transition-colors hover:bg-sunken hover:text-ink"
    >
      <i className={`${icon} text-[14px]`} aria-hidden="true" />
      {children}
    </button>
  );
}

function EmptyState({ icon, title, body, actionLabel, onAction }) {
  return (
    <div className="panel px-6 py-16 text-center">
      <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-xl bg-sunken text-ink-soft">
        <i className={`${icon} text-[24px]`} aria-hidden="true" />
      </div>
      <h3 className="text-lg font-semibold tracking-tight text-ink">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">{body}</p>
      <button type="button" onClick={onAction} className="btn btn-primary mt-6">
        <i className="ri-add-line text-[18px]" aria-hidden="true" />
        {actionLabel}
      </button>
    </div>
  );
}

const VALUE_ROW =
  "flex items-center justify-between gap-3 rounded-lg border border-line bg-canvas px-3.5 py-2";

export default function Vault({ token }) {
  const [activeTab, setActiveTab] = useState("cards");

  const [cards, setCards] = useState([]);
  const [secrets, setSecrets] = useState([]);
  const [authItems, setAuthItems] = useState([]);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [editAuthItem, setEditAuthItem] = useState(null);

  // Search / filter
  const [searchQuery, setSearchQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [togglingFavoriteId, setTogglingFavoriteId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [editCard, setEditCard] = useState(null);

  const [secretModalOpen, setSecretModalOpen] = useState(false);
  const [editSecret, setEditSecret] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'card'|'secret', item }
  const [deletingId, setDeletingId] = useState(null);

  const [revealedCardFields, setRevealedCardFields] = useState({}); // { [id]: { number, cvv, pin } }
  const [revealedSecrets, setRevealedSecrets] = useState({});

  // Auto-hide sensitive values 10s after they're revealed, for shoulder-surfing safety.
  const AUTO_HIDE_MS = 10000;
  const cardTimersRef = useRef({}); // { "id:field": timeoutId }
  const secretTimersRef = useRef({}); // { id: timeoutId }

  useEffect(() => {
    // Clear all pending auto-hide timers when the page unmounts.
    return () => {
      Object.values(cardTimersRef.current).forEach(clearTimeout);
      Object.values(secretTimersRef.current).forEach(clearTimeout);
    };
  }, []);

  // ============================================================
  // FETCH
  // ============================================================

  const fetchAll = useCallback(async () => {
    if (!token) {
      setCards([]);
      setSecrets([]);
      setAuthItems([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [cardsRes, secretsRes, authRes] = await Promise.all([
        axios.get(`${API_URL}/cards`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 15000,
        }),
        axios.get(`${API_URL}/secrets`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 15000,
        }),
        axios.get(`${API_URL}/totp`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 15000,
        }),
      ]);

      setCards(Array.isArray(cardsRes?.data?.data) ? cardsRes.data.data : []);
      setSecrets(Array.isArray(secretsRes?.data?.data) ? secretsRes.data.data : []);
      setAuthItems(Array.isArray(authRes?.data?.data) ? authRes.data.data : []);
    } catch (err) {
      console.error("FETCH VAULT ERROR:", err);
      const message = getErrorMessage(err, "Failed to load your vault. Please try again.");
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ============================================================
  // CARD HANDLERS
  // ============================================================

  const handleAddCard = () => {
    setEditCard(null);
    setCardModalOpen(true);
  };

  const handleEditCard = (card) => {
    setEditCard(card);
    setCardModalOpen(true);
  };

  const handleCardSaved = async () => {
    setCardModalOpen(false);
    setEditCard(null);
    await fetchAll();
  };

  const toggleCardField = (id, field) => {
    const key = `${id}:${field}`;

    setRevealedCardFields((prev) => {
      const isCurrentlyVisible = Boolean(prev?.[id]?.[field]);
      const nextVisible = !isCurrentlyVisible;

      // Cancel any existing auto-hide timer for this field either way.
      if (cardTimersRef.current[key]) {
        clearTimeout(cardTimersRef.current[key]);
        delete cardTimersRef.current[key];
      }

      if (nextVisible) {
        cardTimersRef.current[key] = setTimeout(() => {
          setRevealedCardFields((current) => ({
            ...current,
            [id]: { ...current[id], [field]: false },
          }));
          delete cardTimersRef.current[key];
        }, AUTO_HIDE_MS);
      }

      return {
        ...prev,
        [id]: { ...prev[id], [field]: nextVisible },
      };
    });
  };

  // ============================================================
  // SECRET HANDLERS
  // ============================================================

  const handleAddSecret = () => {
    setEditSecret(null);
    setSecretModalOpen(true);
  };

  const handleEditSecret = (secret) => {
    setEditSecret(secret);
    setSecretModalOpen(true);
  };

  const handleSecretSaved = async () => {
    setSecretModalOpen(false);
    setEditSecret(null);
    await fetchAll();
  };

  const toggleSecretVisible = (id) => {
    setRevealedSecrets((prev) => {
      const nextVisible = !prev[id];

      if (secretTimersRef.current[id]) {
        clearTimeout(secretTimersRef.current[id]);
        delete secretTimersRef.current[id];
      }

      if (nextVisible) {
        secretTimersRef.current[id] = setTimeout(() => {
          setRevealedSecrets((current) => ({ ...current, [id]: false }));
          delete secretTimersRef.current[id];
        }, AUTO_HIDE_MS);
      }

      return { ...prev, [id]: nextVisible };
    });
  };

  // ============================================================
  // AUTHENTICATOR (TOTP) HANDLERS
  // ============================================================

  const handleAddAuth = () => {
    setEditAuthItem(null);
    setAuthModalOpen(true);
  };

  const handleEditAuth = (item) => {
    setEditAuthItem(item);
    setAuthModalOpen(true);
  };

  const handleAuthSaved = async () => {
    setAuthModalOpen(false);
    setEditAuthItem(null);
    await fetchAll();
  };

  // ============================================================
  // FAVORITE TOGGLE
  // ============================================================

  const toggleFavorite = async (type, item) => {
    const id = getId(item);
    const endpoint = type === "card" ? "cards" : type === "totp" ? "totp" : "secrets";

    try {
      setTogglingFavoriteId(id);
      await axios.put(
        `${API_URL}/${endpoint}/${id}`,
        { ...item, isFavorite: !item.isFavorite },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const updater = (list) =>
        list.map((entry) => (getId(entry) === id ? { ...entry, isFavorite: !entry.isFavorite } : entry));

      if (type === "card") setCards(updater);
      else if (type === "totp") setAuthItems(updater);
      else setSecrets(updater);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update favorite."));
    } finally {
      setTogglingFavoriteId(null);
    }
  };

  // ============================================================
  // SEARCH / FILTER
  // ============================================================

  const matchesQuery = (haystack, query) =>
    !query || haystack.some((v) => String(v || "").toLowerCase().includes(query));

  const filteredCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return cards.filter((c) => {
      if (favoritesOnly && !c.isFavorite) return false;
      return matchesQuery([c.nickname, c.bankName, c.cardholderName, c.category], q);
    });
  }, [cards, searchQuery, favoritesOnly]);

  const filteredSecrets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return secrets.filter((s) => {
      if (favoritesOnly && !s.isFavorite) return false;
      return matchesQuery([s.title, s.issuer, s.category], q);
    });
  }, [secrets, searchQuery, favoritesOnly]);

  const filteredAuthItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return authItems.filter((a) => {
      if (favoritesOnly && !a.isFavorite) return false;
      return matchesQuery([a.issuer, a.accountName, a.category], q);
    });
  }, [authItems, searchQuery, favoritesOnly]);

  // ============================================================
  // COPY
  // ============================================================

  const copyToClipboard = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value || "");
      toast.success(`${label} copied to clipboard`);
    } catch {
      toast.error("Failed to copy.");
    }
  };

  // ============================================================
  // DELETE
  // ============================================================

  const handleDelete = async () => {
    if (!deleteTarget) return;

    const id = getId(deleteTarget.item);
    if (!id) return;

    try {
      setDeletingId(id);

      const endpoint =
        deleteTarget.type === "card"
          ? "cards"
          : deleteTarget.type === "totp"
          ? "totp"
          : "secrets";

      await axios.delete(`${API_URL}/${endpoint}/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const label =
        deleteTarget.type === "card" ? "Card" : deleteTarget.type === "totp" ? "Authenticator" : "Secret";
      toast.success(`${label} deleted`);

      setDeleteTarget(null);
      await fetchAll();
    } catch (err) {
      console.error("DELETE ERROR:", err);
      toast.error(getErrorMessage(err, "Failed to delete. Please try again."));
    } finally {
      setDeletingId(null);
    }
  };

  // ============================================================
  // RENDER
  // ============================================================

  useEscapeKey(() => setDeleteTarget(null), Boolean(deleteTarget) && !deletingId);

  const TABS = [
    { id: "cards", label: "Cards", icon: "ri-bank-card-line", count: cards.length },
    { id: "secrets", label: "Secrets & TPINs", icon: "ri-lock-password-line", count: secrets.length },
    { id: "auth", label: "Authenticator", icon: "ri-shield-keyhole-line", count: authItems.length },
  ];

  const ADD_ACTION = {
    cards: { label: "Add card", onClick: handleAddCard },
    secrets: { label: "Add secret", onClick: handleAddSecret },
    auth: { label: "Add authenticator", onClick: handleAddAuth },
  }[activeTab];

  const deleteNoun =
    deleteTarget?.type === "card"
      ? "card"
      : deleteTarget?.type === "totp"
        ? "authenticator"
        : "secret";

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      {cardModalOpen && (
        <CardForm
          onClose={() => {
            setCardModalOpen(false);
            setEditCard(null);
          }}
          onSaved={handleCardSaved}
          token={token}
          editCard={editCard}
        />
      )}

      {secretModalOpen && (
        <SecretForm
          onClose={() => {
            setSecretModalOpen(false);
            setEditSecret(null);
          }}
          onSaved={handleSecretSaved}
          token={token}
          editSecret={editSecret}
        />
      )}

      {authModalOpen && (
        <AuthenticatorForm
          onClose={() => {
            setAuthModalOpen(false);
            setEditAuthItem(null);
          }}
          onSaved={handleAuthSaved}
          token={token}
          editItem={editAuthItem}
        />
      )}

      {deleteTarget && (
        <div
          className="dialog-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vault-delete-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deletingId) {
              setDeleteTarget(null);
            }
          }}
        >
          <div className="dialog max-w-[420px] p-6">
            <div className="mb-4 grid h-10 w-10 place-items-center rounded-full bg-danger-tint text-danger">
              <i className="ri-delete-bin-6-line text-[20px]" aria-hidden="true" />
            </div>
            <h3 id="vault-delete-title" className="text-lg font-semibold tracking-tight">
              Delete this {deleteNoun}?
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              It will be permanently removed. This can’t be undone.
            </p>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => setDeleteTarget(null)}
                disabled={Boolean(deletingId)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={Boolean(deletingId)}
                className="btn btn-danger min-w-[96px]"
              >
                {deletingId ? (
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
            <h1 className="text-[28px] font-semibold leading-tight tracking-tight">
              Cards & secrets
            </h1>
            <p className="mt-1 max-w-[560px] text-sm text-muted">
              Bank cards, TPINs and one-time-code seeds, encrypted and visible only to you.
            </p>
          </div>

          <button type="button" onClick={ADD_ACTION.onClick} className="btn btn-primary">
            <i className="ri-add-line text-[18px]" aria-hidden="true" />
            {ADD_ACTION.label}
          </button>
        </div>

        {/* TABS */}
        <div
          role="tablist"
          aria-label="Vault sections"
          className="mb-6 flex gap-1 overflow-x-auto border-b border-line"
        >
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3.5 pb-3 pt-2 text-sm font-medium transition-colors ${
                  active
                    ? "border-ink text-ink"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                <i className={`${tab.icon} text-[17px]`} aria-hidden="true" />
                {tab.label}
                <span
                  className={`rounded-full px-1.5 text-xs tabular-nums ${
                    active ? "bg-sunken text-ink" : "text-faint"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* SEARCH & FILTER */}
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
              placeholder="Search by name, bank, issuer or category"
              aria-label="Search vault"
              className="field pl-10"
            />
          </div>
          <button
            type="button"
            onClick={() => setFavoritesOnly((v) => !v)}
            aria-pressed={favoritesOnly}
            className={`btn ${
              favoritesOnly ? "border-warn/40 bg-warn-tint text-warn" : "btn-secondary"
            }`}
          >
            <i
              className={`${favoritesOnly ? "ri-star-fill" : "ri-star-line"} text-[16px]`}
              aria-hidden="true"
            />
            Favorites
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-danger/25 bg-danger-tint p-4"
          >
            <div className="flex items-center gap-3">
              <i className="ri-error-warning-line text-[18px] text-danger" aria-hidden="true" />
              <p className="text-sm text-danger">{error}</p>
            </div>
            <button type="button" onClick={fetchAll} className="btn btn-secondary h-8 px-3 text-[13px]">
              Retry
            </button>
          </div>
        )}

        {loading ? (
          (activeTab === "secrets" ? <TableSkeleton rows={4} label="Loading your vault" /> : <CardGridSkeleton label="Loading your vault" />)
        ) : activeTab === "cards" ? (
          filteredCards.length === 0 ? (
            <EmptyState
              icon="ri-bank-card-line"
              title="No cards saved yet"
              body="Keep debit and credit card details in one encrypted place."
              actionLabel="Add your first card"
              onAction={handleAddCard}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filteredCards.map((card) => {
                const id = getId(card);
                const revealed = revealedCardFields[id] || {};
                const isDeleting = deletingId === id;
                const isCredit = card.cardType === "credit";

                return (
                  <article
                    key={id}
                    className={`panel p-5 ${isDeleting ? "opacity-60" : ""}`}
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-[15px] font-semibold text-ink">
                          {card.nickname || card.bankName}
                        </h3>
                        <p className="mt-0.5 truncate text-[13px] text-muted">
                          {card.bankName} · {card.cardholderName}
                        </p>
                        <span
                          className={`mt-2 inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                            isCredit ? "bg-accent-tint text-accent" : "bg-sunken text-ink-soft"
                          }`}
                        >
                          {isCredit ? "Credit" : "Debit"}
                        </span>
                      </div>
                      <div className="flex shrink-0 gap-0.5">
                        <FavoriteButton
                          active={Boolean(card.isFavorite)}
                          disabled={togglingFavoriteId === id}
                          onClick={() => toggleFavorite("card", card)}
                        />
                        <EditIconButton
                          label="Edit card"
                          disabled={isDeleting}
                          onClick={() => handleEditCard(card)}
                        />
                        <DeleteIconButton
                          label="Delete card"
                          disabled={isDeleting}
                          onClick={() => setDeleteTarget({ type: "card", item: card })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2 text-[13px]">
                      <div className={VALUE_ROW}>
                        <span className="min-w-0 truncate font-mono tracking-wider text-ink">
                          {revealed.number
                            ? card.cardNumber?.replace(/(.{4})/g, "$1 ").trim()
                            : card.maskedCardNumber || "•••• •••• •••• ••••"}
                        </span>
                        <div className="flex shrink-0 gap-0.5">
                          <RowAction
                            title={revealed.number ? "Auto-hides in 10s" : "Show card number"}
                            icon={revealed.number ? "ri-eye-off-line" : "ri-eye-line"}
                            onClick={() => toggleCardField(id, "number")}
                          >
                            {revealed.number ? "Hide" : "Show"}
                          </RowAction>
                          <RowAction
                            title="Copy card number"
                            icon="ri-file-copy-line"
                            onClick={() => copyToClipboard(card.cardNumber, "Card number")}
                          >
                            Copy
                          </RowAction>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <div className={`${VALUE_ROW} flex-1`}>
                          <span className="text-muted">
                            Exp {card.expiryMonth}/{card.expiryYear}
                          </span>
                        </div>
                        <div className={`${VALUE_ROW} flex-1`}>
                          <span className="font-mono text-ink">
                            {revealed.cvv ? card.cvv : "•••"}
                          </span>
                          <RowAction
                            title={revealed.cvv ? "Auto-hides in 10s" : "Show CVV"}
                            icon={revealed.cvv ? "ri-eye-off-line" : "ri-eye-line"}
                            onClick={() => toggleCardField(id, "cvv")}
                          >
                            {revealed.cvv ? "Hide" : "CVV"}
                          </RowAction>
                        </div>
                      </div>

                      {card.pin && (
                        <div className={VALUE_ROW}>
                          <span className="text-muted">
                            PIN{" "}
                            <span className="ml-1 font-mono text-ink">
                              {revealed.pin ? card.pin : "••••"}
                            </span>
                          </span>
                          <div className="flex shrink-0 gap-0.5">
                            <RowAction
                              title={revealed.pin ? "Auto-hides in 10s" : "Show PIN"}
                              icon={revealed.pin ? "ri-eye-off-line" : "ri-eye-line"}
                              onClick={() => toggleCardField(id, "pin")}
                            >
                              {revealed.pin ? "Hide" : "Show"}
                            </RowAction>
                            <RowAction
                              title="Copy PIN"
                              icon="ri-file-copy-line"
                              onClick={() => copyToClipboard(card.pin, "PIN")}
                            >
                              Copy
                            </RowAction>
                          </div>
                        </div>
                      )}

                      {card.notes && (
                        <p className="pt-1 text-[13px] text-muted">{card.notes}</p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )
        ) : activeTab === "secrets" ? (
          filteredSecrets.length === 0 ? (
            <EmptyState
              icon="ri-lock-password-line"
              title="No secrets saved yet"
              body="Store TPINs, UPI PINs, security answers or any other sensitive code."
              actionLabel="Add your first secret"
              onAction={handleAddSecret}
            />
          ) : (
            <div className="panel overflow-hidden">
              <div className="hidden grid-cols-12 gap-4 border-b border-line bg-sunken/60 px-6 py-3 text-xs font-medium text-muted md:grid">
                <div className="col-span-3">Title</div>
                <div className="col-span-2">Type</div>
                <div className="col-span-2">Issuer</div>
                <div className="col-span-3">Value</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>

              <ul className="divide-y divide-line">
                {filteredSecrets.map((secret) => {
                  const id = getId(secret);
                  const isVisible = Boolean(revealedSecrets[id]);
                  const isDeleting = deletingId === id;

                  return (
                    <li
                      key={id}
                      className={`grid grid-cols-1 items-center gap-2 px-4 py-4 transition-colors hover:bg-canvas/70 md:grid-cols-12 md:gap-4 md:px-6 ${
                        isDeleting ? "opacity-60" : ""
                      }`}
                    >
                      <div className="truncate text-sm font-medium text-ink md:col-span-3">
                        {secret.title}
                      </div>
                      <div className="text-[13px] text-muted md:col-span-2">
                        {secretTypeLabel(secret.secretType)}
                      </div>
                      <div className="truncate text-[13px] text-muted md:col-span-2">
                        {secret.issuer || "—"}
                      </div>
                      <div className="flex min-w-0 items-center gap-1 md:col-span-3">
                        <span className="min-w-0 truncate font-mono text-[13px] text-ink">
                          {isVisible
                            ? secret.value
                            : "•".repeat(Math.max(String(secret.value || "").length, 4))}
                        </span>
                        <RowAction
                          title={isVisible ? "Auto-hides in 10s" : "Show value"}
                          icon={isVisible ? "ri-eye-off-line" : "ri-eye-line"}
                          onClick={() => toggleSecretVisible(id)}
                        >
                          <span className="sr-only">{isVisible ? "Hide" : "Show"}</span>
                        </RowAction>
                        <RowAction
                          title="Copy value"
                          icon="ri-file-copy-line"
                          onClick={() => copyToClipboard(secret.value, "Value")}
                        >
                          <span className="sr-only">Copy</span>
                        </RowAction>
                      </div>
                      <div className="flex justify-end gap-0.5 md:col-span-2">
                        <FavoriteButton
                          active={Boolean(secret.isFavorite)}
                          disabled={togglingFavoriteId === id}
                          onClick={() => toggleFavorite("secret", secret)}
                        />
                        <EditIconButton
                          label="Edit secret"
                          disabled={isDeleting}
                          onClick={() => handleEditSecret(secret)}
                        />
                        <DeleteIconButton
                          label="Delete secret"
                          disabled={isDeleting}
                          onClick={() => setDeleteTarget({ type: "secret", item: secret })}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )
        ) : filteredAuthItems.length === 0 ? (
          <EmptyState
            icon="ri-shield-keyhole-line"
            title="No authenticators yet"
            body="Store a TOTP secret to get live 6-digit codes for another site’s two-factor login."
            actionLabel="Add your first authenticator"
            onAction={handleAddAuth}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filteredAuthItems.map((item) => {
              const id = getId(item);
              const isDeleting = deletingId === id;

              return (
                <article
                  key={id}
                  className={`panel p-5 ${isDeleting ? "opacity-60" : ""}`}
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-[15px] font-semibold text-ink">
                        {item.issuer}
                      </h3>
                      {item.accountName && (
                        <p className="mt-0.5 truncate text-[13px] text-muted">
                          {item.accountName}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-0.5">
                      <FavoriteButton
                        active={Boolean(item.isFavorite)}
                        disabled={togglingFavoriteId === id}
                        onClick={() => toggleFavorite("totp", item)}
                      />
                      <EditIconButton
                        label="Edit authenticator"
                        disabled={isDeleting}
                        onClick={() => handleEditAuth(item)}
                      />
                      <DeleteIconButton
                        label="Delete authenticator"
                        disabled={isDeleting}
                        onClick={() => setDeleteTarget({ type: "totp", item })}
                      />
                    </div>
                  </div>
                  <TotpCodeDisplay secret={item.secret} />
                  {item.notes && (
                    <p className="pt-3 text-[13px] text-muted">{item.notes}</p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
