import axios from "axios";
import React, { useCallback, useEffect, useState } from "react";
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
    setRevealedCardFields((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: !prev?.[id]?.[field] },
    }));
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
    setRevealedSecrets((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // ============================================================
  // COPY
  // ============================================================

  const copyToClipboard = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value || "");
      toast.success(`${label} copied to clipboard.`);
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

      toast.success(
        deleteTarget.type === "card" ? "Card deleted." : "Secret deleted.",
      );

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
    <div className="min-h-screen bg-[#f9f9ff] font-['Inter',sans-serif] text-[#191b23]">
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
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deletingId) {
              setDeleteTarget(null);
            }
          }}
        >
          <div className="w-full max-w-[420px] bg-white rounded-[16px] shadow-2xl border border-[#e1e2ec] p-6">
            <h3 className="text-[20px] font-bold text-[#191b23]">
              Delete {deleteTarget.type === "card" ? "card" : "secret"}?
            </h3>
            <p className="text-[14px] text-[#727785] mt-2 leading-6">
              This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={Boolean(deletingId)}
                className="px-4 py-2.5 rounded-[8px] bg-[#f2f3fd] hover:bg-[#e1e2ec] text-[#191b23] text-[14px] font-semibold disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={Boolean(deletingId)}
                className="min-w-[90px] px-4 py-2.5 rounded-[8px] bg-[#ba1a1a] hover:bg-[#93000a] text-white text-[14px] font-semibold disabled:opacity-50"
              >
                {deletingId ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-[1200px] mx-auto px-[20px] md:px-[32px] pt-[48px] pb-[120px]">
        <div className="mb-8">
          <h2 className="text-[32px] font-bold font-['Manrope',sans-serif] text-[#191b23]">
            Card &amp; Secrets Vault
          </h2>
          <p className="text-[16px] text-[#424754] mt-2">
            Debit / credit cards, TPINs, and other sensitive codes — encrypted at rest.
          </p>
        </div>

        {/* TABS */}
        <div className="flex gap-2 mb-6 border-b border-[#e1e2ec]">
          <button
            type="button"
            onClick={() => setActiveTab("cards")}
            className={`px-4 py-3 text-[14px] font-semibold border-b-2 transition-colors ${
              activeTab === "cards"
                ? "border-[#0058be] text-[#0058be]"
                : "border-transparent text-[#727785] hover:text-[#191b23]"
            }`}
          >
            💳 Cards ({cards.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("secrets")}
            className={`px-4 py-3 text-[14px] font-semibold border-b-2 transition-colors ${
              activeTab === "secrets"
                ? "border-[#0058be] text-[#0058be]"
                : "border-transparent text-[#727785] hover:text-[#191b23]"
            }`}
          >
            🔑 Secrets &amp; TPINs ({secrets.length})
          </button>
        </div>

        {error && (
          <div className="bg-[#ffdad6] border border-[#ba1a1a] rounded-[12px] p-4 mb-6 flex items-center justify-between gap-4">
            <p className="text-[13px] text-[#ba1a1a]">{error}</p>
            <button
              type="button"
              onClick={fetchAll}
              className="text-[12px] font-semibold text-[#ba1a1a] hover:underline whitespace-nowrap"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-[16px] border border-[#e1e2ec] p-12 text-center">
            <div className="w-10 h-10 border-4 border-[#e1e2ec] border-t-[#0058be] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-[15px] text-[#727785] font-medium">Loading your vault...</p>
          </div>
        ) : activeTab === "cards" ? (
          <>
            <div className="flex justify-end mb-4">
              <button
                type="button"
                onClick={handleAddCard}
                className="bg-[#0058be] hover:bg-[#004395] text-white px-5 py-2.5 rounded-[10px] text-[14px] font-semibold"
              >
                + Add Card
              </button>
            </div>

            {cards.length === 0 ? (
              <div className="bg-white rounded-[16px] border border-[#e1e2ec] p-14 text-center">
                <div className="w-14 h-14 bg-[#e0e7ff] rounded-full flex items-center justify-center mx-auto mb-5 text-[22px]">
                  💳
                </div>
                <h3 className="text-[18px] font-semibold text-[#191b23] mb-2">No cards yet</h3>
                <p className="text-[14px] text-[#727785] mb-5">
                  Add your debit or credit card details to keep them safe.
                </p>
                <button
                  type="button"
                  onClick={handleAddCard}
                  className="bg-[#0058be] hover:bg-[#004395] text-white px-5 py-2.5 rounded-[8px] text-[14px] font-semibold"
                >
                  + Add your first card
                </button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {cards.map((card) => {
                  const id = getId(card);
                  const revealed = revealedCardFields[id] || {};
                  const isDeleting = deletingId === id;

                  return (
                    <div
                      key={id}
                      className={`bg-white rounded-[16px] border border-[#e1e2ec] shadow-[0_4px_20px_rgba(15,23,42,0.03)] p-5 ${
                        isDeleting ? "opacity-60" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <span
                            className={`inline-block text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full mb-1 ${
                              card.cardType === "credit"
                                ? "bg-[#fef3c7] text-[#92400e]"
                                : "bg-[#e0e7ff] text-[#3730a3]"
                            }`}
                          >
                            {card.cardType}
                          </span>
                          <h3 className="text-[15px] font-semibold text-[#191b23]">
                            {card.nickname || card.bankName}
                          </h3>
                          <p className="text-[12px] text-[#727785]">
                            {card.bankName} · {card.cardholderName}
                          </p>
                        </div>

                        <div className="flex gap-1">
                          <button
                            type="button"
                            title="Edit"
                            onClick={() => handleEditCard(card)}
                            className="p-1.5 text-[#727785] hover:text-[#191b23] hover:bg-[#f2f3fd] rounded-md"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            title="Delete"
                            onClick={() => setDeleteTarget({ type: "card", item: card })}
                            className="p-1.5 text-[#727785] hover:text-[#ba1a1a] hover:bg-[#fdecea] rounded-md"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2.5 text-[13px]">
                        <div className="flex items-center justify-between bg-[#f9f9ff] border border-[#e1e2ec] rounded-[10px] px-3 py-2">
                          <span className="font-mono tracking-wider text-[#191b23]">
                            {revealed.number
                              ? card.cardNumber?.replace(/(.{4})/g, "$1 ").trim()
                              : card.maskedCardNumber || "•••• •••• •••• ••••"}
                          </span>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => toggleCardField(id, "number")}
                              className="text-[11px] text-[#0058be] font-medium"
                            >
                              {revealed.number ? "Hide" : "Show"}
                            </button>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(card.cardNumber, "Card number")}
                              className="text-[11px] text-[#0058be] font-medium"
                            >
                              Copy
                            </button>
                          </div>
                        </div>

                        <div className="flex gap-2.5">
                          <div className="flex-1 flex items-center justify-between bg-[#f9f9ff] border border-[#e1e2ec] rounded-[10px] px-3 py-2">
                            <span className="text-[#727785]">
                              Exp {card.expiryMonth}/{card.expiryYear}
                            </span>
                          </div>

                          <div className="flex-1 flex items-center justify-between bg-[#f9f9ff] border border-[#e1e2ec] rounded-[10px] px-3 py-2">
                            <span className="font-mono text-[#191b23]">
                              {revealed.cvv ? card.cvv : "•••"}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleCardField(id, "cvv")}
                              className="text-[11px] text-[#0058be] font-medium"
                            >
                              {revealed.cvv ? "Hide" : "CVV"}
                            </button>
                          </div>
                        </div>

                        {card.pin && (
                          <div className="flex items-center justify-between bg-[#f9f9ff] border border-[#e1e2ec] rounded-[10px] px-3 py-2">
                            <span className="text-[#727785]">
                              PIN:{" "}
                              <span className="font-mono text-[#191b23]">
                                {revealed.pin ? card.pin : "••••"}
                              </span>
                            </span>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => toggleCardField(id, "pin")}
                                className="text-[11px] text-[#0058be] font-medium"
                              >
                                {revealed.pin ? "Hide" : "Show"}
                              </button>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(card.pin, "PIN")}
                                className="text-[11px] text-[#0058be] font-medium"
                              >
                                Copy
                              </button>
                            </div>
                          </div>
                        )}

                        {card.notes && (
                          <p className="text-[12px] text-[#727785] italic pt-1">{card.notes}</p>
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
            <div className="flex justify-end mb-4">
              <button
                type="button"
                onClick={handleAddSecret}
                className="bg-[#0058be] hover:bg-[#004395] text-white px-5 py-2.5 rounded-[10px] text-[14px] font-semibold"
              >
                + Add Secret
              </button>
            </div>

            {secrets.length === 0 ? (
              <div className="bg-white rounded-[16px] border border-[#e1e2ec] p-14 text-center">
                <div className="w-14 h-14 bg-[#e0e7ff] rounded-full flex items-center justify-center mx-auto mb-5 text-[22px]">
                  🔑
                </div>
                <h3 className="text-[18px] font-semibold text-[#191b23] mb-2">No secrets yet</h3>
                <p className="text-[14px] text-[#727785] mb-5">
                  Save TPINs, UPI PINs, security answers, or any other sensitive code.
                </p>
                <button
                  type="button"
                  onClick={handleAddSecret}
                  className="bg-[#0058be] hover:bg-[#004395] text-white px-5 py-2.5 rounded-[8px] text-[14px] font-semibold"
                >
                  + Add your first secret
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-[16px] border border-[#e1e2ec] shadow-[0_4px_20px_rgba(15,23,42,0.03)] overflow-hidden">
                <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 border-b border-[#e1e2ec] bg-[#f9f9ff]/50 text-[12px] font-semibold text-[#727785] uppercase tracking-wide">
                  <div className="col-span-3">Title</div>
                  <div className="col-span-2">Type</div>
                  <div className="col-span-2">Issuer</div>
                  <div className="col-span-3">Value</div>
                  <div className="col-span-2 text-right">Actions</div>
                </div>

                <div className="flex flex-col divide-y divide-[#e1e2ec]">
                  {secrets.map((secret) => {
                    const id = getId(secret);
                    const isVisible = Boolean(revealedSecrets[id]);
                    const isDeleting = deletingId === id;

                    return (
                      <div
                        key={id}
                        className={`grid grid-cols-1 md:grid-cols-12 gap-4 items-center px-5 md:px-6 py-4 hover:bg-[#f2f3fd]/50 ${
                          isDeleting ? "opacity-60" : ""
                        }`}
                      >
                        <div className="md:col-span-3 font-semibold text-[14px] text-[#191b23] truncate">
                          {secret.title}
                        </div>
                        <div className="md:col-span-2 text-[13px] text-[#424754]">
                          {secretTypeLabel(secret.secretType)}
                        </div>
                        <div className="md:col-span-2 text-[13px] text-[#424754] truncate">
                          {secret.issuer || "—"}
                        </div>
                        <div className="md:col-span-3 flex items-center gap-2">
                          <span className="font-mono text-[13px] text-[#191b23]">
                            {isVisible ? secret.value : "•".repeat(Math.max(String(secret.value || "").length, 4))}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleSecretVisible(id)}
                            className="text-[11px] text-[#0058be] font-medium"
                          >
                            {isVisible ? "Hide" : "Show"}
                          </button>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(secret.value, "Value")}
                            className="text-[11px] text-[#0058be] font-medium"
                          >
                            Copy
                          </button>
                        </div>
                        <div className="md:col-span-2 flex justify-end gap-1">
                          <button
                            type="button"
                            title="Edit"
                            onClick={() => handleEditSecret(secret)}
                            className="p-1.5 text-[#727785] hover:text-[#191b23] hover:bg-[#f2f3fd] rounded-md"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            title="Delete"
                            onClick={() => setDeleteTarget({ type: "secret", item: secret })}
                            className="p-1.5 text-[#727785] hover:text-[#ba1a1a] hover:bg-[#fdecea] rounded-md"
                          >
                            🗑️
                          </button>
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
