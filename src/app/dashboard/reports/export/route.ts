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
  other: number
): number | string {
  if (!buyAvg || !discount) return "";
  const raw =
    discount < 1
      ? buyAvg / discount + transport + other
      : buyAvg * (1 + discount / 100) + transport + other;
  return roundUp5(raw);
}

const HEADER_STYLE = {
  font: { name: "Segoe UI", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
  fill: { fgColor: { rgb: "059669" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: {
    top: { style: "thin", color: { rgb: "047857" } },
    bottom: { style: "medium", color: { rgb: "047857" } },
    left: { style: "thin", color: { rgb: "047857" } },
    right: { style: "thin", color: { rgb: "047857" } },
  },
};

function cellStyle(rowIdx: number, isNumeric: boolean) {
  const bg = rowIdx % 2 === 0 ? "FFFFFF" : "F9FAFB";
  return {
    font: { name: "Segoe UI", sz: 10, color: { rgb: "334155" } },
    fill: { fgColor: { rgb: bg } },
    alignment: { horizontal: isNumeric ? "right" : "left", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "E2E8F0" } },
      bottom: { style: "thin", color: { rgb: "E2E8F0" } },
      left: { style: "thin", color: { rgb: "E2E8F0" } },
      right: { style: "thin", color: { rgb: "E2E8F0" } },
    },
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
  ws["!rows"] = [{ hpt: 32 }, { hpt: 8 }, { hpt: 24 }, ...Array(rows.length).fill({ hpt: 20 })];
  for (const addr in ws) {
    if (addr.startsWith("!")) continue;
    const cell = ws[addr];
    const { r, c } = XLSX.utils.decode_cell(addr);
    if (r === 0) {
      cell.s = { font: { name: "Segoe UI", sz: 14, bold: true, color: { rgb: "065F46" } }, alignment: { horizontal: "left", vertical: "center" } };
    } else if (r === 2) {
      cell.s = HEADER_STYLE;
    } else if (r >= 3) {
      cell.s = cellStyle(r - 3, typeof cell.v === "number");
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
      return [
        row.category_name, row.item_name, row.unit ?? "", "TIER",
        computeTierPrice(row.buy_avg, row.tier1_discount, transport, other),
        computeTierPrice(row.buy_avg, row.tier2_discount, transport, other),
        computeTierPrice(row.buy_avg, row.tier3_discount, transport, other),
        computeTierPrice(row.buy_avg, row.tier4_discount, transport, other),
        row.created_at ?? "",
      ];
    }
    return [
      row.category_name, row.item_name, row.unit ?? "",
      (row.strategy ?? "").toUpperCase(),
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