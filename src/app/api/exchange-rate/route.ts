import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getExchangeRate, saveExchangeRate } from "@/lib/db";

export const dynamic = "force-dynamic";

// ── CBE Scraper ───────────────────────────────────────────────────────────────
async function fetchCBERate(): Promise<number> {
  const res = await fetch(
    "https://www.cbe.org.eg/en/economic-research/statistics/exchange-rates",
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      cache: "no-store",
    }
  );

  if (!res.ok) throw new Error(`CBE responded ${res.status}`);

  const html = await res.text();

  // The CBE exchange-rates page renders a table like:
  //   <td class="column-width table-cell">US Dollar</td>
  //   <td class="column-width table-cell">50.3394</td>  ← Buy
  //   <td class="column-width table-cell">50.4394</td>  ← Sell
  // We capture the Buy rate (first number after "US Dollar").
  const patterns = [
    // Primary: "US Dollar" label followed by table-cell with the buy rate
    /US\s*Dollar[\s\S]{0,300}?(\d{2,3}[.,]\d{2,6})/i,
    // Fallback: any cell with a plausible EGP/USD number after "US Dollar"
    /US\s+Dollar[\s\S]{0,500}?(\d{2,3}\.\d{2,4})/i,
  ];

  for (const pattern of patterns) {
    const m = html.match(pattern);
    if (m) {
      const raw = m[1].replace(",", ".");
      const val = parseFloat(raw);
      if (!isNaN(val) && val > 10 && val < 500) {
        return val;
      }
    }
  }

  throw new Error("Could not parse USD/EGP rate from CBE page");
}

// ── Is the stored rate stale? (> 7 days old) ─────────────────────────────────
function isStale(fetchedAt: string): boolean {
  const then = new Date(fetchedAt).getTime();
  const now = Date.now();
  return now - then > 7 * 24 * 60 * 60 * 1000;
}

// ── GET /api/exchange-rate ────────────────────────────────────────────────────
// Returns the current stored rate.
// If the rate is stale (>7 days) it auto-refreshes before responding.
export async function GET() {
  requireRole();

  let row = getExchangeRate("USD");

  // Auto-refresh on Sunday or if rate is stale
  if (!row || isStale(row.fetched_at)) {
    try {
      const rate = await fetchCBERate();
      saveExchangeRate("USD", rate, "CBE auto-refresh");
      row = getExchangeRate("USD");
    } catch {
      // If auto-refresh fails, return whatever is stored (or null)
    }
  }

  if (!row) {
    return NextResponse.json(
      { error: "No exchange rate stored. Click Refresh to fetch from CBE." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    currency: row.currency,
    rate: row.rate,
    source: row.source,
    fetched_at: row.fetched_at,
  });
}

// ── POST /api/exchange-rate ───────────────────────────────────────────────────
// Force-refresh from CBE. SC/AD only.
export async function POST(request: Request) {
  requireRole(["SC", "AD"]);

  // Allow manual override via body: { rate: number }
  let manualRate: number | null = null;
  try {
    const body = await request.json();
    if (body?.rate && typeof body.rate === "number" && body.rate > 0) {
      manualRate = body.rate;
    }
  } catch {
    // No body or not JSON — proceed with CBE fetch
  }

  if (manualRate !== null) {
    saveExchangeRate("USD", manualRate, "Manual entry");
    const row = getExchangeRate("USD");
    return NextResponse.json({ currency: "USD", rate: manualRate, source: "Manual entry", fetched_at: row?.fetched_at });
  }

  try {
    const rate = await fetchCBERate();
    saveExchangeRate("USD", rate, "CBE website");
    const row = getExchangeRate("USD");
    return NextResponse.json({
      currency: row!.currency,
      rate: row!.rate,
      source: row!.source,
      fetched_at: row!.fetched_at,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `CBE fetch failed: ${err?.message ?? "Unknown error"}. Use manual entry instead.` },
      { status: 502 }
    );
  }
}
