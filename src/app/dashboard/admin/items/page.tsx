import { SectionIntro } from "@/components/app-shell";
import AdminPanel from "@/components/admin-panel";
import MarginFloorsPanel from "@/components/margin-floors-panel";
import TierPricingPanel from "@/components/tier-pricing-panel";
import CsvImportPanel from "@/components/csv-import-panel";
import CollapsiblePanel from "@/components/collapsible-panel";
import { requireRole } from "@/lib/auth";
import { getAdminSnapshot, getMarginFloors, getItems, getItemTiers } from "@/lib/db";
import { getServerT, getServerLocale } from "@/lib/locale-server";

export default function ItemsAdminPage({
  searchParams,
}: {
  searchParams?: { success?: string; error?: string };
}) {
  const session = requireRole(["AD", "SC", "WH"]);
  const t = getServerT();
  const locale = getServerLocale();
  const isAr = locale === "ar";
  const snapshot = getAdminSnapshot();
  const floors = getMarginFloors();
  const allItems = getItems();
  const tiers = getItemTiers();

  const eyebrow = isAr ? "دليل النظام" : "ERP Catalog";
  const description = session.role === "AD"
    ? (isAr ? "تصفح المنتجات والأقسام وإعدادات التسعير القياسية وشرائح الكميات." : "Browse items, categories, standard pricing configs, and volume tiers.")
    : (isAr ? "تصفح المنتجات والأقسام." : "Browse items and categories.");

  return (
    <div className="page-stack">
      <SectionIntro
        eyebrow={eyebrow}
        title={t("nav.items")}
        description={description}
        actions={
          searchParams?.success ? (
            <span className="badge badge-success">{searchParams.success}</span>
          ) : searchParams?.error ? (
            <span className="badge badge-danger">{searchParams.error}</span>
          ) : (
            <span className="badge badge-strong">{session.displayName}</span>
          )
        }
      />

      <AdminPanel
        users={snapshot.users}
        categories={snapshot.categories}
        suppliers={snapshot.suppliers}
        items={snapshot.items}
        showOnly="items"
        role={session.role}
      />

      {session.role === "AD" && (
        <>
          <CollapsiblePanel
            id="csv-import"
            eyebrow="Data Import"
            title="CSV Import — Items & Categories"
            badgeText="Upload CSV"
            badgeClass="badge-indigo"
            subtitle="Download the template, fill in your items and categories with tier pricing, then upload to bulk-import or update the catalog."
          >
            <CsvImportPanel type="items" />
          </CollapsiblePanel>

          <CollapsiblePanel
            id="floors"
            eyebrow="Pricing Controls"
            title="Margin Floor Rules"
            badgeText={`${floors.length} active rules`}
            badgeClass="badge-warning"
            subtitle="Margin floors set the minimum markup percentage that must be applied when publishing selling prices. Any attempt to save a price below the floor will be blocked. Item-level rules take precedence over category-level rules."
          >
            <MarginFloorsPanel
              floors={floors}
              categories={snapshot.categories.map((c) => ({ id: c.id, name: c.name }))}
              items={allItems.map((i) => ({
                id: i.id,
                name: i.name,
                category_id: i.category_id,
                category_name: i.category_name,
              }))}
              username={session.displayName}
            />
          </CollapsiblePanel>

          <CollapsiblePanel
            id="tiers"
            eyebrow="Pricing Controls"
            title="Volume Tier Rules"
            badgeText={`${tiers.filter(t => t.is_tiered === 1).length} active items`}
            badgeClass="badge-indigo"
            subtitle="Volume tiers set discount rates based on deal quantity for specific products. Discounts are applied directly to the base published price when the monthly Tier Pricing toggle is active."
          >
            <TierPricingPanel
              tiers={tiers}
              items={allItems.map((i) => ({
                id: i.id,
                name: i.name,
                category_id: i.category_id,
                category_name: i.category_name,
              }))}
              username={session.displayName}
            />
          </CollapsiblePanel>
        </>
      )}
    </div>
  );
}
