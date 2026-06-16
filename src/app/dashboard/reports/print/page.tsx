import { getMonthlyReport } from "@/lib/db";
import { formatCurrency, formatDateTime, formatMonthLabel } from "@/lib/format";
import PrintButton from "@/components/print-button";

type PrintPageProps = {
  searchParams?: {
    month?: string;
    categoryId?: string;
  };
};

export default function ReportPrintPage({ searchParams }: PrintPageProps) {
  const month = searchParams?.month || new Date().toISOString().slice(0, 7);
  const categoryId = searchParams?.categoryId ? Number(searchParams.categoryId) : undefined;
  const report = getMonthlyReport(month, categoryId);

  return (
    <div className="print-page-wrapper" style={{ minHeight: "100vh", background: "#fff", color: "#10213a", fontFamily: "'Readex Pro Variable', -apple-system, sans-serif" }}>
      <main style={{ padding: "32px", maxWidth: "1100px", margin: "0 auto" }}>
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
            <div>
              <p style={{ margin: 0, color: "#4b6b97", textTransform: "uppercase", letterSpacing: "0.12em", fontSize: "12px" }}>
                FAERP monthly report
              </p>
              <h1 style={{ margin: "8px 0 0", fontSize: "32px" }}>{formatMonthLabel(month)}</h1>
            </div>
            <PrintButton />
          </header>

          <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
            {[
              ["Quotes", report.metrics.quotes],
              ["Suppliers", report.metrics.suppliers],
              ["Published", report.metrics.selling],
              ["Price changes", report.metrics.changes]
            ].map(([label, value]) => (
              <div key={String(label)} style={{ border: "1px solid #dbe5f2", borderRadius: "18px", padding: "18px" }}>
                <div style={{ color: "#5f7699", marginBottom: "8px" }}>{label}</div>
                <strong style={{ fontSize: "28px" }}>{value}</strong>
              </div>
            ))}
          </section>

          <section style={{ marginBottom: "24px" }}>
            <h2>Approved selling prices</h2>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Category", "Item", "Strategy", "Sell min", "Sell max", "Updated"].map((heading) => (
                    <th
                      key={heading}
                      style={{ textAlign: "left", borderBottom: "1px solid #dbe5f2", padding: "10px 8px", color: "#5f7699" }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.monthlySellingPrices.map((row) => (
                  <tr key={row.item_id}>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #eef3f8" }}>{row.category_name}</td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #eef3f8" }}>{row.item_name}</td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #eef3f8" }}>{row.strategy?.toUpperCase()}</td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #eef3f8" }}>{formatCurrency(row.sell_min)}</td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #eef3f8" }}>{formatCurrency(row.sell_max)}</td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #eef3f8" }}>{formatDateTime(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h2>Supplier change alerts</h2>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Item", "Supplier", "Updates", "Low", "High", "Last change"].map((heading) => (
                    <th
                      key={heading}
                      style={{ textAlign: "left", borderBottom: "1px solid #dbe5f2", padding: "10px 8px", color: "#5f7699" }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.volatilityRows.map((row, index) => (
                  <tr key={`${row.item_name}-${row.supplier_name}-${index}`}>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #eef3f8" }}>{row.item_name}</td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #eef3f8" }}>{row.supplier_name}</td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #eef3f8" }}>{row.updates}</td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #eef3f8" }}>{formatCurrency(row.low_price)}</td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #eef3f8" }}>{formatCurrency(row.high_price)}</td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #eef3f8" }}>{formatDateTime(row.last_change)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </main>
    </div>
  );
}