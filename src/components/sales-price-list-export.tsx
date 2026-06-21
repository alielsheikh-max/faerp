"use client";

import { useState } from "react";
import * as XLSX from "xlsx-js-style";
import { formatDate, formatMonthLabel } from "@/lib/format";
import { useI18n } from "@/lib/i18n-context";

type SalesRow = {
  item_id: number;
  item_name: string;
  unit: string;
  category_name: string;
  sell_min: number | null;
  sell_max: number | null;
  moq: number;
  tier_pricing_enabled: number;
  is_tiered: number;
  tier1_max: number; tier1_discount: number;
  tier2_max: number; tier2_discount: number;
  tier3_max: number; tier3_discount: number;
  tier4_max: number; tier4_discount: number;
  buy_avg: number | null;
  transportation: number;
  other_expenses: number;
};

type Props = { rows: SalesRow[]; month: string; username: string };

function fmtEGP(n: number | null, locale?: string) {
  if (n === null) return "—";
  if (locale === "ar") {
    return `${n.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} جنيه`;
  }
  return `EGP ${n.toLocaleString("en-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getTierInfo(r: SalesRow, locale?: string) {
  const isTiered = r.is_tiered === 1 && r.buy_avg != null;
  if (!isTiered) {
    return {
      min: r.sell_min,
      max: r.sell_max,
      notes: ""
    };
  }

  const buyAvg = r.buy_avg ?? 0;
  const transport = r.transportation ?? 0;
  const other = r.other_expenses ?? 0;
  const sellMin = r.sell_min;
  const roundUp5 = (n: number) => Math.ceil(n / 5) * 5;
  const isAr = locale === "ar";

  function getPriceForDiscount(discount: number) {
    if (discount <= 0 || buyAvg <= 0) return null;
    if (discount < 1) {
      return roundUp5(buyAvg / discount + transport + other);
    }
    const baseSellMin = sellMin !== null ? (sellMin - transport - other) : buyAvg;
    return roundUp5(baseSellMin * (1 - discount / 100) + transport + other);
  }

  const tierPrices = [
    { label: isAr ? "أساسي" : "B",  range: `1–${r.tier1_max}`,  price: sellMin ?? getPriceForDiscount(r.tier1_discount) },
    { label: isAr ? "ش٢" : "T2", range: `${r.tier1_max + 1}–${r.tier2_max}`, price: getPriceForDiscount(r.tier2_discount) },
    { label: isAr ? "ش٣" : "T3", range: `${r.tier2_max + 1}–${r.tier3_max}`, price: getPriceForDiscount(r.tier3_discount) },
    { label: isAr ? "ش٤" : "T4", range: `>${r.tier3_max}`,   price: getPriceForDiscount(r.tier4_discount) },
  ].filter(t => t.price !== null);

  if (tierPrices.length === 0) {
    return {
      min: r.sell_min,
      max: r.sell_max,
      notes: isAr ? "تطبق أسعار الشرائح" : "Tiered pricing applies"
    };
  }

  const prices = tierPrices.map(t => t.price as number);
  const minVal = Math.min(...prices);
  const maxVal = Math.max(...prices);

  const notes = tierPrices.map(t => {
    const formattedPrice = t.price?.toLocaleString("en-EG", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return `${t.label} (${t.range}): ${formattedPrice} ${isAr ? "جنيه" : "EGP"}`;
  }).join(" | ");

  return {
    min: minVal,
    max: maxVal,
    notes
  };
}

function printWindow(html: string, title: string, isRTL?: boolean) {
  const win = window.open("", "_blank", "width=950,height=750");
  if (!win) { alert("Please allow pop-ups to generate PDF reports."); return; }
  win.document.write(`<!DOCTYPE html><html dir="${isRTL ? "rtl" : "ltr"}"><head>
    <meta charset="UTF-8"/>
    <title>${title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Readex+Pro:wght@300;400;600;700&display=swap" rel="stylesheet"/>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Readex Pro',sans-serif;font-size:12px;color:#111827;background:#fff;padding:32px 40px;direction:${isRTL ? "rtl" : "ltr"};text-align:${isRTL ? "right" : "left"}}
      .header{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:3px solid #1e3a8a;padding-bottom:16px;margin-bottom:24px}
      .brand{display:flex;align-items:center;gap:10px}
      .brand-mark{width:36px;height:36px;display:flex;align-items:center;justify-content:center}
      .brand-name{font-size:18px;font-weight:800;color:#111827}
      .brand-sub{font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em}
      .meta{text-align:${isRTL ? "left" : "right"}}
      .meta .doc-title{font-size:16px;font-weight:800;color:#111827;margin-bottom:4px}
      .meta .doc-sub{font-size:11px;color:#6b7280}
      .stamp{display:inline-block;padding:4px 12px;border-radius:99px;background:rgba(16,185,129,0.1);border:1.5px solid #10b981;color:#065f46;font-weight:800;font-size:10px;letter-spacing:.06em;text-transform:uppercase;margin-top:6px}
      .cat-header{background:#eff6ff;padding:8px 12px;font-weight:800;font-size:12px;color:#1e3a8a;border-inline-start:3px solid #1e3a8a;margin:16px 0 6px;border-radius:0 4px 4px 0}
      html[dir="rtl"] .cat-header{border-radius: 4px 0 0 4px}
      table{width:100%;border-collapse:collapse;margin-bottom:8px}
      th{background:#1e3a8a;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#ffffff;padding:8px 10px;border-bottom:2px solid #1b357f;text-align:start}
      th.r{text-align:end}
      td{padding:7px 10px;border-bottom:1px solid #f3f4f6;font-size:11px;vertical-align:top}
      tr:last-child td{border-bottom:none}
      tr:hover td{background:#fafafa}
      .r{text-align:end;font-variant-numeric:tabular-nums}
      .sell-min{color:#0284c7;font-weight:800}
      .sell-max{color:#1e3a8a;font-weight:800}
      .tier-tag{display:inline-block;padding:1px 6px;background:#eff6ff;color:#1e3a8a;border-radius:4px;font-size:9px;font-weight:800;margin-inline-start:4px}
      .muted{color:#9ca3af}
      .footer{margin-top:32px;padding-top:12px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:9px;color:#9ca3af}
      @media print{body{padding:20px 28px}@page{margin:1.5cm;size:A4 landscape}}
    </style>
  </head><body>${html}<script>window.onload=function(){window.print();}<\/script></body></html>`);
  win.document.close();
}

export default function SalesPriceListExport({ rows, month, username }: Props) {
  const { locale } = useI18n();
  const isAr = locale === "ar";
  const [exporting, setExporting] = useState(false);

  const published = rows.filter(r => r.sell_min !== null);
  const grouped: Record<string, SalesRow[]> = {};
  for (const r of published) {
    if (!grouped[r.category_name]) grouped[r.category_name] = [];
    grouped[r.category_name].push(r);
  }

  const monthLabel = formatMonthLabel(month);

  /* ── PDF ────────────────────────────────────────────────────── */
  const exportPDF = () => {
    let body = `
      <div class="header">
        <div class="brand">
          <div class="brand-mark"><img src="/faerp%20logo.svg" style="width:36px;height:36px;object-fit:contain;" alt="Logo"/></div>
          <div><div class="brand-name">FAERP</div><div class="brand-sub">${isAr ? "نظام تخطيط موارد المؤسسات · تشغيل محلي" : "Enterprise ERP · On-Premises"}</div></div>
        </div>
        <div class="meta">
          <div class="doc-title">${isAr ? "قائمة الأسعار النهائية المعتمدة" : "Final Approved Price List"}</div>
          <div class="doc-sub">${monthLabel} · ${isAr ? `أعدت بواسطة ${username}` : `Prepared by ${username}`}</div>
          <div class="doc-sub">${formatDate()}</div>
          <div class="stamp">${isAr ? "✓ معتمدة ومنشورة بواسطة إدارة سلاسل الإمداد" : "✓ Published &amp; Approved by SC"}</div>
        </div>
      </div>`;

    for (const [cat, catRows] of Object.entries(grouped)) {
      body += `<div class="cat-header">${cat}</div>
        <table><thead><tr>
          <th>${isAr ? "المنتج" : "Product"}</th>
          <th>${isAr ? "الوحدة" : "Unit"}</th>
          <th class="r">${isAr ? "الحد الأدنى للطلب" : "MOQ"}</th>
          <th class="r">${isAr ? "أدنى سعر بيع (جنيه)" : "Min Price (EGP)"}</th>
          <th class="r">${isAr ? "أقصى سعر بيع (جنيه)" : "Max Price (EGP)"}</th>
          <th>${isAr ? "ملاحظات" : "Notes"}</th>
        </tr></thead><tbody>`;
      for (const r of catRows) {
        const info = getTierInfo(r, locale);
        const hasTiers = r.is_tiered === 1 && r.buy_avg != null;
        body += `<tr>
          <td>${r.item_name}${hasTiers ? `<span class="tier-tag">${isAr ? "مقسم لشرائح" : "TIERED"}</span>` : ""}</td>
          <td class="muted">${r.unit}</td>
          <td class="r muted">${r.moq || "—"}</td>
          <td class="r sell-min">${fmtEGP(info.min, locale)}</td>
          <td class="r sell-max">${fmtEGP(info.max, locale)}</td>
          <td class="muted" style="font-size:10px">${info.notes}</td>
        </tr>`;
      }
      body += `</tbody></table>`;
    }

    body += `<div class="footer">
      <span>${isAr ? "FAERP · سري · للاستخدام الداخلي فقط" : "FAERP · Confidential · Internal Use Only"}</span>
      <span>${isAr ? `معتمدة ومنشورة بواسطة: ${username}` : `Approved &amp; Published by: ${username}`}</span>
      <span>${formatDate()}</span>
    </div>`;

    printWindow(body, `${isAr ? "قائمة أسعار FAERP" : "FAERP Price List"} – ${monthLabel}`, isAr);
  };

  /* ── Excel ──────────────────────────────────────────────────── */
  const exportXLSX = async () => {
    setExporting(true);
    try {
      const wb = XLSX.utils.book_new();
      
      // Style Definitions (matching WH Supplier Request layout style)
      const titleStyle = {
        font: { name: "Segoe UI", sz: 16, bold: true, color: { rgb: "1E3A8A" } },
        alignment: { horizontal: isAr ? "right" : "left", vertical: "center" }
      };

      const subtitleStyle = {
        font: { name: "Segoe UI", sz: 10, italic: true, color: { rgb: "475569" } },
        alignment: { horizontal: isAr ? "right" : "left", vertical: "center" }
      };

      const statusStyle = {
        font: { name: "Segoe UI", sz: 10, bold: true, color: { rgb: "065F46" } },
        alignment: { horizontal: isAr ? "right" : "left", vertical: "center" }
      };

      const headerStyleLeft = {
        font: { name: "Segoe UI", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "1E3A8A" } }, // App Blue (#1E3A8A)
        alignment: { horizontal: isAr ? "right" : "left", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "1B357F" } },
          bottom: { style: "medium", color: { rgb: "1B357F" } },
          left: { style: "thin", color: { rgb: "1B357F" } },
          right: { style: "thin", color: { rgb: "1B357F" } }
        }
      };

      const headerStyleCenter = {
        font: { name: "Segoe UI", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "1E3A8A" } }, // App Blue (#1E3A8A)
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "1B357F" } },
          bottom: { style: "medium", color: { rgb: "1B357F" } },
          left: { style: "thin", color: { rgb: "1B357F" } },
          right: { style: "thin", color: { rgb: "1B357F" } }
        }
      };

      const headerStyleRight = {
        font: { name: "Segoe UI", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "1E3A8A" } }, // App Blue (#1E3A8A)
        alignment: { horizontal: isAr ? "left" : "right", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "1B357F" } },
          bottom: { style: "medium", color: { rgb: "1B357F" } },
          left: { style: "thin", color: { rgb: "1B357F" } },
          right: { style: "thin", color: { rgb: "1B357F" } }
        }
      };

      const catStyle = {
        font: { name: "Segoe UI", sz: 11, bold: true, color: { rgb: "4338CA" } },
        fill: { fgColor: { rgb: "F5F3FF" } }, // Purple-50
        alignment: { horizontal: isAr ? "right" : "left", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "E5E7EB" } },
          bottom: { style: "thin", color: { rgb: "E5E7EB" } },
          left: { style: "thin", color: { rgb: "E5E7EB" } },
          right: { style: "thin", color: { rgb: "E5E7EB" } }
        }
      };

      const cellStyleProduct = {
        font: { name: "Segoe UI", sz: 10, bold: true, color: { rgb: "334155" } },
        alignment: { horizontal: isAr ? "right" : "left", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "E2E8F0" } },
          bottom: { style: "thin", color: { rgb: "E2E8F0" } },
          left: { style: "thin", color: { rgb: "E2E8F0" } },
          right: { style: "thin", color: { rgb: "E2E8F0" } }
        }
      };

      const cellStyleUnit = {
        font: { name: "Segoe UI", sz: 10, color: { rgb: "334155" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "E2E8F0" } },
          bottom: { style: "thin", color: { rgb: "E2E8F0" } },
          left: { style: "thin", color: { rgb: "E2E8F0" } },
          right: { style: "thin", color: { rgb: "E2E8F0" } }
        }
      };

      const cellStyleMOQ = {
        font: { name: "Segoe UI", sz: 10, color: { rgb: "334155" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "E2E8F0" } },
          bottom: { style: "thin", color: { rgb: "E2E8F0" } },
          left: { style: "thin", color: { rgb: "E2E8F0" } },
          right: { style: "thin", color: { rgb: "E2E8F0" } }
        }
      };

      const cellStyleMin = {
        font: { name: "Segoe UI", sz: 10, bold: true, color: { rgb: "0284C7" } },
        alignment: { horizontal: isAr ? "left" : "right", vertical: "center" },
        numFmt: isAr ? '#,##0.00 "جنيه"' : '"EGP" #,##0.00',
        border: {
          top: { style: "thin", color: { rgb: "E2E8F0" } },
          bottom: { style: "thin", color: { rgb: "E2E8F0" } },
          left: { style: "thin", color: { rgb: "E2E8F0" } },
          right: { style: "thin", color: { rgb: "E2E8F0" } }
        }
      };

      const cellStyleMax = {
        font: { name: "Segoe UI", sz: 10, bold: true, color: { rgb: "6366F1" } },
        alignment: { horizontal: isAr ? "left" : "right", vertical: "center" },
        numFmt: isAr ? '#,##0.00 "جنيه"' : '"EGP" #,##0.00',
        border: {
          top: { style: "thin", color: { rgb: "E2E8F0" } },
          bottom: { style: "thin", color: { rgb: "E2E8F0" } },
          left: { style: "thin", color: { rgb: "E2E8F0" } },
          right: { style: "thin", color: { rgb: "E2E8F0" } }
        }
      };

      const cellStyleNotes = {
        font: { name: "Segoe UI", sz: 10, color: { rgb: "475569" } },
        alignment: { horizontal: isAr ? "right" : "left", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "E2E8F0" } },
          bottom: { style: "thin", color: { rgb: "E2E8F0" } },
          left: { style: "thin", color: { rgb: "E2E8F0" } },
          right: { style: "thin", color: { rgb: "E2E8F0" } }
        }
      };

      const wsData: any[][] = [];
      const rowHeights: any[] = [
        { hpt: 35 }, // Title
        { hpt: 22 }, // Prepared by / Date
        { hpt: 22 }, // SC Approved label
        { hpt: 10 }, // Spacer
        { hpt: 28 }, // Headers
      ];

      // Title rows
      wsData.push([{ v: isAr ? "FAERP — قائمة الأسعار النهائية المعتمدة" : "FAERP — Final Approved Price List", s: titleStyle }]);
      wsData.push([{ v: isAr ? `${monthLabel} · أعدت بواسطة ${username} · ${formatDate()}` : `${monthLabel} · Prepared by ${username} · ${formatDate()}`, s: subtitleStyle }]);
      wsData.push([{ v: isAr ? "✓ معتمدة ومنشورة بواسطة إدارة سلاسل الإمداد" : "✓ Published & Approved by SC", s: statusStyle }]);
      wsData.push([]);

      // Headers
      wsData.push([
        { v: isAr ? "المنتج" : "Product",         s: isAr ? headerStyleRight : headerStyleLeft },
        { v: isAr ? "الوحدة" : "Unit",            s: headerStyleCenter },
        { v: isAr ? "الحد الأدنى للطلب" : "MOQ",   s: headerStyleCenter },
        { v: isAr ? "السعر الأدنى (جنيه)" : "Min Price (EGP)", s: isAr ? headerStyleLeft : headerStyleRight },
        { v: isAr ? "السعر الأقصى (جنيه)" : "Max Price (EGP)", s: isAr ? headerStyleLeft : headerStyleRight },
        { v: isAr ? "الملاحظات" : "Notes",         s: isAr ? headerStyleRight : headerStyleLeft },
      ]);

      for (const [cat, catRows] of Object.entries(grouped)) {
        wsData.push([
          { v: cat, s: catStyle },
          { v: "", s: catStyle },
          { v: "", s: catStyle },
          { v: "", s: catStyle },
          { v: "", s: catStyle },
          { v: "", s: catStyle }
        ]);
        rowHeights.push({ hpt: 26 });
        
        for (const r of catRows) {
          const info = getTierInfo(r, locale);
          wsData.push([
            { v: r.item_name, s: cellStyleProduct },
            { v: r.unit, s: cellStyleUnit },
            { v: r.moq || "", s: cellStyleMOQ },
            { v: info.min ?? "", s: cellStyleMin },
            { v: info.max ?? "", s: cellStyleMax },
            { v: info.notes, s: cellStyleNotes },
          ]);
          rowHeights.push({ hpt: 22 });
        }
        wsData.push([]);
        rowHeights.push({ hpt: 10 });
      }

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // Auto-fit column widths based on content length
      const colWidths = [20, 10, 10, 16, 16, 24]; // Minimum base widths
      for (let rIdx = 5; rIdx < wsData.length; rIdx++) {
        const row = wsData[rIdx];
        if (!row || row.length === 0) continue;
        
        // Skip category header rows (where column 1 is empty)
        const isCatRow = !row[1] || row[1].v === "";
        
        for (let cIdx = 0; cIdx < row.length; cIdx++) {
          const cell = row[cIdx];
          if (!cell) continue;
          
          let valStr = "";
          if (typeof cell.v === "number") {
            if (cIdx === 3 || cIdx === 4) {
              valStr = isAr
                ? `${cell.v.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} جنيه`
                : `EGP ${cell.v.toLocaleString("en-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            } else {
              valStr = String(cell.v);
            }
          } else if (cell.v !== undefined && cell.v !== null) {
            valStr = String(cell.v);
          }
          
          if (valStr.length > 0) {
            if (isCatRow && cIdx === 0) continue;
            if (valStr.length + 5 > colWidths[cIdx]) {
              colWidths[cIdx] = valStr.length + 5;
            }
          }
        }
      }

      ws["!cols"] = colWidths.map(w => ({ wch: w }));
      ws["!rows"] = rowHeights;
      ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } },
      ];
      ws["!views"] = [{ RTL: isAr }];
      
      XLSX.utils.book_append_sheet(wb, ws, monthLabel.substring(0, 31));
      XLSX.writeFile(wb, isAr ? `قائمة_الأسعار_${month}_${username}.xlsx` : `FAERP_PriceList_${month}_${username}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  if (published.length === 0) return null;

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "14px 20px", borderRadius: "14px",
      background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)",
      border: "1.5px solid rgba(99,102,241,0.25)",
      boxShadow: "0 2px 10px rgba(99,102,241,0.08)",
      marginBottom: "4px",
    }}>
      {/* Left — info */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <div style={{
          width: "44px", height: "44px", borderRadius: "12px", flexShrink: 0,
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "20px", boxShadow: "0 4px 12px rgba(99,102,241,0.4)",
        }}>📋</div>
        <div>
          <div style={{ fontSize: "14px", fontWeight: 800, color: "#3730a3", marginBottom: "3px" }}>
            {isAr ? `قائمة الأسعار النهائية — ${monthLabel}` : `Final Price List — ${monthLabel}`}
          </div>
          <div style={{ fontSize: "11px", color: "#4338ca" }}>
            {isAr 
              ? `تم نشر ${published.length} منتجاً في ${Object.keys(grouped).length} فئات · معتمد من إدارة سلاسل الإمداد` 
              : `${published.length} published items across ${Object.keys(grouped).length} categories · Approved by SC`}
          </div>
        </div>
      </div>
      {/* Right — export buttons */}
      <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
        <button
          type="button"
          onClick={exportXLSX}
          disabled={exporting}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            padding: "9px 16px", borderRadius: "9px", fontSize: "12px", fontWeight: 700,
            border: "1.5px solid rgba(99,102,241,0.35)",
            background: "white", color: "#3730a3",
            cursor: exporting ? "not-allowed" : "pointer",
            opacity: exporting ? 0.6 : 1,
            transition: "all 150ms",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.08)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "white"; }}
        >
          📊 {exporting ? (isAr ? "جاري التصدير…" : "Exporting…") : (isAr ? "إكسل / XLSX" : "Excel / XLSX")}
        </button>
        <button
          type="button"
          onClick={exportPDF}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            padding: "9px 16px", borderRadius: "9px", fontSize: "12px", fontWeight: 700,
            border: "none",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: "#fff",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(99,102,241,0.4)",
            transition: "all 150ms",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 18px rgba(99,102,241,0.55)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 12px rgba(99,102,241,0.4)"; }}
        >
          🖨️ {isAr ? "طباعة / PDF" : "Print / PDF"}
        </button>
      </div>
    </div>
  );
}
