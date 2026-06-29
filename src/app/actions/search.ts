"use server";

import { getItemCardData, getSupplierCardData } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { calcTierPricesShared } from "@/lib/format";

export async function fetchItemCard(itemId: number) {
  const session = requireRole(["AD", "SC", "WH", "MG", "SA"]);
  const data = getItemCardData(itemId);
  if (!data) return null;

  if (session.role === "SA") {
    // For SA: pre-calculate approved tier prices and completely scrub all sensitive fields!
    const scrubbedSellingRows = data.sellingRows.map((s) => {
      const isApproved = s.approval_status === "approved";
      const tierPrices = (s.tier_pricing_enabled || s.is_tiered)
        ? calcTierPricesShared(s)
        : [];
      
      return {
        month: s.month,
        sell_min: isApproved ? s.sell_min : s.last_approved_sell_min,
        sell_max: isApproved ? s.sell_max : s.last_approved_sell_max,
        strategy: isApproved ? s.strategy : s.last_approved_strategy,
        approval_status: s.approval_status,
        tier_pricing_enabled: s.tier_pricing_enabled,
        is_tiered: s.is_tiered,
        tierPrices,
        buy_min: null,
        buy_max: null,
        buy_avg: null,
        markup_min: null,
        markup_max: null,
        created_by: null,
        created_at: null,
      };
    });

    return {
      item: {
        id: data.item.id,
        name: data.item.name,
        unit: data.item.unit,
        description: data.item.description,
        active: data.item.active,
        category_name: data.item.category_name,
        category_id: data.item.category_id,
        moq: data.item.moq,
        recommended_supplier_id: null,
        recommended_supplier_name: null,
        images: data.item.images,
      },
      priceRows: [],
      supplierStats: [],
      monthStats: [],
      supplierNames: [],
      months: data.months,
      grid: new Map(),
      sellingRows: scrubbedSellingRows,
    };
  }

  // For roles other than SA, enrich sellingRows with tierPrices
  const enrichedSellingRows = data.sellingRows.map((s) => ({
    ...s,
    tierPrices: (s.tier_pricing_enabled || s.is_tiered) ? calcTierPricesShared(s) : [],
  }));

  return {
    ...data,
    sellingRows: enrichedSellingRows,
  };
}

export async function fetchSupplierCard(supplierId: number) {
  // Sales Agents must never see supplier cards
  requireRole(["AD", "SC", "WH", "MG"]);
  return getSupplierCardData(supplierId);
}
