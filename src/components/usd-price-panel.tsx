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

type Props = { catalog: CatalogRow[]; month: string; username: string };

/* ── Design tokens (match FAERP report/print pages) ─────────────────── */
const R = {
  navy:    "#10213a", navyMid: "#4b6b97", navySoft: "#5f7699",
  border:  "#dbe5f2", rowBorder: "#eef3f8", bg: "#f4f8fd", white: "#ffffff",
  green:   "#0a7a4a", blue: "#1d4ed8",
  font:    "'Readex Pro Variable', -apple-system, sans-serif",
};

export default function UsdPricePanel({ catalog, month, username }: Props) {
  const { locale } = useI18n();
  const [open, setOpen]             = useState(false);
  const [rate, setRate]             = useState<number | null>(null);
  const [loadingRate, setLoading]   = useState(false);
  const [rateError, setRateError]   = useState<string | null>(null);
  const [rateInfo, setRateInfo]     = useState<string | null>(null);
  const [exporting, setExporting]   = useState(false);

  const lbl = (en: string, ar: string) => (locale === "ar" ? ar : en);

  const published = catalog.filter(r => r.sell_min !== null && r.sell_max !== null);
  const grouped: Record<string, CatalogRow[]> = {};
  for (const row of published) {
    if (!grouped[row.category_name]) grouped[row.category_name] = [];
    grouped[row.category_name].push(row);
  }

  const openPanel = useCallback(async () => {
    setOpen(true);
    if (rate) return;
    setLoading(true); setRateError(null);
    try {
      const res = await fetch("/api/exchange-rate");
      const d = await res.json();
      if (res.ok && d.rate) {
        setRate(d.rate);
        setRateInfo(d.fetched_at ? new Date(d.fetched_at).toLocaleDateString() : "");
      } else {
        setRateError(d.error ?? lbl("Could not load rate.", "تعذّر تحميل سعر الصرف."));
      }
    } catch { setRateError(lbl("Network error.", "خطأ في الاتصال.")); }
    finally { setLoading(false); }
  }, [rate, locale]);

  const toUSD = (egp: number | null) => egp !== null && rate ? egp / rate : null;
  const fmtUSD = (v: number | null) => v !== null
    ? `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";
  const fmtEGP = (v: number | null) => v !== null
    ? `EGP ${v.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—";

  /* ── Styled XLSX Export (xlsx-js-style) ────────────────────────────── */
  const exportXLSX = useCallback(async () => {
    if (!rate || exporting) return;
    setExporting(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const XLSX: any = await import("xlsx-js-style");

      /* Style definitions */
      const hdr = { /* navy header */
        font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10, name: "Calibri" },
        fill: { patternType: "solid", fgColor: { rgb: "10213A" } },
        alignment: { horizontal: "left", vertical: "center" },
        border: { top: { style: "thin", color: { rgb: "10213A" } }, bottom: { style: "thin", color: { rgb: "10213A" } }, left: { style: "thin", color: { rgb: "10213A" } }, right: { style: "thin", color: { rgb: "10213A" } } },
      };
      const hdrR = { ...hdr, alignment: { horizontal: "right", vertical: "center" } };
      const cat = { /* category sub-heading */
        font: { bold: true, color: { rgb: "10213A" }, sz: 10 },
        fill: { patternType: "solid", fgColor: { rgb: "EEF3FB" } },
        alignment: { horizontal: "left", vertical: "center" },
        border: { top: { style: "thin", color: { rgb: "DBE5F2" } }, bottom: { style: "thin", color: { rgb: "DBE5F2" } }, left: { style: "thin", color: { rgb: "DBE5F2" } }, right: { style: "thin", color: { rgb: "DBE5F2" } } },
      };
      const even = { font: { sz: 10 }, fill: { patternType: "solid", fgColor: { rgb: "FFFFFF" } }, alignment: { horizontal: "left", vertical: "center" }, border: { top: { style: "thin", color: { rgb: "EEF3F8" } }, bottom: { style: "thin", color: { rgb: "EEF3F8" } }, left: { style: "thin", color: { rgb: "EEF3F8" } }, right: { style: "thin", color: { rgb: "EEF3F8" } } } };
      const odd  = { ...even, fill: { patternType: "solid", fgColor: { rgb: "F4F8FD" } } };
      const minS = { font: { bold: true, color: { rgb: "0A7A4A" }, sz: 10 }, fill: { patternType: "solid", fgColor: { rgb: "F0FBF4" } }, alignment: { horizontal: "right", vertical: "center" }, border: even.border };
      const maxS = { font: { bold: true, color: { rgb: "1D4ED8" }, sz: 10 }, fill: { patternType: "solid", fgColor: { rgb: "F0F4FF" } }, alignment: { horizontal: "right", vertical: "center" }, border: even.border };
      const foot = { font: { italic: true, color: { rgb: "5F7699" }, sz: 9 }, fill: { patternType: "solid", fgColor: { rgb: "F4F8FD" } } };
      const numR = { ...even, alignment: { horizontal: "right", vertical: "center" } };

      /* Build rows */
      const s = (v: unknown, t: string, style: object, z?: string) =>
        z ? { v, t, s: style, z } : { v, t, s: style };
      const COLS = ["Category", "Product", "Unit", "MOQ", "Min (EGP)", "Max (EGP)", "Min (USD $)", "Max (USD $)"];

      const wsData: unknown[][] = [];

      /* Row 1: report title */
      wsData.push([
        s(`FAERP — Published Selling Prices in USD — ${month}`, "s", hdr),
        ...Array(7).fill(s("", "s", hdr)),
      ]);

      /* Row 2: subtitle */
      wsData.push([
        s(`1 USD = ${rate.toFixed(4)} EGP   |   Rate date: ${rateInfo ?? ""}   |   Generated by: ${username}`, "s", { font: { italic: true, color: { rgb: "4B6B97" }, sz: 9 }, fill: { patternType: "solid", fgColor: { rgb: "EEF3FB" } } }),
        ...Array(7).fill(s("", "s", {})),
      ]);

      /* Row 3: blank spacer */
      wsData.push(Array(8).fill(s("", "s", {})));

      /* Row 4: column headers */
      wsData.push(COLS.map((h, i) => s(h, "s", i >= 4 ? hdrR : hdr)));

      /* Data rows grouped by category */
      let rowIdx = 0;
      Object.entries(grouped).forEach(([catName, rows]) => {
        rows.forEach((r, i) => {
          const bg = rowIdx % 2 === 0 ? even : odd;
          wsData.push([
            s(i === 0 ? catName : "", "s", i === 0 ? cat : bg),
            s(r.item_name, "s", bg),
            s(r.unit, "s", bg),
            s(r.moq ?? 0, "n", { ...numR, fill: bg.fill }),
            s(r.sell_min ?? 0, "n", minS, "#,##0.00"),
            s(r.sell_max ?? 0, "n", maxS, "#,##0.00"),
            s(toUSD(r.sell_min) ?? 0, "n", minS, "#,##0.00"),
            s(toUSD(r.sell_max) ?? 0, "n", maxS, "#,##0.00"),
          ]);
          rowIdx++;
        });
      });

      /* Footer */
      wsData.push(Array(8).fill(s("", "s", {})));
      wsData.push([s(`© FAERP · ${new Date().toLocaleDateString()} · ${published.length} items`, "s", foot), ...Array(7).fill(s("", "s", foot))]);

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      /* Column widths */
      ws["!cols"] = [
        { wch: 22 }, { wch: 44 }, { wch: 10 }, { wch: 8 },
        { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
      ];

      /* Row heights */
      ws["!rows"] = [{ hpt: 22 }, { hpt: 14 }, { hpt: 6 }, { hpt: 18 }];

      /* Merges: title and subtitle span all 8 cols */
      ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
      ];

      const wb = XLSX.utils.book_new();
      wb.Props = { Title: `USD Prices ${month}`, Author: username };
      XLSX.utils.book_append_sheet(wb, ws, `USD Prices ${month}`);
      XLSX.writeFile(wb, `FAERP_USD_Prices_${month}.xlsx`);
    } catch (e) {
      console.error("XLSX export failed:", e);
    } finally {
      setExporting(false);
    }
  }, [published, grouped, rate, month, username, rateInfo, exporting]);

  /* ── PDF print (triggers @media print) ─────────────────────────────── */
  const exportPDF = useCallback(() => window.print(), []);

  /* ── Print CSS ──────────────────────────────────────────────────────── */
  const printCSS = `
    @media print {
      /* Hide everything on screen */
      body * { visibility: hidden !important; }
      /* Show ONLY the dedicated print document */
      #usd-print-doc { display: block !important; visibility: visible !important; }
      #usd-print-doc * { visibility: visible !important; }
      #usd-print-doc {
        position: fixed !important;
        top: 0 !important; left: 0 !important;
        width: 100% !important; height: auto !important;
        background: #fff !important;
        z-index: 99999 !important;
        padding: 32px !important;
        box-sizing: border-box !important;
        font-family: 'Readex Pro Variable', Calibri, sans-serif !important;
        color: #10213a !important;
      }
      .usd-no-print { display: none !important; visibility: hidden !important; }
      table { page-break-inside: auto; width: 100% !important; border-collapse: collapse !important; }
      tr { page-break-inside: avoid; }
      thead { display: table-header-group; }
    }
  `;

  /* ── Closed state button ─────────────────────────────────────────────── */
  if (!open) {
    return (
      <button
        type="button" onClick={openPanel}
        style={{ padding: "10px 20px", borderRadius: "10px", border: "1px solid var(--border-medium)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)", cursor: "pointer", fontWeight: "700", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", transition: "all 200ms", width: "100%", justifyContent: "center" }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.color = "var(--primary)"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-medium)"; e.currentTarget.style.color = "var(--text-primary)"; }}
      >
        💵 {lbl("Show Prices in USD", "عرض الأسعار بالدولار")}
      </button>
    );
  }

  /* ── Shared report content (modal body + print doc) ─────────────────── */
  const COL_HEADERS = [
    lbl("Product", "المنتج"), lbl("Unit", "الوحدة"), lbl("MOQ", "الحد الأدنى"),
    lbl("Min (EGP)", "أدنى (ج.م)"), lbl("Max (EGP)", "أقصى (ج.م)"),
    lbl("Min (USD)", "أدنى ($)"), lbl("Max (USD)", "أقصى ($)"),
  ];

  const ReportContent = ({ isPrint = false }: { isPrint?: boolean }) => (
    <div style={{ fontFamily: R.font, color: R.navy }}>
      {/* Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px", marginBottom: "28px" }}>
        {[
          { label: lbl("Exchange Rate", "سعر الصرف"),        value: rate ? `1 USD = ${rate.toFixed(4)} EGP` : "—",  sub: rateInfo ?? "" },
          { label: lbl("Published Items", "المنتجات المعتمدة"), value: String(published.length), sub: lbl("with selling prices", "بأسعار بيع معتمدة") },
          { label: lbl("Categories", "الفئات"),              value: String(Object.keys(grouped).length), sub: lbl("product categories", "فئات المنتجات") },
        ].map(({ label, value, sub }) => (
          <div key={label} style={{ border: `1px solid ${R.border}`, borderRadius: isPrint ? "10px" : "14px", padding: "16px 20px", background: R.white }}>
            <div style={{ color: R.navySoft, fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>{label}</div>
            <div style={{ fontSize: "20px", fontWeight: 800, color: R.navy, lineHeight: 1.1 }}>{value}</div>
            {sub && <div style={{ color: R.navyMid, fontSize: "10.5px", marginTop: "4px" }}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* Category tables */}
      {Object.entries(grouped).map(([cat, rows], ci) => (
        <div key={cat} style={{ marginBottom: ci < Object.keys(grouped).length - 1 ? "28px" : 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px", borderBottom: `2px solid ${R.border}`, paddingBottom: "8px" }}>
            <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 800, color: R.navy, textTransform: "uppercase", letterSpacing: "0.06em" }}>{cat}</h3>
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 10px", borderRadius: "20px", backgroundColor: R.bg, border: `1px solid ${R.border}`, color: R.navySoft }}>{rows.length}</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr>
                {COL_HEADERS.map((h, i) => (
                  <th key={h} style={{ textAlign: i >= 3 ? "right" : "left", borderBottom: `2px solid ${R.border}`, padding: "9px 10px", color: R.navySoft, fontWeight: 700, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap", background: R.bg }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.item_id} style={{ borderBottom: `1px solid ${R.rowBorder}`, background: i % 2 === 0 ? R.white : R.bg }}>
                  <td style={{ padding: "10px 10px", fontWeight: 600, color: R.navy, maxWidth: "220px" }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }} title={r.item_name}>{r.item_name}</span>
                  </td>
                  <td style={{ padding: "10px 10px", color: R.navySoft, whiteSpace: "nowrap" }}>{r.unit}</td>
                  <td style={{ padding: "10px 10px", color: R.navySoft, textAlign: "center" }}>{r.moq ? r.moq.toLocaleString() : "—"}</td>
                  <td style={{ padding: "10px 10px", textAlign: "right", whiteSpace: "nowrap", color: R.green, fontWeight: 700 }}>{fmtEGP(r.sell_min)}</td>
                  <td style={{ padding: "10px 10px", textAlign: "right", whiteSpace: "nowrap", color: R.blue, fontWeight: 700 }}>{fmtEGP(r.sell_max)}</td>
                  <td style={{ padding: "10px 10px", textAlign: "right", whiteSpace: "nowrap" }}><span style={{ fontWeight: 800, color: R.green, fontSize: "13px" }}>{fmtUSD(toUSD(r.sell_min))}</span></td>
                  <td style={{ padding: "10px 10px", textAlign: "right", whiteSpace: "nowrap" }}><span style={{ fontWeight: 800, color: R.blue, fontSize: "13px" }}>{fmtUSD(toUSD(r.sell_max))}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {/* Footer */}
      <div style={{ marginTop: "28px", paddingTop: "14px", borderTop: `1px solid ${R.border}`, display: "flex", justifyContent: "space-between", fontSize: "10.5px", color: R.navySoft }}>
        <span>FAERP · {lbl("Published Selling Prices — USD", "أسعار البيع المعتمدة — بالدولار")} · {month}</span>
        <span>{lbl("Generated by", "أنشأه")} {username} · {new Date().toLocaleDateString()}</span>
      </div>
    </div>
  );

  return (
    <>
      <style>{printCSS}</style>

      {/* ══ Screen-only interactive modal ══════════════════════════════ */}
      <div className="modal-overlay usd-no-print" onClick={() => setOpen(false)}>
        <div
          className="modal-container"
          style={{ maxWidth: "900px", maxHeight: "92vh", display: "flex", flexDirection: "column", background: R.white }}
          onClick={e => e.stopPropagation()}
        >
          {/* Top bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: `1px solid ${R.border}`, background: R.white, borderRadius: "var(--radius-lg) var(--radius-lg) 0 0", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "linear-gradient(135deg, #10213a 0%, #1d4ed8 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>💵</div>
              <div>
                <p style={{ margin: 0, fontSize: "10px", color: R.navySoft, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>FAERP · {lbl("Price Report", "تقرير الأسعار")}</p>
                <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: R.navy }}>{lbl("Published Selling Prices in USD", "قائمة الأسعار المعتمدة بالدولار")}</h2>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {rate && (
                <>
                  <button type="button" onClick={exportXLSX} disabled={exporting}
                    style={{ padding: "7px 14px", fontSize: "12px", fontWeight: 700, borderRadius: "8px", border: `1px solid ${R.border}`, background: R.bg, color: R.navy, cursor: exporting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "6px", opacity: exporting ? 0.6 : 1 }}>
                    {exporting ? "⏳" : "📊"} {lbl("Excel / XLSX", "إكسل")}
                  </button>
                  <button type="button" onClick={exportPDF}
                    style={{ padding: "7px 14px", fontSize: "12px", fontWeight: 700, borderRadius: "8px", border: `1px solid ${R.navy}`, background: R.navy, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                    🖨️ {lbl("Print / PDF", "طباعة PDF")}
                  </button>
                </>
              )}
              <button className="modal-close-btn" onClick={() => setOpen(false)} style={{ fontSize: "24px", color: R.navySoft }}>×</button>
            </div>
          </div>

          {/* Body */}
          <div className="modal-body" style={{ padding: "24px 28px", overflowY: "auto", flex: 1, background: R.white }}>
            {loadingRate && <div style={{ padding: "60px", textAlign: "center", color: R.navySoft }}>⏳ {lbl("Loading exchange rate…", "جارٍ تحميل سعر الصرف…")}</div>}
            {rateError && (
              <div style={{ padding: "16px 20px", marginBottom: "20px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "10px", fontSize: "13px", color: "#dc2626" }}>
                ⚠️ {rateError}
                <div style={{ fontSize: "11px", marginTop: "6px", color: R.navySoft }}>{lbl("Use the USD Rate Card to refresh or enter a rate manually.", "استخدم بطاقة سعر الدولار لتحديث السعر أو إدخاله يدوياً.")}</div>
              </div>
            )}
            {!rate && !loadingRate && !rateError && (
              <div style={{ padding: "60px", textAlign: "center", color: R.navySoft }}>
                <div style={{ fontSize: "40px", marginBottom: "12px" }}>💱</div>
                <div style={{ fontWeight: 700 }}>{lbl("No exchange rate available.", "لا يوجد سعر صرف متاح.")}</div>
              </div>
            )}
            {rate && !loadingRate && <ReportContent />}
          </div>
        </div>
      </div>

      {/* ══ Print-only document — positioned at top of page, outside modal ══ */}
      {rate && (
        <div id="usd-print-doc" style={{ display: "none" }}>
          {/* FAERP report header — same style as /dashboard/reports/print */}
          <div style={{ borderBottom: `2px solid ${R.border}`, paddingBottom: "16px", marginBottom: "24px" }}>
            <p style={{ margin: 0, color: R.navyMid, textTransform: "uppercase", letterSpacing: "0.12em", fontSize: "11px", fontWeight: 700 }}>
              FAERP · {lbl("Published Selling Prices — USD", "أسعار البيع المعتمدة — بالدولار")}
            </p>
            <h1 style={{ margin: "6px 0 4px", fontSize: "28px", fontWeight: 800, color: R.navy }}>{month}</h1>
            <p style={{ margin: 0, fontSize: "12px", color: R.navySoft }}>
              1 USD = {rate.toFixed(4)} EGP
              {rateInfo && ` · Rate date: ${rateInfo}`}
              {` · Printed by ${username}`}
            </p>
          </div>
          <ReportContent isPrint />
        </div>
      )}
    </>
  );
}
