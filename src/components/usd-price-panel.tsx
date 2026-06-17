"use client";

import { useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n-context";

type CatalogRow = {
  item_id: number;
  item_name: string;
  unit: string;
  category_name: string;
  sell_min: number | null;
  sell_max: number | null;
  moq?: number;
};

type Props = {
  catalog: CatalogRow[];
  month: string;
  username: string;
};

/* ─── Design tokens matching the FAERP print/report pages ─── */
const R = {
  navy:       "#10213a",
  navyMid:    "#4b6b97",
  navySoft:   "#5f7699",
  border:     "#dbe5f2",
  rowBorder:  "#eef3f8",
  bg:         "#f4f8fd",
  white:      "#ffffff",
  green:      "#0a7a4a",
  blue:       "#1d4ed8",
  font:       "'Readex Pro Variable', -apple-system, sans-serif",
};

export default function UsdPricePanel({ catalog, month, username }: Props) {
  const { locale } = useI18n();
  const [open, setOpen]               = useState(false);
  const [rate, setRate]               = useState<number | null>(null);
  const [loadingRate, setLoadingRate] = useState(false);
  const [rateError, setRateError]     = useState<string | null>(null);
  const [rateInfo, setRateInfo]       = useState<string | null>(null);

  const lbl = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const published = catalog.filter((r) => r.sell_min !== null && r.sell_max !== null);
  const grouped: Record<string, CatalogRow[]> = {};
  for (const row of published) {
    if (!grouped[row.category_name]) grouped[row.category_name] = [];
    grouped[row.category_name].push(row);
  }

  const openPanel = useCallback(async () => {
    setOpen(true);
    if (rate) return;
    setLoadingRate(true);
    setRateError(null);
    try {
      const res = await fetch("/api/exchange-rate");
      const d = await res.json();
      if (res.ok && d.rate) {
        setRate(d.rate);
        setRateInfo(d.fetched_at ? new Date(d.fetched_at).toLocaleDateString() : "");
      } else {
        setRateError(d.error ?? lbl("Could not load rate.", "تعذّر تحميل سعر الصرف."));
      }
    } catch {
      setRateError(lbl("Network error.", "خطأ في الاتصال."));
    } finally {
      setLoadingRate(false);
    }
  }, [rate, locale]);

  const toUSD  = (egp: number | null) => egp !== null && rate ? egp / rate : null;
  const fmtUSD = (v: number | null)   => v !== null
    ? `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "—";
  const fmtEGP = (v: number | null)   => v !== null
    ? `EGP ${v.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
    : "—";

  /* ── CSV Export ── */
  const exportCSV = useCallback(() => {
    if (!rate) return;
    const header = ["Category", "Product", "Unit", "MOQ", "Min Sell (EGP)", "Max Sell (EGP)", "Min Sell (USD)", "Max Sell (USD)"].join(",");
    const rows = published.map((r) => [
      `"${r.category_name}"`, `"${r.item_name}"`, `"${r.unit}"`,
      r.moq ?? 0,
      r.sell_min?.toFixed(2) ?? "",
      r.sell_max?.toFixed(2) ?? "",
      toUSD(r.sell_min)?.toFixed(2) ?? "",
      toUSD(r.sell_max)?.toFixed(2) ?? "",
    ].join(","));
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `selling_prices_usd_${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [published, rate, month]);

  /* ── Print ── */
  const exportPDF = useCallback(() => { window.print(); }, []);

  /* ── Closed state: trigger button ── */
  if (!open) {
    return (
      <button
        type="button"
        onClick={openPanel}
        style={{
          padding: "10px 20px", borderRadius: "10px",
          border: "1px solid var(--border-medium)",
          backgroundColor: "var(--bg-surface)", color: "var(--text-primary)",
          cursor: "pointer", fontWeight: "700", fontSize: "13px",
          display: "flex", alignItems: "center", gap: "8px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)", transition: "all 200ms",
          width: "100%", justifyContent: "center",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--primary)";
          e.currentTarget.style.color       = "var(--primary)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--border-medium)";
          e.currentTarget.style.color       = "var(--text-primary)";
        }}
      >
        💵 {lbl("Show Prices in USD", "عرض الأسعار بالدولار")}
      </button>
    );
  }

  /* ── Print CSS ── */
  const printCSS = `
    @media print {
      body * { visibility: hidden !important; }
      .usd-print-root, .usd-print-root * { visibility: visible !important; }
      .usd-print-root {
        position: fixed !important; top: 0 !important; left: 0 !important;
        width: 100% !important; height: auto !important;
        background: #fff !important; z-index: 9999 !important;
        overflow: visible !important;
      }
      .usd-no-print  { display: none !important; visibility: hidden !important; }
      .usd-print-show { display: block !important; visibility: visible !important; }
      .modal-overlay  { background: none !important; position: static !important; display: block !important; padding: 0 !important; }
      .modal-container { max-height: none !important; box-shadow: none !important; overflow: visible !important; max-width: 100% !important; border: none !important; }
      .modal-body { overflow: visible !important; padding: 0 !important; }
      table { page-break-inside: auto; width: 100% !important; }
      tr    { page-break-inside: avoid; }
      thead { display: table-header-group; }
    }
  `;

  /* ── Shared table header columns ── */
  const COL_HEADERS = [
    lbl("Product", "المنتج"),
    lbl("Unit",    "الوحدة"),
    lbl("MOQ",     "الحد الأدنى"),
    lbl("Min (EGP)",  "أدنى (ج.م)"),
    lbl("Max (EGP)",  "أقصى (ج.م)"),
    lbl("Min (USD)",  "أدنى ($)"),
    lbl("Max (USD)",  "أقصى ($)"),
  ];

  /* ── Report body — shared between modal view and print ── */
  const ReportBody = () => (
    <div style={{ fontFamily: R.font, color: R.navy }}>
      {/* ═══ Metrics row ═══ */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
        gap: "14px", marginBottom: "28px",
      }}>
        {[
          { label: lbl("Exchange Rate", "سعر الصرف"), value: rate ? `1 USD = ${rate.toFixed(4)} EGP` : "—", sub: rateInfo ?? "" },
          { label: lbl("Published Items", "المنتجات المعتمدة"), value: String(published.length), sub: lbl("with selling prices", "بأسعار بيع معتمدة") },
          { label: lbl("Categories", "الفئات"), value: String(Object.keys(grouped).length), sub: lbl("product categories", "فئات المنتجات") },
        ].map(({ label, value, sub }) => (
          <div key={label} style={{
            border: `1px solid ${R.border}`, borderRadius: "14px",
            padding: "16px 20px", background: R.white,
          }}>
            <div style={{ color: R.navySoft, fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>
              {label}
            </div>
            <div style={{ fontSize: "20px", fontWeight: 800, color: R.navy, lineHeight: 1.1 }}>{value}</div>
            {sub && <div style={{ color: R.navyMid, fontSize: "10.5px", marginTop: "4px" }}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* ═══ Tables per category ═══ */}
      {Object.entries(grouped).map(([cat, rows], ci) => (
        <div key={cat} style={{ marginBottom: ci < Object.keys(grouped).length - 1 ? "32px" : 0 }}>
          {/* Category heading */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px", borderBottom: `2px solid ${R.border}`, paddingBottom: "8px" }}>
            <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 800, color: R.navy, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {cat}
            </h3>
            <span style={{
              fontSize: "11px", fontWeight: 700, padding: "2px 10px",
              borderRadius: "20px", backgroundColor: R.bg,
              border: `1px solid ${R.border}`, color: R.navySoft,
            }}>{rows.length}</span>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr>
                {COL_HEADERS.map((h, i) => (
                  <th key={h} style={{
                    textAlign: i >= 3 ? "right" : "left",
                    borderBottom: `2px solid ${R.border}`,
                    padding: "9px 10px",
                    color: R.navySoft, fontWeight: 700,
                    fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.07em",
                    whiteSpace: "nowrap", background: R.bg,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.item_id} style={{ borderBottom: `1px solid ${R.rowBorder}`, background: i % 2 === 0 ? R.white : R.bg }}>
                  {/* Product */}
                  <td style={{ padding: "10px 10px", fontWeight: 600, color: R.navy, maxWidth: "220px" }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }} title={r.item_name}>
                      {r.item_name}
                    </span>
                  </td>
                  {/* Unit */}
                  <td style={{ padding: "10px 10px", color: R.navySoft, whiteSpace: "nowrap" }}>
                    {r.unit}
                  </td>
                  {/* MOQ */}
                  <td style={{ padding: "10px 10px", color: R.navySoft, textAlign: "center" }}>
                    {r.moq ? r.moq.toLocaleString() : "—"}
                  </td>
                  {/* Min EGP */}
                  <td style={{ padding: "10px 10px", textAlign: "right", whiteSpace: "nowrap", color: R.green, fontWeight: 700 }}>
                    {fmtEGP(r.sell_min)}
                  </td>
                  {/* Max EGP */}
                  <td style={{ padding: "10px 10px", textAlign: "right", whiteSpace: "nowrap", color: R.blue, fontWeight: 700 }}>
                    {fmtEGP(r.sell_max)}
                  </td>
                  {/* Min USD */}
                  <td style={{ padding: "10px 10px", textAlign: "right", whiteSpace: "nowrap" }}>
                    <span style={{ fontWeight: 800, color: R.green, fontSize: "13px" }}>
                      {fmtUSD(toUSD(r.sell_min))}
                    </span>
                  </td>
                  {/* Max USD */}
                  <td style={{ padding: "10px 10px", textAlign: "right", whiteSpace: "nowrap" }}>
                    <span style={{ fontWeight: 800, color: R.blue, fontSize: "13px" }}>
                      {fmtUSD(toUSD(r.sell_max))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {/* ═══ Footer ═══ */}
      <div style={{ marginTop: "32px", paddingTop: "16px", borderTop: `1px solid ${R.border}`, display: "flex", justifyContent: "space-between", fontSize: "10.5px", color: R.navySoft }}>
        <span>FAERP · {lbl("Published Selling Prices — USD", "أسعار البيع المعتمدة — بالدولار")} · {month}</span>
        <span>{lbl("Generated by", "أنشأه")} {username} · {new Date().toLocaleDateString()}</span>
      </div>
    </div>
  );

  return (
    <>
      <style>{printCSS}</style>

      <div className="modal-overlay usd-print-root" onClick={() => setOpen(false)}>
        <div
          className="modal-container"
          style={{ maxWidth: "900px", maxHeight: "92vh", display: "flex", flexDirection: "column", background: R.white }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Modal top bar (hidden on print) ── */}
          <div className="usd-no-print modal-header" style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "16px 24px", borderBottom: `1px solid ${R.border}`,
            background: R.white, borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
          }}>
            {/* Brand + title */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{
                width: "38px", height: "38px", borderRadius: "10px",
                background: "linear-gradient(135deg, #10213a 0%, #1d4ed8 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "18px", flexShrink: 0,
              }}>💵</div>
              <div>
                <p style={{ margin: 0, fontSize: "10px", color: R.navySoft, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>
                  FAERP · {lbl("Price Report", "تقرير الأسعار")}
                </p>
                <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: R.navy }}>
                  {lbl("Published Selling Prices in USD", "قائمة الأسعار المعتمدة بالدولار")}
                </h2>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {rate && (
                <>
                  <button
                    type="button" onClick={exportCSV}
                    style={{
                      padding: "7px 14px", fontSize: "12px", fontWeight: 700,
                      borderRadius: "8px", border: `1px solid ${R.border}`,
                      background: R.bg, color: R.navy, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: "6px",
                    }}
                  >📊 {lbl("Excel / CSV", "إكسل")}</button>
                  <button
                    type="button" onClick={exportPDF}
                    style={{
                      padding: "7px 14px", fontSize: "12px", fontWeight: 700,
                      borderRadius: "8px", border: "1px solid #10213a",
                      background: "#10213a", color: "#fff", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: "6px",
                    }}
                  >🖨️ {lbl("Print / PDF", "طباعة PDF")}</button>
                </>
              )}
              <button className="modal-close-btn" onClick={() => setOpen(false)} style={{ fontSize: "24px", color: R.navySoft }} >×</button>
            </div>
          </div>

          {/* ── Modal body ── */}
          <div className="modal-body" style={{ padding: "28px 28px 24px", overflowY: "auto", flex: 1, background: R.white }}>

            {/* Print-only report header */}
            <div className="usd-print-show" style={{ display: "none", marginBottom: "24px", borderBottom: `2px solid ${R.border}`, paddingBottom: "16px" }}>
              <p style={{ margin: 0, color: R.navyMid, textTransform: "uppercase", letterSpacing: "0.12em", fontSize: "11px", fontWeight: 700 }}>
                FAERP · {lbl("Published Selling Prices — USD", "أسعار البيع المعتمدة — بالدولار")}
              </p>
              <h1 style={{ margin: "6px 0 4px", fontSize: "28px", fontWeight: 800, color: R.navy }}>{month}</h1>
              <p style={{ margin: 0, fontSize: "12px", color: R.navySoft }}>
                1 USD = {rate?.toFixed(4)} EGP
                {rateInfo && ` · ${lbl("Rate date", "تاريخ السعر")}: ${rateInfo}`}
                {` · ${lbl("Printed by", "طبع بواسطة")} ${username}`}
              </p>
            </div>

            {/* Loading / error / content */}
            {loadingRate && (
              <div style={{ padding: "60px", textAlign: "center", color: R.navySoft }}>
                ⏳ {lbl("Loading exchange rate…", "جارٍ تحميل سعر الصرف…")}
              </div>
            )}

            {rateError && (
              <div style={{
                padding: "16px 20px", marginBottom: "20px",
                background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)",
                borderRadius: "10px", fontSize: "13px", color: "#dc2626",
              }}>
                ⚠️ {rateError}
                <div style={{ fontSize: "11px", marginTop: "6px", color: R.navySoft }}>
                  {lbl("Use the USD Rate Card to refresh or enter a rate manually.", "استخدم بطاقة سعر الدولار لتحديث السعر أو إدخاله يدوياً.")}
                </div>
              </div>
            )}

            {!rate && !loadingRate && !rateError && (
              <div style={{ padding: "60px", textAlign: "center", color: R.navySoft }}>
                <div style={{ fontSize: "40px", marginBottom: "12px" }}>💱</div>
                <div style={{ fontWeight: 700 }}>{lbl("No exchange rate available.", "لا يوجد سعر صرف متاح.")}</div>
                <div style={{ fontSize: "12px", marginTop: "6px" }}>
                  {lbl("Use the USD Rate Card above to set a rate.", "استخدم بطاقة سعر الدولار أعلاه لتعيين سعر.")}
                </div>
              </div>
            )}

            {rate && !loadingRate && <ReportBody />}
          </div>
        </div>
      </div>
    </>
  );
}
