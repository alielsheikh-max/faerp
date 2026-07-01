/* ── Shared date/currency helpers ──────────────────────────────────────── */

/** dd-mm-yyyy HH:mm */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    const d = new Date(value);
    const day   = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year  = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const mins  = String(d.getMinutes()).padStart(2, "0");
    return `${day}-${month}-${year} ${hours}:${mins}`;
  } catch { return value; }
}

/** dd-mm-yyyy */
export function formatDate(value?: string | Date | null): string {
  if (!value) return "—";
  try {
    const d = typeof value === "string" ? new Date(value) : value;
    const day   = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year  = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch { return String(value); }
}

export function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-EG", {
    style: "currency",
    currency: "EGP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function getLocale(): "en" | "ar" {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("faerp-locale");
      if (stored === "ar" || stored === "en") return stored;
    } catch {}
    try {
      const match = document.cookie.match(/faerp-locale=([^;]+)/);
      if (match && (match[1] === "ar" || match[1] === "en")) {
        return match[1] as "en" | "ar";
      }
    } catch {}
  } else {
    try {
      const { cookies } = require("next/headers");
      const val = cookies().get("faerp-locale")?.value;
      if (val === "ar" || val === "en") return val;
    } catch {}
  }
  return "en";
}

const ARABIC_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر"
];

export function formatMonthLabel(month: string) {
  if (!month) return "—";
  const parts = month.split("-");
  if (parts.length < 2) return month;
  const [year, monthNumber] = parts.map(Number);
  if (Number.isNaN(year) || Number.isNaN(monthNumber)) return month;
  
  const locale = getLocale();

  if (locale === "ar") {
    const arMonth = ARABIC_MONTHS[monthNumber - 1] || "";
    return `${arMonth} ${year}`;
  }

  const date = new Date(year, monthNumber - 1, 1);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric"
  }).format(date);
}

export function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function shiftMonth(month: string, offset: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + offset, 1);
  const yyyy = date.getFullYear();
  const mm = `${date.getMonth() + 1}`.padStart(2, "0");

  return `${yyyy}-${mm}`;
}

export function asNumber(value: FormDataEntryValue | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numberValue = Number(value);

  return Number.isNaN(numberValue) ? null : numberValue;
}

export function asString(value: FormDataEntryValue | string | null | undefined) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

/** Round up to nearest 5 EGP — used for ALL sell price displays. */
export const roundUp5 = (n: number | null | undefined) => n != null ? Math.ceil(n / 5) * 5 : n;

export type TierPriceResult = {
  label: string;
  range: string;
  price: number;
};

export function calcTierPricesShared(row: {
  strategy: string | null;
  buy_min: number | null;
  buy_max: number | null;
  buy_avg: number | null;
  sell_min: number | null;
  transportation: number;
  other_expenses: number;
  tier_pricing_enabled: number;
  is_tiered: number;
  tier1_max: number;
  tier1_discount: number;
  tier2_max: number;
  tier2_discount: number;
  tier3_max: number;
  tier3_discount: number;
  tier4_max: number;
  tier4_discount: number;
}): TierPriceResult[] {
  const baseCost = row.strategy === "min" ? (row.buy_min ?? 0) : row.strategy === "max" ? (row.buy_max ?? 0) : (row.buy_avg ?? 0);
  const buyAvg = baseCost;
  const transport = row.transportation ?? 0;
  const other = row.other_expenses ?? 0;
  const sellMin = row.sell_min;
  const r5 = (n: number) => Math.ceil(n / 5) * 5;

  function getPriceForDiscount(discount: number) {
    if (discount <= 0 || buyAvg <= 0) return null;
    if (discount < 1) {
      return r5(buyAvg / discount + transport + other);
    }
    const baseSellMin = sellMin !== null ? (sellMin - transport - other) : buyAvg;
    return r5(baseSellMin * (1 - discount / 100) + transport + other);
  }

  return [
    { label: "B",  range: `1–${row.tier1_max}`,  price: getPriceForDiscount(row.tier1_discount) ?? (sellMin !== null ? r5(sellMin) : null) },
    { label: "T2", range: `${row.tier1_max + 1}–${row.tier2_max}`, price: getPriceForDiscount(row.tier2_discount) },
    { label: "T3", range: `${row.tier2_max + 1}–${row.tier3_max}`, price: getPriceForDiscount(row.tier3_discount) },
    { label: "T4", range: `>${row.tier3_max}`,   price: getPriceForDiscount(row.tier4_discount) },
  ].filter((t): t is TierPriceResult => t.price !== null);
}

