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

  // Serialize grid Map to a plain object Record<month, Record<supplierName, entry>>
  const serializedGrid: Record<string, Record<string, { price: number; recordedAt: string }>> = {};
  for (const [month, supplierMap] of grid.entries()) {
    serializedGrid[month] = {};
    for (const [supplierName, entry] of supplierMap.entries()) {
      serializedGrid[month][supplierName] = entry;
    }
  }

  return (
    <div className="page-stack" style={{ padding: "0 0 20px" }}>
      <ItemDetailClient
        item={item}
        supplierStats={supplierStats}
        monthStats={monthStats}
        months={months}
        supplierNames={supplierNames}
        serializedGrid={serializedGrid}
        sellingRows={sellingRows}
        role={session.role}
      />
    </div>
  );
}
