import { requireRole } from "@/lib/auth";
import { getSupplierCardData, database } from "@/lib/db";
import { notFound } from "next/navigation";
import SupplierDetailClient from "./supplier-detail-client";

type PageProps = {
  params: {
    id: string;
  };
};

export default function SupplierDetailPage({ params }: PageProps) {
  const session = requireRole(["AD", "SC", "WH", "SA"]);
  const supplierId = Number(params.id);

  if (isNaN(supplierId)) {
    notFound();
  }

  const data = getSupplierCardData(supplierId);
  if (!data) {
    notFound();
  }

  const { supplier, itemStats, monthStats, months } = data;

  // Fetch complete quotes history for the charts and detail table
  const quotesHistory = database().prepare(`
    SELECT pe.id, pe.price, pe.currency, pe.month, pe.notes, pe.collected_by, pe.recorded_at,
           i.name AS item_name, pe.item_id, c.name AS category_name
    FROM price_entries pe
    JOIN items i ON i.id = pe.item_id
    JOIN categories c ON c.id = i.category_id
    WHERE pe.supplier_id = ?
    ORDER BY pe.month DESC, pe.recorded_at DESC, pe.id DESC
  `).all(supplierId) as Array<{
    id: number;
    price: number;
    currency: string;
    month: string;
    notes: string | null;
    collected_by: string;
    recorded_at: string;
    item_name: string;
    item_id: number;
    category_name: string;
  }>;

  return (
    <div className="page-stack" style={{ padding: "0 0 20px" }}>
      <SupplierDetailClient
        supplier={supplier}
        itemStats={itemStats}
        monthStats={monthStats}
        months={months}
        quotesHistory={quotesHistory}
        role={session.role}
      />
    </div>
  );
}
