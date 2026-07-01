"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { asNumber, asString } from "@/lib/format";
import {
  approveAllPendingSellingPrices,
  approveGlobalPendingSellingPrices,
  approveMultiplePendingSellingPrices,
  approveSinglePendingSellingPrice,
  reconsiderSellingPrice,
  reconsiderMultiplePendingSellingPrices,
  getPendingPriceEntries,
  getPendingPriceChangeRequests
} from "@/lib/db";

export async function approveMultipleSellingPricesAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = requireRole(["MG"]);
    const month = asString(formData.get("month"));
    const itemIdsStr = asString(formData.get("itemIds"));

    if (!month || !itemIdsStr) {
      return { ok: false, error: "Month and Item IDs are required." };
    }

    const itemIds = JSON.parse(itemIdsStr) as number[];
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return { ok: false, error: "No items selected." };
    }

    approveMultiplePendingSellingPrices(itemIds, month, session.displayName);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/sales");
    revalidatePath("/dashboard/notifications");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to approve batch." };
  }
}

export async function approveGlobalSellingPricesAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = requireRole(["MG"]);
    const month = asString(formData.get("month"));

    if (!month) {
      return { ok: false, error: "Month is required." };
    }

    approveGlobalPendingSellingPrices(month, session.displayName);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/sales");
    revalidatePath("/dashboard/notifications");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to approve all." };
  }
}

export async function approveAllSellingPricesAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = requireRole(["MG"]);
    const categoryId = asNumber(formData.get("categoryId"));
    const month = asString(formData.get("month"));

    if (categoryId === null || !month) {
      return { ok: false, error: "Category ID and Month are required." };
    }

    approveAllPendingSellingPrices(categoryId, month, session.displayName);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/sales");
    revalidatePath("/dashboard/notifications");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to approve all." };
  }
}

export async function approveSingleSellingPriceAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = requireRole(["MG"]);
    const itemId = asNumber(formData.get("itemId"));
    const month = asString(formData.get("month"));

    if (itemId === null || !month) {
      return { ok: false, error: "Item ID and Month are required." };
    }

    approveSinglePendingSellingPrice(itemId, month, session.displayName);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/sales");
    revalidatePath("/dashboard/notifications");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to approve item." };
  }
}

export async function reconsiderSellingPriceAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = requireRole(["MG"]);
    const itemId = asNumber(formData.get("itemId"));
    const month = asString(formData.get("month"));
    const note = asString(formData.get("reconsiderNote")) || "";

    if (itemId === null || !month) {
      return { ok: false, error: "Item ID and Month are required." };
    }

    if (!note.trim()) {
      return { ok: false, error: "A reconsideration note is required." };
    }

    reconsiderSellingPrice(itemId, month, note.trim(), session.displayName);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/sales");
    revalidatePath("/dashboard/notifications");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to return for reconsideration." };
  }
}

export async function reconsiderMultipleSellingPricesAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = requireRole(["MG"]);
    const month = asString(formData.get("month"));
    const itemIdsStr = asString(formData.get("itemIds"));
    const note = asString(formData.get("reconsiderNote")) || "";

    if (!month || !itemIdsStr) {
      return { ok: false, error: "Month and Item IDs are required." };
    }

    if (!note.trim()) {
      return { ok: false, error: "A reconsideration note is required for batch reject." };
    }

    const itemIds = JSON.parse(itemIdsStr) as number[];
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return { ok: false, error: "No items selected." };
    }

    reconsiderMultiplePendingSellingPrices(itemIds, month, note.trim(), session.displayName);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/sales");
    revalidatePath("/dashboard/notifications");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to return batch for reconsideration." };
  }
}


export async function getPendingApprovalsAction(): Promise<{ ok: boolean; pendingQuotes?: any[]; pendingRevisions?: any[]; error?: string }> {
  try {
    const session = requireRole(["SC"]);
    const pendingQuotes = getPendingPriceEntries();
    const pendingRevisions = getPendingPriceChangeRequests();
    return { ok: true, pendingQuotes, pendingRevisions };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to fetch approvals." };
  }
}
