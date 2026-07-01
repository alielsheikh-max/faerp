import { getMonthlyReport } from "@/lib/db";
import { formatCurrency, formatDateTime, formatMonthLabel } from "@/lib/format";
import PrintButton from "@/components/print-button";

type PrintPageProps = {
  searchParams?: {
    month?: string;
    categoryId?: string;
    autoprint?: string;
  };
};

/** Mirror of the pricing-calculator roundUp5 helper */
function roundUp5(v: number): number { return v > 0 ? Math.ceil(v / 5) * 5 : v; }

/** Compute tier price: divisor (< 1) or % markup (>= 1) */
function tierPrice(buyAvg: number | null, discount: number, transport: number, other: number): string {
  if (!buyAvg || !discount) return "—";
  const raw = discount < 1 ? buyAvg / discount + transport + other : buyAvg * (1 + discount / 100) + transport + other;
  return formatCurrency(roundUp5(raw));
}

export default function ReportPrintPage({ searchParams }: PrintPageProps) {
  const month = searchParams?.month || new Date().toISOString().slice(0, 7);
  const categoryId = searchParams?.categoryId ? Number(searchParams.categoryId) : undefined;
  const autoprint = searchParams?.autoprint === "1";
  const report = getMonthlyReport(month, categoryId);

  const tdStyle = { padding: "10px 8px", borderBottom: "1px solid #eef3f8" } as const;
  const thStyle = { textAlign: "left" as const, borderBottom: "1px solid #dbe5f2", padding: "10px 8px", color: "#5f7699" };

  return (
    <div className="print-page-wrapper" style={{ minHeight: "100vh", background: "#fff", color: "#10213a", fontFamily: "'Readex Pro Variable', -apple-system, sans-serif" }}>
      <main style={{ padding: "32px", maxWidth: "1200px", margin: "0 auto" }}>
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
            <div>
              <p style={{ margin: 0, color: "#4b6b97", textTransform: "uppercase", letterSpacing: "0.12em", fontSize: "12px" }}>
                FAERP monthly report
              </p>
              <h1 style={{ margin: "8px 0 0", fontSize: "32px" }}>{formatMonthLabel(month)}</h1>
            </div>
            <PrintButton autoprint={autoprint} />
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
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Category</th>
                  <th style={thStyle}>Item</th>
                  <th style={thStyle}>Strategy</th>
                  <th style={thStyle}>T1 (1–100) / Min</th>
                  <th style={thStyle}>T2 (101–200)</th>
                  <th style={thStyle}>T3 (201–800)</th>
                  <th style={thStyle}>T4 (801+) / Max</th>
                  <th style={thStyle}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {report.monthlySellingPrices.map((row) => {
                  const isTier = row.tier_pricing_enabled === 1 && row.is_tiered === 1;
                  const tp = (d: number) => {
                    const baseCost = row.strategy === "min" ? (row.buy_min ?? 0) : row.strategy === "max" ? (row.buy_max ?? 0) : (row.buy_avg ?? 0);
                    return tierPrice(baseCost, d, row.transportation ?? 0, row.other_expenses ?? 0);
                  };
                  const t1max = row.tier1_max ?? 100;
                  const t2max = row.tier2_max ?? 200;
                  const t3max = row.tier3_max ?? 800;
                  return (
                    <tr key={row.item_id}>
                      <td style={tdStyle}>{row.category_name}</td>
                      <td style={tdStyle}>{row.item_name}</td>
                      <td style={tdStyle}>
                        <span style={{ fontWeight: 700, color: isTier ? "#6366f1" : (row.is_tiered === 2 ? "#d97706" : "#10b981") }}>
                          {isTier ? "⚡ TIER" : (row.is_tiered === 2 ? "🔒 FIXED" : `↕ MIN/MAX`)}
                        </span>
                      </td>
                      {isTier ? (
                        <>
                          <td style={tdStyle}>{tp(row.tier1_discount ?? 0)}</td>
                          <td style={tdStyle}>{row.tier2_discount ? tp(row.tier2_discount) : "—"}</td>
                          <td style={tdStyle}>{row.tier3_discount ? tp(row.tier3_discount) : "—"}</td>
                          <td style={tdStyle}>{row.tier4_discount ? tp(row.tier4_discount) : "—"}</td>
                        </>
                      ) : row.is_tiered === 2 ? (
                        <>
                          <td style={{ ...tdStyle, color: "#d97706", fontWeight: 700 }}>🔒 {formatCurrency(row.sell_min)}</td>
                          <td style={tdStyle}>—</td>
                          <td style={tdStyle}>—</td>
                          <td style={tdStyle}>—</td>
                        </>
                      ) : (
                        <>
                          <td style={{ ...tdStyle, color: "#10b981", fontWeight: 700 }}>{formatCurrency(row.sell_min)}</td>
                          <td style={tdStyle}>—</td>
                          <td style={tdStyle}>—</td>
                          <td style={{ ...tdStyle, color: "#6366f1", fontWeight: 700 }}>{formatCurrency(row.sell_max)}</td>
                        </>
                      )}
                      <td style={tdStyle}>{formatDateTime(row.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p style={{ fontSize: "10px", color: "#8899aa", marginTop: "6px" }}>
              T1–T4 = tier price brackets · Min/Max = fixed price range · All prices include transport &amp; expenses, rounded up to nearest 5 EGP
            </p>
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