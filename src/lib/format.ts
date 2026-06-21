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
