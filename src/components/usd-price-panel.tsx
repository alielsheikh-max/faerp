"use client";

import { useState, useCallback } from "react";
import * as XLSX from "xlsx-js-style";
import { formatDate } from "@/lib/format";
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

/* ── Shared PDF helpers (mirrors report-generator.tsx) ────────────────── */
function printWindow(html: string, title: string) {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) { alert("Please allow popups to generate PDF reports."); return; }
  win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8"/>
    <title>${title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet"/>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Inter',sans-serif;font-size:12px;color:#111827;background:#fff;padding:32px 40px}
      .report-header{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:3px solid #6366f1;padding-bottom:16px;margin-bottom:24px}
      .brand{display:flex;align-items:center;gap:10px}
      .brand-mark{width:36px;height:36px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:14px}
      .brand-name{font-size:18px;font-weight:800;color:#111827}
      .brand-sub{font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em}
      .report-meta{text-align:right}
      .report-meta .title{font-size:16px;font-weight:800;color:#111827;margin-bottom:4px}
      .report-meta .subtitle{font-size:11px;color:#6b7280}
      .stat-row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px}
      .stat-box{padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb}
      .stat-box .lbl{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;margin-bottom:4px}
      .stat-box .val{font-size:20px;font-weight:800;color:#111827}
      .stat-box .sub{font-size:9px;color:#9ca3af;margin-top:2px}
      .section-title{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.10em;color:#6366f1;margin:20px 0 10px}
      .cat-header{background:#f5f3ff;padding:8px 12px;font-weight:800;font-size:12px;color:#4338ca;border-left:3px solid #6366f1;margin:12px 0 6px}
      table{width:100%;border-collapse:collapse;margin-bottom:16px}
      th{background:#f9fafb;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#6b7280;padding:8px 10px;border-bottom:2px solid #e5e7eb;text-align:left}
      th.num{text-align:right}
      td{padding:7px 10px;border-bottom:1px solid #f3f4f6;font-size:11px;vertical-align:top}
      tr:last-child td{border-bottom:none}
      .num{text-align:right;font-variant-numeric:tabular-nums}
      .usd-min{color:#0284c7;font-weight:800}
      .usd-max{color:#6366f1;font-weight:800}
      .muted{color:#9ca3af}
      .footer{margin-top:32px;padding-top:12px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:9px;color:#9ca3af}
      .highlight-row td{background:#f0f9ff}
      @media print{body{padding:20px 28px}@page{margin:1.5cm;size:A4}}
    </style>
  </head><body>${html}<script>window.onload=function(){window.print();}<\/script></body></html>`);
  win.document.close();
}

// formatDate() imported from @/lib/format — returns dd-mm-yyyy

/* ────────────────────────────────────────────────────────────────────── */
export default function UsdPricePanel({ catalog, month, username }: Props) {
  const { locale } = useI18n();
  const [open, setOpen]           = useState(false);
  const [rate, setRate]           = useState<number | null>(null);
  const [loadingRate, setLoading] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);
  const [rateInfo, setRateInfo]   = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

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
        setRateInfo(d.fetched_at ? formatDate(new Date(d.fetched_at)) : "");
      } else {
        setRateError(d.error ?? lbl("Could not load rate.", "تعذّر تحميل سعر الصرف."));
      }
    } catch { setRateError(lbl("Network error.", "خطأ في الاتصال.")); }
    finally { setLoading(false); }
  }, [rate, locale]);

  const toUSD = (egp: number | null) => egp !== null && rate ? egp / rate : null;
  const fmtUSD = (v: number | null) => v !== null
    ? `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";

  /* ── PDF Export — opens print window matching report-generator style ── */
  const exportPDF = useCallback(() => {
    if (!rate) return;

    const statsHtml = `<div class="stat-row">
      <div class="stat-box"><div class="lbl">Exchange Rate</div><div class="val">1 USD = ${rate.toFixed(4)}</div><div class="sub">EGP${rateInfo ? ` · ${rateInfo}` : ""}</div></div>
      <div class="stat-box"><div class="lbl">Published Items</div><div class="val">${published.length}</div><div class="sub">with selling prices</div></div>
      <div class="stat-box"><div class="lbl">Categories</div><div class="val">${Object.keys(grouped).length}</div><div class="sub">product categories</div></div>
    </div>`;

    const headerHtml = `<div class="report-header">
      <div class="brand">
        <div class="brand-mark">F</div>
        <div><div class="brand-name">FAERP</div><div class="brand-sub">Enterprise ERP · On-Premises</div></div>
      </div>
      <div class="report-meta">
        <div class="title">Published Selling Prices — USD</div>
        <div class="subtitle">${month} · Generated ${formatDate()}</div>
      </div>
    </div>${statsHtml}`;

    const tablesHtml = Object.entries(grouped).map(([cat, rows]) => {
      const rowsHtml = rows.map(r => `<tr class="highlight-row">
        <td>${r.item_name}</td>
        <td class="muted">${r.unit}</td>
        <td class="num">${r.moq ? r.moq.toLocaleString() : "—"}</td>
        <td class="num usd-min">${fmtUSD(toUSD(r.sell_min))}</td>
        <td class="num usd-max">${fmtUSD(toUSD(r.sell_max))}</td>
      </tr>`).join("");
      return `<div class="cat-header">${cat}</div>
        <table><thead><tr>
          <th>Product</th><th>Unit</th><th class="num">MOQ</th>
          <th class="num">Min (USD $)</th><th class="num">Max (USD $)</th>
        </tr></thead><tbody>${rowsHtml}</tbody></table>`;
    }).join("");

    const footerHtml = `<div class="footer">
      <span>FAERP · Confidential · 1 USD = ${rate.toFixed(4)} EGP</span>
      <span>Prepared by ${username}</span>
      <span>${formatDate(new Date())}</span>
    </div>`;

    printWindow(`${headerHtml}${tablesHtml}${footerHtml}`, `USD Prices - ${month}`);
  }, [rate, rateInfo, published, grouped, month, username]);

  /* ── XLSX Export — mirrors report-generator.tsx styling exactly ─────── */
  const exportXLSX = useCallback(async () => {
    if (!rate || exporting) return;
    setExporting(true);
    try {
      const isAr = locale === "ar";
      const headers = [
        isAr ? "الفئة" : "Category",
        isAr ? "المنتج" : "Product",
        isAr ? "الوحدة" : "Unit",
        isAr ? "الحد الأدنى للطلب" : "MOQ",
        isAr ? "أدنى سعر ($)" : "Min (USD $)",
        isAr ? "أقصى سعر ($)" : "Max (USD $)",
      ];

      const dataRows: (string | number)[][] = [];
      for (const [cat, rows] of Object.entries(grouped)) {
        for (const r of rows) {
          dataRows.push([
            cat,
            r.item_name,
            r.unit,
            r.moq ?? 0,
            parseFloat((toUSD(r.sell_min) ?? 0).toFixed(2)),
            parseFloat((toUSD(r.sell_max) ?? 0).toFixed(2)),
          ]);
        }
      }

      const sheetData: unknown[][] = [
        [`Published Selling Prices in USD — ${month}  |  1 USD = ${rate.toFixed(4)} EGP  |  Generated by: ${username}`],
        [],
        headers,
        ...dataRows,
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

      /* Merges & options */
      worksheet["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
      ];
      worksheet["!views"] = [{ RTL: isAr }];

      /* Auto-fit column widths — account for $ prefix on USD columns */
      const cols = headers.map((h, ci) => {
        let maxLen = String(h).length;
        dataRows.forEach(row => {
          const val = row[ci];
          // For USD price columns (ci 4,5), estimate displayed width: "$1,234.56" ≈ raw digits + 4
          const displayLen = (ci >= 4 && typeof val === "number")
            ? String(Math.round(val)).length + 6
            : String(val ?? "").length;
          if (displayLen > maxLen) maxLen = displayLen;
        });
        // Minimum widths per column type
        const minWidths = [18, 44, 10, 10, 16, 16];
        return { wch: Math.max(maxLen + 4, minWidths[ci] ?? 12) };
      });
      worksheet["!cols"] = cols;

      /* Row heights */
      worksheet["!rows"] = [
        { hpt: 35 },
        { hpt: 10 },
        { hpt: 26 },
        ...Array(dataRows.length).fill({ hpt: 22 }),
      ];

      /* Style definitions — identical to report-generator.tsx */
      const titleStyle = {
        font: { name: "Segoe UI", sz: 14, bold: true, color: { rgb: "065F46" } },
        alignment: { horizontal: isAr ? "right" : "left", vertical: "center" },
      };
      const headerStyle = {
        font: { name: "Segoe UI", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "059669" } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: {
          top:    { style: "thin",   color: { rgb: "047857" } },
          bottom: { style: "medium", color: { rgb: "047857" } },
          left:   { style: "thin",   color: { rgb: "047857" } },
          right:  { style: "thin",   color: { rgb: "047857" } },
        },
      };

      const rightHeaders = ["min", "max", "usd", "$", "moq", "أدنى", "أقصى", "الحد"];

      const getCellStyle = (rowIdx: number, colIdx: number) => {
        const isEven = (rowIdx - 3) % 2 === 0;
        const bgRgb = isEven ? "FFFFFF" : "F9FAFB";
        const hClean = (headers[colIdx] ?? "").toLowerCase();
        const isRight = rightHeaders.some(k => hClean.includes(k)) || colIdx >= 3;
        return {
          font:      { name: "Segoe UI", sz: 10, color: { rgb: "334155" } },
          fill:      { fgColor: { rgb: bgRgb } },
          alignment: { horizontal: isRight ? "right" : (isAr ? "right" : "left"), vertical: "center" },
          border: {
            top:    { style: "thin", color: { rgb: "E2E8F0" } },
            bottom: { style: "thin", color: { rgb: "E2E8F0" } },
            left:   { style: "thin", color: { rgb: "E2E8F0" } },
            right:  { style: "thin", color: { rgb: "E2E8F0" } },
          },
          // Highlight USD price cells in blue/green tones
          ...(colIdx === 4 ? { font: { name: "Segoe UI", sz: 10, bold: true, color: { rgb: "0369A1" } }, fill: { fgColor: { rgb: isEven ? "F0F9FF" : "E0F2FE" } } } : {}),
          ...(colIdx === 5 ? { font: { name: "Segoe UI", sz: 10, bold: true, color: { rgb: "4338CA" } }, fill: { fgColor: { rgb: isEven ? "F5F3FF" : "EDE9FE" } } } : {}),
        };
      };

      /* Apply styles cell by cell */
      for (const key in worksheet) {
        if (key.startsWith("!")) continue;
        const cell = worksheet[key];
        const addr = XLSX.utils.decode_cell(key);
        if (addr.r === 0)      cell.s = titleStyle;
        else if (addr.r === 2) cell.s = headerStyle;
        else if (addr.r >= 3)  cell.s = getCellStyle(addr.r, addr.c);
      }

      /* Number format for USD columns */
      for (let row = 3; row < 3 + dataRows.length; row++) {
        for (const col of [4, 5]) {
          const cellKey = XLSX.utils.encode_cell({ r: row, c: col });
          if (worksheet[cellKey]) worksheet[cellKey].z = "#,##0.00";
        }
      }

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `USD Prices ${month}`);
      XLSX.writeFile(workbook, `FAERP_USD_Prices_${month}.xlsx`);
    } catch (e) {
      console.error("XLSX export failed:", e);
    } finally {
      setExporting(false);
    }
  }, [published, grouped, rate, month, username, locale, exporting]);

  /* ── Closed state button ───────────────────────────────────────────── */
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

  /* ── Modal column headers (USD only) ───────────────────────────────── */
  const COL_HEADERS = [
    lbl("Product", "المنتج"),
    lbl("Unit", "الوحدة"),
    lbl("MOQ", "الحد الأدنى"),
    lbl("Min (USD $)", "أدنى ($)"),
    lbl("Max (USD $)", "أقصى ($)"),
  ];

  const R = { navy: "#10213a", navyMid: "#4b6b97", navySoft: "#5f7699", border: "#dbe5f2", rowBorder: "#eef3f8", bg: "#f4f8fd", white: "#ffffff", green: "#0a7a4a", blue: "#1d4ed8" };

  /* ── Print CSS (for modal — separate print doc div) ────────────────── */
  const printCSS = `
    @media print {
      body * { visibility: hidden !important; }
      #usd-print-doc { display: block !important; visibility: visible !important; }
      #usd-print-doc * { visibility: visible !important; }
      #usd-print-doc { position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; background: #fff !important; z-index: 99999 !important; }
      .usd-no-print { display: none !important; }
    }
  `;

  return (
    <>
      <style>{printCSS}</style>

      {/* ══ Interactive modal (screen only) ════════════════════════════ */}
      <div className="modal-overlay usd-no-print" onClick={() => setOpen(false)}>
        <div
          className="modal-container"
          style={{ maxWidth: "820px", maxHeight: "92vh", display: "flex", flexDirection: "column", background: R.white }}
          onClick={e => e.stopPropagation()}
        >
          {/* Top bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: `1px solid ${R.border}`, background: R.white, borderRadius: "var(--radius-lg) var(--radius-lg) 0 0", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>💵</div>
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
                    style={{ padding: "7px 14px", fontSize: "12px", fontWeight: 700, borderRadius: "8px", border: "1px solid #6366f1", background: "#6366f1", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
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
                <div style={{ fontSize: "11px", marginTop: "6px", color: R.navySoft }}>{lbl("Use the USD Rate Card to refresh.", "استخدم بطاقة سعر الدولار للتحديث.")}</div>
              </div>
            )}
            {!rate && !loadingRate && !rateError && (
              <div style={{ padding: "60px", textAlign: "center", color: R.navySoft }}>
                <div style={{ fontSize: "40px", marginBottom: "12px" }}>💱</div>
                <div style={{ fontWeight: 700 }}>{lbl("No exchange rate available.", "لا يوجد سعر صرف متاح.")}</div>
              </div>
            )}

            {rate && !loadingRate && (
              <>
                {/* Rate info strip */}
                <div style={{ display: "flex", gap: "16px", marginBottom: "20px", flexWrap: "wrap" }}>
                  {[
                    { label: "Exchange Rate", value: `1 USD = ${rate.toFixed(4)} EGP`, sub: rateInfo ?? "" },
                    { label: "Published Items", value: published.length, sub: "with selling prices" },
                    { label: "Categories", value: Object.keys(grouped).length, sub: "product categories" },
                  ].map(({ label, value, sub }) => (
                    <div key={label} style={{ flex: "1 1 140px", border: `1px solid ${R.border}`, borderRadius: "10px", padding: "12px 16px", background: R.bg }}>
                      <div style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: R.navySoft, marginBottom: "4px" }}>{label}</div>
                      <div style={{ fontSize: "16px", fontWeight: 800, color: R.navy }}>{value}</div>
                      {sub && <div style={{ fontSize: "10px", color: R.navyMid, marginTop: "2px" }}>{sub}</div>}
                    </div>
                  ))}
                </div>

                {/* Tables per category */}
                {Object.entries(grouped).map(([cat, rows]) => (
                  <div key={cat} style={{ marginBottom: "24px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px", paddingBottom: "8px", borderBottom: `2px solid ${R.border}` }}>
                      <h3 style={{ margin: 0, fontSize: "12px", fontWeight: 800, color: R.navy, textTransform: "uppercase", letterSpacing: "0.06em" }}>{cat}</h3>
                      <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", background: R.bg, border: `1px solid ${R.border}`, color: R.navySoft }}>{rows.length}</span>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                      <thead>
                        <tr>
                          {COL_HEADERS.map((h, i) => (
                            <th key={h} style={{ textAlign: i >= 3 ? "right" : "left", borderBottom: `2px solid ${R.border}`, padding: "8px 10px", color: R.navySoft, fontWeight: 700, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.07em", background: R.bg, whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={r.item_id} style={{ borderBottom: `1px solid ${R.rowBorder}`, background: i % 2 === 0 ? R.white : R.bg }}>
                            <td style={{ padding: "9px 10px", fontWeight: 600, color: R.navy, maxWidth: "220px" }}>
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }} title={r.item_name}>{r.item_name}</span>
                            </td>
                            <td style={{ padding: "9px 10px", color: R.navySoft }}>{r.unit}</td>
                            <td style={{ padding: "9px 10px", color: R.navySoft, textAlign: "center" }}>{r.moq ? r.moq.toLocaleString() : "—"}</td>
                            <td style={{ padding: "9px 10px", textAlign: "right", whiteSpace: "nowrap" }}>
                              <span style={{ fontWeight: 800, color: "#0284c7", fontSize: "13px" }}>{fmtUSD(toUSD(r.sell_min))}</span>
                            </td>
                            <td style={{ padding: "9px 10px", textAlign: "right", whiteSpace: "nowrap" }}>
                              <span style={{ fontWeight: 800, color: "#6366f1", fontSize: "13px" }}>{fmtUSD(toUSD(r.sell_max))}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ══ Fallback print doc (if window.print is triggered) ══════════ */}
      {rate && (
        <div id="usd-print-doc" style={{ display: "none" }}>
          <div style={{ fontFamily: "Inter, sans-serif", padding: "32px 40px", color: "#111827" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid #6366f1", paddingBottom: "16px", marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "36px", height: "36px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: "14px" }}>F</div>
                <div><div style={{ fontSize: "18px", fontWeight: 800 }}>FAERP</div><div style={{ fontSize: "10px", color: "#6b7280", textTransform: "uppercase", letterSpacing: ".08em" }}>Enterprise ERP · On-Premises</div></div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "16px", fontWeight: 800, marginBottom: "4px" }}>Published Selling Prices — USD</div>
                <div style={{ fontSize: "11px", color: "#6b7280" }}>{month} · 1 USD = {rate.toFixed(4)} EGP · Prepared by {username}</div>
              </div>
            </div>
            {Object.entries(grouped).map(([cat, rows]) => (
              <div key={cat}>
                <div style={{ background: "#f5f3ff", padding: "8px 12px", fontWeight: 800, fontSize: "12px", color: "#4338ca", borderLeft: "3px solid #6366f1", margin: "12px 0 6px" }}>{cat}</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>
                    {["Product", "Unit", "MOQ", "Min (USD $)", "Max (USD $)"].map((h, i) => (
                      <th key={h} style={{ background: "#f9fafb", fontSize: "9px", fontWeight: 700, textTransform: "uppercase", color: "#6b7280", padding: "8px 10px", borderBottom: "2px solid #e5e7eb", textAlign: i >= 3 ? "right" : "left" }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.item_id} style={{ background: "#f0f9ff" }}>
                        <td style={{ padding: "7px 10px", borderBottom: "1px solid #f3f4f6", fontSize: "11px" }}>{r.item_name}</td>
                        <td style={{ padding: "7px 10px", borderBottom: "1px solid #f3f4f6", fontSize: "11px", color: "#9ca3af" }}>{r.unit}</td>
                        <td style={{ padding: "7px 10px", borderBottom: "1px solid #f3f4f6", fontSize: "11px", textAlign: "center", color: "#9ca3af" }}>{r.moq ?? "—"}</td>
                        <td style={{ padding: "7px 10px", borderBottom: "1px solid #f3f4f6", fontSize: "11px", textAlign: "right", color: "#0284c7", fontWeight: 800 }}>{fmtUSD(toUSD(r.sell_min))}</td>
                        <td style={{ padding: "7px 10px", borderBottom: "1px solid #f3f4f6", fontSize: "11px", textAlign: "right", color: "#6366f1", fontWeight: 800 }}>{fmtUSD(toUSD(r.sell_max))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            <div style={{ marginTop: "32px", paddingTop: "12px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#9ca3af" }}>
              <span>FAERP · Confidential</span><span>Prepared by {username}</span><span>{formatDate()}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
