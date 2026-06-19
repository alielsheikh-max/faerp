"use client";

import { useState } from "react";
import * as XLSX from "xlsx-js-style";
import { formatDate } from "@/lib/format";

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
};

type Props = { rows: SalesRow[]; month: string; username: string };

function fmtEGP(n: number | null) {
  if (n === null) return "—";
  return `EGP ${n.toLocaleString("en-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function printWindow(html: string, title: string) {
  const win = window.open("", "_blank", "width=950,height=750");
  if (!win) { alert("Please allow pop-ups to generate PDF reports."); return; }
  win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8"/>
    <title>${title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet"/>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Inter',sans-serif;font-size:12px;color:#111827;background:#fff;padding:32px 40px}
      .header{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:3px solid #6366f1;padding-bottom:16px;margin-bottom:24px}
      .brand{display:flex;align-items:center;gap:10px}
      .brand-mark{width:36px;height:36px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:14px}
      .brand-name{font-size:18px;font-weight:800;color:#111827}
      .brand-sub{font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em}
      .meta{text-align:right}
      .meta .doc-title{font-size:16px;font-weight:800;color:#111827;margin-bottom:4px}
      .meta .doc-sub{font-size:11px;color:#6b7280}
      .stamp{display:inline-block;padding:4px 12px;border-radius:99px;background:rgba(16,185,129,0.1);border:1.5px solid #10b981;color:#065f46;font-weight:800;font-size:10px;letter-spacing:.06em;text-transform:uppercase;margin-top:6px}
      .cat-header{background:#f5f3ff;padding:8px 12px;font-weight:800;font-size:12px;color:#4338ca;border-left:3px solid #6366f1;margin:16px 0 6px;border-radius:0 4px 4px 0}
      table{width:100%;border-collapse:collapse;margin-bottom:8px}
      th{background:#f9fafb;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#6b7280;padding:8px 10px;border-bottom:2px solid #e5e7eb;text-align:left}
      th.r{text-align:right}
      td{padding:7px 10px;border-bottom:1px solid #f3f4f6;font-size:11px;vertical-align:top}
      tr:last-child td{border-bottom:none}
      tr:hover td{background:#fafafa}
      .r{text-align:right;font-variant-numeric:tabular-nums}
      .sell-min{color:#0284c7;font-weight:800}
      .sell-max{color:#6366f1;font-weight:800}
      .tier-tag{display:inline-block;padding:1px 6px;background:#f5f3ff;color:#6d28d9;border-radius:4px;font-size:9px;font-weight:800;margin-left:4px}
      .muted{color:#9ca3af}
      .footer{margin-top:32px;padding-top:12px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:9px;color:#9ca3af}
      @media print{body{padding:20px 28px}@page{margin:1.5cm;size:A4}}
    </style>
  </head><body>${html}<script>window.onload=function(){window.print();}<\/script></body></html>`);
  win.document.close();
}

export default function SalesPriceListExport({ rows, month, username }: Props) {
  const [exporting, setExporting] = useState(false);

  const published = rows.filter(r => r.sell_min !== null);
  const grouped: Record<string, SalesRow[]> = {};
  for (const r of published) {
    if (!grouped[r.category_name]) grouped[r.category_name] = [];
    grouped[r.category_name].push(r);
  }

  const monthLabel = (() => {
    const [y, m] = month.split("-");
    return new Date(Number(y), Number(m) - 1).toLocaleString("en-EG", { month: "long", year: "numeric" });
  })();

  /* ── PDF ────────────────────────────────────────────────────── */
  const exportPDF = () => {
    let body = `
      <div class="header">
        <div class="brand">
          <div class="brand-mark">F</div>
          <div><div class="brand-name">FAERP</div><div class="brand-sub">Enterprise ERP · On-Premises</div></div>
        </div>
        <div class="meta">
          <div class="doc-title">Final Approved Price List</div>
          <div class="doc-sub">${monthLabel} · Prepared by ${username}</div>
          <div class="doc-sub">${formatDate()}</div>
          <div class="stamp">✓ Published &amp; Approved by SC</div>
        </div>
      </div>`;

    for (const [cat, catRows] of Object.entries(grouped)) {
      body += `<div class="cat-header">${cat}</div>
        <table><thead><tr>
          <th>Product</th><th>Unit</th><th class="r">MOQ</th>
          <th class="r">Min Price (EGP)</th><th class="r">Max Price (EGP)</th><th>Notes</th>
        </tr></thead><tbody>`;
      for (const r of catRows) {
        const tiered = r.tier_pricing_enabled && r.is_tiered;
        body += `<tr>
          <td>${r.item_name}${tiered ? '<span class="tier-tag">TIERED</span>' : ""}</td>
          <td class="muted">${r.unit}</td>
          <td class="r muted">${r.moq || "—"}</td>
          <td class="r sell-min">${fmtEGP(r.sell_min)}</td>
          <td class="r sell-max">${fmtEGP(r.sell_max)}</td>
          <td class="muted" style="font-size:10px">${tiered ? "Tiered pricing applies" : ""}</td>
        </tr>`;
      }
      body += `</tbody></table>`;
    }

    body += `<div class="footer">
      <span>FAERP · Confidential · Internal Use Only</span>
      <span>Approved &amp; Published by: ${username}</span>
      <span>${formatDate()}</span>
    </div>`;

    printWindow(body, `FAERP Price List – ${monthLabel}`);
  };

  /* ── Excel ──────────────────────────────────────────────────── */
  const exportXLSX = async () => {
    setExporting(true);
    try {
      const wb = XLSX.utils.book_new();
      const headerStyle = {
        font: { bold: true, sz: 9, color: { rgb: "6B7280" } },
        fill: { fgColor: { rgb: "F9FAFB" } },
        border: { bottom: { style: "medium", color: { rgb: "E5E7EB" } } },
        alignment: { horizontal: "center" as const },
      };
      const catStyle = {
        font: { bold: true, sz: 11, color: { rgb: "4338CA" } },
        fill: { fgColor: { rgb: "F5F3FF" } },
      };
      const minStyle  = { font: { bold: true, sz: 11, color: { rgb: "0284C7" } }, alignment: { horizontal: "right" as const } };
      const maxStyle  = { font: { bold: true, sz: 11, color: { rgb: "6366F1" } }, alignment: { horizontal: "right" as const } };
      const mutedStyle = { font: { sz: 10, color: { rgb: "9CA3AF" } } };

      const wsData: any[][] = [];

      // Title rows
      wsData.push([{ v: "FAERP — Final Approved Price List", s: { font: { bold: true, sz: 16, color: { rgb: "111827" } } } }]);
      wsData.push([{ v: `${monthLabel} · Prepared by ${username} · ${formatDate()}`, s: { font: { sz: 10, color: { rgb: "6B7280" } } } }]);
      wsData.push([{ v: "✓ Published & Approved by SC", s: { font: { bold: true, sz: 10, color: { rgb: "065F46" } } } }]);
      wsData.push([]);

      // Headers
      wsData.push([
        { v: "Product",         s: headerStyle },
        { v: "Unit",            s: headerStyle },
        { v: "MOQ",             s: headerStyle },
        { v: "Min Price (EGP)", s: { ...headerStyle, alignment: { horizontal: "right" as const } } },
        { v: "Max Price (EGP)", s: { ...headerStyle, alignment: { horizontal: "right" as const } } },
        { v: "Notes",           s: headerStyle },
      ]);

      for (const [cat, catRows] of Object.entries(grouped)) {
        wsData.push([{ v: cat, s: catStyle }, { v: "", s: catStyle }, { v: "", s: catStyle }, { v: "", s: catStyle }, { v: "", s: catStyle }, { v: "", s: catStyle }]);
        for (const r of catRows) {
          wsData.push([
            { v: r.item_name, s: { font: { bold: true, sz: 11 } } },
            { v: r.unit, s: mutedStyle },
            { v: r.moq || "", s: { ...mutedStyle, alignment: { horizontal: "center" as const } } },
            { v: r.sell_min ?? "", s: minStyle },
            { v: r.sell_max ?? "", s: maxStyle },
            { v: r.tier_pricing_enabled && r.is_tiered ? "Tiered pricing" : "", s: mutedStyle },
          ]);
        }
        wsData.push([]);
      }

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws["!cols"] = [{ wch: 36 }, { wch: 10 }, { wch: 8 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
      ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } },
      ];
      XLSX.utils.book_append_sheet(wb, ws, monthLabel.substring(0, 31));
      XLSX.writeFile(wb, `FAERP_PriceList_${month}_${username}.xlsx`);
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
            Final Price List — {monthLabel}
          </div>
          <div style={{ fontSize: "11px", color: "#4338ca" }}>
            {published.length} published items across {Object.keys(grouped).length} categories · Approved by SC
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
          📊 {exporting ? "Exporting…" : "Excel / XLSX"}
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
          🖨️ Print / PDF
        </button>
      </div>
    </div>
  );
}
