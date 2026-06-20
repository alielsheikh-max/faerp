/**
 * src/lib/activity.ts
 *
 * Thin wrapper around logActivity() from db.ts.
 * All event-type constants live here so every action file imports from
 * one place — keeps event keys consistent and avoids typos.
 *
 * Usage:
 *   import { log } from "@/lib/activity";
 *   log.priceQuoteSubmitted(session, { itemName, supplierName, price, month });
 */

import { logActivity } from "@/lib/db";

type Actor = { username: string; role: string; displayName?: string };

/* ── Auth ─────────────────────────────────────────────────────────── */
export const log = {
  signIn(actor: Actor) {
    logActivity({
      actor: actor.username,
      role:  actor.role,
      eventType: "sign_in",
      summary: `${actor.displayName ?? actor.username} signed in`,
    });
  },

  signOut(actor: Actor) {
    logActivity({
      actor: actor.username,
      role:  actor.role,
      eventType: "sign_out",
      summary: `${actor.displayName ?? actor.username} signed out`,
    });
  },

  /* ── Price Quotes (WH) ──────────────────────────────────────────── */
  priceQuoteSubmitted(
    actor: Actor,
    detail: { itemName: string; supplierName: string; price: number; month: string }
  ) {
    logActivity({
      actor: actor.username,
      role:  actor.role,
      eventType: "price_quote_submitted",
      summary: `Price quote submitted — ${detail.itemName} / ${detail.supplierName} @ ${detail.price} (${detail.month})`,
      detail: detail as Record<string, unknown>,
    });
  },

  priceQuoteUpdated(
    actor: Actor,
    detail: { itemName: string; supplierName: string; oldPrice: number; newPrice: number; month: string }
  ) {
    logActivity({
      actor: actor.username,
      role:  actor.role,
      eventType: "price_quote_updated",
      summary: `Price updated — ${detail.itemName} / ${detail.supplierName}: ${detail.oldPrice} → ${detail.newPrice} (${detail.month})`,
      detail: detail as Record<string, unknown>,
    });
  },

  bulkQuotesSubmitted(
    actor: Actor,
    detail: { month: string; count: number }
  ) {
    logActivity({
      actor: actor.username,
      role:  actor.role,
      eventType: "bulk_quotes_submitted",
      summary: `Bulk price collection — ${detail.count} quote(s) saved for ${detail.month}`,
      detail: detail as Record<string, unknown>,
    });
  },

  priceChangeRequested(
    actor: Actor,
    detail: { itemName: string; supplierName: string; oldPrice: number; newPrice: number; month: string }
  ) {
    logActivity({
      actor: actor.username,
      role:  actor.role,
      eventType: "price_change_requested",
      summary: `Price change request — ${detail.itemName} / ${detail.supplierName}: ${detail.oldPrice} → ${detail.newPrice} (${detail.month})`,
      detail: detail as Record<string, unknown>,
    });
  },

  /* ── SC Review ──────────────────────────────────────────────────── */
  priceChangeApproved(
    actor: Actor,
    detail: { requestId: number; itemName: string; month: string }
  ) {
    logActivity({
      actor: actor.username,
      role:  actor.role,
      eventType: "price_change_approved",
      summary: `Price change approved — ${detail.itemName} (${detail.month})`,
      detail: detail as Record<string, unknown>,
    });
  },

  priceChangeRejected(
    actor: Actor,
    detail: { requestId: number; itemName: string; month: string }
  ) {
    logActivity({
      actor: actor.username,
      role:  actor.role,
      eventType: "price_change_rejected",
      summary: `Price change rejected — ${detail.itemName} (${detail.month})`,
      detail: detail as Record<string, unknown>,
    });
  },

  sellingPricePublished(
    actor: Actor,
    detail: { itemName: string; month: string; sellMin: number; sellMax: number }
  ) {
    logActivity({
      actor: actor.username,
      role:  actor.role,
      eventType: "selling_price_published",
      summary: `Selling price set — ${detail.itemName} (${detail.month}): min ${detail.sellMin} / max ${detail.sellMax}`,
      detail: detail as Record<string, unknown>,
    });
  },

  /* ── Admin — Users ──────────────────────────────────────────────── */
  userCreated(actor: Actor, detail: { username: string; role: string; displayName: string }) {
    logActivity({
      actor: actor.username,
      role:  actor.role,
      eventType: "user_created",
      summary: `User account created — ${detail.displayName} (${detail.username} / ${detail.role})`,
      detail: detail as Record<string, unknown>,
    });
  },

  userUpdated(actor: Actor, detail: { username: string; displayName: string; active: boolean }) {
    const status = detail.active ? "active" : "disabled";
    logActivity({
      actor: actor.username,
      role:  actor.role,
      eventType: "user_updated",
      summary: `User updated — ${detail.displayName} (${detail.username}) [${status}]`,
      detail: detail as Record<string, unknown>,
    });
  },

  userDeleted(actor: Actor, detail: { username: string }) {
    logActivity({
      actor: actor.username,
      role:  actor.role,
      eventType: "user_deleted",
      summary: `User deleted — ${detail.username}`,
      detail: detail as Record<string, unknown>,
    });
  },

  /* ── Admin — Catalog ────────────────────────────────────────────── */
  itemCreated(actor: Actor, detail: { name: string; category: string }) {
    logActivity({ actor: actor.username, role: actor.role, eventType: "item_created",
      summary: `Item created — ${detail.name} (${detail.category})`, detail: detail as Record<string, unknown> });
  },
  itemUpdated(actor: Actor, detail: { name: string }) {
    logActivity({ actor: actor.username, role: actor.role, eventType: "item_updated",
      summary: `Item updated — ${detail.name}`, detail: detail as Record<string, unknown> });
  },
  itemDeleted(actor: Actor, detail: { name: string }) {
    logActivity({ actor: actor.username, role: actor.role, eventType: "item_deleted",
      summary: `Item deleted — ${detail.name}`, detail: detail as Record<string, unknown> });
  },

  categoryCreated(actor: Actor, detail: { name: string }) {
    logActivity({ actor: actor.username, role: actor.role, eventType: "category_created",
      summary: `Category created — ${detail.name}`, detail: detail as Record<string, unknown> });
  },
  categoryUpdated(actor: Actor, detail: { name: string }) {
    logActivity({ actor: actor.username, role: actor.role, eventType: "category_updated",
      summary: `Category updated — ${detail.name}`, detail: detail as Record<string, unknown> });
  },
  categoryDeleted(actor: Actor, detail: { name: string }) {
    logActivity({ actor: actor.username, role: actor.role, eventType: "category_deleted",
      summary: `Category deleted — ${detail.name}`, detail: detail as Record<string, unknown> });
  },

  supplierCreated(actor: Actor, detail: { name: string }) {
    logActivity({ actor: actor.username, role: actor.role, eventType: "supplier_created",
      summary: `Supplier created — ${detail.name}`, detail: detail as Record<string, unknown> });
  },
  supplierUpdated(actor: Actor, detail: { name: string }) {
    logActivity({ actor: actor.username, role: actor.role, eventType: "supplier_updated",
      summary: `Supplier updated — ${detail.name}`, detail: detail as Record<string, unknown> });
  },
  supplierDeleted(actor: Actor, detail: { name: string }) {
    logActivity({ actor: actor.username, role: actor.role, eventType: "supplier_deleted",
      summary: `Supplier deleted — ${detail.name}`, detail: detail as Record<string, unknown> });
  },
};
