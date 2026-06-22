"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { asNumber, asString } from "@/lib/format";
import {
  approveAllPendingSellingPrices,
  approveSinglePendingSellingPrice,
  reconsiderSellingPrice
} from "@/lib/db";

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
