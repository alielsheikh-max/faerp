"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { createBatchPriceEntries, saveBatchPriceEntriesSilent, submitPriceChangeRequestAction, extendPreviousMonthPricesAction } from "@/app/actions/pricing";
import { shiftMonth, formatMonthLabel, formatCurrency } from "@/lib/format";
import { useI18n } from "@/lib/i18n-context";

type Category    = { id: number; name: string; description: string };
type Item        = { id: number; name: string; unit: string; category_id: number; category_name: string };
type Supplier    = { id: number; name: string; contact_person?: string; phone?: string };
type HistoryEntry = { item_id: number; supplier_id: number; month: string; price: number; recorded_at: string; collected_role: string; supplier_name: string; notes: string | null };
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
};

const COLORS = ["#3b82f6","#ef4444","#10b981","#f59e0b","#8b5cf6","#06b6d4"];

// Modal for submitting a price change request for a single supplier
function ChangeRequestModal({
  supplier,
  item,
  month,
  currentPrice,
  newPrice,
  requestedBy,
  onClose,
}: {
  supplier: Supplier;
  item: Item;
  month: string;
  currentPrice: number;
  newPrice: number;
  requestedBy: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<"request" | "direct" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const diff = newPrice - currentPrice;
  const diffPct = currentPrice > 0 ? (diff / currentPrice) * 100 : 0;

  const handleSubmit = () => {
    if (!reason.trim()) { setErr("Please enter a reason for the price change."); return; }
    setErr(null);
    const fd = new FormData();
    fd.set("itemId",      String(item.id));
    fd.set("supplierId",  String(supplier.id));
    fd.set("month",       month);
    fd.set("oldPrice",    String(currentPrice));
    fd.set("newPrice",    String(newPrice));
    fd.set("reason",      reason);
    fd.set("requestedBy", requestedBy);
    startTransition(async () => {
      const res = await submitPriceChangeRequestAction(fd);
      if (res.ok) {
        setDone(res.directSaved ? "direct" : "request");
        setTimeout(onClose, 1800);
      }
      else { setErr(res.error ?? "Failed to submit"); }
    });
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 3000,
      background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
      opacity: 1,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: "var(--bg-surface)", border: "1px solid var(--border-medium)",
        borderRadius: "16px", boxShadow: "var(--shadow-xl)",
        width: "100%", maxWidth: "480px", padding: "24px",
        display: "flex", flexDirection: "column", gap: "16px",
        animation: "slideUp 0.22s cubic-bezier(0.16,1,0.3,1)",
        willChange: "transform, opacity",
      }}>
        {/* Header */}
        <div>
          <p style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--warning)", marginBottom: "4px" }}>
            Price Change Request
          </p>
          <h3 style={{ fontSize: "16px", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
            {item.name}
          </h3>
          <div style={{ display: "flex", gap: "6px", marginTop: "6px", flexWrap: "wrap" }}>
            <span className="badge badge-strong" style={{ fontSize: "10px" }}>{supplier.name}</span>
            <span className="badge" style={{ fontSize: "10px" }}>{formatMonthLabel(month)}</span>
          </div>
        </div>

        {/* Price diff visual */}
        <div style={{
          padding: "12px 16px",
          background: diff > 0 ? "var(--danger-light)" : "var(--success-light)",
          border: `1px solid ${diff > 0 ? "rgba(220,38,38,0.25)" : "rgba(16,185,129,0.25)"}`,
          borderRadius: "var(--radius)",
          display: "flex", gap: "16px", alignItems: "center",
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", marginBottom: "2px" }}>Current</div>
            <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--text-secondary)", textDecoration: "line-through" }}>{formatCurrency(currentPrice)}</div>
          </div>
          <div style={{ fontSize: "20px", color: "var(--text-muted)" }}>→</div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", marginBottom: "2px" }}>New</div>
            <div style={{ fontSize: "18px", fontWeight: 800, color: diff > 0 ? "var(--danger)" : "var(--success)" }}>{formatCurrency(newPrice)}</div>
          </div>
          <div style={{ marginInlineStart: "auto", textAlign: "right" }}>
            <div style={{ fontWeight: 800, fontSize: "14px", color: diff > 0 ? "var(--danger)" : "var(--success)" }}>
              {diff > 0 ? "▲" : "▼"} {Math.abs(diffPct).toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Reason */}
        <label className="field">
          <span>Reason for Change <span style={{ color: "var(--danger)", fontWeight: 800 }}>*</span></span>
          <input
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Supplier revised price list, transport costs increased…"
            style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border-medium)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "13px" }}
            autoFocus
          />
        </label>

        {err && <div style={{ fontSize: "12px", color: "var(--danger)", fontWeight: 600 }}>⚠️ {err}</div>}
        {done && (
          <div style={{ fontSize: "13px", color: "var(--success)", fontWeight: 700, textAlign: "center", padding: "8px" }}>
            {done === "direct"
              ? "✓ Price saved directly. No SC approval was needed."
              : "✓ Change request submitted — awaiting SC review."}
          </div>
        )}

        <div style={{ display: "flex", gap: "10px" }}>
          <button type="button" className="button button-secondary" style={{ flex: 1 }} onClick={onClose} disabled={pending}>
            No, Cancel
          </button>
          <button type="button" className="button button-warning" style={{ flex: 2 }} onClick={handleSubmit} disabled={pending || Boolean(done)}>
            {pending ? "Submitting…" : "Yes, Submit Request"}
          </button>
        </div>

        <p style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center", lineHeight: 1.5 }}>
          This will be sent to SC for approval. The price will not change until approved.
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
    if (selected.size === 0) { setErr("Select at least one supplier."); return; }
    setErr(null);
    startTransition(async () => {
      const res = await extendPreviousMonthPricesAction({
        itemId: item.id,
        supplierIds: Array.from(selected),
        extendedBy,
      });
      if (res.ok) {
        setDone(true);
        setResult(`✓ Extended prices for ${res.created} supplier(s) into ${formatMonthLabel(month)}.`);
        setTimeout(() => onClose(true), 1800);
      } else {
        setErr(res.error ?? "Failed");
      }
    });
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", opacity: 1 }}
      onClick={e => e.target === e.currentTarget && onClose(false)}
    >
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-medium)", borderRadius: "16px", boxShadow: "var(--shadow-xl)", width: "100%", maxWidth: "500px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px", animation: "slideUp 0.22s cubic-bezier(0.16,1,0.3,1)", willChange: "transform, opacity" }}>
        <div>
          <p style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--primary)", marginBottom: "4px" }}>SC · Extend Prices</p>
          <h3 style={{ fontSize: "16px", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>{item.name}</h3>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
            Copy confirmed prices from <strong>{formatMonthLabel(prevMonth)}</strong> → <strong>{formatMonthLabel(month)}</strong> for selected suppliers. Only suppliers with no current-month price will be extended.
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
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "13px", color: "var(--text-primary)" }}>{sup.name}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    {price != null ? `${formatMonthLabel(prevMonth)}: ${formatCurrency(price)}` : "No prev-month price"}
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
          <button type="button" className="button button-secondary" style={{ flex: 1 }} onClick={() => onClose(false)} disabled={pending}>Cancel</button>
          <button type="button" className="button button-primary" style={{ flex: 2 }} onClick={handleExtend} disabled={pending || done || selected.size === 0}>
            {pending ? "Extending…" : `Extend ${selected.size} Supplier(s) →`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PurchasingForm({ categories, items, suppliers, month, role, displayName, purchasingHistory, wasSaved }: Props) {
  const { t, locale } = useI18n();
  const isAr = locale === "ar";

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(categories.length > 0 ? String(categories[0].id) : "");
  const [selectedItemId, setSelectedItemId]         = useState<string>("");
  const [historyFilter, setHistoryFilter]           = useState<HistoryFilter>("3");
  const [supplierPrices, setSupplierPrices]         = useState<Record<number, string>>({});
  const [supplierNotes, setSupplierNotes]           = useState<Record<number, string>>({});

  // Change request modal state
  const [changeRequestModal, setChangeRequestModal] = useState<{
    supplier: Supplier; currentPrice: number; newPrice: number;
  } | null>(null);

  // Extend prices modal state (SC only)
  const [extendModal, setExtendModal] = useState(false);

  // Dashboard / Review modal states
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [editingEntry, setEditingEntry] = useState<{ itemId: number; supplierId: number; price: string; notes: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const filteredItems = useMemo(
    () => selectedCategoryId === "" ? items : items.filter(i => i.category_id === Number(selectedCategoryId)),
    [selectedCategoryId, items]
  );

  useEffect(() => {
    if (filteredItems.length > 0) {
      const valid = filteredItems.some(i => String(i.id) === selectedItemId);
      if (!valid) setSelectedItemId(String(filteredItems[0].id));
    } else {
      setSelectedItemId("");
    }
  }, [selectedCategoryId]);

  useEffect(() => {
    if (selectedItemId === "" && filteredItems.length > 0) setSelectedItemId(String(filteredItems[0].id));
  }, [filteredItems]);

  useEffect(() => { setSupplierPrices({}); setSupplierNotes({}); }, [selectedItemId]);

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

  const handleSaveInline = async (item: Item, supplier: Supplier, existingEntry?: HistoryEntry) => {
    if (!editingEntry) return;
    const priceNum = Number(editingEntry.price);
    if (isNaN(priceNum) || priceNum <= 0) {
      alert("Please enter a valid positive price.");
      return;
    }

    const key = `${item.id}_${supplier.id}`;
    const existingConfirmed = confirmedCurrentMonthEntries.get(key);

    if (existingConfirmed) {
      // Set the active selected item to this item so ChangeRequestModal displays correctly
      setSelectedItemId(String(item.id));
      // Set changeRequestModal state to trigger the ChangeRequestModal overlay
      setChangeRequestModal({
        supplier,
        currentPrice: existingConfirmed.price,
        newPrice: priceNum,
      });
    } else {
      // Save directly
      setIsSaving(true);
      try {
        const fd = new FormData();
        fd.set("itemId", String(item.id));
        fd.set("month", month);
        fd.set("collectedBy", displayName);
        fd.set("collectedRole", role);
        fd.set(`price_${supplier.id}`, editingEntry.price);
        fd.set(`notes_${supplier.id}`, editingEntry.notes);
        
        const res = await saveBatchPriceEntriesSilent(fd);
        if (res.ok) {
          setEditingEntry(null);
        } else {
          alert(res.error ?? "Failed to save price.");
        }
      } catch (err) {
        console.error(err);
        alert("An error occurred while saving.");
      } finally {
        setIsSaving(false);
      }
    }
  };

  // Suppliers that have a prev-month price but NO current-month price (extendable)
  const suppliersExtendable = useMemo(
    () => suppliers.filter(s => prevMonthPriceMap[s.id] != null && !currentMonthEntriesBySupplier.has(s.id)).map(s => s.id),
    [suppliers, prevMonthPriceMap, currentMonthEntriesBySupplier]
  );

  // Count suppliers that are "new" (no confirmed price this month) vs "change" mode
  const newEntries    = Object.entries(supplierPrices).filter(([sid, v]) => !currentMonthEntriesBySupplier.has(Number(sid)) && v && Number(v) > 0);
  const changeEntries = Object.entries(supplierPrices).filter(([sid, v]) => currentMonthEntriesBySupplier.has(Number(sid)) && v && Number(v) > 0);
  const filledCount   = newEntries.length + changeEntries.length;

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

  // Custom submit handler — separates new entries from change requests
  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    // Only intercept if there are change-request entries (confirmed suppliers being updated)
    if (changeEntries.length === 0) {
      // Pure new entries — let the form action run normally
      return;
    }

    // There are change entries — prevent the full form submit and handle each path
    e.preventDefault();

    // If there are also NEW entries to save, submit those first via the silent action
    if (newEntries.length > 0) {
      const form = e.currentTarget;
      const fd = new FormData(form);
      // Remove stale price_ keys that belong to confirmed suppliers
      for (const [sid] of changeEntries) {
        fd.delete(`price_${sid}`);
        fd.delete(`notes_${sid}`);
      }
      const hasNewPrices = newEntries.some(([sid]) => fd.has(`price_${sid}`));
      if (hasNewPrices) {
        await saveBatchPriceEntriesSilent(fd);
      }
    }

    // Now handle the first change-request entry via modal
    const [sidStr, newPriceStr] = changeEntries[0];
    const sid = Number(sidStr);
    const supplier = suppliers.find(s => s.id === sid);
    const currentEntry = currentMonthEntriesBySupplier.get(sid);

    if (supplier && currentEntry) {
      // Normal change request — open modal
      setChangeRequestModal({
        supplier,
        currentPrice: currentEntry.price,
        newPrice: Number(newPriceStr),
      });
      setSupplierPrices(prev => {
        const next = { ...prev };
        delete next[sid];
        return next;
      });
    } else if (supplier) {
      // Current-month state changed while the form was open; fall back to a direct save.
      // Save it as a direct new price entry.
      const fd = new FormData();
      fd.set("itemId",        String(selectedItem?.id ?? ""));
      fd.set("month",         month);
      fd.set("collectedBy",   displayName);
      fd.set("collectedRole", role);
      fd.set(`price_${sid}`,  newPriceStr);
      fd.set(`notes_${sid}`,  supplierNotes[sid] ?? "");
      await saveBatchPriceEntriesSilent(fd);
      setSupplierPrices(prev => { const next = { ...prev }; delete next[sid]; return next; });
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Change request modal */}
      {changeRequestModal && selectedItem && (
        <ChangeRequestModal
          supplier={changeRequestModal.supplier}
          item={selectedItem}
          month={month}
          currentPrice={changeRequestModal.currentPrice}
          newPrice={changeRequestModal.newPrice}
          requestedBy={displayName}
          onClose={() => {
            setChangeRequestModal(null);
            setEditingEntry(null);
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
          onClose={(refreshed) => {
            setExtendModal(false);
            if (refreshed) {
              // Reset price inputs so the form reflects the newly extended entries
              setSupplierPrices({});
              setSupplierNotes({});
            }
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
        }} onClick={e => e.target === e.currentTarget && setShowReviewModal(false)}>
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
                  🔍 Review & Edit Submitted Prices
                </h3>
                <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "var(--text-muted)" }}>
                  Month: <strong>{formatMonthLabel(month)}</strong> · Total items: <strong>{items.length}</strong> · Sample Item: <code style={{ fontSize: "10px", background: "var(--bg-elevated)", padding: "2px 4px" }}>{items[0] ? JSON.stringify(items[0]) : "none"}</code>
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
                  placeholder="Search items by name or category..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%", padding: "8px 12px 8px 36px",
                    borderRadius: "8px", border: "1px solid var(--border-medium)",
                    background: "var(--bg-surface)", color: "var(--text-primary)",
                    fontSize: "13px"
                  }}
                />
                <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "14px", pointerEvents: "none", opacity: 0.5 }}>
                  🔍
                </span>
              </div>
              <button
                type="button"
                className="button button-secondary"
                style={{ padding: "8px 14px", fontSize: "12px" }}
                onClick={() => setExpandedItems(new Set(items.map(i => i.id)))}
              >
                Expand All
              </button>
              <button
                type="button"
                className="button button-secondary"
                style={{ padding: "8px 14px", fontSize: "12px" }}
                onClick={() => setExpandedItems(new Set())}
              >
                Collapse All
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
                                  <strong style={{ fontSize: "14px", color: "var(--text-primary)" }}>{item.name}</strong>
                                  <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "8px", marginRight: "8px" }}>
                                    · {isAr ? "الوحدة" : "Unit"}: {item.unit}
                                  </span>
                                </div>
                              </div>
                              
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span className={`badge ${submittedCount === suppliers.length ? "badge-success" : submittedCount > 0 ? "badge-warning" : ""}`} style={{ fontSize: "11px" }}>
                                  {submittedCount} / {suppliers.length} {isAr ? "تم تقديمه" : "submitted"}
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
                                      <th style={{ textAlign: isAr ? "left" : "right", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 700, width: "140px" }}>{isAr ? "السعر" : "Price"} ({item.unit})</th>
                                      <th style={{ textAlign: isAr ? "right" : "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 700 }}>{isAr ? "ملاحظات" : "Notes"}</th>
                                      <th style={{ textAlign: "center", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 700, width: "140px" }}>{isAr ? "الإجراءات" : "Actions"}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {suppliers.map((supplier, idx) => {
                                      const entry = itemEntries?.get(supplier.id);
                                      const isEditing = editingEntry?.itemId === item.id && editingEntry?.supplierId === supplier.id;
                                      const color = COLORS[idx % COLORS.length];
                                      const prevPrice = prevMonthPriceMapAll.get(`${item.id}_${supplier.id}`);
                                      
                                      return (
                                        <tr key={supplier.id} style={{ borderBottom: "1px solid var(--border-light)", background: isEditing ? "var(--bg-elevated)" : "transparent" }}>
                                          {/* Supplier Name */}
                                          <td style={{ padding: "8px 12px", verticalAlign: "middle", textAlign: isAr ? "right" : "left" }}>
                                            <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", flexDirection: isAr ? "row-reverse" : "row" }}>
                                              <span style={{ width: "24px", height: "24px", borderRadius: "50%", background: color + "15", border: `1px solid ${color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, color }}>
                                                {supplier.name.charAt(0)}
                                              </span>
                                              <div style={{ textAlign: isAr ? "right" : "left" }}>
                                                <div style={{ fontWeight: 600 }}>{supplier.name}</div>
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
                                              entry.collected_role === "WH" ? (
                                                <span className="badge badge-success" style={{ fontSize: "10px", padding: "2px 8px" }}>{isAr ? "تم إرساله" : "Submitted"}</span>
                                              ) : (
                                                <span className="badge" style={{ fontSize: "10px", padding: "2px 8px", background: "var(--primary-light)", color: "var(--primary)", border: "1px solid var(--border-accent)" }}>{isAr ? "ممدد" : "Extended"}</span>
                                              )
                                            ) : (
                                              <span className="badge" style={{ fontSize: "10px", padding: "2px 8px", opacity: 0.5 }}>{isAr ? "لم يدخل" : "Not Entered"}</span>
                                            )}
                                          </td>
                                          
                                          {/* Price */}
                                          <td style={{ padding: "8px 12px", textAlign: isAr ? "left" : "right", verticalAlign: "middle" }}>
                                            {isEditing ? (
                                              <input
                                                type="number"
                                                step="0.01"
                                                min="0.01"
                                                value={editingEntry.price}
                                                onChange={e => setEditingEntry(prev => prev ? { ...prev, price: e.target.value } : null)}
                                                placeholder="0.00"
                                                style={{ width: "100px", padding: "4px 8px", fontSize: "13px", border: "1.5px solid var(--border-medium)", borderRadius: "var(--radius-sm)", background: "var(--bg-surface)", color: "var(--text-primary)", textAlign: isAr ? "left" : "right" }}
                                                autoFocus
                                              />
                                            ) : entry ? (
                                              <strong style={{ fontSize: "13px" }}>{formatCurrency(entry.price)}</strong>
                                            ) : (
                                              <span style={{ color: "var(--text-muted)" }}>—</span>
                                            )}
                                          </td>
                                          
                                          {/* Notes */}
                                          <td style={{ padding: "8px 12px", verticalAlign: "middle", textAlign: isAr ? "right" : "left" }}>
                                            {isEditing ? (
                                              <input
                                                type="text"
                                                value={editingEntry.notes}
                                                onChange={e => setEditingEntry(prev => prev ? { ...prev, notes: e.target.value } : null)}
                                                placeholder={isAr ? "ملاحظات اختيارية..." : "Optional notes..."}
                                                style={{ width: "100%", padding: "4px 8px", fontSize: "13px", border: "1px solid var(--border-medium)", borderRadius: "var(--radius-sm)", background: "var(--bg-surface)", color: "var(--text-primary)", textAlign: isAr ? "right" : "left" }}
                                              />
                                            ) : entry?.notes ? (
                                              <span style={{ color: "var(--text-secondary)", fontSize: "12px" }}>{entry.notes}</span>
                                            ) : (
                                              <span style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: "12px" }}>{isAr ? "لا يوجد ملاحظات" : "No notes"}</span>
                                            )}
                                          </td>
                                          
                                          {/* Actions */}
                                          <td style={{ padding: "8px 12px", textAlign: "center", verticalAlign: "middle" }}>
                                            {isEditing ? (
                                              <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                                                <button
                                                  type="button"
                                                  className="button button-primary"
                                                  style={{ padding: "4px 8px", fontSize: "11px" }}
                                                  onClick={() => handleSaveInline(item, supplier, entry)}
                                                  disabled={isSaving}
                                                >
                                                  {isSaving ? (isAr ? "جاري الحفظ..." : "Saving...") : (isAr ? "حفظ" : "Save")}
                                                </button>
                                                <button
                                                  type="button"
                                                  className="button button-secondary"
                                                  style={{ padding: "4px 8px", fontSize: "11px" }}
                                                  onClick={() => setEditingEntry(null)}
                                                  disabled={isSaving}
                                                >
                                                  {isAr ? "إلغاء" : "Cancel"}
                                                </button>
                                              </div>
                                            ) : (
                                              <button
                                                type="button"
                                                className="button button-secondary"
                                                style={{ padding: "4px 10px", fontSize: "11px" }}
                                                onClick={() => setEditingEntry({ itemId: item.id, supplierId: supplier.id, price: entry ? String(entry.price) : "", notes: entry?.notes ?? "" })}
                                              >
                                                {entry ? (isAr ? "تعديل" : "Edit") : (isAr ? "تسجيل السعر" : "Record Price")}
                                              </button>
                                            )}
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
                Close Dashboard
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
          🔍 Review & Edit Submitted Prices
        </button>
      </div>

      {/* ── Category + Item selectors ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "16px" }}>
        <label className="field">
          <span>1. {t("purch.selectCategory")}</span>
          <select value={selectedCategoryId} onChange={e => setSelectedCategoryId(e.target.value)}>
            {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span>2. {t("purch.selectItem")}</span>
          <select value={selectedItemId} onChange={e => setSelectedItemId(e.target.value)} disabled={filteredItems.length === 0}>
            {filteredItems.length === 0
              ? <option value="">— {t("purch.noItemsInCat")} —</option>
              : filteredItems.map(item => <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)
            }
          </select>
        </label>
      </div>

      {selectedItem && (
        <form action={createBatchPriceEntries} onSubmit={handleFormSubmit}>
          <input type="hidden" name="itemId" value={selectedItem.id} />
          <input type="hidden" name="month" value={month} />
          <input type="hidden" name="collectedBy" value={displayName} />
          <input type="hidden" name="collectedRole" value={role} />

          <div className="panel" style={{ padding: "20px 24px" }}>
            <div className="panel-header">
              <div>
                <p className="eyebrow">3. {t("purch.recordPrices")}</p>
                <h2 style={{ fontSize: "14px" }}>{selectedItem.name}</h2>
                <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{t("purch.enterPrices")}</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
                <span className="badge badge-strong">{selectedItem.unit}</span>
                {newEntries.length > 0 && (
                  <span className="badge badge-success" style={{ fontSize: "10px" }}>
                    {newEntries.length} will save directly
                  </span>
                )}

                {/* SC only: extend previous month prices */}
                {role === "SC" && suppliersExtendable.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setExtendModal(true)}
                    className="button button-secondary"
                    style={{ fontSize: "11px", padding: "5px 11px", gap: "5px", marginTop: "2px" }}
                  >
                    📅 Extend {suppliersExtendable.length} prev-month price{suppliersExtendable.length > 1 ? "s" : ""}
                  </button>
                )}
              </div>
            </div>

            {/* Supplier rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "4px" }}>
              {suppliers.map((supplier, idx) => {
                const color = COLORS[idx % COLORS.length];
                const currentPrice = supplierPrices[supplier.id] ?? "";
                const lastEntry  = latestMap[`${supplier.id}_${shiftMonth(month, -1)}`];
                const thisEntry  = currentMonthEntriesBySupplier.get(supplier.id);
                const isConfirmed = Boolean(thisEntry);
                const isChangeMode = isConfirmed && currentPrice && Number(currentPrice) > 0;

                return (
                  <div key={supplier.id} style={{
                    display: "grid", gridTemplateColumns: "auto 1fr 160px auto",
                    gap: "12px", alignItems: "center", padding: "14px 16px",
                    borderRadius: "var(--radius)",
                    border: `1.5px solid ${isChangeMode ? "var(--warning)" : currentPrice ? color + "55" : "var(--border)"}`,
                    background: isChangeMode ? "var(--warning-light)" : currentPrice ? `${color}08` : "var(--bg-elevated)",
                    transition: "all 200ms ease",
                    position: "relative",
                  }}>


                    {/* Supplier identity */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: "180px" }}>
                      <span style={{ width: "32px", height: "32px", borderRadius: "8px", background: color + "22", border: `1.5px solid ${color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 800, color, flexShrink: 0 }}>
                        {supplier.name.charAt(0)}
                      </span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "13px" }}>{supplier.name}</div>
                        {lastEntry && <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "1px" }}>{t("purch.lastMonth")} {formatCurrency(lastEntry.price)}</div>}
                        {thisEntry && (
                          <div style={{ fontSize: "10px", color: isChangeMode ? "var(--warning)" : "var(--success)", marginTop: "1px", fontWeight: 600 }}>
                            {isChangeMode
                              ? `Current confirmed price: ${formatCurrency(thisEntry.price)}`
                              : `Current price: ${formatCurrency(thisEntry.price)}`}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Notes */}
                    <input
                      type="text"
                      name={isConfirmed ? undefined : `notes_${supplier.id}`}
                      placeholder={t("purch.notesOptional")}
                      value={supplierNotes[supplier.id] ?? ""}
                      onChange={e => setSupplierNotes(prev => ({ ...prev, [supplier.id]: e.target.value }))}
                      style={{ padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border-medium)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: "12px" }}
                    />

                    {/* Price */}
                    <input
                      type="number"
                      name={isConfirmed ? undefined : `price_${supplier.id}`}
                      step="0.01" min="0.01"
                      placeholder={t("purch.pricePlaceholder")}
                      value={currentPrice}
                      onChange={e => setSupplierPrices(prev => ({ ...prev, [supplier.id]: e.target.value }))}
                      style={{
                        width: "100%", padding: "8px 12px", borderRadius: "var(--radius)",
                        border: `1.5px solid ${isChangeMode ? "var(--warning)" : currentPrice ? color : "var(--border-medium)"}`,
                        background: "var(--bg-surface)",
                        color: isChangeMode ? "var(--warning)" : currentPrice ? color : "var(--text-primary)",
                        fontSize: "14px", fontWeight: currentPrice ? 700 : 400,
                        outline: "none", transition: "all 200ms",
                      }}
                    />

                    {/* Status icon */}
                    <div style={{ width: "20px", display: "flex", justifyContent: "center" }}>
                      <span style={{ fontSize: "16px", opacity: currentPrice && Number(currentPrice) > 0 ? 1 : 0.3 }}>
                        {isChangeMode ? "⚠️" : currentPrice && Number(currentPrice) > 0 ? "✓" : "○"}
                      </span>
                    </div>
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
                      {f === "all" ? t("gen.all") : `${f}M`}
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
                        <th style={{ padding: "7px 12px", textAlign: "left", fontWeight: 800, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", borderBottom: "1.5px solid var(--border)", position: "sticky", top: 0, left: 0, background: "var(--bg-subtle)", zIndex: 3, whiteSpace: "nowrap", boxShadow: "1px 0 0 var(--border-light), 0 1px 0 var(--border)", minWidth: "80px" }}>
                          {t("purch.month")}
                        </th>
                        {pivotData.activeSuppliers.map(sup => {
                          const color = COLORS[suppliers.findIndex(s => s.id === sup.id) % COLORS.length];
                          return (
                            <th key={sup.id} style={{ padding: "7px 12px", textAlign: "center", fontWeight: 700, fontSize: "10px", color, borderBottom: "1.5px solid var(--border)", position: "sticky", top: 0, background: "var(--bg-subtle)", zIndex: 2, whiteSpace: "nowrap", boxShadow: "0 1px 0 var(--border)", minWidth: "110px" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, display: "inline-block" }} />
                                {sup.name}
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
                            <td style={{ padding: "8px 12px", position: "sticky", left: 0, background: isLatest ? "rgba(99,102,241,0.07)" : "var(--bg-surface)", zIndex: 1, boxShadow: "1px 0 0 var(--border-light)", whiteSpace: "nowrap" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                <span className="badge" style={{ fontSize: "10px", ...(isLatest ? { background: "var(--primary)", color: "#fff", borderColor: "var(--primary)" } : {}) }}>{m}</span>
                                {isLatest && <span style={{ fontSize: "8px", fontWeight: 800, color: "var(--primary)" }}>{t("gen.latest")}</span>}
                              </div>
                            </td>
                            {pivotData.activeSuppliers.map(sup => {
                              const price = pivotData.priceMap.get(`${sup.id}||${m}`);
                              const isBest = price !== undefined && price === minP;
                              return (
                                <td key={sup.id} style={{ padding: "8px 12px", textAlign: "center", background: isBest ? "rgba(16,185,129,0.08)" : "transparent", whiteSpace: "nowrap" }}>
                                  {price !== undefined ? (
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                                      <strong style={{ fontSize: "13px", fontWeight: isBest ? 800 : 600, color: isBest ? "var(--success)" : "var(--text-primary)" }}>{formatCurrency(price)}</strong>
                                      {isBest && <span style={{ fontSize: "8px", fontWeight: 800, background: "var(--success)", color: "#fff", padding: "1px 5px", borderRadius: "3px" }}>{t("gen.best")}</span>}
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

            {/* Submit */}
            <div style={{ marginTop: "8px" }}>
              <button type="submit" className="button button-primary button-block" disabled={newEntries.length === 0 && changeEntries.length === 0} style={{ opacity: filledCount === 0 ? 0.5 : 1 }}>
                {filledCount === 0
                  ? t("purch.enterAtLeastOne")
                  : newEntries.length > 0 && changeEntries.length === 0
                    ? `${t("purch.savePrices")} ${newEntries.length} ${t("purch.saveMultiple")} ${formatMonthLabel(month)}`
                    : changeEntries.length > 0 && newEntries.length === 0
                      ? `Submit ${changeEntries.length} Change Request(s) for SC Approval`
                      : `Save ${newEntries.length} New + Request ${changeEntries.length} Change(s)`
                }
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
