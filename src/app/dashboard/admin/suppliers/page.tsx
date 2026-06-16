import { SectionIntro } from "@/components/app-shell";
import SuppliersDirectory from "@/components/suppliers-directory";
import CsvImportPanel from "@/components/csv-import-panel";
import CollapsiblePanel from "@/components/collapsible-panel";
import SupplierCategoriesPanel from "@/components/supplier-categories-panel";
import { requireRole } from "@/lib/auth";
import { getAdminSnapshot } from "@/lib/db";
import { getServerT } from "@/lib/locale-server";

export default function SuppliersAdminPage({
  searchParams,
}: {
  searchParams?: { success?: string; error?: string };
}) {
  const session = requireRole(["AD", "SC", "WH"]);
  const t = getServerT();
  const snapshot = getAdminSnapshot();

  return (
    <div className="page-stack">
      <SectionIntro
        eyebrow="ERP Directories"
        title={t("nav.suppliers")}
        description="Search and browse supplier profiles, pricing history, and business details."
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

      <article className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Supplier Directory</p>
            <h2>All Suppliers</h2>
          </div>
          <span className="badge badge-strong">{snapshot.suppliers.length} suppliers</span>
        </div>

        <SuppliersDirectory
          suppliers={snapshot.suppliers}
          categories={snapshot.categories}
        />
      </article>

      {session.role === "AD" && (
        <>
          <CollapsiblePanel
            id="supplier-categories"
            eyebrow="Supplier Configuration"
            title="Supplier — Category Assignments"
            badgeText={`${snapshot.suppliers.length} suppliers`}
            badgeClass="badge-indigo"
            subtitle="Assign product categories to each supplier. WH users will only see suppliers that are authorised for the selected item's category when entering prices."
          >
            <SupplierCategoriesPanel
              suppliers={snapshot.suppliers.map(s => ({
                id: s.id,
                name: s.name,
                category_ids: s.category_ids,
              }))}
              categories={snapshot.categories.map(c => ({
                id: c.id,
                name: c.name,
                description: c.description ?? "",
              }))}
            />
          </CollapsiblePanel>

          <CollapsiblePanel
            id="csv-import"
            eyebrow="Data Import"
            title="CSV Import — Suppliers"
            badgeText="Upload CSV"
            badgeClass="badge-indigo"
            subtitle="Download the supplier template, fill in your supplier records, then upload to bulk-import or update the supplier directory."
          >
            <CsvImportPanel type="suppliers" />
          </CollapsiblePanel>
        </>
      )}
    </div>
  );
}

