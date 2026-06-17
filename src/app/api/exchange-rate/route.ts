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
  //   <td>US Dollar</td>
  //   <td>50.1625</td>  ← Buy  (lower — we SKIP this)
  //   <td>50.2963</td>  ← Sell (higher — we WANT this)
  // We skip past the first number (buy rate) and capture the second (sell rate).
  const patterns = [
    // Primary: skip first number (buy), capture second number (sell)
    /US\s*Dollar[\s\S]{0,400}?(\d{2,3}[.,]\d{2,6})[\s\S]{0,200}?(\d{2,3}[.,]\d{2,6})/i,
    // Fallback: just take the first plausible number if only one found
    /US\s+Dollar[\s\S]{0,500}?(\d{2,3}\.\d{2,4})/i,
  ];

  // Try primary pattern first — use the SELL (second) capture group
  const primaryMatch = html.match(patterns[0]);
  if (primaryMatch) {
    const candidates = [primaryMatch[2], primaryMatch[1]]; // sell first, buy as fallback
    for (const raw of candidates) {
      if (!raw) continue;
      const val = parseFloat(raw.replace(",", "."));
      if (!isNaN(val) && val > 10 && val < 500) {
        return val; // returns sell rate (higher value)
      }
    }
  }

  // Fallback pattern
  const fallbackMatch = html.match(patterns[1]);
  if (fallbackMatch) {
    const val = parseFloat(fallbackMatch[1].replace(",", "."));
    if (!isNaN(val) && val > 10 && val < 500) return val;
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
