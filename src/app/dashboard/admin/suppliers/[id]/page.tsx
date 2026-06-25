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

  // Fetch approved selling prices history where this supplier was confirmed
  const approvalsHistory = database().prepare(`
    SELECT 
      sp.month,
      i.name AS item_name,
      i.unit,
      c.name AS category_name,
      sp.strategy,
      COALESCE(
        (SELECT price FROM price_entries 
         WHERE item_id = sp.item_id 
           AND month = sp.month 
           AND supplier_id = sp.confirmed_supplier_id 
           AND status = 'approved' 
         LIMIT 1),
        CASE 
          WHEN sp.strategy = 'min' THEN sp.buy_min
          WHEN sp.strategy = 'max' THEN sp.buy_max
          ELSE sp.buy_avg
        END
      ) AS cost_base,
      sp.sell_min,
      sp.sell_max
    FROM selling_prices sp
    JOIN items i ON sp.item_id = i.id
    JOIN categories c ON i.category_id = c.id
    WHERE sp.confirmed_supplier_id = ?
      AND sp.approval_status = 'approved'
    ORDER BY sp.month DESC, i.name ASC
  `).all(supplierId) as Array<{
    month: string;
    item_name: string;
    unit: string;
    category_name: string;
    strategy: string;
    cost_base: number;
    sell_min: number;
    sell_max: number;
  }>;

  return (
    <div className="page-stack" style={{ padding: "0 0 20px" }}>
      <SupplierDetailClient
        supplier={supplier}
        itemStats={itemStats}
        monthStats={monthStats}
        months={months}
        quotesHistory={quotesHistory}
        approvalsHistory={approvalsHistory}
        role={session.role}
      />
    </div>
  );
}
