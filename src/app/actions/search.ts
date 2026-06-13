"use server";

import { getItemCardData, getSupplierCardData } from "@/lib/db";

export async function fetchItemCard(itemId: number) {
  return getItemCardData(itemId);
}

export async function fetchSupplierCard(supplierId: number) {
  return getSupplierCardData(supplierId);
}
