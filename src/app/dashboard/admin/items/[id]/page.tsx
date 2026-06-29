import { requireRole } from "@/lib/auth";
import { getItemCardData } from "@/lib/db";
import { notFound } from "next/navigation";
import ItemDetailClient from "./item-detail-client";

type PageProps = {
  params: {
    id: string;
  };
};

export default function ItemDetailPage({ params }: PageProps) {
  const session = requireRole(["AD", "SC", "WH", "SA"]);
  const itemId = Number(params.id);
  
  if (isNaN(itemId)) {
    notFound();
  }

  const data = getItemCardData(itemId);
  if (!data) {
    notFound();
  }

  const { item, supplierStats, monthStats, months, supplierNames, grid, sellingRows } = data;
  const isSA = session.role === "SA";

  // Serialize grid Map to a plain object Record<month, Record<supplierName, entry>>
  const serializedGrid: Record<string, Record<string, { price: number; recordedAt: string }>> = {};
  if (!isSA) {
    for (const [month, supplierMap] of grid.entries()) {
      serializedGrid[month] = {};
      for (const [supplierName, entry] of supplierMap.entries()) {
        serializedGrid[month][supplierName] = entry;
      }
    }
  }

  const scrubbedItem = isSA
    ? {
        ...item,
        recommended_supplier_id: null,
        recommended_supplier_name: null,
      }
    : item;

  const scrubbedSellingRows = isSA
    ? sellingRows.map((s) => {
        const isApproved = s.approval_status === "approved";
        return {
          month: s.month,
          sell_min: isApproved ? s.sell_min : s.last_approved_sell_min,
          sell_max: isApproved ? s.sell_max : s.last_approved_sell_max,
          strategy: isApproved ? s.strategy : s.last_approved_strategy,
          approval_status: s.approval_status,
        };
      })
    : sellingRows;

  return (
    <div className="page-stack" style={{ padding: "0 0 20px" }}>
      <ItemDetailClient
        item={scrubbedItem}
        supplierStats={isSA ? [] : supplierStats}
        monthStats={isSA ? [] : monthStats}
        months={months}
        supplierNames={isSA ? [] : supplierNames}
        serializedGrid={serializedGrid}
        sellingRows={scrubbedSellingRows}
        role={session.role}
      />
    </div>
  );
}
