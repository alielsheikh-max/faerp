"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { saveBatchPriceEntriesSilent, submitPriceChangeRequestAction, extendPreviousMonthPricesAction, saveNegotiatedPriceAction } from "@/app/actions/pricing";
import { shiftMonth, formatMonthLabel, formatCurrency } from "@/lib/format";
import { ItemCombobox } from "./item-combobox";
import { useI18n } from "@/lib/i18n-context";

export type Category    = { id: number; name: string; description: string };
export type Item        = { id: number; name: string; unit: string; category_id: number; category_name: string; transportation_per_unit?: number; moq?: number };
export type Supplier    = { id: number; name: string; fame_name?: string | null; contact_person?: string; phone?: string; category_ids: number[] };
type HistoryEntry = { item_id: number; supplier_id: number; month: string; price: number; recorded_at: string; collected_role: string; supplier_name: string; notes: string | null; actual_transport?: number | null; negotiated_price?: number | null; negotiated_notes?: string | null; status: string; review_note?: string | null };
type HistoryFilter = "3" | "6" | "all";

type Props = {
  categories: Category[];
  items: Item[];
  suppliers: Supplier[];
  month: string;
  role: string;
  displayName: string;
  purchasingHistory: HistoryEntry[];
  wasSaved?: boolean;
  initialCategoryId?: string;
  initialItemId?: string;
};

const COLORS = ["#3b82f6","#ef4444","#10b981","#f59e0b","#8b5cf6","#06b6d4"];

// Modal for submitting a price change / transport revision request
const PRICE_PRESETS = ["Price change", "Price negotiation"];
const TRANS_PRESETS = ["Transport cost change", "Rate negotiation"];

export function ChangeRequestModal({
  supplier, item, month, currentPrice, newPrice, oldTransport, newTransport, requestedBy, isNegotiation, isFirstEntry, onClose,
}: {
  supplier: Supplier; item: Item; month: string;
  currentPrice: number; newPrice: number;
  oldTransport?: number | null; newTransport?: number | null;
  requestedBy: string; isNegotiation?: boolean; isFirstEntry?: boolean; onClose: () => void;
}) {
  const { t, isRTL } = useI18n();
  const [purpose, setPurpose] = useState<"price" | "trans" | "both">(() => {
    if (isFirstEntry) return "both";
    const hasPriceChange = newPrice !== currentPrice;
    const oldTrans = oldTransport ?? 0;
    const hasTransChange = newTransport != null && newTransport !== oldTrans;
    if (hasPriceChange && hasTransChange) return "both";
    if (hasTransChange) return "trans";
    return "price";
  });

  const [negotiatedPriceVal, setNegotiatedPriceVal] = useState(String(newPrice > 0 ? newPrice : ""));
  const [revisedPriceVal, setRevisedPriceVal]       = useState(String(newPrice > 0 ? newPrice : ""));
  const [revisedTransVal, setRevisedTransVal]       = useState(String(newTransport ?? oldTransport ?? 0));
  const [notesVal, setNotesVal]                      = useState("");
  
  const [pending, startTransition] = useTransition();
  const [done, setDone]            = useState<"request" | "direct" | null>(null);
  const [err, setErr]              = useState<string | null>(null);

  const handleSubmit = () => {
    if (isFirstEntry) {
      const priceNum = Number(revisedPriceVal);
      const transNum = Number(revisedTransVal);

      if (isNaN(priceNum) || priceNum <= 0) {
        setErr(t("purch.errValidPrice"));
        return;
      }
      if (isNaN(transNum) || transNum < 0) {
        setErr(t("purch.errValidTransport"));
        return;
      }

      setErr(null);
      const fd = new FormData();
      fd.set("itemId", String(item.id));
      fd.set("month", month);
      fd.set("collectedBy", requestedBy);
      fd.set("collectedRole", "WH");
      fd.set(`price_${supplier.id}`, String(priceNum));
      fd.set(`notes_${supplier.id}`, notesVal);
      fd.set(`actual_transport_${supplier.id}`, String(transNum));

      startTransition(async () => {
        const res = await saveBatchPriceEntriesSilent(fd);
        if (res?.ok) {
          setDone("direct");
          setTimeout(onClose, 1500);
        } else {
          setErr(res?.error ?? "Failed to save price.");
        }
      });
    } else if (isNegotiation) {
      const priceNum = Number(negotiatedPriceVal);
      if (isNaN(priceNum) || priceNum <= 0) {
        setErr(t("purch.errValidNegPrice"));
        return;
      }
      setErr(null);
      const fd = new FormData();
      fd.set("itemId", String(item.id));
      fd.set("supplierId", String(supplier.id));
      fd.set("month", month);
      fd.set("negotiatedPrice", String(priceNum));
      fd.set("notes", notesVal);
      startTransition(async () => {
        const res = await saveNegotiatedPriceAction(fd);
        if (res?.ok) {
          setDone("direct");
          setTimeout(onClose, 1500);
        } else {
          setErr(res?.error ?? "Failed to save negotiated price.");
        }
      });
    } else {
      const priceNum = purpose === "trans" ? currentPrice : Number(revisedPriceVal);
      const transNum = purpose === "price" ? (oldTransport ?? 0) : Number(revisedTransVal);

      if (purpose !== "trans" && (isNaN(priceNum) || priceNum <= 0)) {
        setErr(t("purch.errValidRevPrice"));
        return;
      }
      if (purpose !== "price" && (isNaN(transNum) || transNum < 0)) {
        setErr(t("purch.errValidRevTrans"));
        return;
      }

      setErr(null);
      const fd = new FormData();
      fd.set("itemId",      String(item.id));
      fd.set("supplierId",  String(supplier.id));
      fd.set("month",       month);
      fd.set("oldPrice",    String(currentPrice));
      fd.set("newPrice",    String(priceNum));
      
      const purposeText = purpose === "both" ? "Revised trans and price" : purpose === "trans" ? "Revised trans" : "Revised price";
      const reasonText  = notesVal.trim() ? `${purposeText} - Note: ${notesVal}` : purposeText;
      fd.set("reason",      reasonText);
      fd.set("requestedBy", requestedBy);
      fd.set("oldTransport", String(oldTransport ?? 0));
      fd.set("newTransport", String(transNum));

      startTransition(async () => {
        const res = await submitPriceChangeRequestAction(fd);
        if (res?.ok) { setDone(res.directSaved ? "direct" : "request"); setTimeout(onClose, 1800); }
        else          { setErr(res?.error ?? "Failed to submit"); }
      });
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 3000,
      background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
    }}>
      <div style={{
        background: "var(--bg-surface)", border: "1px solid var(--border-medium)",
        borderRadius: "16px", boxShadow: "var(--shadow-xl)",
        width: "100%", maxWidth: "500px", padding: "24px",
        display: "flex", flexDirection: "column", gap: "14px",
        animation: "slideUp 0.22s cubic-bezier(0.16,1,0.3,1)",
      }}>
        <div>
          <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: isFirstEntry ? "#3b82f6" : isNegotiation ? "#8b5cf6" : "var(--warning)", marginBottom: "4px" }}>
            {isFirstEntry ? t("purch.recordPriceHeader") : isNegotiation ? t("purch.logNegotiatedHeader") : t("purch.priceRevisionHeader")}
          </p>
          <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{item.name}</h3>
          <div style={{ display: "flex", gap: "6px", marginTop: "5px", flexWrap: "wrap" }}>
            <span className="badge badge-strong" style={{ fontSize: "10px" }}>{supplier.fame_name || supplier.name}</span>
            <span className="badge" style={{ fontSize: "10px" }}>{formatMonthLabel(month)}</span>
          </div>
        </div>

        {isFirstEntry ? (
          /* Record Price Layout */
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <label className="field">
              <span style={{ fontWeight: 600, fontSize: "12px", color: "var(--text-secondary)" }}>{t("purch.priceEGP")}</span>
              <input
                type="number"
                step="any"
                min="0.01"
                placeholder="0.00"
                value={revisedPriceVal}
                onChange={e => setRevisedPriceVal(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: "8px", border: "1.5px solid var(--border-medium)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "13px" }}
                autoFocus
              />
            </label>

            <label className="field">
              <span style={{ fontWeight: 600, fontSize: "12px", color: "var(--text-secondary)" }}>{t("purch.transportCostEGP")}</span>
              <input
                type="number"
                step="any"
                min="0"
                value={revisedTransVal}
                onChange={e => setRevisedTransVal(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: "8px", border: "1.5px solid var(--border-medium)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "13px" }}
              />
            </label>

            <label className="field">
              <span style={{ fontWeight: 600, fontSize: "12px", color: "var(--text-secondary)" }}>{t("purch.notesOptionalLabel")}</span>
              <input
                type="text"
                value={notesVal}
                onChange={e => setNotesVal(e.target.value)}
                placeholder={t("purch.notesPlaceholder")}
                style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border-medium)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "13px" }}
              />
            </label>
          </div>
        ) : isNegotiation ? (
          /* Redesigned Negotiation Layout */
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <label className="field">
              <span style={{ fontWeight: 600, fontSize: "12px", color: "var(--text-secondary)" }}>{t("purch.purpose")}</span>
              <input
                type="text"
                value={t("purch.priceNegotiation")}
                disabled
                style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border-medium)", background: "var(--bg-subtle)", color: "var(--text-muted)", fontSize: "13px", cursor: "not-allowed" }}
              />
            </label>

            <div style={{ padding: "10px 14px", background: "var(--bg-elevated)", border: "1px solid var(--border-medium)", borderRadius: "var(--radius)", fontSize: "13px" }}>
              <span style={{ color: "var(--text-muted)" }}>{t("purch.submittedPriceLabel")} </span>
              <strong>{formatCurrency(currentPrice)}</strong>
            </div>

            <label className="field">
              <span style={{ fontWeight: 600, fontSize: "12px", color: "var(--text-secondary)" }}>{t("purch.negPriceAfterLabel")}</span>
              <input
                type="number"
                step="any"
                min="0.01"
                value={negotiatedPriceVal}
                onChange={e => setNegotiatedPriceVal(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: "8px", border: "1.5px solid var(--border-medium)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "13px" }}
                autoFocus
              />
            </label>

            {/* Auto calculated amount and percentage based on original price */}
            {(() => {
              const priceNum = Number(negotiatedPriceVal);
              if (isNaN(priceNum) || priceNum <= 0 || currentPrice <= 0) return null;
              const diff = currentPrice - priceNum;
              const pct = (diff / currentPrice) * 100;
              return (
                <div style={{
                  padding: "10px 14px",
                  background: diff >= 0 ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)",
                  border: `1.5px solid ${diff >= 0 ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
                  borderRadius: "8px",
                  fontSize: "12.5px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-secondary)" }}>{t("purch.negDiscountAmtLabel")}</span>
                    <strong style={{ color: diff >= 0 ? "var(--success)" : "var(--danger)" }}>
                      {diff >= 0 ? t("purch.negSavedText") : t("purch.negIncreasedText")} {formatCurrency(Math.abs(diff))}
                    </strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-secondary)" }}>{t("purch.negDiscountPctLabel")}</span>
                    <strong style={{ color: diff >= 0 ? "var(--success)" : "var(--danger)" }}>
                      {pct.toFixed(2)}% {diff >= 0 ? t("purch.negDiscountText") : t("purch.negIncreaseText")}
                    </strong>
                  </div>
                </div>
              );
            })()}

            <label className="field">
              <span style={{ fontWeight: 600, fontSize: "12px", color: "var(--text-secondary)" }}>{t("purch.notesOptionalLabel")}</span>
              <input
                type="text"
                value={notesVal}
                onChange={e => setNotesVal(e.target.value)}
                placeholder={t("purch.negNotesPlaceholder")}
                style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border-medium)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "13px" }}
              />
            </label>
          </div>
        ) : (
          /* Redesigned Revision Layout */
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <span style={{ fontWeight: 600, fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>{t("purch.purposeRequired")}</span>
              <div style={{ display: "flex", gap: "6px" }}>
                {(["price", "trans", "both"] as const).map(p => {
                  const label = p === "price" ? t("purch.priceChange") : p === "trans" ? t("purch.transportChange") : t("purch.changeRequest");
                  const isSelected = purpose === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPurpose(p)}
                      style={{
                        flex: 1, padding: "6px 8px", borderRadius: "8px", fontSize: "11px",
                        border: `1.5px solid ${isSelected ? "var(--warning)" : "var(--border-medium)"}`,
                        background: isSelected ? "rgba(245,158,11,0.08)" : "var(--bg-elevated)",
                        color: isSelected ? "var(--warning)" : "var(--text-secondary)",
                        fontWeight: isSelected ? 700 : 400, cursor: "pointer", transition: "all 150ms",
                        textAlign: "center"
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {(purpose === "price" || purpose === "both") && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  {t("purch.originalPrice")} <strong>{formatCurrency(currentPrice)}</strong>
                </div>
                <label className="field">
                  <span style={{ fontWeight: 600, fontSize: "12px", color: "var(--text-secondary)" }}>{t("purch.revisedPriceEGP")}</span>
                  <input
                    type="number" step="any" min="0.01"
                    value={revisedPriceVal}
                    onChange={e => setRevisedPriceVal(e.target.value)}
                    style={{ padding: "8px 12px", borderRadius: "8px", border: "1.5px solid var(--border-medium)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "13px" }}
                    autoFocus
                  />
                </label>
              </div>
            )}

            {(purpose === "trans" || purpose === "both") && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  {t("purch.originalTransport")} <strong>{formatCurrency(oldTransport ?? 0)}</strong>
                </div>
                <label className="field">
                  <span style={{ fontWeight: 600, fontSize: "12px", color: "var(--text-secondary)" }}>{t("purch.revisedTransportEGP")}</span>
                  <input
                    type="number" step="any" min="0"
                    value={revisedTransVal}
                    onChange={e => setRevisedTransVal(e.target.value)}
                    style={{ padding: "8px 12px", borderRadius: "8px", border: "1.5px solid var(--border-medium)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "13px" }}
                  />
                </label>
              </div>
            )}

            <label className="field">
              <span style={{ fontWeight: 600, fontSize: "12px", color: "var(--text-secondary)" }}>{t("purch.notesOptionalLabel")}</span>
              <input
                type="text"
                value={notesVal}
                onChange={e => setNotesVal(e.target.value)}
                placeholder={t("purch.notePlaceholderWH")}
                style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border-medium)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "13px" }}
              />
            </label>
          </div>
        )}

        {err && <div style={{ fontSize: "12px", color: "var(--danger)", fontWeight: 600 }}>⚠️ {err}</div>}
        {done && (
          <div style={{ fontSize: "13px", color: "var(--success)", fontWeight: 700, textAlign: "center", padding: "6px" }}>
            {done === "direct" 
              ? (isNegotiation ? t("purch.notifiedSC") : t("purch.savedSuccessfully")) 
              : t("purch.requestSubmittedSC")
            }
          </div>
        )}

        <div style={{ display: "flex", gap: "10px" }}>
          <button type="button" className="button button-secondary" style={{ flex: 1 }} onClick={onClose} disabled={pending}>{t("gen.cancel")}</button>
          <button
            type="button"
            className={isFirstEntry ? "button button-primary" : isNegotiation ? "button button-primary" : "button button-warning"}
            style={{
              flex: 2,
              background: isFirstEntry ? "#3b82f6" : isNegotiation ? "#8b5cf6" : undefined,
              borderColor: isFirstEntry ? "#2563eb" : isNegotiation ? "#7c3aed" : undefined,
              color: (isFirstEntry || isNegotiation) ? "#fff" : undefined
            }}
            onClick={handleSubmit}
            disabled={pending || Boolean(done)}
          >
            {pending ? t("purch.savingBtn") : isFirstEntry ? t("purch.savePriceBtn") : isNegotiation ? t("purch.notifySCBtn") : t("purch.submitRequestBtn")}
          </button>
        </div>
        <p style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center", lineHeight: 1.5 }}>
          {isFirstEntry
            ? t("purch.descFirstEntry")
            : isNegotiation
              ? t("purch.descNegotiation")
              : t("purch.descRevision")
          }
        </p>
      </div>
    </div>
  );
}


// Modal for SC to extend previous month prices to current month
function ExtendPricesModal({
  item,
  month,
  suppliers,
  suppliersWithoutCurrentPrice,
  prevMonthPrices,
  extendedBy,
  onClose,
}: {
  item: Item;
  month: string;
  suppliers: Supplier[];
  suppliersWithoutCurrentPrice: number[];
  prevMonthPrices: Record<number, number>;
  extendedBy: string;
  onClose: (refreshed: boolean) => void;
}) {
  const { t, isRTL } = useI18n();
  const prevMonth = shiftMonth(month, -1);
  const [selected, setSelected] = useState<Set<number>>(new Set(suppliersWithoutCurrentPrice));
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const toggle = (id: number) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const handleExtend = () => {
    if (selected.size === 0) { setErr(t("purch.errSelectSupplier")); return; }
    setErr(null);
    startTransition(async () => {
      const res = await extendPreviousMonthPricesAction({
        itemId: item.id,
        supplierIds: Array.from(selected),
        extendedBy,
      });
      if (res?.ok) {
        setDone(true);
        setResult(
          t("purch.extendedResult")
            .replace("{count}", String(res.created))
            .replace("{month}", formatMonthLabel(month))
        );
        setTimeout(() => onClose(true), 1800);
      } else {
        setErr(res?.error ?? "Failed");
      }
    });
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", opacity: 1 }}
    >
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-medium)", borderRadius: "16px", boxShadow: "var(--shadow-xl)", width: "100%", maxWidth: "500px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px", animation: "slideUp 0.22s cubic-bezier(0.16,1,0.3,1)", willChange: "transform, opacity" }}>
        <div>
          <p style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--primary)", marginBottom: "4px" }}>{t("purch.scExtendTitle")}</p>
          <h3 style={{ fontSize: "16px", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>{item.name}</h3>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
            {t("purch.scExtendDesc")
              .replace("{prevMonth}", formatMonthLabel(prevMonth))
              .replace("{month}", formatMonthLabel(month))}
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {suppliersWithoutCurrentPrice.map(sid => {
            const sup = suppliers.find(s => s.id === sid);
            if (!sup) return null;
            const price = prevMonthPrices[sid];
            const isChecked = selected.has(sid);
            return (
              <label key={sid} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", borderRadius: "var(--radius)", border: `1.5px solid ${isChecked ? "var(--primary)" : "var(--border)"}`, background: isChecked ? "var(--primary-light)" : "var(--bg-elevated)", cursor: "pointer", transition: "all 150ms" }}>
                <input type="checkbox" checked={isChecked} onChange={() => toggle(sid)} style={{ accentColor: "var(--primary)", width: "15px", height: "15px" }} />
                <div style={{ flex: 1, textAlign: isRTL ? "right" : "left" }}>
                  <div style={{ fontWeight: 700, fontSize: "13px", color: "var(--text-primary)" }}>{sup.name}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    {price != null ? `${formatMonthLabel(prevMonth)}: ${formatCurrency(price)}` : t("purch.noPrevMonthPrice")}
                  </div>
                </div>
                {price != null && (
                  <span style={{ fontWeight: 800, fontSize: "14px", color: "var(--primary)" }}>{formatCurrency(price)}</span>
                )}
              </label>
            );
          })}
        </div>

        {err && <div style={{ fontSize: "12px", color: "var(--danger)", fontWeight: 600 }}>⚠️ {err}</div>}
        {done && result && <div style={{ fontSize: "13px", color: "var(--success)", fontWeight: 700, textAlign: "center", padding: "8px" }}>{result}</div>}

        <div style={{ display: "flex", gap: "10px" }}>
          <button type="button" className="button button-secondary" style={{ flex: 1 }} onClick={() => onClose(false)} disabled={pending}>{t("gen.cancel")}</button>
          <button type="button" className="button button-primary" style={{ flex: 2 }} onClick={handleExtend} disabled={pending || done || selected.size === 0}>
            {pending ? t("purch.extendingBtn") : t("purch.extendBtnLabel").replace("{count}", String(selected.size))}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PurchasingForm({
  categories,
  items,
  suppliers,
  month,
  role,
  displayName,
  purchasingHistory,
  wasSaved,
  initialCategoryId,
  initialItemId,
}: Props) {
  const { t, locale } = useI18n();
  const isAr = locale === "ar";

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    initialCategoryId || (categories.length > 0 ? String(categories[0].id) : "")
  );
  const [selectedItemId, setSelectedItemId]         = useState<string>(
    initialItemId || ""
  );
  const [historyFilter, setHistoryFilter]           = useState<HistoryFilter>("3");

  // Change request modal state
  const [changeRequestModal, setChangeRequestModal] = useState<{
    supplier: Supplier; item: Item; currentPrice: number; newPrice: number;
    oldTransport?: number | null; newTransport?: number | null;
    isNegotiation?: boolean;
    isFirstEntry?: boolean;
  } | null>(null);

  // Inline entry states for unrecorded suppliers
  const [inlinePrices, setInlinePrices] = useState<Record<number, string>>({});
  const [inlineTransports, setInlineTransports] = useState<Record<number, string>>({});
  const [inlineNotes, setInlineNotes] = useState<Record<number, string>>({});
  const [inlineError, setInlineError] = useState<Record<number, string>>({});
  const [inlinePending, startInlineTransition] = useTransition();

  const handleInlinePriceChange = (supplierId: number, val: string) => {
    setInlinePrices(prev => ({ ...prev, [supplierId]: val }));
  };

  const handleInlineTransportChange = (supplierId: number, val: string) => {
    setInlineTransports(prev => ({ ...prev, [supplierId]: val }));
  };

  const handleInlineNotesChange = (supplierId: number, val: string) => {
    setInlineNotes(prev => ({ ...prev, [supplierId]: val }));
  };

  const handleInlineSubmit = (supplierId: number) => {
    const priceVal = inlinePrices[supplierId];
    const transVal = inlineTransports[supplierId] || "";
    const notesVal = inlineNotes[supplierId] || "";

    const priceNum = Number(priceVal);
    if (!priceVal || isNaN(priceNum) || priceNum <= 0) {
      setInlineError(prev => ({ ...prev, [supplierId]: isAr ? "سعر غير صحيح" : "Invalid price" }));
      return;
    }

    const transNum = transVal ? Number(transVal) : 0;
    if (isNaN(transNum) || transNum < 0) {
      setInlineError(prev => ({ ...prev, [supplierId]: isAr ? "تكلفة غير صحيحة" : "Invalid transport" }));
      return;
    }

    setInlineError(prev => ({ ...prev, [supplierId]: "" }));

    const fd = new FormData();
    fd.set("itemId", String(selectedItem!.id));
    fd.set("month", month);
    fd.set("collectedBy", displayName);
    fd.set("collectedRole", "WH");
    fd.set(`price_${supplierId}`, String(priceNum));
    fd.set(`notes_${supplierId}`, notesVal);
    fd.set(`actual_transport_${supplierId}`, String(transNum));

    startInlineTransition(async () => {
      const res = await saveBatchPriceEntriesSilent(fd);
      if (res?.ok) {
        setInlinePrices(prev => {
          const next = { ...prev };
          delete next[supplierId];
          return next;
        });
        setInlineTransports(prev => {
          const next = { ...prev };
          delete next[supplierId];
          return next;
        });
        setInlineNotes(prev => {
          const next = { ...prev };
          delete next[supplierId];
          return next;
        });
      } else {
        setInlineError(prev => ({ ...prev, [supplierId]: res?.error ?? "Save failed" }));
      }
    });
  };

  // Extend prices modal state (SC only)
  const [extendModal, setExtendModal] = useState(false);

  // Dashboard / Review modal states
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const filteredItems = useMemo(
    () => selectedCategoryId === "" ? items : items.filter(i => i.category_id === Number(selectedCategoryId)),
    [selectedCategoryId, items]
  );

  // Filter suppliers to only those assigned to the selected item's category
  const filteredSuppliers = useMemo(() => {
    const catId = Number(selectedCategoryId);
    if (!catId) return suppliers;
    return suppliers.filter(s => s.category_ids.includes(catId));
  }, [suppliers, selectedCategoryId]);

  // Compute unique submitted supplier count per item for the current month
  const submittedSuppliersByItemId = useMemo(() => {
    const map: Record<number, Set<number>> = {};
    purchasingHistory
      .filter(e => e.month === month)
      .forEach(e => {
        if (!map[e.item_id]) map[e.item_id] = new Set();
        map[e.item_id].add(e.supplier_id);
      });
    return map;
  }, [purchasingHistory, month]);

  const [prevCategoryId, setPrevCategoryId] = useState(selectedCategoryId);

  if (selectedCategoryId !== prevCategoryId) {
    setPrevCategoryId(selectedCategoryId);
    setSelectedItemId("");
  }



  const selectedItem = items.find(i => String(i.id) === selectedItemId);

  const itemHistory = useMemo(
    () => selectedItemId ? purchasingHistory.filter(h => h.item_id === Number(selectedItemId)) : [],
    [selectedItemId, purchasingHistory]
  );

  const latestMap = useMemo(() => {
    const map: Record<string, HistoryEntry> = {};
    for (const e of itemHistory) {
      const key = `${e.supplier_id}_${e.month}`;
      if (!map[key] || e.recorded_at > map[key].recorded_at) map[key] = e;
    }
    return map;
  }, [itemHistory]);

  // Current-month entries are the only entries that require approval to change.
  // Previous-month supplier prices remain normal direct entries for this month.
  const currentMonthEntriesBySupplier = useMemo(() => {
    const map = new Map<number, HistoryEntry>();
    for (const key of Object.keys(latestMap)) {
      const e = latestMap[key];
      if (e.month === month && e.collected_role === "WH") map.set(e.supplier_id, e);
    }
    return map;
  }, [latestMap, month]);

  // Previous month prices — used for the SC "extend" feature
  const prevMonth = shiftMonth(month, -1);
  const prevMonthPriceMap = useMemo(() => {
    const map: Record<number, number> = {};
    for (const key of Object.keys(latestMap)) {
      const e = latestMap[key];
      if (e.month === prevMonth) {
        map[e.supplier_id] = e.price;
      }
    }
    return map;
  }, [latestMap, prevMonth]);

  // A map of item_id -> supplier_id -> latest HistoryEntry for the current month
  const dashboardMonthEntries = useMemo(() => {
    const map = new Map<number, Map<number, HistoryEntry>>();
    for (const e of purchasingHistory) {
      if (e.month === month) {
        if (!map.has(e.item_id)) {
          map.set(e.item_id, new Map());
        }
        const supplierMap = map.get(e.item_id)!;
        if (!supplierMap.has(e.supplier_id)) {
          supplierMap.set(e.supplier_id, e);
        }
      }
    }
    return map;
  }, [purchasingHistory, month]);

  // A map of item_id_supplier_id -> HistoryEntry for confirmed WH prices in the current month
  const confirmedCurrentMonthEntries = useMemo(() => {
    const map = new Map<string, HistoryEntry>();
    for (const e of purchasingHistory) {
      if (e.month === month && e.collected_role === "WH") {
        const key = `${e.item_id}_${e.supplier_id}`;
        if (!map.has(key)) {
          map.set(key, e);
        }
      }
    }
    return map;
  }, [purchasingHistory, month]);

  // Previous month prices for reference
  const prevMonthPriceMapAll = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of purchasingHistory) {
      if (e.month === prevMonth) {
        map.set(`${e.item_id}_${e.supplier_id}`, e.price);
      }
    }
    return map;
  }, [purchasingHistory, prevMonth]);

  // Filtered list of items for the dashboard
  const filteredDashboardItems = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return items;
    return items.filter(i => 
      i.name.toLowerCase().includes(query) || 
      i.category_name.toLowerCase().includes(query)
    );
  }, [items, searchQuery]);

  // Group filtered items by category
  const groupedFilteredItems = useMemo(() => {
    const groups = new Map<string, typeof items>();
    for (const item of filteredDashboardItems) {
      const cat = item.category_name || (isAr ? "غير مصنف" : "Uncategorized");
      if (!groups.has(cat)) {
        groups.set(cat, []);
      }
      groups.get(cat)!.push(item);
    }
    return groups;
  }, [filteredDashboardItems, isAr]);

  const toggleItemExpanded = (itemId: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  // Suppliers that have a prev-month price but NO current-month price (extendable)
  const suppliersExtendable = useMemo(
    () => filteredSuppliers.filter(s => prevMonthPriceMap[s.id] != null && !currentMonthEntriesBySupplier.has(s.id)).map(s => s.id),
    [filteredSuppliers, prevMonthPriceMap, currentMonthEntriesBySupplier]
  );

  const pivotData = useMemo(() => {
    const allMonths = Array.from(new Set(itemHistory.map(h => h.month))).sort((a, b) => b.localeCompare(a));
    const cutoff = historyFilter === "all" ? null : shiftMonth(month, historyFilter === "3" ? -3 : -6);
    const pivotMonths = cutoff ? allMonths.filter(m => m >= cutoff) : allMonths;

    const priceMap = new Map<string, number>();
    for (const key of Object.keys(latestMap)) {
      const e = latestMap[key];
      priceMap.set(`${e.supplier_id}||${e.month}`, e.price);
    }

    const activeSuppliers = suppliers.filter(s => pivotMonths.some(m => priceMap.has(`${s.id}||${m}`)));
    const minByMonth = new Map<string, number>();
    for (const m of pivotMonths) {
      const prices = activeSuppliers.map(s => priceMap.get(`${s.id}||${m}`)).filter((p): p is number => p !== undefined);
      if (prices.length) minByMonth.set(m, Math.min(...prices));
    }
    const monthAvgs = pivotMonths.map(m => {
      const prices = activeSuppliers.map(s => priceMap.get(`${s.id}||${m}`)).filter((p): p is number => p !== undefined);
      return prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null;
    });

    return { pivotMonths, priceMap, activeSuppliers, minByMonth, monthAvgs };
  }, [itemHistory, historyFilter, month, suppliers, latestMap]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Change request modal */}
      {changeRequestModal && changeRequestModal.item && (
        <ChangeRequestModal
          supplier={changeRequestModal.supplier}
          item={changeRequestModal.item}
          month={month}
          currentPrice={changeRequestModal.currentPrice}
          newPrice={changeRequestModal.newPrice}
          oldTransport={changeRequestModal.oldTransport}
          newTransport={changeRequestModal.newTransport}
          requestedBy={displayName}
          isNegotiation={changeRequestModal.isNegotiation}
          isFirstEntry={changeRequestModal.isFirstEntry}
          onClose={() => {
            setChangeRequestModal(null);
          }}
        />
      )}

      {/* Extend prices modal (SC only) */}
      {extendModal && selectedItem && (
        <ExtendPricesModal
          item={selectedItem}
          month={month}
          suppliers={suppliers}
          suppliersWithoutCurrentPrice={suppliersExtendable}
          prevMonthPrices={prevMonthPriceMap}
          extendedBy={displayName}
          onClose={() => {
            setExtendModal(false);
          }}
        />
      )}

      {/* Review & Edit Submitted Prices Modal */}
      {showReviewModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 2000,
          background: "rgba(15, 23, 42, 0.45)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
          animation: "fadeIn 0.2s ease-out",
        }}>
          <div style={{
            width: "100%", maxWidth: "1000px", height: "90vh", maxHeight: "800px",
            display: "flex", flexDirection: "column", background: "var(--bg-surface)",
            border: "1px solid var(--border-medium)", borderRadius: "var(--radius-xl)",
            boxShadow: "var(--shadow-xl)", overflow: "hidden",
            animation: "slideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
          }}>
            {/* Modal Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid var(--border)", background: "var(--bg-elevated)", flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "var(--text-primary)" }}>
                  {isAr ? "🔍 مراجعة وتعديل الأسعار المرسلة" : "🔍 Review & Edit Submitted Prices"}
                </h3>
                <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "var(--text-muted)" }}>
                  {isAr ? (
                    <>
                      الشهر: <strong>{formatMonthLabel(month)}</strong> · إجمالي الأصناف: <strong>{items.length}</strong>
                    </>
                  ) : (
                    <>
                      Month: <strong>{formatMonthLabel(month)}</strong> · Total items: <strong>{items.length}</strong>
                    </>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="button button-secondary"
                style={{ minWidth: "36px", height: "36px", padding: 0, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}
              >
                ×
              </button>
            </div>

            {/* Search & Actions Bar */}
            <div style={{ padding: "12px 24px", borderBottom: "1px solid var(--border)", display: "flex", gap: "12px", alignItems: "center", background: "var(--bg-elevated)", flexShrink: 0 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <input
                  type="text"
                  placeholder={isAr ? "البحث عن الأصناف بالاسم أو الفئة..." : "Search items by name or category..."}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%", padding: isAr ? "8px 36px 8px 12px" : "8px 12px 8px 36px",
                    borderRadius: "8px", border: "1px solid var(--border-medium)",
                    background: "var(--bg-surface)", color: "var(--text-primary)",
                    fontSize: "13px"
                  }}
                />
                <span style={{ position: "absolute", [isAr ? "right" : "left"]: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "14px", pointerEvents: "none", opacity: 0.5 }}>
                  🔍
                </span>
              </div>
              <button
                type="button"
                className="button button-secondary"
                style={{ padding: "8px 14px", fontSize: "12px" }}
                onClick={() => setExpandedItems(new Set(items.map(i => i.id)))}
              >
                {isAr ? "توسيع الكل" : "Expand All"}
              </button>
              <button
                type="button"
                className="button button-secondary"
                style={{ padding: "8px 14px", fontSize: "12px" }}
                onClick={() => setExpandedItems(new Set())}
              >
                {isAr ? "طي الكل" : "Collapse All"}
              </button>
            </div>

            {/* Collapsible List */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              {filteredDashboardItems.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px" }}>
                  {isAr ? `لم يتم العثور على أي صنف يطابق "${searchQuery}"` : `No items found matching "${searchQuery}"`}
                </div>
              ) : (
                Array.from(groupedFilteredItems.entries()).map(([categoryName, groupItems]) => (
                  <div key={categoryName} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {/* Category Section Header */}
                    <div style={{
                      padding: "10px 14px",
                      background: "rgba(37, 99, 235, 0.05)",
                      borderLeft: isAr ? "none" : "4px solid #2563eb",
                      borderRight: isAr ? "4px solid #2563eb" : "none",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      direction: isAr ? "rtl" : "ltr"
                    }}>
                      <span style={{ fontWeight: 800, fontSize: "13px", color: "#1e3a8a", display: "flex", alignItems: "center", gap: "6px" }}>
                        <span>📁</span>
                        <span>{categoryName}</span>
                      </span>
                      <span style={{ fontSize: "11px", color: "#1d4ed8", fontWeight: 700, background: "rgba(37,99,235,0.1)", padding: "2px 8px", borderRadius: "12px" }}>
                        {groupItems.length} {isAr ? "أصناف" : (groupItems.length === 1 ? "item" : "items")}
                      </span>
                    </div>

                    {/* Category Items List */}
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                      paddingLeft: isAr ? "0" : "12px",
                      paddingRight: isAr ? "12px" : "0",
                      direction: isAr ? "rtl" : "ltr"
                    }}>
                      {groupItems.map(item => {
                        const isExpanded = expandedItems.has(item.id);
                        const itemEntries = dashboardMonthEntries.get(item.id);
                        const submittedCount = itemEntries?.size ?? 0;
                        // Only suppliers assigned to this item's category
                        const suppliersForItem = suppliers.filter(
                          s => s.category_ids.includes(Number(item.category_id))
                        );
                        const totalForItem = suppliersForItem.length;

                        return (
                          <div
                            key={item.id}
                            style={{
                              border: "1px solid var(--border)",
                              borderRadius: "var(--radius)",
                              background: "var(--bg-surface)",
                              overflow: "hidden",
                              transition: "all 150ms ease",
                              flexShrink: 0,
                            }}
                          >
                            {/* Item Header */}
                            <div
                              onClick={() => toggleItemExpanded(item.id)}
                              style={{
                                padding: "12px 16px",
                                background: isExpanded ? "var(--bg-subtle)" : "var(--bg-elevated)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                cursor: "pointer",
                                userSelect: "none",
                                minHeight: "48px",
                                flexShrink: 0,
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <span style={{ fontSize: "14px" }}>{isExpanded ? "▼" : "▶"}</span>
                                <div>
                                  <strong
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.dispatchEvent(new CustomEvent("show-item-details", { detail: { itemId: item.id } }));
                                    }}
                                    className="clickable-detail-trigger"
                                    style={{ fontSize: "14px" }}
                                  >
                                    {item.name}
                                  </strong>
                                  <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "8px", marginRight: "8px" }}>
                                    · {isAr ? "الوحدة" : "Unit"}: {item.unit}
                                    {" · "}{isAr ? "أقل كمية طلب (MOQ)" : "MOQ"}: {item.moq ?? 0}
                                    {" · "}{isAr ? "النقل للوحدة" : "Transportation/Unit"}: {formatCurrency(item.transportation_per_unit ?? 0)}
                                  </span>
                                </div>
                              </div>
                              
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span className={`badge ${submittedCount === totalForItem && totalForItem > 0 ? "badge-success" : submittedCount > 0 ? "badge-warning" : ""}`} style={{ fontSize: "11px" }}>
                                  {submittedCount} / {totalForItem} {isAr ? "تم تقديمه" : "submitted"}
                                </span>
                              </div>
                            </div>
                            
                            {/* Expanded Content */}
                            {isExpanded && (
                              <div style={{ borderTop: "1px solid var(--border-light)", padding: "12px 16px", background: "var(--bg-surface)", overflowX: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                                  <thead>
                                    <tr style={{ borderBottom: "1px solid var(--border-medium)", background: "var(--bg-elevated)" }}>
                                      <th style={{ textAlign: isAr ? "right" : "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 700 }}>{isAr ? "المورد" : "Supplier"}</th>
                                      <th style={{ textAlign: "center", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 700, width: "120px" }}>{isAr ? "الحالة" : "Status"}</th>
                                      <th style={{ textAlign: "center", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 700, width: "120px" }}>{isAr ? "تكلفة النقل" : "Trans. Cost"}</th>
                                      <th style={{ textAlign: isAr ? "left" : "right", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 700, width: "140px" }}>{isAr ? "السعر" : "Price"} ({item.unit})</th>
                                      <th style={{ textAlign: isAr ? "right" : "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 700 }}>{isAr ? "ملاحظات" : "Notes"}</th>
                                      <th style={{ textAlign: "center", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 700, width: "140px" }}>{isAr ? "الإجراءات" : "Actions"}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {suppliersForItem.length === 0 ? (
                                      <tr>
                                        <td colSpan={6} style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px", fontStyle: "italic" }}>
                                          {isAr ? "لم يتم تعيين موردين لفئة هذا الصنف." : "No suppliers assigned to this item's category. Contact Admin."}
                                        </td>
                                      </tr>
                                    ) : suppliersForItem.map((supplier, idx) => {
                                      const entry = itemEntries?.get(supplier.id);
                                      const color = COLORS[idx % COLORS.length];
                                      const prevPrice = prevMonthPriceMapAll.get(`${item.id}_${supplier.id}`);
                                      
                                      return (
                                        <tr key={supplier.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                          {/* Supplier Name */}
                                          <td style={{ padding: "8px 12px", verticalAlign: "middle", textAlign: isAr ? "right" : "left" }}>
                                            <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", flexDirection: isAr ? "row-reverse" : "row" }}>
                                              <span style={{ width: "24px", height: "24px", borderRadius: "50%", background: color + "15", border: `1px solid ${color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, color }}>
                                                {(supplier.fame_name || supplier.name).charAt(0)}
                                              </span>
                                              <div style={{ textAlign: isAr ? "right" : "left" }}>
                                                <div
                                                  onClick={() => window.dispatchEvent(new CustomEvent("show-supplier-details", { detail: { supplierId: supplier.id } }))}
                                                  className="clickable-detail-trigger"
                                                  style={{ fontWeight: 600 }}
                                                >
                                                  {supplier.fame_name || supplier.name}
                                                </div>
                                                {prevPrice != null && (
                                                  <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                                                    {isAr ? "السابق" : "Prev"}: {formatCurrency(prevPrice)}
                                                  </div>
                                                )}
                                              </div>
                                            </span>
                                          </td>
                                          
                                          {/* Status badge */}
                                          <td style={{ padding: "8px 12px", textAlign: "center", verticalAlign: "middle" }}>
                                            {entry ? (
                                              entry.status === "rejected" ? (
                                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                                                  <span className="badge badge-danger" style={{ fontSize: "10px", padding: "2px 8px" }} title={entry.review_note || ""}>
                                                    ✕ {isAr ? "مرفوض" : "Rejected"}
                                                  </span>
                                                  {entry.review_note && (
                                                    <span style={{ fontSize: "9px", color: "var(--danger)", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={entry.review_note}>
                                                      {entry.review_note}
                                                    </span>
                                                  )}
                                                </div>
                                              ) : entry.status === "pending" ? (
                                                <span className="badge badge-warning" style={{ fontSize: "10px", padding: "2px 8px" }}>
                                                  ⏳ {isAr ? "قيد الانتظار" : "Pending SC"}
                                                </span>
                                              ) : entry.collected_role === "WH" ? (
                                                <span className="badge badge-success" style={{ fontSize: "10px", padding: "2px 8px" }}>{isAr ? "تم إرساله" : "Submitted"}</span>
                                              ) : (
                                                <span className="badge" style={{ fontSize: "10px", padding: "2px 8px", background: "var(--primary-light)", color: "var(--primary)", border: "1px solid var(--border-accent)" }}>{isAr ? "ممدد" : "Extended"}</span>
                                              )
                                            ) : (
                                              <span className="badge" style={{ fontSize: "10px", padding: "2px 8px", opacity: 0.5 }}>{isAr ? "لم يدخل" : "Not Entered"}</span>
                                            )}
                                          </td>

                                          {/* Transport Cost */}
                                          <td style={{ padding: "8px 12px", textAlign: "center", verticalAlign: "middle" }}>
                                            <span style={{ fontSize: "12px" }}>
                                              {entry?.actual_transport != null ? formatCurrency(entry.actual_transport) : formatCurrency(item.transportation_per_unit ?? 0)}
                                            </span>
                                          </td>
                                          
                                          {/* Price */}
                                          <td style={{ padding: "8px 12px", textAlign: isAr ? "left" : "right", verticalAlign: "middle" }}>
                                            {entry ? (
                                              <div style={{ display: "flex", flexDirection: "column", alignItems: isAr ? "flex-start" : "flex-end" }}>
                                                <strong style={{ fontSize: "13px" }}>{formatCurrency(entry.price)}</strong>
                                                {entry.negotiated_price != null && (
                                                  <span className="badge" style={{
                                                    fontSize: "10px",
                                                    background: "rgba(139,92,246,0.12)",
                                                    color: "#8b5cf6",
                                                    border: "1px solid rgba(139,92,246,0.35)",
                                                    fontWeight: 700,
                                                    marginTop: "4px",
                                                    padding: "2px 6px",
                                                    whiteSpace: "nowrap"
                                                  }}>
                                                    {isAr ? "تفاوض: " : "Negotiated: "}{formatCurrency(entry.negotiated_price)}
                                                  </span>
                                                )}
                                              </div>
                                            ) : (
                                              <span style={{ color: "var(--text-muted)" }}>—</span>
                                            )}
                                          </td>
                                          
                                          {/* Notes */}
                                          <td style={{ padding: "8px 12px", verticalAlign: "middle", textAlign: isAr ? "right" : "left" }}>
                                            {entry?.notes ? (
                                              <span style={{ color: "var(--text-secondary)", fontSize: "12px" }}>{entry.notes}</span>
                                            ) : (
                                              <span style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: "12px" }}>{isAr ? "لا يوجد ملاحظات" : "No notes"}</span>
                                            )}
                                          </td>
                                          
                                          {/* Actions */}
                                          <td style={{ padding: "8px 12px", textAlign: "center", verticalAlign: "middle" }}>
                                            <div style={{ display: "flex", gap: "6px", justifyContent: "center", flexWrap: "wrap" }}>
                                              {entry ? (
                                                <>
                                                  <button
                                                    type="button"
                                                    className="button button-warning"
                                                    style={{ padding: "4px 8px", fontSize: "11px" }}
                                                    onClick={() => setChangeRequestModal({
                                                      supplier,
                                                      item,
                                                      currentPrice: entry.price,
                                                      newPrice: entry.price,
                                                      oldTransport: entry.actual_transport,
                                                      newTransport: entry.actual_transport,
                                                      isNegotiation: false,
                                                      isFirstEntry: entry.status === 'pending' || entry.status === 'rejected',
                                                    })}
                                                  >
                                                    {isAr ? "تعديل" : "Edit"}
                                                  </button>
                                                  {role === "WH" && (
                                                    <button
                                                      type="button"
                                                      className="button"
                                                      style={{
                                                        padding: "4px 8px", fontSize: "11px",
                                                        background: "rgba(139,92,246,0.12)",
                                                        color: "#8b5cf6",
                                                        border: "1px solid rgba(139,92,246,0.35)",
                                                        borderRadius: "var(--radius-sm)"
                                                      }}
                                                      onClick={() => setChangeRequestModal({
                                                        supplier,
                                                        item,
                                                        currentPrice: entry.price,
                                                        newPrice: entry.price,
                                                        oldTransport: entry.actual_transport,
                                                        newTransport: entry.actual_transport,
                                                        isNegotiation: true,
                                                        isFirstEntry: false,
                                                      })}
                                                    >
                                                      {isAr ? "تفاوض" : "Negotiate ↗"}
                                                    </button>
                                                  )}
                                                </>
                                              ) : (
                                                <button
                                                  type="button"
                                                  className="button button-primary"
                                                  style={{ padding: "4px 8px", fontSize: "11px" }}
                                                  onClick={() => setChangeRequestModal({
                                                    supplier,
                                                    item,
                                                    currentPrice: 0,
                                                    newPrice: 0,
                                                    oldTransport: item.transportation_per_unit ?? 0,
                                                    newTransport: item.transportation_per_unit ?? 0,
                                                    isFirstEntry: true,
                                                    isNegotiation: false,
                                                  })}
                                                >
                                                  {isAr ? "تسجيل السعر" : "Record Price"}
                                                </button>
                                              )}
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ display: "flex", justifyContent: "flex-end", padding: "14px 24px", borderTop: "1px solid var(--border)", background: "var(--bg-elevated)", flexShrink: 0 }}>
              <button
                type="button"
                className="button button-secondary"
                style={{ padding: "8px 20px" }}
                onClick={() => setShowReviewModal(false)}
              >
                {isAr ? "إغلاق اللوحة" : "Close Dashboard"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Month banner ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 18px", background: "linear-gradient(135deg, var(--primary-light), transparent)", border: "2px solid var(--primary)", borderRadius: "var(--radius-lg)", boxShadow: "var(--glow-primary)", flexWrap: "wrap" }}>
        <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px", flexShrink: 0 }}>📅</div>
        <div style={{ flex: 1, minWidth: "150px" }}>
          <div style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--primary)", marginBottom: "2px" }}>{t("purch.lockedMonth")}</div>
          <div style={{ fontSize: "19px", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{formatMonthLabel(month)}</div>
        </div>
        <input type="hidden" name="month" value={month} />
        <span className="badge badge-strong" style={{ fontSize: "12px", padding: "5px 12px", marginRight: "12px" }}>{month}</span>
        <button
          type="button"
          onClick={() => setShowReviewModal(true)}
          className="button button-primary"
          style={{ fontSize: "13px", padding: "8px 16px", display: "flex", alignItems: "center", gap: "6px" }}
        >
          {isAr ? "🔍 مراجعة وتعديل الأسعار المرسلة" : "🔍 Review & Edit Submitted Prices"}
        </button>
      </div>

      {/* ── Category + Item selectors ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "16px" }}>
        <label className="field">
          <span>1. {t("purch.selectCategory")}</span>
          <select
            value={selectedCategoryId}
            onChange={e => setSelectedCategoryId(e.target.value)}
            dir="rtl"
            style={{ direction: "rtl", textAlign: "right" }}
          >
            {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span>2. {t("purch.selectItem")}</span>
          <ItemCombobox
            items={filteredItems.map((item) => {
              const submitted = submittedSuppliersByItemId[item.id]?.size ?? 0;
              const total = suppliers.filter(s => s.category_ids.includes(item.category_id)).length;
              const badge = total > 0 ? `${submitted}/${total}` : undefined;
              const badgeVariant = submitted === 0 ? "empty" : submitted >= total ? "complete" : "partial";
              return {
                id: item.id,
                label: item.name,
                unit: item.unit,
                badge,
                badgeVariant: total > 0 ? badgeVariant : undefined,
              };
            })}
            value={selectedItemId}
            onChange={setSelectedItemId}
            disabled={filteredItems.length === 0}
            placeholder={filteredItems.length === 0 ? `— ${t("purch.noItemsInCat")} —` : (isAr ? "— اختر الصنف —" : "— Select an item —")}
          />
        </label>
      </div>

      {selectedItem && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div className="panel" style={{ padding: "20px 24px" }}>
            <div className="panel-header">
              <div>
                <p className="eyebrow">3. {t("purch.recordPrices")}</p>
                <h2
                  onClick={() => window.dispatchEvent(new CustomEvent("show-item-details", { detail: { itemId: selectedItem.id } }))}
                  className="clickable-detail-trigger"
                  style={{ fontSize: "14px" }}
                >
                  {selectedItem.name}
                </h2>
                <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{isAr ? "سجل الأسعار أو تصفح التفاصيل لكل مورد أدناه." : "Record prices or view details for each supplier below."}</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
                <span className="badge badge-strong">{selectedItem.unit}</span>

                {/* SC only: extend previous month prices */}
                {role === "SC" && suppliersExtendable.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setExtendModal(true)}
                    className="button button-secondary"
                    style={{ fontSize: "11px", padding: "5px 11px", gap: "5px", marginTop: "2px" }}
                  >
                    {isAr ? `📅 تمديد ${suppliersExtendable.length} من أسعار الشهر الماضي` : `📅 Extend ${suppliersExtendable.length} prev-month price${suppliersExtendable.length > 1 ? "s" : ""}`}
                  </button>
                )}
              </div>
            </div>

            {/* Supplier rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "14px" }}>

              {/* Empty state: no suppliers configured for this category */}
              {filteredSuppliers.length === 0 && (
                <div style={{
                  padding: "24px 20px",
                  borderRadius: "10px",
                  border: "1.5px dashed var(--border-medium)",
                  background: "var(--bg-subtle)",
                  textAlign: "center",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: "8px",
                }}>
                  <span style={{ fontSize: "28px" }}>🔒</span>
                  <div style={{ fontWeight: 700, fontSize: "13px", color: "var(--text-primary)" }}>
                    {isAr ? "لا يوجد موردون مخصصون لهذه الفئة" : "No suppliers configured for this category"}
                  </div>
                  <div style={{ fontSize: "11.5px", color: "var(--text-muted)", maxWidth: "360px" }}>
                    {isAr
                      ? "يرجى التواصل مع المسؤول لتخصيص موردين لهذه الفئة في صفحة إدارة الموردين."
                      : "Contact your Admin to assign suppliers to this category in the Suppliers admin page."
                    }
                  </div>
                </div>
              )}

              {filteredSuppliers.map((supplier, idx) => {
                const color         = COLORS[idx % COLORS.length];
                const lastEntry     = latestMap[`${supplier.id}_${shiftMonth(month, -1)}`];
                const thisEntry     = currentMonthEntriesBySupplier.get(supplier.id);
                const isConfirmed   = Boolean(thisEntry);

                // ── CONFIRMED (revision) row ────────────────────────────────
                if (isConfirmed && thisEntry) {
                  return (
                    <div key={supplier.id} style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      padding: "14px 18px", borderRadius: "12px",
                      border: "1.5px solid rgba(16,185,129,0.3)",
                      background: "rgba(16,185,129,0.025)",
                      transition: "all 200ms ease",
                    }}>

                      {/* Supplier identity */}
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: "180px", flexShrink: 0 }}>
                        <span style={{ width: "34px", height: "34px", borderRadius: "8px", background: color + "22", border: `1.5px solid ${color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color, flexShrink: 0 }}>
                          {(supplier.fame_name || supplier.name).charAt(0)}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            onClick={() => window.dispatchEvent(new CustomEvent("show-supplier-details", { detail: { supplierId: supplier.id } }))}
                            className="clickable-detail-trigger"
                            style={{ fontWeight: 600, fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                          >
                            {supplier.fame_name || supplier.name}
                          </div>
                          {lastEntry && <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "1px" }}>{isAr ? "السابق" : "Last"}: {formatCurrency(lastEntry.price)}</div>}
                        </div>
                      </div>

                      {/* Submitted price — read-only */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", flexShrink: 0, minWidth: "140px" }}>
                        <span style={{ fontSize: "10px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{isAr ? "السعر المرسل" : "Submitted price"}</span>
                        <div style={{
                          height: "40px", padding: "8px 10px", fontSize: "13px", fontWeight: 400, borderRadius: "var(--radius)", outline: "none", transition: "all 200ms", width: "100%",
                          display: "flex", alignItems: "center", whiteSpace: "nowrap",
                          background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.25)",
                          color: "var(--success)", paddingLeft: "10px",
                        }}>
                          ✓ {formatCurrency(thisEntry.price)}
                        </div>
                        {thisEntry.negotiated_price != null && (
                          <div className="badge" style={{
                            fontSize: "10px",
                            background: "rgba(139,92,246,0.12)",
                            color: "#8b5cf6",
                            border: "1px solid rgba(139,92,246,0.35)",
                            fontWeight: 700,
                            padding: "3px 6px",
                            marginTop: "2px",
                            textAlign: "center"
                          }}>
                            {isAr ? "تفاوض: " : "Negotiated: "}{formatCurrency(thisEntry.negotiated_price)}
                          </div>
                        )}
                      </div>

                      {/* Submitted trans — read-only */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "120px", flexShrink: 0 }}>
                        <span style={{ fontSize: "10px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{isAr ? "النقل المرسل" : "Submitted trans."}</span>
                        <div style={{
                          height: "40px", padding: "8px 10px", fontSize: "13px", fontWeight: 400, borderRadius: "var(--radius)", outline: "none", transition: "all 200ms", width: "100%",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.18)",
                          color: "var(--text-secondary)",
                        }}>
                          {thisEntry.actual_transport != null ? formatCurrency(thisEntry.actual_transport) : "—"}
                        </div>
                      </div>

                      {/* Notes — read-only */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1, minWidth: "150px" }}>
                        <span style={{ fontSize: "10px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{isAr ? "الملاحظات" : "Notes"}</span>
                        <div style={{
                          height: "40px", padding: "8px 10px", fontSize: "12px", fontWeight: 400, borderRadius: "var(--radius)",
                          display: "flex", alignItems: "center", background: "var(--bg-elevated)", border: "1px solid var(--border)",
                          color: thisEntry.notes ? "var(--text-primary)" : "var(--text-muted)", fontStyle: thisEntry.notes ? "normal" : "italic",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                        }}>
                          {thisEntry.notes || (isAr ? "لا يوجد ملاحظات" : "No notes")}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: "flex", gap: "8px", alignSelf: "flex-end", flexShrink: 0 }}>
                        {role === "WH" && (
                          <button
                            type="button"
                            onClick={() => {
                              setChangeRequestModal({
                                supplier,
                                item: selectedItem!,
                                currentPrice: thisEntry.price,
                                newPrice: thisEntry.price,
                                oldTransport: thisEntry.actual_transport,
                                newTransport: thisEntry.actual_transport,
                                isNegotiation: true,
                                isFirstEntry: false,
                              });
                            }}
                            style={{
                              height: "40px", padding: "0 14px", flexShrink: 0,
                              borderRadius: "var(--radius)",
                              border: "1px solid rgba(139,92,246,0.35)",
                              background: "rgba(139,92,246,0.12)",
                              color: "#8b5cf6",
                              fontWeight: 600, fontSize: "13px",
                              cursor: "pointer",
                              transition: "all 200ms", whiteSpace: "nowrap",
                            }}
                          >
                            {isAr ? "تفاوض ↗" : "Negotiate ↗"}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setChangeRequestModal({
                              supplier,
                              item: selectedItem!,
                              currentPrice: thisEntry.price,
                              newPrice: thisEntry.price,
                              oldTransport: thisEntry.actual_transport,
                              newTransport: thisEntry.actual_transport,
                              isNegotiation: false,
                              isFirstEntry: false,
                            });
                          }}
                          style={{
                            height: "40px", padding: "0 14px", flexShrink: 0,
                            borderRadius: "var(--radius)",
                            border: "1.5px solid var(--warning)",
                            background: "rgba(245,158,11,0.12)",
                            color: "var(--warning)",
                            fontWeight: 600, fontSize: "13px",
                            cursor: "pointer",
                            transition: "all 200ms", whiteSpace: "nowrap",
                          }}
                        >
                          {isAr ? "طلب تعديل ↗" : "Edit ↗"}
                        </button>
                      </div>
                    </div>
                  );
                }

                /* ── FIRST ENTRY row ─────────────────────────────────────── */
                return (
                  <div key={supplier.id} style={{
                    display: "flex", flexDirection: "column", gap: "8px",
                    padding: "14px 18px", borderRadius: "12px",
                    border: inlineError[supplier.id] ? "1.5px solid var(--danger)" : "1.5px solid var(--border)",
                    background: "var(--bg-elevated)",
                    transition: "all 200ms ease",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%" }}>
                      {/* Supplier identity */}
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: "180px", width: "180px", flexShrink: 0 }}>
                        <span style={{ width: "34px", height: "34px", borderRadius: "8px", background: color + "22", border: `1.5px solid ${color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color, flexShrink: 0 }}>
                          {(supplier.fame_name || supplier.name).charAt(0)}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            onClick={() => window.dispatchEvent(new CustomEvent("show-supplier-details", { detail: { supplierId: supplier.id } }))}
                            className="clickable-detail-trigger"
                            style={{ fontWeight: 600, fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                          >
                            {supplier.fame_name || supplier.name}
                          </div>
                          {lastEntry && <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "1px" }}>{isAr ? "السابق" : "Last"}: {formatCurrency(lastEntry.price)}</div>}
                        </div>
                      </div>

                      {/* Price Input Column */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "140px", width: "140px", flexShrink: 0 }}>
                        <span style={{ fontSize: "10px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                          {isAr ? "السعر (EGP)" : "Price (EGP)"}
                        </span>
                        <input
                          type="number"
                          step="any"
                          placeholder="0.00"
                          value={inlinePrices[supplier.id] || ""}
                          onChange={(e) => handleInlinePriceChange(supplier.id, e.target.value)}
                          style={{
                            height: "40px",
                            padding: "8px 10px",
                            fontSize: "13px",
                            borderRadius: "var(--radius)",
                            border: inlineError[supplier.id] && inlineError[supplier.id].includes("price") ? "1.5px solid var(--danger)" : "1.5px solid var(--border)",
                            background: "var(--bg-surface)",
                            color: "var(--text-primary)",
                            outline: "none",
                            width: "100%",
                          }}
                        />
                      </div>

                      {/* Trans Input Column */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "120px", flexShrink: 0 }}>
                        <span style={{ fontSize: "10px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                          {isAr ? "تكلفة النقل" : "Trans. (EGP)"}
                        </span>
                        <input
                          type="number"
                          step="any"
                          placeholder={isAr ? "اختياري" : "Optional"}
                          value={inlineTransports[supplier.id] || ""}
                          onChange={(e) => handleInlineTransportChange(supplier.id, e.target.value)}
                          style={{
                            height: "40px",
                            padding: "8px 10px",
                            fontSize: "13px",
                            borderRadius: "var(--radius)",
                            border: inlineError[supplier.id] && inlineError[supplier.id].includes("transport") ? "1.5px solid var(--danger)" : "1.5px solid var(--border)",
                            background: "var(--bg-surface)",
                            color: "var(--text-primary)",
                            outline: "none",
                            width: "100%",
                          }}
                        />
                      </div>

                      {/* Notes Input Column */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1, minWidth: "150px" }}>
                        <span style={{ fontSize: "10px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                          {isAr ? "الملاحظات" : "Notes"}
                        </span>
                        <input
                          type="text"
                          placeholder={isAr ? "اكتب ملاحظة..." : "Write a note..."}
                          value={inlineNotes[supplier.id] || ""}
                          onChange={(e) => handleInlineNotesChange(supplier.id, e.target.value)}
                          style={{
                            height: "40px",
                            padding: "8px 10px",
                            fontSize: "12px",
                            borderRadius: "var(--radius)",
                            border: "1px solid var(--border)",
                            background: "var(--bg-surface)",
                            color: "var(--text-primary)",
                            outline: "none",
                            width: "100%",
                          }}
                        />
                      </div>

                      {/* Action Column */}
                      <div style={{ display: "flex", gap: "8px", alignSelf: "flex-end", flexShrink: 0 }}>
                        <button
                          type="button"
                          disabled={inlinePending}
                          onClick={() => handleInlineSubmit(supplier.id)}
                          style={{
                            height: "40px", padding: "0 24px", flexShrink: 0,
                            borderRadius: "var(--radius)",
                            border: "none",
                            background: "var(--primary)",
                            color: "#ffffff",
                            fontWeight: 600, fontSize: "13px",
                            cursor: "pointer",
                            transition: "all 200ms", whiteSpace: "nowrap",
                            opacity: inlinePending ? 0.6 : 1,
                          }}
                        >
                          {isAr ? "حفظ" : "Record"}
                        </button>
                      </div>
                    </div>
                    {inlineError[supplier.id] && (
                      <div style={{ fontSize: "11px", color: "var(--danger)", paddingLeft: "44px", paddingRight: "44px" }}>
                        ⚠️ {inlineError[supplier.id]}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pivot history table */}
            <div style={{ marginTop: "16px", borderTop: "1.5px solid var(--border-light)", paddingTop: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                <h3 style={{ fontSize: "12px", fontWeight: 800, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
                  📊 {t("purch.prevPrices")}
                </h3>
                <div style={{ display: "flex", gap: "3px", background: "var(--bg-elevated)", padding: "3px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                  {(["3", "6", "all"] as HistoryFilter[]).map(f => (
                    <button key={f} type="button" onClick={() => setHistoryFilter(f)}
                      className={`button ${historyFilter === f ? "button-primary" : "button-secondary"}`}
                      style={{ padding: "4px 12px", fontSize: "11px", borderRadius: "6px", cursor: "pointer" }}>
                      {f === "all" ? t("gen.all") : (isAr ? `${f} أشهر` : `${f}M`)}
                    </button>
                  ))}
                </div>
              </div>

              {pivotData.pivotMonths.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "13px", padding: "20px 0", border: "1px dashed var(--border-light)", borderRadius: "var(--radius)" }}>
                  {t("purch.noHistRange")}
                </div>
              ) : (
                <div className="table-wrap" style={{ maxHeight: "300px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ background: "var(--bg-subtle)" }}>
                        <th style={{ padding: "7px 12px", textAlign: isAr ? "right" : "left", fontWeight: 800, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", borderBottom: "1.5px solid var(--border)", position: "sticky", top: 0, [isAr ? "right" : "left"]: 0, background: "var(--bg-subtle)", zIndex: 3, whiteSpace: "nowrap", boxShadow: `${isAr ? "-1px" : "1px"} 0 0 var(--border-light), 0 1px 0 var(--border)`, minWidth: "80px" }}>
                          {t("purch.month")}
                        </th>
                        {pivotData.activeSuppliers.map(sup => {
                          const color = COLORS[suppliers.findIndex(s => s.id === sup.id) % COLORS.length];
                          return (
                            <th key={sup.id} style={{ padding: "7px 12px", textAlign: "center", fontWeight: 700, fontSize: "10px", color, borderBottom: "1.5px solid var(--border)", position: "sticky", top: 0, background: "var(--bg-subtle)", zIndex: 2, whiteSpace: "nowrap", boxShadow: "0 1px 0 var(--border)", minWidth: "110px" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, display: "inline-block" }} />
                                {sup.fame_name || sup.name}
                              </span>
                            </th>
                          );
                        })}
                        <th style={{ padding: "7px 12px", textAlign: "center", fontWeight: 800, fontSize: "10px", color: "var(--primary)", borderBottom: "1.5px solid var(--border)", position: "sticky", top: 0, background: "var(--bg-subtle)", zIndex: 2, whiteSpace: "nowrap", boxShadow: "0 1px 0 var(--border)", minWidth: "90px" }}>
                          {t("purch.avg")} ⌀
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pivotData.pivotMonths.map((m, mi) => {
                        const isLatest = m === month;
                        const minP = pivotData.minByMonth.get(m);
                        const mPrices = pivotData.activeSuppliers.map(s => pivotData.priceMap.get(`${s.id}||${m}`)).filter((p): p is number => p !== undefined);
                        const mAvg = mPrices.length ? mPrices.reduce((a, b) => a + b, 0) / mPrices.length : null;
                        const prevAvg = pivotData.monthAvgs[mi + 1];
                        const currAvg = pivotData.monthAvgs[mi];
                        let trendEl: React.ReactNode = null;
                        if (prevAvg != null && currAvg != null) {
                          const pct = ((currAvg - prevAvg) / prevAvg) * 100;
                          if (Math.abs(pct) > 0.5) trendEl = (
                            <span style={{ fontSize: "9px", fontWeight: 800, color: pct > 0 ? "var(--danger)" : "var(--success)", marginLeft: "3px" }}>
                              {pct > 0 ? `↑${pct.toFixed(1)}%` : `↓${Math.abs(pct).toFixed(1)}%`}
                            </span>
                          );
                        }
                        return (
                          <tr key={m} style={{ borderBottom: mi < pivotData.pivotMonths.length - 1 ? "1px solid var(--border-light)" : "none", background: isLatest ? "rgba(99,102,241,0.04)" : "transparent" }}>
                            <td style={{ padding: "8px 12px", position: "sticky", [isAr ? "right" : "left"]: 0, background: isLatest ? "rgba(99,102,241,0.07)" : "var(--bg-surface)", zIndex: 1, boxShadow: `${isAr ? "-1px" : "1px"} 0 0 var(--border-light)`, whiteSpace: "nowrap" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                <span className="badge" style={{ fontSize: "10px", ...(isLatest ? { background: "var(--primary)", color: "#fff", borderColor: "var(--primary)" } : {}) }}>{m}</span>
                                {isLatest && <span style={{ fontSize: "8px", fontWeight: 800, color: "var(--primary)" }}>{t("gen.latest")}</span>}
                              </div>
                            </td>
                            {pivotData.activeSuppliers.map(sup => {
                              const price = pivotData.priceMap.get(`${sup.id}||${m}`);
                              const isBest = price !== undefined && price === minP;
                              return (
                                <td key={sup.id} style={{ padding: "8px 12px", textAlign: "center", background: isBest ? "rgba(2,132,199,0.08)" : "transparent", whiteSpace: "nowrap" }}>
                                  {price !== undefined ? (
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                                      <strong style={{ fontSize: "13px", fontWeight: isBest ? 800 : 600, color: isBest ? "var(--info)" : "var(--text-primary)" }}>{formatCurrency(price)}</strong>
                                      {isBest && <span style={{ fontSize: "8px", fontWeight: 800, background: "var(--info)", color: "#fff", padding: "1px 5px", borderRadius: "3px" }}>{t("gen.best")}</span>}
                                    </div>
                                  ) : <span style={{ color: "var(--text-dim)" }}>—</span>}
                                </td>
                              );
                            })}
                            <td style={{ padding: "8px 12px", textAlign: "center", whiteSpace: "nowrap" }}>
                              {mAvg !== null ? (
                                <span style={{ display: "inline-flex", alignItems: "center" }}>
                                  <strong style={{ fontSize: "12px", fontWeight: 700, color: "var(--primary)" }}>{formatCurrency(mAvg)}</strong>
                                  {trendEl}
                                </span>
                              ) : <span style={{ color: "var(--text-dim)" }}>—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>{t("purch.lowestNote")}</p>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
