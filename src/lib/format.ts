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

export function formatMonthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
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
