"use server";

import { revalidatePath } from "next/cache";
import { acknowledgePrice, markPriceAcknowledgmentsAsRead, markRejectedPriceEntriesAsReadForWH } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { asNumber, asString } from "@/lib/format";

/**
 * T18: SA acknowledges a price change alert.
 * Stores an entry in price_acknowledgments so SC can see who/when.
 */
export async function acknowledgeAlertAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = requireRole(["SA", "SC", "AD"]);
    const historyId = asNumber(formData.get("historyId"));
    if (historyId === null) return { ok: false, error: "Missing historyId" };

    acknowledgePrice(historyId, session.displayName);

    revalidatePath("/dashboard/sales");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/notifications");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

/**
 * SC marks all SA price acknowledgments as read/seen.
 */
export async function markAcknowledgmentsReadAction(): Promise<{ ok: boolean }> {
  try {
    requireRole(["SC", "AD"]);
    markPriceAcknowledgmentsAsRead();
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/notifications");
    return { ok: true };
  } catch (e) {
    return { ok: false };
  }
}

export async function markWHNotificationsReadAction(): Promise<{ ok: boolean }> {
  try {
    const session = requireRole(["WH", "AD"]);
    markRejectedPriceEntriesAsReadForWH(session.displayName);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/notifications");
    return { ok: true };
  } catch (e) {
    return { ok: false };
  }
}
