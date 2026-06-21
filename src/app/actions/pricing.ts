"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addPriceEntry, updatePriceEntry, saveSellingPrice, getRecommendation, database, saveNegotiatedPrice, approvePriceEntry, rejectPriceEntry } from "@/lib/db";
import { asNumber, asString } from "@/lib/format";
import { log } from "@/lib/activity";

export async function createBatchPriceEntries(formData: FormData) {
  const itemId = asNumber(formData.get("itemId"));
  const month = asString(formData.get("month"));
  const collectedBy = asString(formData.get("collectedBy")) || "WH Purchasing";
  const collectedRole = asString(formData.get("collectedRole")) || "WH";

  if (itemId === null || !month) {
    redirect(`/dashboard/purchasing?error=missing`);
  }

  const entries: { supplierId: number; price: number; notes: string; actualTransport?: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("price_")) {
      const supplierId = Number(key.replace("price_", ""));
      const price = asNumber(value);
      if (!isNaN(supplierId) && supplierId > 0 && price !== null && price > 0) {
        const notes = asString(formData.get(`notes_${supplierId}`));
        const rawTransport = asNumber(formData.get(`actual_transport_${supplierId}`));
        const actualTransport = rawTransport != null && rawTransport >= 0 ? rawTransport : undefined;
        entries.push({ supplierId, price, notes, actualTransport });
      }
    }
  }

  if (entries.length === 0) {
    redirect(`/dashboard/purchasing?error=missing`);
  }

  for (const entry of entries) {
    addPriceEntry({
      itemId,
      supplierId: entry.supplierId,
      month,
      price: entry.price,
      collectedBy,
      collectedRole,
      notes: entry.notes,
      actualTransport: entry.actualTransport,
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/purchasing");
  revalidatePath("/dashboard/manager");

  redirect(`/dashboard/purchasing?month=${month}&saved=1`);
}

/**
 * Same as createBatchPriceEntries but returns a result instead of redirecting.
 * Used when called imperatively from client-side JS (mixed new+change submit flow).
 */
/** Update an existing price entry (price + notes only). No month lock — correcting existing data. */
export async function updatePriceEntryAction(input: {
  id: number;
  price: number;
  notes: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!input.id || input.price <= 0) return { ok: false, error: "Invalid input." };
    updatePriceEntry(input.id, input.price, input.notes);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/purchasing");
    revalidatePath("/dashboard/manager");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Update failed." };
  }
}

/** Add a single new price entry silently (returns ok/error, no redirect). */
export async function addPriceEntrySilent(input: {
  itemId: number;
  supplierId: number;
  month: string;
  price: number;
  notes: string;
  collectedBy: string;
  actualTransport?: number;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    addPriceEntry({ ...input, collectedRole: "WH" });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/purchasing");
    revalidatePath("/dashboard/manager");
    log.priceQuoteSubmitted(
      { username: input.collectedBy, role: "WH" },
      { itemName: `Item #${input.itemId}`, supplierName: `Supplier #${input.supplierId}`, price: input.price, month: input.month }
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." };
  }
}

export async function saveBatchPriceEntriesSilent(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const itemId = asNumber(formData.get("itemId"));
    const month = asString(formData.get("month"));
    const collectedBy = asString(formData.get("collectedBy")) || "WH Purchasing";
    const collectedRole = asString(formData.get("collectedRole")) || "WH";

    if (itemId === null || !month) return { ok: false, error: "Missing item or month." };

    const entries: { supplierId: number; price: number; notes: string; actualTransport?: number }[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("price_")) {
        const supplierId = Number(key.replace("price_", ""));
        const price = asNumber(value);
        if (!isNaN(supplierId) && supplierId > 0 && price !== null && price > 0) {
          const notes = asString(formData.get(`notes_${supplierId}`));
          const rawTransport = asNumber(formData.get(`actual_transport_${supplierId}`));
          const actualTransport = rawTransport != null && rawTransport >= 0 ? rawTransport : undefined;
          entries.push({ supplierId, price, notes, actualTransport });
        }
      }
    }

    if (entries.length === 0) return { ok: false, error: "No valid prices provided." };

    for (const entry of entries) {
      addPriceEntry({
        itemId,
        supplierId: entry.supplierId,
        month,
        price: entry.price,
        collectedBy,
        collectedRole,
        notes: entry.notes,
        actualTransport: entry.actualTransport,
      });
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/purchasing");
    revalidatePath("/dashboard/manager");

    log.bulkQuotesSubmitted(
      { username: collectedBy, role: collectedRole },
      { month, count: entries.length }
    );

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." };
  }
}

export async function createPriceEntry(formData: FormData) {
  const itemId = asNumber(formData.get("itemId"));
  const supplierId = asNumber(formData.get("supplierId"));
  const month = asString(formData.get("month"));
  const price = asNumber(formData.get("price"));
  const collectedBy = asString(formData.get("collectedBy")) || "WH Purchasing";
  const collectedRole = asString(formData.get("collectedRole")) || "WH";
  const notes = asString(formData.get("notes"));

  if (itemId === null || supplierId === null || !month || price === null) {
    redirect(`/dashboard/purchasing?month=${month || ""}&error=missing`);
  }

  addPriceEntry({ itemId, supplierId, month, price, collectedBy, collectedRole, notes });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/purchasing");
  revalidatePath("/dashboard/manager");

  redirect(`/dashboard/purchasing?month=${month}&saved=1`);
}

export async function publishSellingPrice(formData: FormData) {
  const itemId = asNumber(formData.get("itemId"));
  const month = asString(formData.get("month"));
  const strategy = asString(formData.get("strategy")) as "min" | "max" | "avg";
  const markupTypeRaw = asString(formData.get("markupType")) || "percent";
  const markupType = (["percent", "amount", "divisor"].includes(markupTypeRaw) ? markupTypeRaw : "percent") as "percent" | "amount" | "divisor";
  const markupMin = asNumber(formData.get("markupMin"));
  const markupMax = asNumber(formData.get("markupMax"));
  const createdBy = asString(formData.get("createdBy")) || "SC Manager";
  const changeReason = asString(formData.get("changeReason")) || undefined;
  const otherExpenses = asNumber(formData.get("otherExpenses")) || 0;
  // T5: SC transport override for this month
  const transportOverrideEnabled = asString(formData.get("transportOverrideEnabled")) === "1";
  const transportOverrideRaw = asNumber(formData.get("transportOverride"));
  const transportOverride = transportOverrideEnabled && transportOverrideRaw !== null ? transportOverrideRaw : null;
  // T17: dual note fields
  const internalNote = asString(formData.get("internalNote")) || undefined;
  const saNote = asString(formData.get("saNote")) || undefined;

  // Custom tiers override
  const tierPricingEnabled = asString(formData.get("tierPricingEnabled")) === "on" ? 1 : 0;
  const tier1Max = asNumber(formData.get("tier1Max"));
  const tier1Discount = asNumber(formData.get("tier1Discount"));
  const tier2Max = asNumber(formData.get("tier2Max"));
  const tier2Discount = asNumber(formData.get("tier2Discount"));
  const tier3Max = asNumber(formData.get("tier3Max"));
  const tier3Discount = asNumber(formData.get("tier3Discount"));
  const tier4Discount = asNumber(formData.get("tier4Discount"));

  const redirectTo =
    asString(formData.get("redirectTo")) ||
    `/dashboard?month=${month}&itemId=${itemId}&saved=1`;
  const errorRedirect =
    asString(formData.get("errorRedirect")) ||
    `/dashboard?month=${month || ""}&error=pricing`;

  if (
    itemId === null ||
    !month ||
    markupMin === null ||
    markupMax === null ||
    !["min", "max", "avg"].includes(strategy)
  ) {
    redirect(errorRedirect);
  }

  if (markupMax < markupMin) {
    redirect(errorRedirect);
  }

  try {
    saveSellingPrice({
      itemId,
      month,
      strategy,
      markupType,
      markupMin,
      markupMax,
      createdBy,
      changeReason,
      otherExpenses,
      transportOverride,
      internalNote,
      saNote,
      tierPricingEnabled,
      tier1Max,
      tier1Discount,
      tier2Max,
      tier2Discount,
      tier3Max,
      tier3Discount,
      tier4Discount,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.startsWith("FLOOR_VIOLATION:")) {
      const parts = msg.split(":");
      const floorPct = parts[1] ?? "0";
      redirect(`${errorRedirect}&floorViolation=1&floor=${floorPct}`);
    }
    redirect(errorRedirect);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/manager");
  revalidatePath("/dashboard/sales");

  redirect(redirectTo);
}

export async function saveSellingPriceInline(input: {
  itemId: number;
  month: string;
  sellMin: number;
  sellMax: number;
  createdBy: string;
  changeReason?: string;
  otherExpenses?: number;
  tierPricingEnabled?: number;
}): Promise<{ ok: boolean; error?: string; floorViolation?: boolean; floorPct?: number }> {
  try {
    const rec = getRecommendation(input.month, input.itemId);
    if (rec.buyAvg === null) return { ok: false, error: "No quotes found" };

    const db = database();
    const itemRow = db.prepare("SELECT transportation_per_unit FROM items WHERE id = ?").get(input.itemId) as { transportation_per_unit: number } | undefined;
    const transportation = itemRow?.transportation_per_unit ?? 0;
    
    const otherExpenses = input.otherExpenses !== undefined
      ? input.otherExpenses
      : (db.prepare("SELECT other_expenses FROM selling_prices WHERE item_id = ? AND month = ?").get(input.itemId, input.month) as { other_expenses: number } | undefined)?.other_expenses ?? 0;

    const tierPricingEnabled = input.tierPricingEnabled !== undefined
      ? input.tierPricingEnabled
      : (db.prepare("SELECT tier_pricing_enabled FROM selling_prices WHERE item_id = ? AND month = ?").get(input.itemId, input.month) as { tier_pricing_enabled: number } | undefined)?.tier_pricing_enabled ?? 0;

    const baseSellMin = input.sellMin - transportation - otherExpenses;
    const baseSellMax = input.sellMax - transportation - otherExpenses;

    const base = rec.buyAvg;
    const markupMin = base > 0 ? ((baseSellMin / base) - 1) * 100 : 0;
    const markupMax = base > 0 ? ((baseSellMax / base) - 1) * 100 : 0;

    saveSellingPrice({
      itemId: input.itemId,
      month: input.month,
      strategy: "avg",
      markupType: "percent",
      markupMin: Math.max(0, markupMin),
      markupMax: Math.max(0, markupMax),
      createdBy: input.createdBy,
      changeReason: input.changeReason,
      otherExpenses,
      tierPricingEnabled,
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/manager");
    revalidatePath("/dashboard/sales");

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Save failed";
    if (msg.startsWith("FLOOR_VIOLATION:")) {
      const parts = msg.split(":");
      return {
        ok: false,
        floorViolation: true,
        floorPct: parseFloat(parts[1] ?? "0"),
        error: parts.slice(2).join(":"),
      };
    }
    return { ok: false, error: msg };
  }
}

// ── New server action for margin floor management (SC Admin only) ────────────
import { upsertMarginFloor, deleteMarginFloor } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export async function setMarginFloorAction(formData: FormData): Promise<void> {
  requireRole(["AD"]);
  const floorType = asString(formData.get("floorType")) as "item" | "category";
  const itemId = asNumber(formData.get("itemId")) ?? undefined;
  const categoryId = asNumber(formData.get("categoryId")) ?? undefined;
  const minMarkupPct = asNumber(formData.get("minMarkupPct")) ?? 5;
  const setBy = asString(formData.get("setBy")) || "SC Manager";
  const notes = asString(formData.get("notes")) || undefined;

  upsertMarginFloor({ floorType, itemId, categoryId, minMarkupPct, setBy, notes });

  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard");
}

export async function deleteMarginFloorAction(formData: FormData): Promise<void> {
  requireRole(["AD"]);
  const id = asNumber(formData.get("id"));
  if (id !== null) deleteMarginFloor(id);
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard");
}

// ── Task 1: Category Bulk Markup ─────────────────────────────────────────────
import {
  applyCategoryMarkup,
  submitPriceChangeRequest,
  approvePriceChangeRequest,
  rejectPriceChangeRequest,
  hasConfirmedPrice,
} from "@/lib/db";
import { currentMonth } from "@/lib/format";

export async function applyCategoryMarkupAction(formData: FormData): Promise<{
  ok: boolean;
  applied?: number;
  skipped?: number;
  errors?: string[];
  error?: string;
}> {
  try {
    requireRole(["SC"]);
    const categoryId  = asNumber(formData.get("categoryId"));
    const month       = asString(formData.get("month"));
    const strategy    = (asString(formData.get("strategy")) || "avg") as "min" | "avg" | "max";
    const markupTypeR = asString(formData.get("markupType")) || "percent";
    const markupType  = (["percent","amount","divisor"].includes(markupTypeR) ? markupTypeR : "percent") as "percent" | "amount" | "divisor";
    const markupMin   = asNumber(formData.get("markupMin")) ?? 8;
    const markupMax   = asNumber(formData.get("markupMax")) ?? 14;
    const createdBy   = asString(formData.get("createdBy")) || "SC Manager";
    const itemsDataRaw = asString(formData.get("itemsData"));

    const tierPricingEnabled = asString(formData.get("tierPricingEnabled")) === "on" ? 1 : 0;

    if (!categoryId || !month) return { ok: false, error: "Category and month are required." };
    if (markupMax < markupMin) return { ok: false, error: "Max markup must be ≥ min markup." };

    let itemsDataParsed: any[] | undefined = undefined;
    if (itemsDataRaw) {
      try {
        itemsDataParsed = JSON.parse(itemsDataRaw);
      } catch (err) {
        console.error("Failed to parse itemsData:", err);
      }
    }

    const result = applyCategoryMarkup({
      categoryId, month, strategy, markupType, markupMin, markupMax, createdBy,
      tierPricingEnabled,
      itemsData: itemsDataParsed,
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/manager");
    revalidatePath("/dashboard/sales");

    return { ok: true, ...result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

// ── Task 2: Price Change Request workflow ─────────────────────────────────────
export async function submitPriceChangeRequestAction(formData: FormData): Promise<{
  ok: boolean; error?: string; directSaved?: boolean;
}> {
  try {
    const itemId        = asNumber(formData.get("itemId"));
    const supplierId    = asNumber(formData.get("supplierId"));
    const month         = asString(formData.get("month"));
    const oldPrice      = asNumber(formData.get("oldPrice"));
    const newPrice      = asNumber(formData.get("newPrice"));
    const reason        = asString(formData.get("reason"));
    const requestedBy   = asString(formData.get("requestedBy")) || "WH Purchasing";
    // optional transport revision
    const oldTransportRaw = formData.get("oldTransport");
    const newTransportRaw = formData.get("newTransport");
    const oldTransport  = oldTransportRaw ? asNumber(oldTransportRaw) : null;
    const newTransport  = newTransportRaw ? asNumber(newTransportRaw) : null;

    if (!itemId || !supplierId || !month || oldPrice === null || newPrice === null || !reason.trim()) {
      return { ok: false, error: "All fields are required including reason." };
    }
    if (newPrice <= 0) return { ok: false, error: "New price must be greater than zero." };

    // Enforce: change requests only allowed for current month
    if (month !== currentMonth()) {
      return { ok: false, error: "Price change requests can only be submitted for the current month. Past months are locked." };
    }

    if (!hasConfirmedPrice(itemId, supplierId, month)) {
      addPriceEntry({
        itemId,
        supplierId,
        month,
        price: newPrice,
        collectedBy: requestedBy,
        collectedRole: "WH",
        notes: reason,
      });

      revalidatePath("/dashboard/purchasing");
      revalidatePath("/dashboard");
      revalidatePath("/dashboard/manager");
      log.priceQuoteSubmitted(
        { username: requestedBy, role: "WH" },
        { itemName: `Item #${itemId}`, supplierName: `Supplier #${supplierId}`, price: newPrice, month }
      );
      return { ok: true, directSaved: true };
    }

    submitPriceChangeRequest({ itemId, supplierId, month, oldPrice, newPrice, oldTransport, newTransport, reason, requestedBy });
    log.priceChangeRequested(
      { username: requestedBy, role: "WH" },
      { itemName: `Item #${itemId}`, supplierName: `Supplier #${supplierId}`, oldPrice: oldPrice!, newPrice: newPrice!, month }
    );

    revalidatePath("/dashboard/purchasing");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function approvePriceChangeRequestAction(formData: FormData): Promise<void> {
  requireRole(["SC"]);
  const requestId  = asNumber(formData.get("requestId"));
  const reviewedBy = asString(formData.get("reviewedBy")) || "SC Manager";
  const reviewNote = asString(formData.get("reviewNote")) || undefined;

  if (requestId === null) return;
  approvePriceChangeRequest({ requestId, reviewedBy, reviewNote });
  log.priceChangeApproved(
    { username: reviewedBy, role: "SC" },
    { requestId: requestId!, itemName: `Request #${requestId}`, month: "" }
  );

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/purchasing");
  revalidatePath("/dashboard/manager");
}

export async function rejectPriceChangeRequestAction(formData: FormData): Promise<void> {
  requireRole(["SC"]);
  const requestId  = asNumber(formData.get("requestId"));
  const reviewedBy = asString(formData.get("reviewedBy")) || "SC Manager";
  const reviewNote = asString(formData.get("reviewNote")) || undefined;

  if (requestId === null) return;
  rejectPriceChangeRequest({ requestId, reviewedBy, reviewNote });
  log.priceChangeRejected(
    { username: reviewedBy, role: "SC" },
    { requestId: requestId!, itemName: `Request #${requestId}`, month: "" }
  );

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/purchasing");
}

// ── SC-only: Extend previous month prices to current month ──────────────────
import { extendPreviousMonthPrices } from "@/lib/db";

export async function extendPreviousMonthPricesAction(input: {
  itemId: number;
  supplierIds?: number[];
  extendedBy: string;
}): Promise<{ ok: boolean; created?: number; error?: string }> {
  try {
    requireRole(["SC"]);
    const created = extendPreviousMonthPrices({
      itemId: input.itemId,
      supplierIds: input.supplierIds,
      extendedBy: input.extendedBy,
    });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/purchasing");
    revalidatePath("/dashboard/manager");
    return { ok: true, created };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function publishSellingPriceAction(formData: FormData): Promise<{ ok: boolean; error?: string; floorViolation?: boolean; floorPct?: number }> {
  try {
    requireRole(["SC"]);
    const itemId = asNumber(formData.get("itemId"));
    const month = asString(formData.get("month"));
    const strategy = asString(formData.get("strategy")) as "min" | "max" | "avg";
    const markupTypeRaw = asString(formData.get("markupType")) || "percent";
    const markupType = (["percent", "amount", "divisor"].includes(markupTypeRaw) ? markupTypeRaw : "percent") as "percent" | "amount" | "divisor";
    const markupMin = asNumber(formData.get("markupMin"));
    const markupMax = asNumber(formData.get("markupMax"));
    const createdBy = asString(formData.get("createdBy")) || "SC Manager";
    const changeReason = asString(formData.get("changeReason")) || undefined;
    const otherExpenses = asNumber(formData.get("otherExpenses")) || 0;
    const tierPricingEnabled = asString(formData.get("tierPricingEnabled")) === "on" ? 1 : 0;
    const tier1Max = asNumber(formData.get("tier1Max"));
    const tier1Discount = asNumber(formData.get("tier1Discount"));
    const tier2Max = asNumber(formData.get("tier2Max"));
    const tier2Discount = asNumber(formData.get("tier2Discount"));
    const tier3Max = asNumber(formData.get("tier3Max"));
    const tier3Discount = asNumber(formData.get("tier3Discount"));
    const tier4Discount = asNumber(formData.get("tier4Discount"));

    if (
      itemId === null ||
      !month ||
      markupMin === null ||
      markupMax === null ||
      !["min", "max", "avg"].includes(strategy)
    ) {
      return { ok: false, error: "Missing required fields" };
    }

    if (markupMax < markupMin) {
      return { ok: false, error: "Max markup must be greater than or equal to min markup" };
    }

    saveSellingPrice({
      itemId,
      month,
      strategy,
      markupType,
      markupMin,
      markupMax,
      createdBy,
      changeReason,
      otherExpenses,
      tierPricingEnabled,
      tier1Max,
      tier1Discount,
      tier2Max,
      tier2Discount,
      tier3Max,
      tier3Discount,
      tier4Discount,
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/manager");
    revalidatePath("/dashboard/sales");

    log.sellingPricePublished(
      { username: createdBy, role: "SC" },
      { itemName: `Item #${itemId}`, month, sellMin: 0, sellMax: 0 }
    );

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.startsWith("FLOOR_VIOLATION:")) {
      const parts = msg.split(":");
      const floorPct = parts[1] ?? "0";
      return { ok: false, floorViolation: true, floorPct: parseFloat(floorPct), error: parts.slice(2).join(":") };
    }
    return { ok: false, error: msg || "Failed to publish prices" };
  }
}

import { setMonthlyTierPricing, setScTransportOverride, upsertItemTier, deleteItemTier } from "@/lib/db";

export async function toggleMonthlyTierPricingAction(formData: FormData): Promise<void> {
  requireRole(["AD"]);
  const month = asString(formData.get("month"));
  const enabled = asString(formData.get("tierPricingEnabled")) === "on";

  if (!month) return;
  setMonthlyTierPricing(month, enabled);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/sales");
}

// T26: Admin enables/disables SC's ability to override transport per item/month
export async function toggleScTransportOverrideAction(formData: FormData): Promise<void> {
  requireRole(["AD"]);
  const month   = asString(formData.get("month"));
  const enabled = asString(formData.get("scTransportOverrideEnabled")) === "on";
  if (!month) return;
  setScTransportOverride(month, enabled);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/pricing");
}

export async function saveItemTierConfigAction(formData: FormData): Promise<void> {
  requireRole(["AD", "SC"]);
  const itemId       = asNumber(formData.get("itemId"));
  const isTiered     = asString(formData.get("isTiered")) === "on" ? 1 : 0;
  const tier1Max     = asNumber(formData.get("tier1Max"))     ?? 100;
  const tier1Discount = asNumber(formData.get("tier1Discount")) ?? 0;
  const tier2Max     = asNumber(formData.get("tier2Max"))     ?? 200;
  const tier2Discount = asNumber(formData.get("tier2Discount")) ?? 5;
  const tier3Max     = asNumber(formData.get("tier3Max"))     ?? 300;
  const tier3Discount = asNumber(formData.get("tier3Discount")) ?? 10;
  const tier4Max     = asNumber(formData.get("tier4Max"))     ?? 0;
  const tier4Discount = asNumber(formData.get("tier4Discount")) ?? 0;

  if (itemId === null) return;
  upsertItemTier({
    itemId,
    isTiered,
    tier1Max,
    tier1Discount,
    tier2Max,
    tier2Discount,
    tier3Max,
    tier3Discount,
    tier4Max,
    tier4Discount,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/admin");
}

export async function deleteItemTierConfigAction(formData: FormData): Promise<void> {
  requireRole(["AD", "SC"]);
  const itemId = asNumber(formData.get("itemId"));
  if (itemId !== null) {
    deleteItemTier(itemId);
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/admin");
}

export async function saveNegotiatedPriceAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const itemId = asNumber(formData.get("itemId"));
    const supplierId = asNumber(formData.get("supplierId"));
    const month = asString(formData.get("month"));
    const negotiatedPrice = asNumber(formData.get("negotiatedPrice"));
    const notes = asString(formData.get("notes"));

    if (itemId === null || supplierId === null || !month || negotiatedPrice === null || negotiatedPrice <= 0) {
      return { ok: false, error: "Missing or invalid parameters." };
    }

    saveNegotiatedPrice(itemId, supplierId, month, negotiatedPrice, notes);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/purchasing");
    revalidatePath("/dashboard/manager");

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save negotiated price." };
  }
}

export async function approvePriceEntryAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    requireRole(["SC", "AD"]);
    const entryId = asNumber(formData.get("entryId"));
    const reviewedBy = asString(formData.get("reviewedBy")) || "SC Manager";
    const note = asString(formData.get("reviewNote")) || undefined;

    if (entryId === null) return { ok: false, error: "Missing entry ID." };

    approvePriceEntry(entryId, reviewedBy, note);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/approvals");
    revalidatePath("/dashboard/pricing");

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to approve quote." };
  }
}

export async function rejectPriceEntryAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    requireRole(["SC", "AD"]);
    const entryId = asNumber(formData.get("entryId"));
    const reviewedBy = asString(formData.get("reviewedBy")) || "SC Manager";
    const note = asString(formData.get("reviewNote")) || "";

    if (entryId === null) return { ok: false, error: "Missing entry ID." };
    if (!note.trim()) return { ok: false, error: "Rejection note is required." };

    rejectPriceEntry(entryId, reviewedBy, note);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/approvals");
    revalidatePath("/dashboard/purchasing");
    revalidatePath("/dashboard/notifications");

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to reject quote." };
  }
}

