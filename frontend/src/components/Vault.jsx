import axios from "axios";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import CardForm from "./CardForm";
import SecretForm, { SECRET_TYPES } from "./SecretForm";

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

const secretTypeLabel = (value) =>
  SECRET_TYPES.find((t) => t.value === value)?.label || "Other";

// ============================================================
// PREMIUM ICON BUTTONS (edit / delete)
// ============================================================

function EditIconButton({ onClick, disabled, label = "Edit" }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="group/edit relative p-2 rounded-[10px] border border-transparent text-[#A8A4BD] bg-white/[0.03] hover:bg-[#8B72FF]/15 hover:border-[#8B72FF]/30 hover:text-[#C9BFFF] active:scale-90 transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none"
    >
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
        className="transition-transform duration-150 group-hover/edit:-translate-y-0.5"
      >
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
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
      className="group/del relative p-2 rounded-[10px] border border-transparent text-[#A8A4BD] bg-white/[0.03] hover:bg-[#F87171]/15 hover:border-[#F87171]/30 hover:text-[#F87171] active:scale-90 transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none"
    >
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
        className="transition-transform duration-150 group-hover/del:rotate-6"
      >
        <path d="M3 6h18" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
      </svg>
    </button>
  );
}

export default function Vault({ token }) {
  const [activeTab, setActiveTab] = useState("cards");

  const [cards, setCards] = useState([]);
  const [secrets, setSecrets] = useState([]);
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
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [cardsRes, secretsRes] = await Promise.all([
        axios.get(`${API_URL}/cards`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 15000,
        }),
        axios.get(`${API_URL}/secrets`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 15000,
        }),
      ]);

      setCards(Array.isArray(cardsRes?.data?.data) ? cardsRes.data.data : []);
      setSecrets(Array.isArray(secretsRes?.data?.data) ? secretsRes.data.data : []);
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

      const endpoint = deleteTarget.type === "card" ? "cards" : "secrets";

      await axios.delete(`${API_URL}/${endpoint}/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.success(deleteTarget.type === "card" ? "Card deleted" : "Secret deleted");

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

  return (
    <div className="relative min-h-screen bg-[#0A0810] font-['Inter',sans-serif] text-[#F5F3FF] overflow-x-hidden">
      {/* Ambient premium glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-[420px] w-[420px] rounded-full bg-[#8B72FF]/20 blur-[120px]" />
        <div className="absolute top-1/3 -right-20 h-[380px] w-[380px] rounded-full bg-[#FBBF24]/10 blur-[130px]" />
        <div className="absolute bottom-0 left-0 h-[300px] w-[300px] rounded-full bg-[#8B72FF]/10 blur-[100px]" />
      </div>

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

      {deleteTarget && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deletingId) {
              setDeleteTarget(null);
            }
          }}
        >
          <div className="w-full max-w-[420px] bg-[#130F1F]/95 backdrop-blur-xl rounded-[20px] shadow-2xl border border-white/10 p-6">
            <div className="w-12 h-12 rounded-full bg-[#3F1013] flex items-center justify-center mb-4 text-[20px]">
              🗑️
            </div>
            <h3 className="text-[20px] font-bold text-[#F5F3FF]">
              Delete {deleteTarget.type === "card" ? "card" : "secret"}?
            </h3>
            <p className="text-[14px] text-[#A8A4BD] mt-2 leading-6">
              This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={Boolean(deletingId)}
                className="px-4 py-2.5 rounded-[10px] bg-white/5 hover:bg-white/10 text-[#F5F3FF] text-[14px] font-semibold disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={Boolean(deletingId)}
                className="min-w-[90px] px-4 py-2.5 rounded-[10px] bg-[#F87171] hover:bg-[#B91C1C] text-[#1a0505] text-[14px] font-semibold disabled:opacity-50 transition-colors"
              >
                {deletingId ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="relative max-w-[1200px] mx-auto px-[20px] md:px-[32px] pt-[56px] pb-[120px]">
        {/* HERO HEADER */}
        <div className="mb-10 flex flex-col gap-2">
          <span className="inline-flex items-center gap-1.5 w-fit text-[11px] font-semibold uppercase tracking-[0.12em] text-[#FBBF24] bg-[#3A2A08] px-3 py-1 rounded-full border border-[#FBBF24]/20">
            ✦ Premium Vault
          </span>
          <h2 className="text-[34px] md:text-[38px] font-extrabold font-['Manrope',sans-serif] bg-gradient-to-r from-white via-[#F5F3FF] to-[#C9BFFF] bg-clip-text text-transparent">
            Card &amp; Secrets Vault
          </h2>
          <p className="text-[15px] text-[#A8A4BD] max-w-[560px]">
            Debit / credit cards, TPINs, and other sensitive codes — encrypted end-to-end and visible only to you.
          </p>
        </div>

        {/* TABS */}
        <div className="inline-flex p-1 mb-8 rounded-[14px] bg-white/[0.04] border border-white/10 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setActiveTab("cards")}
            className={`px-5 py-2.5 text-[14px] font-semibold rounded-[10px] transition-all ${
              activeTab === "cards"
                ? "bg-gradient-to-r from-[#8B72FF] to-[#6D5AE0] text-white shadow-[0_4px_16px_rgba(139,114,255,0.35)]"
                : "text-[#A8A4BD] hover:text-white"
            }`}
          >
            💳 Cards <span className="opacity-70">({cards.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("secrets")}
            className={`px-5 py-2.5 text-[14px] font-semibold rounded-[10px] transition-all ${
              activeTab === "secrets"
                ? "bg-gradient-to-r from-[#8B72FF] to-[#6D5AE0] text-white shadow-[0_4px_16px_rgba(139,114,255,0.35)]"
                : "text-[#A8A4BD] hover:text-white"
            }`}
          >
            🔑 Secrets &amp; TPINs <span className="opacity-70">({secrets.length})</span>
          </button>
        </div>

        {error && (
          <div className="bg-[#3F1013] border border-[#F87171]/30 rounded-[14px] p-4 mb-6 flex items-center justify-between gap-4">
            <p className="text-[13px] text-[#F87171]">{error}</p>
            <button
              type="button"
              onClick={fetchAll}
              className="text-[12px] font-semibold text-[#F87171] hover:underline whitespace-nowrap"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="bg-white/[0.03] backdrop-blur-xl rounded-[20px] border border-white/10 p-16 text-center">
            <div className="w-10 h-10 border-4 border-white/10 border-t-[#8B72FF] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-[15px] text-[#A8A4BD] font-medium">Loading your vault...</p>
          </div>
        ) : activeTab === "cards" ? (
          <>
            <div className="flex justify-end mb-5">
              <button
                type="button"
                onClick={handleAddCard}
                className="bg-gradient-to-r from-[#8B72FF] to-[#6D5AE0] hover:from-[#9c86ff] hover:to-[#7c68ec] text-white px-5 py-2.5 rounded-[12px] text-[14px] font-semibold shadow-[0_4px_16px_rgba(139,114,255,0.3)] transition-all hover:-translate-y-0.5"
              >
                + Add Card
              </button>
            </div>

            {cards.length === 0 ? (
              <div className="bg-white/[0.03] backdrop-blur-xl rounded-[20px] border border-white/10 p-16 text-center">
                <div className="w-16 h-16 bg-[#8B72FF]/15 rounded-full flex items-center justify-center mx-auto mb-5 text-[26px]">
                  💳
                </div>
                <h3 className="text-[18px] font-semibold text-[#F5F3FF] mb-2">No cards yet</h3>
                <p className="text-[14px] text-[#A8A4BD] mb-6">
                  Add your debit or credit card details to keep them safe.
                </p>
                <button
                  type="button"
                  onClick={handleAddCard}
                  className="bg-gradient-to-r from-[#8B72FF] to-[#6D5AE0] hover:from-[#9c86ff] hover:to-[#7c68ec] text-white px-5 py-2.5 rounded-[12px] text-[14px] font-semibold transition-all"
                >
                  + Add your first card
                </button>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                {cards.map((card) => {
                  const id = getId(card);
                  const revealed = revealedCardFields[id] || {};
                  const isDeleting = deletingId === id;
                  const isCredit = card.cardType === "credit";

                  return (
                    <div
                      key={id}
                      className={`relative overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.35)] p-5 transition-all hover:border-white/20 ${
                        isDeleting ? "opacity-60" : ""
                      }`}
                    >
                      {/* Decorative gradient stripe */}
                      <div
                        className={`absolute -top-16 -right-16 h-40 w-40 rounded-full blur-3xl opacity-30 ${
                          isCredit ? "bg-[#FBBF24]" : "bg-[#8B72FF]"
                        }`}
                      />

                      <div className="relative flex items-start justify-between mb-4">
                        <div>
                          <span
                            className={`inline-block text-[10px] font-bold uppercase tracking-[0.08em] px-2.5 py-1 rounded-full mb-2 ${
                              isCredit
                                ? "bg-[#3A2A08] text-[#FBBF24] border border-[#FBBF24]/20"
                                : "bg-[#8B72FF]/15 text-[#C9BFFF] border border-[#8B72FF]/20"
                            }`}
                          >
                            {isCredit ? "✦ Credit" : "Debit"}
                          </span>
                          <h3 className="text-[16px] font-bold text-[#F5F3FF]">
                            {card.nickname || card.bankName}
                          </h3>
                          <p className="text-[12px] text-[#A8A4BD]">
                            {card.bankName} · {card.cardholderName}
                          </p>
                        </div>

                        <div className="flex gap-1.5">
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

                      <div className="relative space-y-2.5 text-[13px]">
                        <div className="flex items-center justify-between bg-black/20 border border-white/10 rounded-[12px] px-3.5 py-2.5">
                          <span className="font-mono tracking-wider text-[#F5F3FF]">
                            {revealed.number
                              ? card.cardNumber?.replace(/(.{4})/g, "$1 ").trim()
                              : card.maskedCardNumber || "•••• •••• •••• ••••"}
                          </span>
                          <div className="flex gap-2.5">
                            <button
                              type="button"
                              title={revealed.number ? "Auto-hides in 10s" : "Show"}
                              onClick={() => toggleCardField(id, "number")}
                              className="text-[11px] text-[#C9BFFF] hover:text-white font-medium"
                            >
                              {revealed.number ? "Hide" : "Show"}
                            </button>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(card.cardNumber, "Card number")}
                              className="text-[11px] text-[#C9BFFF] hover:text-white font-medium"
                            >
                              Copy
                            </button>
                          </div>
                        </div>

                        <div className="flex gap-2.5">
                          <div className="flex-1 flex items-center justify-between bg-black/20 border border-white/10 rounded-[12px] px-3.5 py-2.5">
                            <span className="text-[#A8A4BD]">
                              Exp {card.expiryMonth}/{card.expiryYear}
                            </span>
                          </div>

                          <div className="flex-1 flex items-center justify-between bg-black/20 border border-white/10 rounded-[12px] px-3.5 py-2.5">
                            <span className="font-mono text-[#F5F3FF]">
                              {revealed.cvv ? card.cvv : "•••"}
                            </span>
                            <button
                              type="button"
                              title={revealed.cvv ? "Auto-hides in 10s" : "Show CVV"}
                              onClick={() => toggleCardField(id, "cvv")}
                              className="text-[11px] text-[#C9BFFF] hover:text-white font-medium"
                            >
                              {revealed.cvv ? "Hide" : "CVV"}
                            </button>
                          </div>
                        </div>

                        {card.pin && (
                          <div className="flex items-center justify-between bg-black/20 border border-white/10 rounded-[12px] px-3.5 py-2.5">
                            <span className="text-[#A8A4BD]">
                              PIN:{" "}
                              <span className="font-mono text-[#F5F3FF]">
                                {revealed.pin ? card.pin : "••••"}
                              </span>
                            </span>
                            <div className="flex gap-2.5">
                              <button
                                type="button"
                                title={revealed.pin ? "Auto-hides in 10s" : "Show"}
                                onClick={() => toggleCardField(id, "pin")}
                                className="text-[11px] text-[#C9BFFF] hover:text-white font-medium"
                              >
                                {revealed.pin ? "Hide" : "Show"}
                              </button>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(card.pin, "PIN")}
                                className="text-[11px] text-[#C9BFFF] hover:text-white font-medium"
                              >
                                Copy
                              </button>
                            </div>
                          </div>
                        )}

                        {card.notes && (
                          <p className="text-[12px] text-[#A8A4BD] italic pt-1">{card.notes}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex justify-end mb-5">
              <button
                type="button"
                onClick={handleAddSecret}
                className="bg-gradient-to-r from-[#8B72FF] to-[#6D5AE0] hover:from-[#9c86ff] hover:to-[#7c68ec] text-white px-5 py-2.5 rounded-[12px] text-[14px] font-semibold shadow-[0_4px_16px_rgba(139,114,255,0.3)] transition-all hover:-translate-y-0.5"
              >
                + Add Secret
              </button>
            </div>

            {secrets.length === 0 ? (
              <div className="bg-white/[0.03] backdrop-blur-xl rounded-[20px] border border-white/10 p-16 text-center">
                <div className="w-16 h-16 bg-[#8B72FF]/15 rounded-full flex items-center justify-center mx-auto mb-5 text-[26px]">
                  🔑
                </div>
                <h3 className="text-[18px] font-semibold text-[#F5F3FF] mb-2">No secrets yet</h3>
                <p className="text-[14px] text-[#A8A4BD] mb-6">
                  Save TPINs, UPI PINs, security answers, or any other sensitive code.
                </p>
                <button
                  type="button"
                  onClick={handleAddSecret}
                  className="bg-gradient-to-r from-[#8B72FF] to-[#6D5AE0] hover:from-[#9c86ff] hover:to-[#7c68ec] text-white px-5 py-2.5 rounded-[12px] text-[14px] font-semibold transition-all"
                >
                  + Add your first secret
                </button>
              </div>
            ) : (
              <div className="bg-white/[0.03] backdrop-blur-xl rounded-[20px] border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.35)] overflow-hidden">
                <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 border-b border-white/10 bg-black/20 text-[12px] font-semibold text-[#A8A4BD] uppercase tracking-wide">
                  <div className="col-span-3">Title</div>
                  <div className="col-span-2">Type</div>
                  <div className="col-span-2">Issuer</div>
                  <div className="col-span-3">Value</div>
                  <div className="col-span-2 text-right">Actions</div>
                </div>

                <div className="flex flex-col divide-y divide-white/10">
                  {secrets.map((secret) => {
                    const id = getId(secret);
                    const isVisible = Boolean(revealedSecrets[id]);
                    const isDeleting = deletingId === id;

                    return (
                      <div
                        key={id}
                        className={`grid grid-cols-1 md:grid-cols-12 gap-4 items-center px-5 md:px-6 py-4 hover:bg-white/[0.04] transition-colors ${
                          isDeleting ? "opacity-60" : ""
                        }`}
                      >
                        <div className="md:col-span-3 font-semibold text-[14px] text-[#F5F3FF] truncate">
                          {secret.title}
                        </div>
                        <div className="md:col-span-2 text-[13px] text-[#A8A4BD]">
                          {secretTypeLabel(secret.secretType)}
                        </div>
                        <div className="md:col-span-2 text-[13px] text-[#A8A4BD] truncate">
                          {secret.issuer || "—"}
                        </div>
                        <div className="md:col-span-3 flex items-center gap-2.5">
                          <span className="font-mono text-[13px] text-[#F5F3FF]">
                            {isVisible ? secret.value : "•".repeat(Math.max(String(secret.value || "").length, 4))}
                          </span>
                          <button
                            type="button"
                            title={isVisible ? "Auto-hides in 10s" : "Show"}
                            onClick={() => toggleSecretVisible(id)}
                            className="text-[11px] text-[#C9BFFF] hover:text-white font-medium"
                          >
                            {isVisible ? "Hide" : "Show"}
                          </button>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(secret.value, "Value")}
                            className="text-[11px] text-[#C9BFFF] hover:text-white font-medium"
                          >
                            Copy
                          </button>
                        </div>
                        <div className="md:col-span-2 flex justify-end gap-1.5">
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
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
