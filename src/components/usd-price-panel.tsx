"use client";

import { useState, useCallback } from "react";

import { formatDate, formatMonthLabel } from "@/lib/format";
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
function printWindow(html: string, title: string, isRTL?: boolean) {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) { alert("Please allow popups to generate PDF reports."); return; }
  win.document.write(`<!DOCTYPE html><html dir="${isRTL ? "rtl" : "ltr"}"><head>
    <meta charset="UTF-8"/>
    <title>${title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Readex+Pro:wght@300;400;600;700&display=swap" rel="stylesheet"/>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Readex Pro',sans-serif;font-size:12px;color:#111827;background:#fff;padding:32px 40px;direction:${isRTL ? "rtl" : "ltr"};text-align:${isRTL ? "right" : "left"}}
      .report-header{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:3px solid #1e3a8a;padding-bottom:16px;margin-bottom:24px}
      .brand{display:flex;align-items:center;gap:10px}
      .brand-mark{width:36px;height:36px;display:flex;align-items:center;justify-content:center}
      .brand-name{font-size:18px;font-weight:800;color:#111827}
      .brand-sub{font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em}
      .report-meta{text-align:${isRTL ? "left" : "right"}}
      .report-meta .title{font-size:16px;font-weight:800;color:#111827;margin-bottom:4px}
      .report-meta .subtitle{font-size:11px;color:#6b7280}
      .stat-row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px}
      .stat-box{padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb}
      .stat-box .lbl{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;margin-bottom:4px}
      .stat-box .val{font-size:20px;font-weight:800;color:#111827}
      .stat-box .sub{font-size:9px;color:#9ca3af;margin-top:2px}
      .section-title{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.10em;color:#1e3a8a;margin:20px 0 10px}
      .cat-header{background:#eff6ff;padding:8px 12px;font-weight:800;font-size:12px;color:#1e3a8a;border-inline-start:3px solid #1e3a8a;margin:12px 0 6px;border-radius:0 4px 4px 0}
      html[dir="rtl"] .cat-header{border-radius: 4px 0 0 4px}
      table{width:100%;border-collapse:collapse;margin-bottom:16px}
      th{background:#1e3a8a;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#ffffff;padding:8px 10px;border-bottom:2px solid #1b357f;text-align:start}
      th.num{text-align:end}
      td{padding:7px 10px;border-bottom:1px solid #f3f4f6;font-size:11px;vertical-align:top}
      tr:last-child td{border-bottom:none}
      .num{text-align:end;font-variant-numeric:tabular-nums}
      .usd-min{color:#0284c7;font-weight:800}
      .usd-max{color:#1e3a8a;font-weight:800}
      .muted{color:#9ca3af}
      .footer{margin-top:32px;padding-top:12px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:9px;color:#9ca3af}
      .highlight-row td{background:#f0f9ff}
      @media print{body{padding:20px 28px}@page{margin:1.5cm;size:A4 landscape}}
    </style>
  </head><body>${html}<script>window.onload=function(){window.print();}<\/script></body></html>`);
  win.document.close();
}

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
    const isAr = locale === "ar";
    const monthLabel = formatMonthLabel(month);

    const statsHtml = `<div class="stat-row">
      <div class="stat-box"><div class="lbl">${lbl("Exchange Rate", "سعر الصرف")}</div><div class="val">1 USD = ${rate.toFixed(4)}</div><div class="sub">${isAr ? "جنيه" : "EGP"}${rateInfo ? ` · ${rateInfo}` : ""}</div></div>
      <div class="stat-box"><div class="lbl">${lbl("Published Items", "الأصناف المنشورة")}</div><div class="val">${published.length}</div><div class="sub">${isAr ? "مع أسعار البيع" : "with selling prices"}</div></div>
      <div class="stat-box"><div class="lbl">${lbl("Categories", "الفئات")}</div><div class="val">${Object.keys(grouped).length}</div><div class="sub">${isAr ? "أقسام المنتجات" : "product categories"}</div></div>
    </div>`;

    const headerHtml = `<div class="report-header">
      <div class="brand">
        <div class="brand-mark"><img src="/faerp%20logo.svg" style="width:36px;height:36px;object-fit:contain;" alt="Logo"/></div>
        <div><div class="brand-name">FAERP</div><div class="brand-sub">${isAr ? "نظام تخطيط موارد المؤسسات · تشغيل محلي" : "Enterprise ERP · On-Premises"}</div></div>
      </div>
      <div class="report-meta">
        <div class="title">${isAr ? "أسعار البيع المنشورة بالدولار" : "Published Selling Prices — USD"}</div>
        <div class="subtitle">${monthLabel} · ${isAr ? `تاريخ الإنشاء: ${formatDate()}` : `Generated ${formatDate()}`}</div>
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
          <th>${isAr ? "المنتج" : "Product"}</th><th>${isAr ? "الوحدة" : "Unit"}</th><th class="num">${isAr ? "الحد الأدنى" : "MOQ"}</th>
          <th class="num">${isAr ? "أدنى ($)" : "Min (USD $)"}</th><th class="num">${isAr ? "أقصى ($)" : "Max (USD $)"}</th>
        </tr></thead><tbody>${rowsHtml}</tbody></table>`;
    }).join("");

    const footerHtml = `<div class="footer">
      <span>${isAr ? `FAERP · سري · ١ دولار = ${rate.toFixed(4)} جنيه` : `FAERP · Confidential · 1 USD = ${rate.toFixed(4)} EGP`}</span>
      <span>${isAr ? `أعدت بواسطة ${username}` : `Prepared by ${username}`}</span>
      <span>${formatDate(new Date())}</span>
    </div>`;

    printWindow(`${headerHtml}${tablesHtml}${footerHtml}`, `${isAr ? "أسعار الدولار" : "USD Prices"} - ${monthLabel}`, isAr);
  }, [rate, rateInfo, published, grouped, month, username, locale]);

  /* ── XLSX Export — mirrors report-generator.tsx styling exactly ─────── */
  const exportXLSX = useCallback(async () => {
    if (!rate || exporting) return;
    setExporting(true);
    try {
      const XLSX = await import("xlsx-js-style");
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
        [isAr
          ? `أسعار البيع المنشورة بالدولار — ${formatMonthLabel(month)}  |  ١ دولار = ${rate.toFixed(4)} جنيه  |  أعدت بواسطة: ${username}`
          : `Published Selling Prices in USD — ${month}  |  1 USD = ${rate.toFixed(4)} EGP  |  Generated by: ${username}`
        ],
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
        { hpt: 28 },
        ...Array(dataRows.length).fill({ hpt: 22 }),
      ];

      /* Style definitions — matching FAERP Brand Theme */
      const titleStyle = {
        font: { name: "Segoe UI", sz: 16, bold: true, color: { rgb: "1E3A8A" } },
        alignment: { horizontal: isAr ? "right" : "left", vertical: "center" },
      };
      
      const headerStyle = {
        font: { name: "Segoe UI", sz: 11, bold: true, color: { rgb: "1F2937" } },
        fill: { fgColor: { rgb: "F1F5F9" } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: {
          top:    { style: "thin",   color: { rgb: "CBD5E1" } },
          bottom: { style: "medium", color: { rgb: "94A3B8" } },
          left:   { style: "thin",   color: { rgb: "CBD5E1" } },
          right:  { style: "thin",   color: { rgb: "CBD5E1" } },
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
          // Highlight USD price cells in blue/purple tones
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
          if (worksheet[cellKey]) worksheet[cellKey].z = "$#,##0.00";
        }
      }

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `USD Prices ${month}`);
      XLSX.writeFile(workbook, isAr ? `أسعار_بالدولار_${month}.xlsx` : `FAERP_USD_Prices_${month}.xlsx`);
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
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: "16px",
          padding: "16px 20px", borderRadius: "14px",
          border: "1.5px solid rgba(6,182,212,0.35)",
          background: "linear-gradient(135deg, #ecfeff 0%, #cffafe 100%)",
          cursor: "pointer", transition: "all 220ms ease",
          textAlign: locale === "ar" ? "right" : "left", position: "relative", overflow: "hidden",
          boxShadow: "0 2px 8px rgba(6,182,212,0.12)",
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(6,182,212,0.25)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 2px 8px rgba(6,182,212,0.12)"; }}
      >
        {/* Decorative orb */}
        <span style={{ position: "absolute", top: "-20px", right: locale === "ar" ? "unset" : "-20px", left: locale === "ar" ? "-20px" : "unset", width: "80px", height: "80px", borderRadius: "50%", background: "rgba(6,182,212,0.08)", pointerEvents: "none" }} />
        {/* Icon */}
        <div style={{
          width: "46px", height: "46px", borderRadius: "12px", flexShrink: 0,
          background: "linear-gradient(135deg, #0891b2 0%, #0e7490 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 12px rgba(6,182,212,0.4)", fontSize: "20px",
        }}>💵</div>
        {/* Text */}
        <div style={{ flex: 1, minWidth: 0, textAlign: locale === "ar" ? "right" : "left" }}>
          <div style={{ fontSize: "15px", fontWeight: 800, letterSpacing: "-0.01em", color: "#164e63", marginBottom: "3px" }}>
            {lbl("Show Prices in USD", "عرض الأسعار بالدولار")}
          </div>
          <div style={{ fontSize: "11px", color: "#0e7490" }}>
            {lbl("Convert & export published prices", "تحويل وتصدير الأسعار المنشورة")}
          </div>
        </div>
        <span style={{ fontSize: "16px", color: "#0891b2", flexShrink: 0, transform: locale === "ar" ? "rotate(180deg)" : "none" }}>→</span>
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
          <div className="usd-price-modal-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: `1px solid ${R.border}`, background: R.white, borderRadius: "var(--radius-lg) var(--radius-lg) 0 0", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>💵</div>
              <div style={{ textAlign: locale === "ar" ? "right" : "left" }}>
                <p style={{ margin: 0, fontSize: "10px", color: R.navySoft, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>FAERP · {lbl("Price Report", "تقرير الأسعار")}</p>
                <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: R.navy }}>{lbl("Published Selling Prices in USD", "قائمة الأسعار المعتمدة بالدولار")}</h2>
              </div>
            </div>
            <div className="usd-price-modal-header-actions" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {rate && (
                <>
                  <button type="button" onClick={exportXLSX} disabled={exporting}
                    style={{ padding: "7px 14px", fontSize: "12px", fontWeight: 700, borderRadius: "8px", border: `1px solid ${R.border}`, background: R.bg, color: R.navy, cursor: exporting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "6px", opacity: exporting ? 0.6 : 1 }}>
                    {exporting ? "⏳" : "📊"} {exporting ? (locale === "ar" ? "جاري التصدير…" : "Exporting…") : (locale === "ar" ? "إكسل" : "Excel / XLSX")}
                  </button>
                  <button type="button" onClick={exportPDF}
                    style={{ padding: "7px 14px", fontSize: "12px", fontWeight: 700, borderRadius: "8px", border: "1px solid #6366f1", background: "#6366f1", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                    🖨️ {locale === "ar" ? "طباعة PDF" : "Print / PDF"}
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
                    { label: lbl("Exchange Rate", "سعر الصرف"), value: `1 USD = ${rate.toFixed(4)} EGP`, sub: rateInfo ?? "" },
                    { label: lbl("Published Items", "الأصناف المنشورة"), value: published.length, sub: lbl("with selling prices", "مع أسعار البيع") },
                    { label: lbl("Categories", "الفئات"), value: Object.keys(grouped).length, sub: lbl("product categories", "أقسام المنتجات") },
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
                            <th key={h} style={{ textAlign: i >= 3 ? (locale === "ar" ? "left" : "right") : (locale === "ar" ? "right" : "left"), borderBottom: `2px solid ${R.border}`, padding: "8px 10px", color: R.navySoft, fontWeight: 700, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.07em", background: R.bg, whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={r.item_id} style={{ borderBottom: `1px solid ${R.rowBorder}`, background: i % 2 === 0 ? R.white : R.bg }}>
                            <td style={{ padding: "9px 10px", fontWeight: 600, color: R.navy, maxWidth: "220px", textAlign: locale === "ar" ? "right" : "left" }}>
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }} title={r.item_name}>{r.item_name}</span>
                            </td>
                            <td style={{ padding: "9px 10px", color: R.navySoft, textAlign: locale === "ar" ? "right" : "left" }}>{r.unit}</td>
                            <td style={{ padding: "9px 10px", color: R.navySoft, textAlign: "center" }}>{r.moq ? r.moq.toLocaleString() : "—"}</td>
                            <td style={{ padding: "9px 10px", textAlign: locale === "ar" ? "left" : "right", whiteSpace: "nowrap" }}>
                              <span style={{ fontWeight: 800, color: "#0284c7", fontSize: "13px" }}>{fmtUSD(toUSD(r.sell_min))}</span>
                            </td>
                            <td style={{ padding: "9px 10px", textAlign: locale === "ar" ? "left" : "right", whiteSpace: "nowrap" }}>
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
          <div style={{ fontFamily: "Readex Pro, sans-serif", padding: "32px 40px", color: "#111827" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid #1e3a8a", paddingBottom: "16px", marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center" }}><img src="/faerp logo.svg" style={{ width: "36px", height: "36px", objectFit: "contain" }} alt="Logo" /></div>
                <div><div style={{ fontSize: "18px", fontWeight: 800 }}>FAERP</div><div style={{ fontSize: "10px", color: "#6b7280", textTransform: "uppercase", letterSpacing: ".08em" }}>{lbl("Enterprise ERP · On-Premises", "نظام تخطيط موارد المؤسسات · تشغيل محلي")}</div></div>
              </div>
              <div style={{ textAlign: locale === "ar" ? "left" : "right" }}>
                <div style={{ fontSize: "16px", fontWeight: 800, marginBottom: "4px" }}>{lbl("Published Selling Prices — USD", "أسعار البيع المنشورة بالدولار")}</div>
                <div style={{ fontSize: "11px", color: "#6b7280" }}>{formatMonthLabel(month)} · {lbl(`1 USD = ${rate.toFixed(4)} EGP`, `١ دولار = ${rate.toFixed(4)} جنيه`)} · {lbl(`Prepared by ${username}`, `أعدت بواسطة ${username}`)}</div>
              </div>
            </div>
            {Object.entries(grouped).map(([cat, rows]) => (
              <div key={cat}>
                <div style={{ background: "#eff6ff", padding: "8px 12px", fontWeight: 800, fontSize: "12px", color: "#1e3a8a", borderInlineStart: "3px solid #1e3a8a", margin: "12px 0 6px" }}>{cat}</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>
                    {COL_HEADERS.map((h, i) => (
                      <th key={h} style={{ background: "#1e3a8a", fontSize: "9px", fontWeight: 700, textTransform: "uppercase", color: "#ffffff", padding: "8px 10px", borderBottom: "2px solid #1b357f", textAlign: i >= 3 ? (locale === "ar" ? "left" : "right") : (locale === "ar" ? "right" : "left") }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.item_id} style={{ background: "#f0f9ff" }}>
                        <td style={{ padding: "7px 10px", borderBottom: "1px solid #f3f4f6", fontSize: "11px", textAlign: locale === "ar" ? "right" : "left" }}>{r.item_name}</td>
                        <td style={{ padding: "7px 10px", borderBottom: "1px solid #f3f4f6", fontSize: "11px", color: "#9ca3af", textAlign: locale === "ar" ? "right" : "left" }}>{r.unit}</td>
                        <td style={{ padding: "7px 10px", borderBottom: "1px solid #f3f4f6", fontSize: "11px", textAlign: "center", color: "#9ca3af" }}>{r.moq ?? "—"}</td>
                        <td style={{ padding: "7px 10px", borderBottom: "1px solid #f3f4f6", fontSize: "11px", textAlign: locale === "ar" ? "left" : "right", color: "#0284c7", fontWeight: 800 }}>{fmtUSD(toUSD(r.sell_min))}</td>
                        <td style={{ padding: "7px 10px", borderBottom: "1px solid #f3f4f6", fontSize: "11px", textAlign: locale === "ar" ? "left" : "right", color: "#1e3a8a", fontWeight: 800 }}>{fmtUSD(toUSD(r.sell_max))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            <div style={{ marginTop: "32px", paddingTop: "12px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#9ca3af" }}>
              <span>{lbl("FAERP · Confidential", "FAERP · سري")}</span><span>{lbl(`Prepared by ${username}`, `أعدت بواسطة ${username}`)}</span><span>{formatDate()}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
