import { NextResponse } from "next/server";
import { getMonthlyReport } from "@/lib/db";

export const dynamic = "force-dynamic";

function toCsvValue(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value).replace(/"/g, "\"\"");
  return `"${text}"`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") || new Date().toISOString().slice(0, 7);
  const categoryId = searchParams.get("categoryId");
  const report = getMonthlyReport(month, categoryId ? Number(categoryId) : undefined);

  const rows = [
    ["Section", "Category", "Item", "Supplier", "Value 1", "Value 2", "Value 3", "Value 4"],
    ...report.comparisonRows.flatMap((row) =>
      Object.values(row.quotes).map((quote) => [
        "Comparison",
        row.categoryName,
        row.itemName,
        quote.supplierName,
        quote.price,
        row.unit,
        quote.recordedAt,
        ""
      ])
    ),
    ...report.volatilityRows.map((row) => [
      "Volatility",
      "",
      row.item_name,
      row.supplier_name,
      row.updates,
      row.low_price,
      row.high_price,
      row.last_change
    ]),
    ...report.monthlySellingPrices.map((row) => [
      "Selling",
      row.category_name,
      row.item_name,
      "",
      row.strategy,
      row.sell_min,
      row.sell_max,
      row.created_at
    ])
  ];

  const csv = rows.map((row) => row.map((cell) => toCsvValue(cell)).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"faerp-report-${month}.csv\"`
    }
  });
}