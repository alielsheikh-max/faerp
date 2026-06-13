import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  getMonthlyReport,
  getSuppliers,
  getSalesCatalog,
  getSalesCatalogForMonths,
  getAllPriceEntries,
  getMonthlyMetrics,
} from "@/lib/db";
import { currentMonth } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Auth check
  const session = requireRole();

  const { searchParams } = new URL(request.url);
  const preset = searchParams.get("preset") || "";
  const month = searchParams.get("month") || currentMonth();
  const startMonth = searchParams.get("startMonth") || month;
  const endMonth = searchParams.get("endMonth") || month;

  const report = getMonthlyReport(month);
  const suppliers = getSuppliers();
  const metrics = getMonthlyMetrics(month);

  // Build supplier id→quote map for comparison rows
  const comparisonRows = report.comparisonRows.map((row) => ({
    itemId: row.itemId,
    itemName: row.itemName,
    unit: row.unit,
    categoryName: row.categoryName,
    quotes: Object.fromEntries(
      Object.entries(row.quotes).map(([supplierId, q]) => [supplierId, q])
    ),
  }));

  switch (preset) {
    case "market_overview":
    case "supplier_comparison":
    case "wh_summary":
      return NextResponse.json({ comparisonRows, suppliers, metrics });

    case "selling_price_list":
    case "sales_catalog": {
      const catalog = getSalesCatalog(month);
      return NextResponse.json({ catalog, metrics });
    }

    case "published_selling_prices": {
      const catalog = getSalesCatalogForMonths(startMonth, endMonth);
      return NextResponse.json({ catalog, metrics });
    }

    case "price_volatility":
      return NextResponse.json({ volatilityRows: report.volatilityRows, metrics });

    case "collection_log": {
      // Get all entries for this month
      const allEntries = getAllPriceEntries().filter((e) => e.month === month);
      return NextResponse.json({ recentEntries: allEntries, metrics });
    }

    default:
      return NextResponse.json({ comparisonRows, suppliers, metrics, volatilityRows: report.volatilityRows });
  }
}
