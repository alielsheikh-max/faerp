"use client";

import { useState, useEffect, useTransition } from "react";
import { formatCurrency, formatMonthLabel, formatDateTime, currentMonth } from "@/lib/format";
import { useI18n } from "@/lib/i18n-context";
import * as XLSX from "xlsx-js-style";

// ── Types ─────────────────────────────────────────────────────────────────────
type ReportPreset = {
  id: string;
  icon: string;
  titleEn: string;
  titleAr: string;
  descEn: string;
  descAr: string;
  roles: string[];
  color: string;
};

const PRESETS: ReportPreset[] = [
  // SC presets
  {
    id: "published_selling_prices",
    icon: "💰",
    titleEn: "Published Selling Prices",
    titleAr: "أسعار البيع المنشورة للمبيعات",
    descEn: "Min and max published selling prices for the selected month or range of months",
    descAr: "أسعار البيع الدنيا والقصوى المعتمدة والمنشورة للشهر المحدد أو نطاق الأشهر",
    roles: ["SC"],
    color: "#059669",
  },
  {
    id: "market_overview",
    icon: "📊",
    titleEn: "Monthly Market Overview",
    titleAr: "نظرة عامة على السوق الشهري",
    descEn: "All supplier quotes this month, min/avg/max per item, market trend",
    descAr: "جميع عروض أسعار الموردين هذا الشهر، أدنى/متوسط/أقصى لكل صنف، اتجاه السوق",
    roles: ["SC"],
    color: "#6366f1",
  },
  {
    id: "selling_price_list",
    icon: "💰",
    titleEn: "Approved Selling Price List",
    titleAr: "قائمة أسعار البيع المعتمدة",
    descEn: "Published min/max selling prices by category and item for this month",
    descAr: "أسعار البيع الدنيا والقصوى المنشورة حسب الفئة والصنف لهذا الشهر",
    roles: ["SA"],
    color: "#10b981",
  },
  {
    id: "supplier_comparison",
    icon: "🏭",
    titleEn: "Supplier Price Comparison",
    titleAr: "مقارنة أسعار الموردين",
    descEn: "Side-by-side supplier prices per item with cheapest highlighted",
    descAr: "مقارنة أسعار الموردين لكل صنف مع تمييز الأرخص",
    roles: ["SC"],
    color: "#3b82f6",
  },
  {
    id: "price_volatility",
    icon: "⚠️",
    titleEn: "Price Volatility Alert",
    titleAr: "تنبيه تقلب الأسعار",
    descEn: "Items with same-month price revisions and spread analysis",
    descAr: "الأصناف التي شهدت مراجعات أسعار في نفس الشهر وتحليل الفارق",
    roles: ["SC"],
    color: "#ef4444",
  },
  // WH presets
  {
    id: "collection_log",
    icon: "📋",
    titleEn: "Price Collection Log",
    titleAr: "سجل جمع الأسعار",
    descEn: "All price entries recorded this month by supplier and item",
    descAr: "جميع الأسعار المسجلة هذا الشهر حسب المورد والصنف",
    roles: ["WH"],
    color: "#10b981",
  },
  {
    id: "wh_summary",
    icon: "📦",
    titleEn: "WH Monthly Summary",
    titleAr: "ملخص المشتريات الشهري",
    descEn: "Coverage status: which items/suppliers have been quoted this month",
    descAr: "حالة التغطية: الأصناف والموردون الذين تم تسعيرهم هذا الشهر",
    roles: ["WH"],
    color: "#f59e0b",
  },
  // SA presets
  {
    id: "sales_catalog",
    icon: "🛒",
    titleEn: "Sales Price Catalog",
    titleAr: "كتالوج أسعار المبيعات",
    descEn: "Clean approved price list ready for client quotations",
    descAr: "قائمة أسعار معتمدة جاهزة لعروض أسعار العملاء",
    roles: ["SA", "SC"],
    color: "#8b5cf6",
  },
];

// ── PDF generation helpers ────────────────────────────────────────────────────
function printWindow(html: string, title: string) {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) { alert("Please allow popups to generate PDF reports."); return; }
  win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8"/>
    <title>${title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet"/>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Inter',sans-serif;font-size:12px;color:#111827;background:#fff;padding:32px 40px;direction:ltr}
      body.rtl{direction:rtl;font-family:'Cairo',sans-serif;text-align:right}
      .report-header{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:3px solid #6366f1;padding-bottom:16px;margin-bottom:24px}
      .brand{display:flex;align-items:center;gap:10px}
      .brand-mark{width:36px;height:36px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:14px}
      .brand-name{font-size:18px;font-weight:800;color:#111827}
      .brand-sub{font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em}
      .report-meta{text-align:right}
      .report-meta .title{font-size:16px;font-weight:800;color:#111827;margin-bottom:4px}
      .report-meta .subtitle{font-size:11px;color:#6b7280}
      .badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;background:#eef2ff;color:#4338ca;border:1px solid #c7d2fe}
      .badge-success{background:#ecfdf5;color:#065f46;border-color:#a7f3d0}
      .badge-warning{background:#fffbeb;color:#92400e;border-color:#fcd34d}
      .badge-danger{background:#fef2f2;color:#991b1b;border-color:#fca5a5}
      .section-title{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.10em;color:#6366f1;margin:20px 0 10px}
      table{width:100%;border-collapse:collapse;margin-bottom:16px}
      th{background:#f9fafb;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#6b7280;padding:8px 10px;border-bottom:2px solid #e5e7eb;text-align:left}
      td{padding:7px 10px;border-bottom:1px solid #f3f4f6;font-size:11px;vertical-align:top}
      tr:last-child td{border-bottom:none}
      .best{color:#059669;font-weight:800}
      .danger{color:#dc2626;font-weight:700}
      .muted{color:#9ca3af}
      .num{text-align:right;font-variant-numeric:tabular-nums}
      .stat-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
      .stat-box{padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb}
      .stat-box .lbl{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;margin-bottom:4px}
      .stat-box .val{font-size:20px;font-weight:800;color:#111827}
      .cat-header{background:#f5f3ff;padding:8px 12px;font-weight:800;font-size:12px;color:#4338ca;border-left:3px solid #6366f1;margin:12px 0 6px}
      .footer{margin-top:32px;padding-top:12px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:9px;color:#9ca3af}
      .highlight-row td{background:#f0fdf4}
      .pending-row td{background:#fffbeb}
      @media print{body{padding:20px 28px}@page{margin:1.5cm;size:A4}}
    </style>
  </head><body>${html}<script>window.onload=function(){window.print();}<\/script></body></html>`);
  win.document.close();
}

function formatDate() {
  return new Date().toLocaleDateString("en-EG", { day: "2-digit", month: "long", year: "numeric" });
}

function header(title: string, subtitle: string, month: string, stats?: Record<string, string | number>) {
  const statsHtml = stats ? `<div class="stat-row">${Object.entries(stats).map(([lbl, val]) => `<div class="stat-box"><div class="lbl">${lbl}</div><div class="val">${val}</div></div>`).join("")}</div>` : "";
  return `<div class="report-header">
    <div class="brand">
      <div class="brand-mark">F</div>
      <div><div class="brand-name">FAERP</div><div class="brand-sub">Enterprise ERP · On-Premises</div></div>
    </div>
    <div class="report-meta">
      <div class="title">${title}</div>
      <div class="subtitle">${subtitle} · Generated ${formatDate()}</div>
    </div>
  </div>${statsHtml}`;
}

function footer(username: string) {
  return `<div class="footer"><span>FAERP · Confidential</span><span>Prepared by ${username}</span><span>${formatDate()}</span></div>`;
}

// ── Report data fetcher + renderer ────────────────────────────────────────────
async function generateReport(presetId: string, startMonth: string, endMonth: string, username: string, locale: string, role: string) {
  const res = await fetch(`/api/report-data?preset=${presetId}&month=${startMonth}&startMonth=${startMonth}&endMonth=${endMonth}`);
  if (!res.ok) { alert("Failed to load report data."); return; }
  const data = await res.json();
  const isAr = locale === "ar";
  const bodyClass = isAr ? ' class="rtl"' : "";
  const month = startMonth;

  switch (presetId) {
    case "published_selling_prices": {
      const { catalog } = data;
      const byCategory: Record<string, any[]> = {};
      for (const row of catalog) {
        if (!byCategory[row.category_name]) byCategory[row.category_name] = [];
        byCategory[row.category_name].push(row);
      }
      const catHtml = Object.entries(byCategory).map(([cat, rows]) => {
        const rowsHtml = rows.map((r: any) => `<tr class="highlight-row">
          <td>${r.item_name}</td><td class="muted">${r.unit}</td>
          <td class="num best">${formatCurrency(r.sell_min)}</td>
          <td class="num" style="color:#6366f1;font-weight:800">${formatCurrency(r.sell_max)}</td>
          <td style="text-align:center"><span class="badge">${(r.strategy || "AVG").toUpperCase()}</span></td>
        </tr>`).join("");
        return `<div class="cat-header">${cat}</div><table><thead><tr><th>${isAr ? "الصنف" : "Item"}</th><th>${isAr ? "الوحدة" : "Unit"}</th><th class="num">${isAr ? "أدنى سعر بيع" : "Min Sell"}</th><th class="num">${isAr ? "أقصى سعر بيع" : "Max Sell"}</th><th style="text-align:center">${isAr ? "الاستراتيجية" : "Strategy"}</th></tr></thead><tbody>${rowsHtml}</tbody></table>`;
      }).join("");
      const monthLabel = startMonth === endMonth ? formatMonthLabel(startMonth) : `${formatMonthLabel(startMonth)} → ${formatMonthLabel(endMonth)}`;
      const html = `<body${bodyClass}>${header(
        isAr ? "تقرير أسعار البيع المنشورة للمبيعات" : "Published Selling Prices Report",
        monthLabel,
        startMonth,
        { [isAr ? "الأصناف المنشورة" : "Published Items"]: catalog.length }
      )}${catHtml}${footer(username)}</body>`;
      printWindow(html, `Published Prices - ${startMonth}_to_${endMonth}`);
      break;
    }
    case "market_overview": {
      const { metrics, comparisonRows, suppliers } = data;
      const supplierCols = suppliers.map((s: any) => `<th class="num">${s.name}</th>`).join("");
      const rows = comparisonRows.map((row: any) => {
        const prices = suppliers.map((s: any) => {
          const q = row.quotes[String(s.id)];
          return q ? q.price : null;
        });
        const minP = Math.min(...prices.filter((p: any) => p !== null));
        const cells = suppliers.map((s: any, i: number) => {
          const p = prices[i];
          return `<td class="num ${p === minP ? "best" : ""}">${p !== null ? formatCurrency(p) : '<span class="muted">—</span>'}</td>`;
        }).join("");
        const avg = prices.filter((p: any) => p !== null).reduce((a: number, b: number) => a + b, 0) / prices.filter((p: any) => p !== null).length;
        return `<tr><td>${row.categoryName}</td><td style="max-width:220px">${row.itemName}</td><td class="muted">${row.unit}</td>${cells}<td class="num">${formatCurrency(avg)}</td></tr>`;
      }).join("");
      const html = `<body${bodyClass}>${header(
        isAr ? "نظرة عامة على السوق الشهري" : "Monthly Market Overview",
        formatMonthLabel(month),
        month,
        {
          [isAr ? "عروض الأسعار" : "Total Quotes"]: metrics.quotes,
          [isAr ? "الموردون" : "Suppliers"]: metrics.suppliers,
          [isAr ? "الأصناف" : "Items Covered"]: metrics.products,
          [isAr ? "الأسعار المنشورة" : "Prices Published"]: metrics.selling,
        }
      )}<div class="section-title">${isAr ? "مقارنة أسعار الموردين" : "Supplier Price Comparison"}</div>
      <table><thead><tr><th>${isAr ? "الفئة" : "Category"}</th><th>${isAr ? "الصنف" : "Item"}</th><th>${isAr ? "الوحدة" : "Unit"}</th>${supplierCols}<th class="num">${isAr ? "المتوسط" : "Market Avg"}</th></tr></thead><tbody>${rows}</tbody></table>
      ${footer(username)}</body>`;
      printWindow(html, `Market Overview - ${month}`);
      break;
    }

    case "selling_price_list": {
      const { catalog } = data;
      const byCategory: Record<string, any[]> = {};
      for (const row of catalog) {
        if (!byCategory[row.category_name]) byCategory[row.category_name] = [];
        byCategory[row.category_name].push(row);
      }
      const isSA = role === "SA";
      const catHtml = Object.entries(byCategory).map(([cat, rows]) => {
        const rowsHtml = rows.map((r: any) => r.sell_min !== null ? `<tr class="highlight-row">
          <td>${r.item_name}</td><td class="muted">${r.unit}</td>
          <td class="num best">${formatCurrency(r.sell_min)}</td>
          <td class="num" style="color:#6366f1;font-weight:800">${formatCurrency(r.sell_max)}</td>
          ${isSA ? "" : `<td style="text-align:center"><span class="badge">${(r.strategy || "").toUpperCase()}</span></td>`}
        </tr>` : `<tr class="pending-row"><td>${r.item_name}</td><td class="muted">${r.unit}</td><td colspan="${isSA ? "2" : "3"}" class="muted" style="text-align:center">${isAr ? "قيد الانتظار" : "Pending"}</td></tr>`).join("");
        const strategyHeader = isSA ? "" : `<th style="text-align:center">${isAr ? "الاستراتيجية" : "Strategy"}</th>`;
        return `<div class="cat-header">${cat}</div><table><thead><tr><th>${isAr ? "الصنف" : "Item"}</th><th>${isAr ? "الوحدة" : "Unit"}</th><th class="num">${isAr ? "أدنى سعر بيع" : "Min Sell"}</th><th class="num">${isAr ? "أقصى سعر بيع" : "Max Sell"}</th>${strategyHeader}</tr></thead><tbody>${rowsHtml}</tbody></table>`;
      }).join("");
      const published = catalog.filter((r: any) => r.sell_min !== null).length;
      const uniqueCategories = new Set(catalog.map((r: any) => r.category_name)).size;
      const monthLabel = startMonth === endMonth ? formatMonthLabel(startMonth) : `${formatMonthLabel(startMonth)} - ${formatMonthLabel(endMonth)}`;
      const statsObj = {
        [isAr ? "الأصناف المنشورة" : "Published Items"]: published,
        [isAr ? "الإجمالي" : "Total Items"]: catalog.length,
        [isAr ? "الفترة الزمنية" : "Period"]: monthLabel,
        [isAr ? "فئات المنتجات" : "Categories"]: uniqueCategories,
      };
      const html = `<body${bodyClass}>${header(
        isAr ? "قائمة أسعار البيع المعتمدة" : "Approved Selling Price List",
        monthLabel,
        month,
        statsObj
      )}${catHtml}${footer(username)}</body>`;
      printWindow(html, `Selling Prices - ${month}`);
      break;
    }

    case "supplier_comparison": {
      const { comparisonRows, suppliers } = data;
      const supplierCols = suppliers.map((s: any) => `<th class="num">${s.name}</th>`).join("");
      const rows = comparisonRows.map((row: any) => {
        const prices = suppliers.map((s: any) => {
          const q = row.quotes[String(s.id)];
          return q ? q.price : null;
        });
        const validPrices = prices.filter((p: any) => p !== null);
        const minP = validPrices.length ? Math.min(...validPrices) : null;
        const cells = suppliers.map((s: any, i: number) => {
          const p = prices[i];
          const isBest = p !== null && p === minP;
          return `<td class="num ${isBest ? "best" : ""}">${p !== null ? formatCurrency(p) : '<span class="muted">—</span>'}${isBest ? ' <span class="badge badge-success" style="font-size:8px">★</span>' : ""}</td>`;
        }).join("");
        const spread = validPrices.length >= 2 ? (((Math.max(...validPrices) - Math.min(...validPrices)) / Math.min(...validPrices)) * 100).toFixed(1) + "%" : "—";
        return `<tr><td>${row.categoryName}</td><td style="max-width:200px">${row.itemName}</td>${cells}<td class="num muted">${spread}</td></tr>`;
      }).join("");
      const html = `<body${bodyClass}>${header(
        isAr ? "مقارنة أسعار الموردين" : "Supplier Price Comparison",
        formatMonthLabel(month), month
      )}<div class="section-title">${isAr ? "★ = الأرخص للصنف" : "★ = cheapest for item"}</div>
      <table><thead><tr><th>${isAr ? "الفئة" : "Category"}</th><th>${isAr ? "الصنف" : "Item"}</th>${supplierCols}<th class="num">${isAr ? "الفارق" : "Spread"}</th></tr></thead><tbody>${rows}</tbody></table>
      ${footer(username)}</body>`;
      printWindow(html, `Supplier Comparison - ${month}`);
      break;
    }

    case "price_volatility": {
      const { volatilityRows, metrics } = data;
      const rows = volatilityRows.map((r: any) => `<tr>
        <td>${r.item_name}</td><td>${r.supplier_name}</td>
        <td class="num">${r.updates}</td>
        <td class="num best">${formatCurrency(r.low_price)}</td>
        <td class="num danger">${formatCurrency(r.high_price)}</td>
        <td class="num">${(((r.high_price - r.low_price) / r.low_price) * 100).toFixed(1)}%</td>
        <td class="muted">${formatDateTime(r.last_change)}</td>
      </tr>`).join("");
      const html = `<body${bodyClass}>${header(
        isAr ? "تنبيه تقلب الأسعار" : "Price Volatility Alert",
        formatMonthLabel(month), month,
        { [isAr ? "تنبيهات" : "Alerts"]: volatilityRows.length, [isAr ? "التغييرات" : "Price Changes"]: metrics.changes }
      )}${volatilityRows.length === 0 ? `<p style="color:#6b7280;text-align:center;padding:32px">${isAr ? "لا توجد تقلبات أسعار هذا الشهر" : "No price volatility detected this month"}</p>` : `
      <table><thead><tr>
        <th>${isAr ? "الصنف" : "Item"}</th><th>${isAr ? "المورد" : "Supplier"}</th>
        <th class="num">${isAr ? "التحديثات" : "Updates"}</th>
        <th class="num">${isAr ? "أدنى" : "Low"}</th><th class="num">${isAr ? "أقصى" : "High"}</th>
        <th class="num">${isAr ? "الفارق" : "Spread"}</th>
        <th>${isAr ? "آخر تغيير" : "Last Change"}</th>
      </tr></thead><tbody>${rows}</tbody></table>`}
      ${footer(username)}</body>`;
      printWindow(html, `Volatility Alert - ${month}`);
      break;
    }

    case "collection_log": {
      const { recentEntries } = data;
      const rows = recentEntries.map((e: any) => `<tr>
        <td><span class="badge">${e.month}</span></td>
        <td>${e.category_name}</td><td style="max-width:200px">${e.item_name}</td>
        <td>${e.supplier_name}</td>
        <td class="num best">${formatCurrency(e.price)}</td>
        <td class="muted">${formatDateTime(e.recorded_at)}</td>
      </tr>`).join("");
      const html = `<body${bodyClass}>${header(
        isAr ? "سجل جمع الأسعار" : "Price Collection Log",
        formatMonthLabel(month), month,
        { [isAr ? "الإجمالي المسجّل" : "Total Logged"]: recentEntries.length }
      )}
      <table><thead><tr>
        <th>${isAr ? "الشهر" : "Month"}</th><th>${isAr ? "الفئة" : "Category"}</th>
        <th>${isAr ? "الصنف" : "Item"}</th><th>${isAr ? "المورد" : "Supplier"}</th>
        <th class="num">${isAr ? "السعر" : "Price"}</th><th>${isAr ? "وقت التسجيل" : "Recorded At"}</th>
      </tr></thead><tbody>${rows}</tbody></table>
      ${footer(username)}</body>`;
      printWindow(html, `Collection Log - ${month}`);
      break;
    }

    case "wh_summary": {
      const { comparisonRows, suppliers, metrics } = data;
      const total = comparisonRows.length;
      const covered = comparisonRows.filter((r: any) => Object.keys(r.quotes).length > 0).length;
      const rows = comparisonRows.map((row: any) => {
        const quotedSuppliers = Object.keys(row.quotes).length;
        const allSuppliers = suppliers.length;
        const status = quotedSuppliers === 0 ? `<span class="badge badge-danger">${isAr ? "لم يُسجَّل" : "Not Recorded"}</span>` :
          quotedSuppliers < allSuppliers ? `<span class="badge badge-warning">${quotedSuppliers}/${allSuppliers}</span>` :
          `<span class="badge badge-success">${isAr ? "مكتمل" : "Complete"} ✓</span>`;
        return `<tr class="${quotedSuppliers === allSuppliers ? "highlight-row" : quotedSuppliers === 0 ? "pending-row" : ""}">
          <td>${row.categoryName}</td><td style="max-width:220px">${row.itemName}</td><td class="muted">${row.unit}</td>
          <td>${status}</td>
        </tr>`;
      }).join("");
      const html = `<body${bodyClass}>${header(
        isAr ? "ملخص المشتريات الشهري" : "WH Monthly Summary",
        formatMonthLabel(month), month,
        {
          [isAr ? "إجمالي الأصناف" : "Total Items"]: total,
          [isAr ? "مغطى" : "Covered"]: covered,
          [isAr ? "معلق" : "Pending"]: total - covered,
          [isAr ? "عروض الأسعار" : "Quotes Logged"]: metrics.quotes,
        }
      )}
      <table><thead><tr>
        <th>${isAr ? "الفئة" : "Category"}</th><th>${isAr ? "الصنف" : "Item"}</th>
        <th>${isAr ? "الوحدة" : "Unit"}</th><th>${isAr ? "الحالة" : "Status"}</th>
      </tr></thead><tbody>${rows}</tbody></table>
      ${footer(username)}</body>`;
      printWindow(html, `WH Summary - ${month}`);
      break;
    }

    case "sales_catalog": {
      const { catalog } = data;
      const published = catalog.filter((r: any) => r.sell_min !== null);
      const byCategory: Record<string, any[]> = {};
      for (const row of published) {
        if (!byCategory[row.category_name]) byCategory[row.category_name] = [];
        byCategory[row.category_name].push(row);
      }
      const catHtml = Object.entries(byCategory).map(([cat, rows]) => {
        const rowsHtml = rows.map((r: any) => `<tr class="highlight-row">
          <td style="max-width:260px;font-weight:600">${r.item_name}</td>
          <td class="muted">${r.unit}</td>
          <td class="num best" style="font-size:14px">${formatCurrency(r.sell_min)}</td>
          <td class="num" style="color:#6366f1;font-weight:800;font-size:14px">${formatCurrency(r.sell_max)}</td>
        </tr>`).join("");
        return `<div class="cat-header">${cat}</div><table>
          <thead><tr>
            <th>${isAr ? "المنتج" : "Product"}</th><th>${isAr ? "الوحدة" : "Unit"}</th>
            <th class="num">${isAr ? "أدنى سعر" : "Min Price"}</th>
            <th class="num">${isAr ? "أقصى سعر" : "Max Price"}</th>
          </tr></thead><tbody>${rowsHtml}</tbody></table>`;
      }).join("");

      const uniqueCategories = new Set(published.map((r: any) => r.category_name)).size;
      const monthLabel = startMonth === endMonth ? formatMonthLabel(startMonth) : `${formatMonthLabel(startMonth)} - ${formatMonthLabel(endMonth)}`;

      const statsObj = {
        [isAr ? "الأصناف المتاحة" : "Available Items"]: published.length,
        [isAr ? "الفترة الزمنية" : "Period"]: monthLabel,
        [isAr ? "فئات المنتجات" : "Categories"]: uniqueCategories,
        [isAr ? "حالة الكتالوج" : "Catalog Status"]: isAr ? "معتمد" : "Approved"
      };

      const html = `<body${bodyClass}>${header(
        isAr ? "كتالوج أسعار المبيعات" : "Sales Price Catalog",
        monthLabel, month,
        statsObj
      )}<p style="color:#6b7280;font-size:11px;margin-bottom:16px">${isAr ? "جميع الأسعار بالجنيه المصري · للاستخدام الداخلي فقط" : "All prices in EGP · For internal use only"}</p>
      ${catHtml}${footer(username)}</body>`;
      printWindow(html, `Sales Catalog - ${month}`);
      break;
    }
  }
}

// ── API route for report data ─────────────────────────────────────────────────
// (defined below as a separate file)

// ── Main Component ────────────────────────────────────────────────────────────
export default function ReportGenerator({ role, username, dashboardMonth }: { role: string; username: string; dashboardMonth?: string }) {
  const { locale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [generatingExcel, setGeneratingExcel] = useState<string | null>(null);
  const [startMonth, setStartMonth] = useState(dashboardMonth || currentMonth());
  const [endMonth, setEndMonth] = useState(dashboardMonth || currentMonth());

  useEffect(() => {
    if (dashboardMonth) {
      setStartMonth(dashboardMonth);
      setEndMonth(dashboardMonth);
    }
  }, [dashboardMonth]);

  const month = startMonth;

  const visiblePresets = PRESETS.filter(p => p.roles.includes(role));

  const handleGenerate = async (presetId: string) => {
    setGenerating(presetId);
    try {
      await generateReport(presetId, startMonth, endMonth, username, locale, role);
    } finally {
      setGenerating(null);
    }
  };

  const handleExportExcel = async (presetId: string) => {
    setGeneratingExcel(presetId);
    try {
      const res = await fetch(`/api/report-data?preset=${presetId}&month=${startMonth}&startMonth=${startMonth}&endMonth=${endMonth}`);
      if (!res.ok) { alert("Failed to load report data."); return; }
      const data = await res.json();
      const isAr = locale === "ar";
      
      const preset = PRESETS.find(p => p.id === presetId);
      const title = isAr ? preset?.titleAr : preset?.titleEn;

      let headers: string[] = [];
      let rows: any[][] = [];

      if (presetId === "market_overview") {
        const { comparisonRows, suppliers } = data;
        headers = [
          isAr ? "الفئة" : "Category",
          isAr ? "الصنف" : "Item",
          isAr ? "الوحدة" : "Unit",
          ...suppliers.map((s: any) => s.name),
          isAr ? "المتوسط" : "Market Avg"
        ];
        rows = comparisonRows.map((row: any) => {
          const supplierPrices = suppliers.map((s: any) => {
            const q = row.quotes[String(s.id)];
            return q ? q.price : "";
          });
          const prices = suppliers.map((s: any) => row.quotes[String(s.id)]?.price).filter((p: any) => p !== undefined && p !== null);
          const avg = prices.length ? (prices.reduce((a: number, b: number) => a + b, 0) / prices.length).toFixed(2) : "";
          return [row.categoryName, row.itemName, row.unit, ...supplierPrices, avg];
        });
      } else if (presetId === "selling_price_list") {
        const { catalog } = data;
        const isSA = role === "SA";
        if (isSA) {
          headers = [
            isAr ? "الفئة" : "Category",
            isAr ? "الصنف" : "Item",
            isAr ? "الوحدة" : "Unit",
            isAr ? "أدنى سعر بيع" : "Min Sell",
            isAr ? "أقصى سعر بيع" : "Max Sell",
            isAr ? "الحالة" : "Status"
          ];
          rows = catalog.map((r: any) => [
            r.category_name,
            r.item_name,
            r.unit,
            r.sell_min !== null ? r.sell_min : "",
            r.sell_max !== null ? r.sell_max : "",
            r.sell_min !== null ? (isAr ? "منشور" : "Published") : (isAr ? "قيد الانتظار" : "Pending")
          ]);
        } else {
          headers = [
            isAr ? "الفئة" : "Category",
            isAr ? "الصنف" : "Item",
            isAr ? "الوحدة" : "Unit",
            isAr ? "أدنى سعر بيع" : "Min Sell",
            isAr ? "أقصى سعر بيع" : "Max Sell",
            isAr ? "الاستراتيجية" : "Strategy",
            isAr ? "الحالة" : "Status"
          ];
          rows = catalog.map((r: any) => [
            r.category_name,
            r.item_name,
            r.unit,
            r.sell_min !== null ? r.sell_min : "",
            r.sell_max !== null ? r.sell_max : "",
            r.strategy || "",
            r.sell_min !== null ? (isAr ? "منشور" : "Published") : (isAr ? "قيد الانتظار" : "Pending")
          ]);
        }
      } else if (presetId === "supplier_comparison") {
        const { comparisonRows, suppliers } = data;
        headers = [
          isAr ? "الفئة" : "Category",
          isAr ? "الصنف" : "Item",
          isAr ? "الوحدة" : "Unit",
          ...suppliers.map((s: any) => s.name),
          isAr ? "الفارق" : "Spread"
        ];
        rows = comparisonRows.map((row: any) => {
          const supplierPrices = suppliers.map((s: any) => {
            const q = row.quotes[String(s.id)];
            return q ? q.price : "";
          });
          const prices = suppliers.map((s: any) => row.quotes[String(s.id)]?.price).filter((p: any) => p !== undefined && p !== null);
          const spread = prices.length >= 2 ? (((Math.max(...prices) - Math.min(...prices)) / Math.min(...prices)) * 100).toFixed(1) + "%" : "";
          return [row.categoryName, row.itemName, row.unit, ...supplierPrices, spread];
        });
      } else if (presetId === "price_volatility") {
        const { volatilityRows } = data;
        headers = [
          isAr ? "الصنف" : "Item",
          isAr ? "المورد" : "Supplier",
          isAr ? "التحديثات" : "Updates",
          isAr ? "أدنى" : "Low",
          isAr ? "أقصى" : "High",
          isAr ? "الفارق" : "Spread",
          isAr ? "آخر تغيير" : "Last Change"
        ];
        rows = volatilityRows.map((r: any) => [
          r.item_name,
          r.supplier_name,
          r.updates,
          r.low_price,
          r.high_price,
          (((r.high_price - r.low_price) / r.low_price) * 100).toFixed(1) + "%",
          formatDateTime(r.last_change)
        ]);
      } else if (presetId === "collection_log") {
        const { recentEntries } = data;
        headers = [
          isAr ? "الشهر" : "Month",
          isAr ? "الفئة" : "Category",
          isAr ? "الصنف" : "Item",
          isAr ? "المورد" : "Supplier",
          isAr ? "السعر" : "Price",
          isAr ? "وقت التسجيل" : "Recorded At"
        ];
        rows = recentEntries.map((e: any) => [
          e.month,
          e.category_name,
          e.item_name,
          e.supplier_name,
          e.price,
          formatDateTime(e.recorded_at)
        ]);
      } else if (presetId === "wh_summary") {
        const { comparisonRows, suppliers } = data;
        headers = [
          isAr ? "الفئة" : "Category",
          isAr ? "الصنف" : "Item",
          isAr ? "الوحدة" : "Unit",
          isAr ? "الحالة" : "Status"
        ];
        rows = comparisonRows.map((row: any) => {
          const quotedSuppliers = Object.keys(row.quotes).length;
          const allSuppliers = suppliers.length;
          const status = quotedSuppliers === 0 ? (isAr ? "لم يسجل" : "Not Recorded") :
            quotedSuppliers < allSuppliers ? `${quotedSuppliers}/${allSuppliers}` : (isAr ? "مكتمل" : "Complete");
          return [row.categoryName, row.itemName, row.unit, status];
        });
      } else if (presetId === "sales_catalog") {
        const { catalog } = data;
        const published = catalog.filter((r: any) => r.sell_min !== null);
        headers = [
          isAr ? "الفئة" : "Category",
          isAr ? "المنتج" : "Product",
          isAr ? "الوحدة" : "Unit",
          isAr ? "أدنى سعر" : "Min Price",
          isAr ? "أقصى سعر" : "Max Price"
        ];
        rows = published.map((r: any) => [
          r.category_name,
          r.item_name,
          r.unit,
          r.sell_min,
          r.sell_max
        ]);
      } else if (presetId === "published_selling_prices") {
        const { catalog } = data;
        headers = [
          isAr ? "الفئة" : "Category",
          isAr ? "المنتج" : "Product",
          isAr ? "الوحدة" : "Unit",
          isAr ? "أدنى سعر بيع" : "Min Sell Price",
          isAr ? "أقصى سعر بيع" : "Max Sell Price",
          isAr ? "الاستراتيجية" : "Strategy"
        ];
        rows = catalog.map((r: any) => [
          r.category_name,
          r.item_name,
          r.unit,
          r.sell_min,
          r.sell_max,
          r.strategy || "AVG"
        ]);
      }

      const sheetData = [
        [`${title} - ${month}`],
        [],
        headers,
        ...rows
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

      // Merge cells: A1 to last column header for Title
      worksheet["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }
      ];

      // Enable RTL if locale is Arabic
      worksheet["!views"] = [{ RTL: isAr }];

      // Auto-fit column widths based on content length
      const cols = headers.map((header, colIdx) => {
        let maxLen = String(header).length;
        rows.forEach((row) => {
          const cellVal = row[colIdx];
          if (cellVal !== undefined && cellVal !== null) {
            const len = String(cellVal).length;
            if (len > maxLen) maxLen = len;
          }
        });
        return { wch: Math.max(maxLen + 5, 12) };
      });
      worksheet["!cols"] = cols;

      // Set row heights
      worksheet["!rows"] = [
        { hpt: 35 }, // Title row
        { hpt: 10 }, // Spacer row
        { hpt: 26 }, // Headers row
        ...Array(rows.length).fill({ hpt: 22 }) // Data rows
      ];

      // Styles definitions
      const titleStyle = {
        font: { name: "Segoe UI", sz: 16, bold: true, color: { rgb: "065F46" } }, // Emerald-800
        alignment: { horizontal: isAr ? "right" : "left", vertical: "center" }
      };

      const headerStyle = {
        font: { name: "Segoe UI", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "059669" } }, // Emerald-600
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: {
          top: { style: "thin", color: { rgb: "047857" } },
          bottom: { style: "medium", color: { rgb: "047857" } },
          left: { style: "thin", color: { rgb: "047857" } },
          right: { style: "thin", color: { rgb: "047857" } }
        }
      };

      // Styles for normal rows (zebra-striped)
      const getCellStyle = (rIndex: number, colIndex: number, headerName: string, cellValue: any) => {
        const isEven = (rIndex - 3) % 2 === 0; // Row 3 is the first data row
        const bgRgb = isEven ? "FFFFFF" : "F9FAFB"; // Alternating Slate-50 zebra style
        
        let align = isAr ? "right" : "left";
        const hClean = headerName.toLowerCase();
        
        const centerHeaders = [
          "unit", "units", "id", "item id", "status", "month", "updates", "recorded at", "last change",
          "معرف الصنف", "الوحدة", "الحالة", "الشهر", "التحديثات", "آخر تغيير", "وقت التسجيل"
        ];
        
        const rightHeaders = [
          "price", "sell", "avg", "spread", "low", "high",
          "سعر", "متوسط", "فارق", "أدنى", "أقصى"
        ];

        const isCenter = centerHeaders.some(ch => hClean.includes(ch));
        const isRight = rightHeaders.some(rh => hClean.includes(rh)) || typeof cellValue === "number";

        if (isCenter) {
          align = "center";
        } else if (isRight) {
          align = "right";
        }

        return {
          font: { name: "Segoe UI", sz: 10, color: { rgb: "334155" } },
          fill: { fgColor: { rgb: bgRgb } },
          alignment: { horizontal: align, vertical: "center" },
          border: {
            top: { style: "thin", color: { rgb: "E2E8F0" } },
            bottom: { style: "thin", color: { rgb: "E2E8F0" } },
            left: { style: "thin", color: { rgb: "E2E8F0" } },
            right: { style: "thin", color: { rgb: "E2E8F0" } }
          }
        };
      };

      // Loop through worksheet cells and apply styles
      for (const key in worksheet) {
        if (key.startsWith("!")) continue;
        const cell = worksheet[key];
        const addr = XLSX.utils.decode_cell(key);
        const r = addr.r;
        const c = addr.c;

        if (r === 0) {
          cell.s = titleStyle;
        } else if (r === 2) {
          cell.s = headerStyle;
        } else if (r >= 3) {
          const hName = headers[c] || "";
          cell.s = getCellStyle(r, c, hName, cell.v);
        }
      }

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
      XLSX.writeFile(workbook, `${presetId}_${month}.xlsx`);
    } catch (err) {
      console.error(err);
      alert("Error exporting excel report.");
    } finally {
      setGeneratingExcel(null);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "16px",
          padding: "16px 20px",
          borderRadius: "14px",
          border: "1.5px solid rgba(16,185,129,0.4)",
          background: "linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)",
          cursor: "pointer",
          transition: "all 220ms ease",
          textAlign: "left",
          boxShadow: "0 2px 8px rgba(16,185,129,0.12)",
          position: "relative",
          overflow: "hidden",
        }}
        onMouseEnter={e => {
          const b = e.currentTarget as HTMLButtonElement;
          b.style.borderColor = "rgba(16,185,129,0.7)";
          b.style.boxShadow = "0 6px 20px rgba(16,185,129,0.22)";
          b.style.transform = "translateY(-2px)";
          b.style.background = "linear-gradient(135deg, #d1fae5 0%, #ecfdf5 100%)";
        }}
        onMouseLeave={e => {
          const b = e.currentTarget as HTMLButtonElement;
          b.style.borderColor = "rgba(16,185,129,0.4)";
          b.style.boxShadow = "0 2px 8px rgba(16,185,129,0.12)";
          b.style.transform = "translateY(0)";
          b.style.background = "linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)";
        }}
      >
        {/* Icon block */}
        <div style={{
          width: "46px", height: "46px", borderRadius: "12px", flexShrink: 0,
          background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 12px rgba(16,185,129,0.4)",
          fontSize: "20px",
        }}>
          📄
        </div>
        {/* Text */}
        <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
          <div style={{ fontSize: "15px", fontWeight: 800, color: "#065f46", letterSpacing: "-0.01em" }}>
            {locale === "ar" ? "تقارير PDF" : "PDF Reports"}
          </div>
          <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px", fontWeight: 500 }}>
            {locale === "ar" ? "إنشاء تقارير السوق وقوائم الأسعار" : `${visiblePresets.length} report types · market data, prices, logs`}
          </div>
        </div>
        {/* Arrow */}
        <div style={{
          width: "28px", height: "28px", borderRadius: "8px", flexShrink: 0,
          background: "rgba(16,185,129,0.15)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "14px", color: "#059669", fontWeight: 800,
          transition: "transform 220ms ease",
        }}>
          →
        </div>
      </button>
    );
  }

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(6,9,15,0.7)",
        backdropFilter: "blur(6px)",
        zIndex: 3000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        animation: "fadeIn 0.15s ease-out",
      }}
    >
      {/* Modal */}
      <div style={{
        width: "100%", maxWidth: "680px", maxHeight: "88vh",
        display: "flex", flexDirection: "column",
        background: "var(--bg-surface)", border: "1px solid var(--border-medium)",
        borderRadius: "16px", boxShadow: "var(--shadow-xl)",
        animation: "slideUp 0.22s cubic-bezier(0.16,1,0.3,1)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border-light)", display: "flex", alignItems: "center", gap: "14px", flexShrink: 0, background: "linear-gradient(135deg, rgba(16,185,129,0.08), transparent)" }}>
          <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "linear-gradient(135deg,#10b981,#059669)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0, boxShadow: "0 4px 12px rgba(16,185,129,0.4)" }}>📄</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--success)", marginBottom: "3px" }}>
              {locale === "ar" ? "إنشاء تقرير" : "Report Generator"} · {formatMonthLabel(month)}
            </p>
            <h2 style={{ fontSize: "16px", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
              {locale === "ar" ? "اختر نوع التقرير" : "Select Report Type"}
            </h2>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "3px" }}>
              {locale === "ar" ? "يُفتح في نافذة جديدة جاهزة للطباعة / حفظ PDF" : "Opens in a new window — ready to print or Save as PDF"}
            </p>
          </div>
          <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "20px", cursor: "pointer", padding: "4px 8px", borderRadius: "6px", lineHeight: 1 }}>×</button>
        </div>

        {/* Month Selection Range */}
        <div style={{
          padding: "12px 24px",
          background: "var(--bg-subtle)",
          borderBottom: "1px solid var(--border-light)",
          display: "flex",
          gap: "16px",
          alignItems: "center",
          flexWrap: "wrap"
        }}>
          <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)" }}>
            {locale === "ar" ? "نطاق الأشهر للتقرير:" : "Report Month Range:"}
          </span>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              type="month"
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
              style={{
                padding: "6px 10px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--bg-elevated)",
                color: "var(--text-primary)",
                fontSize: "13px"
              }}
            />
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{locale === "ar" ? "إلى" : "to"}</span>
            <input
              type="month"
              value={endMonth}
              onChange={(e) => setEndMonth(e.target.value)}
              style={{
                padding: "6px 10px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--bg-elevated)",
                color: "var(--text-primary)",
                fontSize: "13px"
              }}
            />
          </div>
          {startMonth !== endMonth && (
            <span className="badge badge-success" style={{ fontSize: "10px" }}>
              {locale === "ar" ? "تقرير متعدد الأشهر" : "Multi-month range"}
            </span>
          )}
        </div>

        {/* Report presets */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px 20px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {visiblePresets.map((preset) => {
            const isGenerating = generating === preset.id;
            const title = locale === "ar" ? preset.titleAr : preset.titleEn;
            const desc = locale === "ar" ? preset.descAr : preset.descEn;
            return (
              <div
                key={preset.id}
                style={{
                  display: "flex", alignItems: "center", gap: "14px",
                  padding: "14px 16px", borderRadius: "12px",
                  border: `1.5px solid ${preset.color}33`,
                  background: `${preset.color}08`,
                  transition: "all 200ms ease",
                  cursor: isGenerating ? "wait" : "default",
                }}
              >
                {/* Icon */}
                <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: `${preset.color}22`, border: `1.5px solid ${preset.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>
                  {preset.icon}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: "13px", color: "var(--text-primary)", marginBottom: "3px" }}>{title}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.4 }}>{desc}</div>
                  <div style={{ marginTop: "5px", display: "flex", gap: "5px", flexWrap: "wrap" }}>
                    {preset.roles.map(r => (
                      <span key={r} style={{ fontSize: "9px", fontWeight: 800, padding: "1px 6px", borderRadius: "4px", background: preset.color + "22", color: preset.color, border: `1px solid ${preset.color}44` }}>{r}</span>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}>
                  {/* Generate PDF button */}
                  <button
                    type="button"
                    onClick={() => handleGenerate(preset.id)}
                    disabled={generating !== null || generatingExcel !== null}
                    style={{
                      padding: "7px 14px", borderRadius: "8px", border: "none",
                      background: generating === preset.id ? "var(--bg-elevated)" : preset.color,
                      color: generating === preset.id ? "var(--text-muted)" : "#fff",
                      fontSize: "11px", fontWeight: 700, cursor: (generating || generatingExcel) ? "wait" : "pointer",
                      whiteSpace: "nowrap",
                      transition: "all 150ms",
                      boxShadow: generating === preset.id ? "none" : `0 2px 8px ${preset.color}33`,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                      width: "120px",
                    }}
                  >
                    {generating === preset.id ? (
                      <><span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>⟳</span> {locale === "ar" ? "جارٍ..." : "PDF..."}</>
                    ) : (
                      <><span>📄</span> {locale === "ar" ? "تصدير PDF" : "Export PDF"}</>
                    )}
                  </button>

                  {/* Export Excel button */}
                  <button
                    type="button"
                    onClick={() => handleExportExcel(preset.id)}
                    disabled={generating !== null || generatingExcel !== null}
                    style={{
                      padding: "6px 14px", borderRadius: "8px", 
                      border: `1.5px solid ${preset.color}bb`,
                      background: generatingExcel === preset.id ? "var(--bg-elevated)" : "transparent",
                      color: generatingExcel === preset.id ? "var(--text-muted)" : preset.color,
                      fontSize: "11px", fontWeight: 700, cursor: (generating || generatingExcel) ? "wait" : "pointer",
                      whiteSpace: "nowrap",
                      transition: "all 150ms",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                      width: "120px",
                    }}
                    onMouseEnter={(e) => {
                      if (!generating && !generatingExcel) {
                        const b = e.currentTarget as HTMLButtonElement;
                        b.style.background = preset.color;
                        b.style.color = "#fff";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!generating && !generatingExcel) {
                        const b = e.currentTarget as HTMLButtonElement;
                        b.style.background = "transparent";
                        b.style.color = preset.color;
                      }
                    }}
                  >
                    {generatingExcel === preset.id ? (
                      <><span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>⟳</span> {locale === "ar" ? "جارٍ..." : "Excel..."}</>
                    ) : (
                      <><span>📊</span> {locale === "ar" ? "تصدير Excel" : "Export Excel"}</>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 24px", borderTop: "1px solid var(--border-light)", background: "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            {locale === "ar" ? `تقارير لشهر ${formatMonthLabel(month)} · ${visiblePresets.length} تقارير متاحة` : `Reports for ${formatMonthLabel(month)} · ${visiblePresets.length} presets available`}
          </span>
          <button onClick={() => setOpen(false)} className="button button-secondary" style={{ fontSize: "12px", padding: "7px 16px" }}>
            {locale === "ar" ? "إغلاق" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
