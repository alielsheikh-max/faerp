import { NextResponse } from "next/server";
import { getMonthlyReport } from "@/lib/db";
import * as XLSX from "xlsx-js-style";

export const dynamic = "force-dynamic";

// ── Helpers ────────────────────────────────────────────────────────────────────
function roundUp5(v: number) { return v > 0 ? Math.ceil(v / 5) * 5 : v; }

function computeTierPrice(
  buyAvg: number | null,
  discount: number | null,
  transport: number,
  other: number,
  sellMin: number | null
): number | string {
  if (!buyAvg || !discount) return "";
  const raw =
    discount < 1
      ? buyAvg / discount + transport + other
      : (sellMin !== null ? (sellMin - transport - other) : buyAvg) * (1 - discount / 100) + transport + other;
  return roundUp5(raw);
}

const HEADER_STYLE = {
  font: { name: "Segoe UI", sz: 11, bold: true, color: { rgb: "1F2937" } },
  fill: { fgColor: { rgb: "F1F5F9" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: {
    top: { style: "thin", color: { rgb: "CBD5E1" } },
    bottom: { style: "medium", color: { rgb: "94A3B8" } },
    left: { style: "thin", color: { rgb: "CBD5E1" } },
    right: { style: "thin", color: { rgb: "CBD5E1" } },
  },
};

function cellStyle(rowIdx: number, headerName: string, cellValue: any) {
  const bg = rowIdx % 2 === 0 ? "FFFFFF" : "F9FAFB";
  const hClean = headerName.toLowerCase();
  
  const centerKeywords = ["unit", "moq", "date", "change", "at", "published"];
  const isCenter = centerKeywords.some(k => hClean.includes(k));
  const isNumeric = typeof cellValue === "number";
  
  const align = isCenter ? "center" : (isNumeric ? "right" : "left");
  const priceKeywords = ["price", "sell", "avg", "low", "high", "spread", "val", "t1", "t2", "t3", "t4"];
  const isPriceCol = priceKeywords.some(k => hClean.includes(k)) && !hClean.includes("%");

  return {
    font: { name: "Segoe UI", sz: 10, color: { rgb: "334155" } },
    fill: { fgColor: { rgb: bg } },
    alignment: { horizontal: align, vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "E2E8F0" } },
      bottom: { style: "thin", color: { rgb: "E2E8F0" } },
      left: { style: "thin", color: { rgb: "E2E8F0" } },
      right: { style: "thin", color: { rgb: "E2E8F0" } },
    },
    ...(isPriceCol && isNumeric ? { numFmt: '"EGP" #,##0.00' } : {})
  };
}

function buildSheet(
  sheetTitle: string,
  month: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
): XLSX.WorkSheet {
  const aoa = [[`${sheetTitle}  \u2014  ${month}`], [], headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }];
  ws["!cols"] = headers.map((h, ci) => {
    let max = h.length;
    rows.forEach((r) => { const v = r[ci]; if (v != null) max = Math.max(max, String(v).length); });
    return { wch: Math.max(max + 4, 12) };
  });
  ws["!rows"] = [{ hpt: 35 }, { hpt: 10 }, { hpt: 28 }, ...Array(rows.length).fill({ hpt: 22 })];
  for (const addr in ws) {
    if (addr.startsWith("!")) continue;
    const cell = ws[addr];
    const { r, c } = XLSX.utils.decode_cell(addr);
    if (r === 0) {
      cell.s = { font: { name: "Segoe UI", sz: 16, bold: true, color: { rgb: "1E3A8A" } }, alignment: { horizontal: "left", vertical: "center" } };
    } else if (r === 2) {
      cell.s = HEADER_STYLE;
    } else if (r >= 3) {
      const hName = headers[c] || "";
      cell.s = cellStyle(r - 3, hName, cell.v);
    }
  }
  return ws;
}

// ── Route handler ──────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") || new Date().toISOString().slice(0, 7);
  const categoryId = searchParams.get("categoryId");
  const report = getMonthlyReport(month, categoryId ? Number(categoryId) : undefined);

  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Selling Prices ───────────────────────────────────────────────
  const sellingHeaders = [
    "Category", "Item", "Unit", "Strategy",
    "T1 / Min (1\u2013100)", "T2 (101\u2013200)", "T3 (201\u2013800)", "T4 / Max (801+)", "Published At",
  ];
  const sellingRows = report.monthlySellingPrices.map((row) => {
    const isTier = row.tier_pricing_enabled === 1 && row.is_tiered === 1;
    const transport = row.transportation ?? 0;
    const other = row.other_expenses ?? 0;
    if (isTier) {
      const baseCost = row.strategy === "min" ? (row.buy_min ?? 0) : row.strategy === "max" ? (row.buy_max ?? 0) : (row.buy_avg ?? 0);
      return [
        row.category_name, row.item_name, row.unit ?? "", "TIER",
        computeTierPrice(baseCost, row.tier1_discount, transport, other, row.sell_min),
        computeTierPrice(baseCost, row.tier2_discount, transport, other, row.sell_min),
        computeTierPrice(baseCost, row.tier3_discount, transport, other, row.sell_min),
        computeTierPrice(baseCost, row.tier4_discount, transport, other, row.sell_min),
        row.created_at ?? "",
      ];
    }
    if (row.is_tiered === 2) {
      return [
        row.category_name, row.item_name, row.unit ?? "", "FIXED",
        row.sell_min ?? "", "", "", "", row.created_at ?? "",
      ];
    }
    return [
      row.category_name, row.item_name, row.unit ?? "", "MIN/MAX",
      row.sell_min ?? "", "", "", row.sell_max ?? "", row.created_at ?? "",
    ];
  });
  XLSX.utils.book_append_sheet(wb, buildSheet("Selling Prices", month, sellingHeaders, sellingRows), "Selling Prices");

  // ── Sheet 2: Market Quotes ────────────────────────────────────────────────
  const quotesHeaders = ["Category", "Item", "Unit", "Supplier", "Price (EGP)", "Date"];
  const quotesRows: (string | number)[][] = report.comparisonRows.flatMap((row) =>
    Object.values(row.quotes as Record<string, { supplierName: string; price: number; recordedAt: string }>).map((q) => [
      row.categoryName, row.itemName, row.unit, q.supplierName, q.price, q.recordedAt,
    ])
  );
  XLSX.utils.book_append_sheet(wb, buildSheet("Market Quotes", month, quotesHeaders, quotesRows), "Market Quotes");

  // ── Sheet 3: Volatility Alerts ────────────────────────────────────────────
  const volatHeaders = ["Item", "Supplier", "Updates", "Low Price (EGP)", "High Price (EGP)", "Spread %", "Last Change"];
  const volatRows = report.volatilityRows.map((row) => [
    row.item_name, row.supplier_name, row.updates, row.low_price, row.high_price,
    row.low_price > 0 ? `${(((row.high_price - row.low_price) / row.low_price) * 100).toFixed(1)}%` : "\u2014",
    row.last_change,
  ]);
  XLSX.utils.book_append_sheet(wb, buildSheet("Volatility Alerts", month, volatHeaders, volatRows), "Volatility Alerts");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="faerp-report-${month}.xlsx"`,
    },
  });
}