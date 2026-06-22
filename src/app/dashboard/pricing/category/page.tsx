import { requireRole } from "@/lib/auth";
import { getCategories, getItems, getSalesCatalog, getSuppliers, getAllPriceEntries } from "@/lib/db";
import { currentMonth, formatMonthLabel } from "@/lib/format";
import { SectionIntro } from "@/components/app-shell";
import CategoryMarkupPanel from "@/components/category-markup-panel";

type SearchParams = { month?: string; categoryId?: string };

export default function CategoryPricingPage({ searchParams }: { searchParams?: SearchParams }) {
  const session = requireRole(["SC", "AD"]);
  const month = searchParams?.month || currentMonth();

  const categories = getCategories();
  const items      = getItems();

  const initialCategoryId = searchParams?.categoryId ? String(searchParams.categoryId) : undefined;
  const catIdNum = initialCategoryId ? parseInt(initialCategoryId, 10) : undefined;

  // Helper to subtract 1 month
  const getPrevMonth = (m: string) => {
    const [y, mon] = m.split("-").map(Number);
    if (mon === 1) return `${y - 1}-12`;
    return `${y}-${String(mon - 1).padStart(2, "0")}`;
  };
  const prevMonth = getPrevMonth(month);

  const salesCatalog = getSalesCatalog(month, catIdNum);
  const prevCatalog = getSalesCatalog(prevMonth, catIdNum);
  const suppliers = getSuppliers();
  const priceEntries = getAllPriceEntries();

  // Filter items that have at least one approved price entry for the current month
  // OR have NO price entries at all (approved, pending, or rejected) for the current month.
  const currentMonthEntries = priceEntries.filter(pe => pe.month === month);
  const entriesByItem = new Map<number, typeof currentMonthEntries>();
  for (const entry of currentMonthEntries) {
    if (!entriesByItem.has(entry.item_id)) {
      entriesByItem.set(entry.item_id, []);
    }
    entriesByItem.get(entry.item_id)!.push(entry);
  }

  const filteredItems = items.filter(item => {
    const itemEntries = entriesByItem.get(item.id) || [];
    if (itemEntries.length === 0) return true;
    return itemEntries.some(entry => entry.status === 'approved');
  });

  return (
    <div className="page-stack">
      <SectionIntro
        eyebrow={formatMonthLabel(month)}
        title="Category Pricing"
        description="Apply a uniform markup or divisor to all items in a category at once. Ideal for quick month-start pricing or cost-change adjustments."
        actions={
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span className="badge badge-strong">{session.displayName}</span>
            <span className="badge">{formatMonthLabel(month)}</span>
            <a href="/dashboard/pricing" className="button button-secondary" style={{ fontSize: "11px", padding: "5px 12px" }}>
              🧮 Item Pricing →
            </a>
          </div>
        }
      />

      {/* Bulk Category Pricing */}
      <section className="panel animate-fade-in">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Bulk Apply</p>
            <h2>Category Markup</h2>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span className="badge" style={{ fontSize: "11px", background: "var(--primary-light)", color: "var(--primary)" }}>
              ⚡ Applies to all items with quotes this month
            </span>
          </div>
        </div>

        {/* Mode explanation cards */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "12px",
          padding: "0 0 20px",
        }}>
          {[
            {
              icon: "%",
              label: "Percent Mode",
              formula: "sell = cost \u00d7 (1 + markup%)",
              sub: "Apply a min & max % range \u2014 each item gets a value in between",
              color: "#10b981",
            },
            {
              icon: "+",
              label: "Fixed Amount",
              formula: "sell = cost + amount (EGP)",
              sub: "Adds a flat EGP amount on top of the supplier cost",
              color: "#6366f1",
            },
            {
              icon: "\u00f7",
              label: "Divisor Mode",
              formula: "sell = cost \u00f7 divisor",
              sub: "e.g. divisor 0.77 implies ~30% gross margin",
              color: "#8b5cf6",
            },
          ].map(m => (
            <div key={m.label} style={{
              padding: "16px 18px",
              background: "var(--bg-surface)",
              border: "1.5px solid var(--border-light)",
              borderTop: `3px solid ${m.color}`,
              borderRadius: "var(--radius-lg)",
              display: "flex", gap: "14px", alignItems: "flex-start",
              boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
            }}>
              <div style={{
                width: "36px", height: "36px", borderRadius: "10px",
                background: m.color + "15", border: `1px solid ${m.color}30`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "18px", fontWeight: 900, color: m.color, flexShrink: 0,
              }}>
                {m.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--text-primary)", marginBottom: "6px" }}>
                  {m.label}
                </div>
                <code style={{
                  display: "block", fontSize: "12px", fontWeight: 700,
                  fontFamily: "'Courier New', monospace",
                  color: m.color,
                  background: m.color + "12",
                  border: `1px solid ${m.color}30`,
                  padding: "4px 10px", borderRadius: "6px",
                  marginBottom: "8px",
                }}>{m.formula}</code>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.5 }}>
                  {m.sub}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: "16px" }}>
          <CategoryMarkupPanel
            categories={categories}
            items={filteredItems}
            month={month}
            username={session.displayName}
            defaultCategoryId={initialCategoryId}
            salesCatalog={salesCatalog}
            prevCatalog={prevCatalog}
            suppliers={suppliers}
            priceEntries={priceEntries}
          />
        </div>
      </section>
    </div>
  );
}
