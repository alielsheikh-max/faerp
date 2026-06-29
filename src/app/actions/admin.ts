"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import fs from "fs";
import path from "path";
import {
  createCategory,
  createItem,
  createSupplier,
  createUser,
  deleteCategory,
  deleteItem,
  deleteSupplier,
  deleteUser,
  updateCategory,
  updateItem,
  updateSupplier,
  updateUser,
  purgeAllDataExceptUsers,
  setSupplierCategories,
  ensureSupplierCategory,
  bulkSetItemActive,
  bulkMoveItemCategory,
  bulkDeleteItems,
  bulkDeleteCategories,
  database,
} from "@/lib/db";
import { asNumber, asString } from "@/lib/format";
import { requireRole } from "@/lib/auth";
import { log } from "@/lib/activity";

function fail(message: string, returnTo: string = "/dashboard/admin"): never {
  redirect(`${returnTo}?error=${encodeURIComponent(message)}`);
}

function done(message: string, returnTo: string = "/dashboard/admin"): never {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/admin/items");
  revalidatePath("/dashboard/admin/suppliers");
  revalidatePath("/dashboard/purchasing");
  revalidatePath("/dashboard/manager");
  revalidatePath("/dashboard/sales");
  redirect(`${returnTo}?success=${encodeURIComponent(message)}`);
}

/**
 * Assign categories to a supplier. Returns a result object (no redirect)
 * so client components can show inline success/error feedback.
 */
export async function assignSupplierCategoriesAction(
  formData: FormData
): Promise<{ success: boolean; message?: string; error?: string }> {
  const session = requireRole(["AD"]);
  const supplierId = Number(formData.get("supplier_id"));
  if (!supplierId || isNaN(supplierId)) {
    return { success: false, error: "Invalid supplier ID." };
  }
  const rawIds = formData.getAll("category_ids");
  const categoryIds = rawIds.map(Number).filter(n => !isNaN(n) && n > 0);
  try {
    setSupplierCategories(supplierId, categoryIds, session.displayName);
    revalidatePath("/dashboard/purchasing");
    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/admin/suppliers");
    return { success: true, message: `Categories updated (${categoryIds.length} assigned).` };
  } catch (e) {
    return { success: false, error: "Failed to update supplier categories." };
  }
}

/**
 * Bulk-save category assignments for multiple suppliers at once.
 * Accepts formData with "assignments" = JSON string of
 * Array<{ supplierId: number; categoryIds: number[] }>
 */
export async function bulkAssignSupplierCategoriesAction(
  formData: FormData
): Promise<{ success: boolean; message?: string; error?: string }> {
  const session = requireRole(["AD"]);
  const raw = formData.get("assignments");
  if (!raw || typeof raw !== "string") {
    return { success: false, error: "No assignment data provided." };
  }
  let assignments: Array<{ supplierId: number; categoryIds: number[] }>;
  try {
    assignments = JSON.parse(raw);
    if (!Array.isArray(assignments)) throw new Error("Not an array");
  } catch {
    return { success: false, error: "Invalid assignment data format." };
  }
  try {
    for (const { supplierId, categoryIds } of assignments) {
      if (!supplierId || isNaN(supplierId)) continue;
      const validIds = (categoryIds ?? []).filter(n => !isNaN(n) && n > 0);
      setSupplierCategories(supplierId, validIds, session.displayName);
    }
    revalidatePath("/dashboard/purchasing");
    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/admin/suppliers");
    return {
      success: true,
      message: `Saved assignments for ${assignments.length} supplier${assignments.length === 1 ? "" : "s"}.`,
    };
  } catch (e) {
    return { success: false, error: "Failed to save supplier categories." };
  }
}


export async function createUserAction(formData: FormData) {
  requireRole(["AD"]);
  const username = asString(formData.get("username")).toLowerCase();
  const password = asString(formData.get("password"));
  const role = asString(formData.get("role"));
  const displayName = asString(formData.get("displayName"));

  if (!username || !password || !role || !displayName) {
    fail("Please fill all user fields.");
  }

  createUser({ username, password, role, displayName });
  log.userCreated({ username: "admin", role: "AD" }, { username, role, displayName });
  done("User created.");
}

export async function updateUserAction(formData: FormData) {
  requireRole(["AD"]);
  const id = asNumber(formData.get("id"));
  const username = asString(formData.get("username")).toLowerCase();
  const password = asString(formData.get("password"));
  const role = asString(formData.get("role"));
  const displayName = asString(formData.get("displayName"));
  const active = asString(formData.get("active")) === "on";

  if (id === null || !username || !role || !displayName) {
    fail("Please complete the user update fields.");
  }

  updateUser({ id, username, password: password || undefined, role, displayName, active });
  log.userUpdated({ username: "admin", role: "AD" }, { username, displayName, active });
  done("User updated.");
}

export async function deleteUserAction(formData: FormData) {
  requireRole(["AD"]);
  const id = asNumber(formData.get("id"));

  if (id === null) {
    fail("User id is missing.");
  }

  const usernameToDelete = asString(formData.get("username")) || `id:${id}`;
  deleteUser(id);
  log.userDeleted({ username: "admin", role: "AD" }, { username: usernameToDelete });
  done("User deleted.");
}

export async function createCategoryAction(formData: FormData) {
  requireRole(["AD"]);
  const name = asString(formData.get("name"));
  const description = asString(formData.get("description"));

  if (!name) {
    fail("Category name is required.", "/dashboard/admin/items");
  }

  createCategory({ name, description });
  log.categoryCreated({ username: "admin", role: "AD" }, { name });
  done("Category created.", "/dashboard/admin/items");
}

export async function updateCategoryAction(formData: FormData) {
  requireRole(["AD"]);
  const id = asNumber(formData.get("id"));
  const name = asString(formData.get("name"));
  const description = asString(formData.get("description"));

  if (id === null || !name) {
    fail("Category update is incomplete.", "/dashboard/admin/items");
  }

  updateCategory({ id, name, description });
  log.categoryUpdated({ username: "admin", role: "AD" }, { name });
  done("Category updated.", "/dashboard/admin/items");
}

export async function deleteCategoryAction(formData: FormData) {
  requireRole(["AD"]);
  const id = asNumber(formData.get("id"));

  if (id === null) {
    fail("Category id is missing.");
  }

  try {
    deleteCategory(id);
  } catch (error) {
    fail(error instanceof Error ? error.message : "Category delete failed.", "/dashboard/admin/items");
  }

  log.categoryDeleted({ username: "admin", role: "AD" }, { name: `id:${id}` });
  done("Category deleted.", "/dashboard/admin/items");
}

export async function createSupplierAction(formData: FormData) {
  requireRole(["AD"]);
  const name = asString(formData.get("name"));
  const fameName = asString(formData.get("fameName"));
  const contactPerson = asString(formData.get("contactPerson"));
  const phone = asString(formData.get("phone"));
  const code = asString(formData.get("code"));
  const contactJobTitle = asString(formData.get("contactJobTitle"));
  const representedProducts = asString(formData.get("representedProducts"));
  const email = asString(formData.get("email"));
  const region = asString(formData.get("region"));
  const address = asString(formData.get("address"));

  if (!name) {
    fail("Supplier name is required.", "/dashboard/admin/suppliers");
  }

  createSupplier({ name, fameName, contactPerson, phone, code, contactJobTitle, representedProducts, email, region, address });
  log.supplierCreated({ username: "admin", role: "AD" }, { name });
  done("Supplier created.", "/dashboard/admin/suppliers");
}

export async function updateSupplierAction(formData: FormData) {
  requireRole(["AD"]);
  const id = asNumber(formData.get("id"));
  const name = asString(formData.get("name"));
  const fameName = asString(formData.get("fameName"));
  const contactPerson = asString(formData.get("contactPerson"));
  const phone = asString(formData.get("phone"));
  const code = asString(formData.get("code"));
  const contactJobTitle = asString(formData.get("contactJobTitle"));
  const representedProducts = asString(formData.get("representedProducts"));
  const email = asString(formData.get("email"));
  const region = asString(formData.get("region"));
  const address = asString(formData.get("address"));

  if (id === null || !name) {
    fail("Supplier update is incomplete.", "/dashboard/admin/suppliers");
  }

  updateSupplier({ id, name, fameName, contactPerson, phone, code, contactJobTitle, representedProducts, email, region, address });
  log.supplierUpdated({ username: "admin", role: "AD" }, { name });
  done("Supplier updated.", "/dashboard/admin/suppliers");
}

export async function deleteSupplierAction(formData: FormData) {
  requireRole(["AD"]);
  const id = asNumber(formData.get("id"));

  if (id === null) {
    fail("Supplier id is missing.");
  }

  try {
    deleteSupplier(id);
  } catch (error) {
    fail(error instanceof Error ? error.message : "Supplier delete failed.", "/dashboard/admin/suppliers");
  }

  log.supplierDeleted({ username: "admin", role: "AD" }, { name: `id:${id}` });
  done("Supplier deleted.", "/dashboard/admin/suppliers");
}

async function processUploadedImages(files: FormDataEntryValue[], existingImages: string[] = []): Promise<string[]> {
  const uploadDir = path.join(process.cwd(), "public", "uploads", "items");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const validFiles: File[] = [];
  for (const entry of files) {
    if (entry instanceof File && entry.name !== "" && entry.size > 0) {
      validFiles.push(entry);
    }
  }

  if (existingImages.length + validFiles.length > 5) {
    throw new Error("You can only upload up to 5 images per product.");
  }

  const newPaths: string[] = [];
  for (const file of validFiles) {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error(`File "${file.name}" exceeds the 5 MB size limit.`);
    }
    if (!file.type.startsWith("image/")) {
      throw new Error(`File "${file.name}" is not a valid image format.`);
    }

    const timestamp = Date.now();
    const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filename = `img_${timestamp}_${Math.floor(Math.random() * 1000)}_${cleanName}`;
    const filePath = path.join(uploadDir, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);
    newPaths.push(`/uploads/items/${filename}`);
  }

  return [...existingImages, ...newPaths];
}

export async function createItemAction(formData: FormData) {
  requireRole(["AD"]);
  const categoryId = asNumber(formData.get("categoryId"));
  const name = asString(formData.get("name"));
  const unit = asString(formData.get("unit"));
  const description = asString(formData.get("description"));
  const transportationPerUnit = asNumber(formData.get("transportationPerUnit")) || 0;
  const moq = asNumber(formData.get("moq")) || 0;
  const recommendedSupplierId = asNumber(formData.get("recommendedSupplierId"));

  if (categoryId === null || !name || !unit) {
    fail("Item creation is incomplete.", "/dashboard/admin/items");
  }

  let finalImagesStr: string | null = null;
  try {
    const uploaded = await processUploadedImages(formData.getAll("images"));
    if (uploaded.length > 0) {
      finalImagesStr = JSON.stringify(uploaded);
    }
  } catch (error) {
    fail(error instanceof Error ? error.message : "Image upload failed.", "/dashboard/admin/items");
  }

  createItem({ categoryId, name, unit, description, transportationPerUnit, moq, recommendedSupplierId, images: finalImagesStr });

  // Auto-assign category to recommended supplier so item appears in WH missing quotes
  if (recommendedSupplierId && categoryId) {
    ensureSupplierCategory(recommendedSupplierId, categoryId, "system:auto");
  }

  log.itemCreated({ username: "admin", role: "AD" }, { name, category: `Category #${categoryId}` });
  done("Item created.", "/dashboard/admin/items");
}

export async function updateItemAction(formData: FormData) {
  requireRole(["AD"]);
  const id = asNumber(formData.get("id"));
  const categoryId = asNumber(formData.get("categoryId"));
  const name = asString(formData.get("name"));
  const unit = asString(formData.get("unit"));
  const description = asString(formData.get("description"));
  const active = asString(formData.get("active")) === "on";
  const transportationPerUnit = asNumber(formData.get("transportationPerUnit")) || 0;
  const moq = asNumber(formData.get("moq")) || 0;
  const recommendedSupplierId = asNumber(formData.get("recommendedSupplierId"));

  if (id === null || categoryId === null || !name || !unit) {
    fail("Item update is incomplete.", "/dashboard/admin/items");
  }

  const deletedImagesStr = asString(formData.get("deletedImages")) || "[]";
  let deletedImages: string[] = [];
  try {
    deletedImages = JSON.parse(deletedImagesStr);
  } catch (_) {}

  // Fetch current images
  const db = database();
  const row = db.prepare("SELECT images FROM items WHERE id = ?").get(id) as { images: string | null } | undefined;
  let existingImages: string[] = [];
  if (row?.images) {
    try {
      existingImages = JSON.parse(row.images);
    } catch (_) {}
  }

  const remainingImages = existingImages.filter(img => !deletedImages.includes(img));

  // Try to delete actual files
  for (const delImg of deletedImages) {
    try {
      const fullPath = path.join(process.cwd(), "public", delImg);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (err) {
      console.error("Failed to delete file:", delImg, err);
    }
  }

  let finalImagesStr: string | null = null;
  try {
    const uploaded = await processUploadedImages(formData.getAll("images"), remainingImages);
    if (uploaded.length > 0) {
      finalImagesStr = JSON.stringify(uploaded);
    }
  } catch (error) {
    fail(error instanceof Error ? error.message : "Image upload failed.", "/dashboard/admin/items");
  }

  updateItem({ id, categoryId, name, unit, description, active, transportationPerUnit, moq, recommendedSupplierId, images: finalImagesStr });

  // Auto-assign category to recommended supplier so item appears in WH missing quotes
  if (recommendedSupplierId && categoryId) {
    ensureSupplierCategory(recommendedSupplierId, categoryId, "system:auto");
  }

  log.itemUpdated({ username: "admin", role: "AD" }, { name });
  done("Item updated.", "/dashboard/admin/items");
}

export async function deleteItemAction(formData: FormData) {
  requireRole(["AD"]);
  const id = asNumber(formData.get("id"));

  if (id === null) {
    fail("Item id is missing.");
  }

  try {
    deleteItem(id);
  } catch (error) {
    fail(error instanceof Error ? error.message : "Item delete failed.");
  }

  log.itemDeleted({ username: "admin", role: "AD" }, { name: `id:${id}` });
  done("Item deleted.", "/dashboard/admin/items");
}

// ── T2: Bulk item operations ───────────────────────────────────────────────

export async function bulkActivateItemsAction(formData: FormData) {
  requireRole(["AD"]);
  const ids = formData.getAll("itemId").map(Number).filter(n => !isNaN(n) && n > 0);
  if (ids.length === 0) fail("No items selected.");
  bulkSetItemActive(ids, true);
  revalidatePath("/dashboard/admin/items");
  revalidatePath("/dashboard/admin");
  redirect(`/dashboard/admin/items?success=${encodeURIComponent(`${ids.length} item(s) activated.`)}`);
}

export async function bulkDeactivateItemsAction(formData: FormData) {
  requireRole(["AD"]);
  const ids = formData.getAll("itemId").map(Number).filter(n => !isNaN(n) && n > 0);
  if (ids.length === 0) fail("No items selected.");
  bulkSetItemActive(ids, false);
  revalidatePath("/dashboard/admin/items");
  revalidatePath("/dashboard/admin");
  redirect(`/dashboard/admin/items?success=${encodeURIComponent(`${ids.length} item(s) deactivated.`)}`);
}

export async function bulkMoveCategoryAction(formData: FormData) {
  requireRole(["AD"]);
  const ids = formData.getAll("itemId").map(Number).filter(n => !isNaN(n) && n > 0);
  const categoryId = asNumber(formData.get("categoryId"));
  if (ids.length === 0 || categoryId === null) fail("No items or category selected.");
  bulkMoveItemCategory(ids, categoryId);
  revalidatePath("/dashboard/admin/items");
  revalidatePath("/dashboard/admin");
  redirect(`/dashboard/admin/items?success=${encodeURIComponent(`${ids.length} item(s) moved.`)}`);
}

export async function bulkDeleteItemsAction(formData: FormData) {
  requireRole(["AD"]);
  const ids = formData.getAll("itemId").map(Number).filter(n => !isNaN(n) && n > 0);
  if (ids.length === 0) fail("No items selected.");
  const { deleted, skipped } = bulkDeleteItems(ids);
  revalidatePath("/dashboard/admin/items");
  revalidatePath("/dashboard/admin");
  const msg = skipped > 0
    ? `${deleted} deleted, ${skipped} skipped (have pricing history).`
    : `${deleted} item(s) deleted.`;
  redirect(`/dashboard/admin/items?success=${encodeURIComponent(msg)}`);
}

export async function bulkDeleteCategoriesAction(formData: FormData) {
  requireRole(["AD"]);
  const ids = formData.getAll("categoryId").map(Number).filter(n => !isNaN(n) && n > 0);
  if (ids.length === 0) fail("No categories selected.");
  const { deleted, skipped } = bulkDeleteCategories(ids);
  revalidatePath("/dashboard/admin/items");
  revalidatePath("/dashboard/admin");
  const msg = skipped > 0
    ? `${deleted} deleted, ${skipped} skipped (have items).`
    : `${deleted} category(ies) deleted.`;
  redirect(`/dashboard/admin/items?success=${encodeURIComponent(msg)}`);
}

export async function purgeDataAction(formData: FormData) {
  requireRole(["AD"]);
  const password = asString(formData.get("password"));
  if (password !== "17012911") {
    fail("Incorrect purge protection password.");
  }

  try {
    purgeAllDataExceptUsers();
  } catch (error) {
    fail(error instanceof Error ? error.message : "Database purge failed.");
  }

  done("Database purged successfully. All transaction, pricing, and catalog records have been wiped.");
}

function parseCSV(text: string): string[][] {
  const lines = text.split(/\r?\n/);
  const result: string[][] = [];
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    const row: string[] = [];
    let insideQuote = false;
    let currentField = "";
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        row.push(currentField.trim());
        currentField = "";
      } else {
        currentField += char;
      }
    }
    row.push(currentField.trim());
    const cleanedRow = row.map(val => {
      let cleaned = val;
      if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
        cleaned = cleaned.substring(1, cleaned.length - 1).trim();
      }
      return cleaned;
    });
    result.push(cleanedRow);
  }
  return result;
}

export async function importItemsCSVAction(formData: FormData) {
  requireRole(["AD"]);
  const file = formData.get("file") as File;
  if (!file || file.size === 0) {
    fail("No CSV file selected or file is empty.");
  }

  try {
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length <= 1) {
      fail("CSV file has no data rows.");
    }

    const db = database();
    let itemsCreated = 0;
    let itemsUpdated = 0;
    let categoriesCreated = 0;

    const findCategory = db.prepare("SELECT id FROM categories WHERE name = ?");
    const insertCategory = db.prepare("INSERT INTO categories (name, description) VALUES (?, ?)");
    const findItem = db.prepare("SELECT id FROM items WHERE category_id = ? AND name = ?");
    const insertItem = db.prepare(`
      INSERT INTO items (category_id, name, unit, description, active, transportation_per_unit, moq)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const updateItemQuery = db.prepare(`
      UPDATE items
      SET unit = ?, description = ?, active = ?, transportation_per_unit = ?, moq = ?
      WHERE id = ?
    `);

    // New column layout (0-indexed):
    // 0: Category, 1: MOQ, 2: Item Name, 3: Transportation per Item/EGP,
    // 4: TIER (yes/no), 5: Range 1, 6: Discount 1, 7: Range 2, 8: Discount 2,
    // 9: Range 3, 10: Discount 3, 11: Range 4, 12: Discount 4
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < 3) continue;

      const catName   = row[0]?.trim();
      const moq       = parseInt(row[1]?.trim()) || 0;
      const itemName  = row[2]?.trim();
      const transCost = parseFloat(row[3]?.trim()) || 0.0;
      const active    = 1; // default active on plain import
      const unit      = "قطعة"; // default unit
      const description = "";

      if (!catName || !itemName) continue;

      let catId: number;
      const catRow = findCategory.get(catName) as { id: number } | undefined;
      if (catRow) {
        catId = catRow.id;
      } else {
        const result = insertCategory.run(catName, "Imported via CSV template");
        catId = Number(result.lastInsertRowid);
        categoriesCreated++;
      }

      const itemRow = findItem.get(catId, itemName) as { id: number } | undefined;
      if (itemRow) {
        updateItemQuery.run(unit, description, active, transCost, moq, itemRow.id);
        itemsUpdated++;
      } else {
        insertItem.run(catId, itemName, unit, description, active, transCost, moq);
        itemsCreated++;
      }
    }

    done(`Successfully imported: ${itemsCreated} new items, updated ${itemsUpdated} existing items. Created ${categoriesCreated} new categories.`);
  } catch (error) {
    fail(error instanceof Error ? error.message : "Failed to parse and import CSV file.");
  }
}

export async function importSuppliersCSVAction(formData: FormData) {
  requireRole(["AD"]);
  const file = formData.get("file") as File;
  if (!file || file.size === 0) {
    fail("No CSV file selected or file is empty.");
  }

  try {
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length <= 1) {
      fail("CSV file has no data rows.");
    }

    const db = database();
    let suppliersCreated = 0;
    let suppliersUpdated = 0;

    const findSupplier = db.prepare("SELECT id FROM suppliers WHERE name = ?");
    const insertSupplierQuery = db.prepare(`
      INSERT INTO suppliers (
        name, code, contact_job_title, contact_person, phone, represented_products, email, region, address
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const updateSupplierQuery = db.prepare(`
      UPDATE suppliers
      SET
        code = ?,
        contact_job_title = ?,
        contact_person = ?,
        phone = ?,
        represented_products = ?,
        email = ?,
        region = ?,
        address = ?
      WHERE id = ?
    `);

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < 1) continue;

      const name = row[0]?.trim();
      const code = row[1]?.trim() || "";
      const jobTitle = row[2]?.trim() || "";
      const contactPerson = row[3]?.trim() || "";
      const phone = row[4]?.trim() || "";
      const products = row[5]?.trim() || "";
      const email = row[6]?.trim() || "";
      const region = row[7]?.trim() || "";
      const address = row[8]?.trim() || "";

      if (!name) continue;

      const supplierRow = findSupplier.get(name) as { id: number } | undefined;
      if (supplierRow) {
        updateSupplierQuery.run(code, jobTitle, contactPerson, phone, products, email, region, address, supplierRow.id);
        suppliersUpdated++;
      } else {
        insertSupplierQuery.run(name, code, jobTitle, contactPerson, phone, products, email, region, address);
        suppliersCreated++;
      }
    }

    done(`Successfully imported: ${suppliersCreated} new suppliers, updated ${suppliersUpdated} existing suppliers.`);
  } catch (error) {
    fail(error instanceof Error ? error.message : "Failed to parse and import CSV file.");
  }
}

export async function importItemsCSVActionDirect(formData: FormData) {
  try {
    requireRole(["AD"]);
  } catch (err) {
    return { success: false, error: "Unauthorized. Admin role required." };
  }

  const file = formData.get("file") as File;
  if (!file || file.size === 0) {
    return { success: false, error: "No CSV file selected or file is empty." };
  }

  try {
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length <= 1) {
      return { success: false, error: "CSV file has no data rows." };
    }

    const db = database();
    let itemsCreated = 0;
    let itemsUpdated = 0;
    let categoriesCreated = 0;
    let tiersSet = 0;

    const findCategory = db.prepare("SELECT id FROM categories WHERE name = ?");
    const insertCategory = db.prepare("INSERT INTO categories (name, description) VALUES (?, ?)");
    const findItem = db.prepare("SELECT id FROM items WHERE category_id = ? AND name = ?");
    const insertItem = db.prepare(`
      INSERT INTO items (category_id, name, unit, description, active, transportation_per_unit, moq)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const updateItemQuery = db.prepare(`
      UPDATE items
      SET unit = ?, description = ?, active = ?, transportation_per_unit = ?, moq = ?
      WHERE id = ?
    `);
    const upsertTier = db.prepare(`
      INSERT INTO item_tiers
        (item_id, is_tiered, tier1_max, tier1_discount, tier2_max, tier2_discount,
         tier3_max, tier3_discount, tier4_max, tier4_discount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(item_id) DO UPDATE SET
        is_tiered        = excluded.is_tiered,
        tier1_max        = excluded.tier1_max,
        tier1_discount   = excluded.tier1_discount,
        tier2_max        = excluded.tier2_max,
        tier2_discount   = excluded.tier2_discount,
        tier3_max        = excluded.tier3_max,
        tier3_discount   = excluded.tier3_discount,
        tier4_max        = excluded.tier4_max,
        tier4_discount   = excluded.tier4_discount
    `);

    // Helper: parse "1-100" → upper bound (100)
    function parseRangeMax(rangeStr: string): number {
      if (!rangeStr) return 0;
      const clean = rangeStr.trim().replace(/[^\d\-]/g, "");
      const parts = clean.split("-");
      const upper = parseInt(parts[parts.length - 1]) || 0;
      return upper;
    }

    // New column layout (0-indexed):
    // 0: Category, 1: MOQ, 2: Item Name, 3: Transportation per Item/EGP,
    // 4: TIER (yes/no), 5: Range 1, 6: Discount 1, 7: Range 2, 8: Discount 2,
    // 9: Range 3, 10: Discount 3, 11: Range 4, 12: Discount 4

    const runTransaction = db.transaction(() => {
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < 3) continue;

        const catName      = row[0]?.trim();
        const moq          = parseInt(row[1]?.trim()) || 0;
        const itemName     = row[2]?.trim();
        const transCost    = parseFloat(row[3]?.trim()) || 0.0;
        const tierEnabled  = (row[4]?.trim() || "").toLowerCase() === "yes";
        const tier1Range   = row[5]?.trim() || "1-100";
        const tier1Disc    = parseFloat(row[6]?.trim()) || 0.0;
        const tier2Range   = row[7]?.trim() || "101-200";
        const tier2Disc    = parseFloat(row[8]?.trim()) || 5.0;
        const tier3Range   = row[9]?.trim() || "201-300";
        const tier3Disc    = parseFloat(row[10]?.trim()) || 10.0;
        const tier4Range   = row[11]?.trim() || "";
        const tier4Disc    = parseFloat(row[12]?.trim()) || 0.0;
        const unit         = "قطعة";
        const description  = "";
        const active       = 1;

        if (!catName || !itemName) continue;

        let catId: number;
        const catRow = findCategory.get(catName) as { id: number } | undefined;
        if (catRow) {
          catId = catRow.id;
        } else {
          const result = insertCategory.run(catName, "Imported via CSV template");
          catId = Number(result.lastInsertRowid);
          categoriesCreated++;
        }

        let itemId: number;
        const itemRow = findItem.get(catId, itemName) as { id: number } | undefined;
        if (itemRow) {
          updateItemQuery.run(unit, description, active, transCost, moq, itemRow.id);
          itemId = itemRow.id;
          itemsUpdated++;
        } else {
          const res = insertItem.run(catId, itemName, unit, description, active, transCost, moq);
          itemId = Number(res.lastInsertRowid);
          itemsCreated++;
        }

        // Parse range max values
        const tier1Max = tierEnabled ? (parseRangeMax(tier1Range) || 100) : 100;
        const tier2Max = tierEnabled ? (parseRangeMax(tier2Range) || 200) : 200;
        const tier3Max = tierEnabled ? (parseRangeMax(tier3Range) || 300) : 300;
        // tier4 is the final open-ended tier — use 0 to mean "no upper limit"
        const tier4Max = (tierEnabled && tier4Range) ? (parseRangeMax(tier4Range) || 0) : 0;

        upsertTier.run(
          itemId, tierEnabled ? 1 : 0,
          tier1Max, tier1Disc,
          tier2Max, tier2Disc,
          tier3Max, tier3Disc,
          tier4Max, tier4Disc
        );
        tiersSet++;
      }
    });

    runTransaction();

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/purchasing");
    revalidatePath("/dashboard/manager");
    revalidatePath("/dashboard/sales");

    return {
      success: true,
      message: `Successfully imported: ${itemsCreated} new items, updated ${itemsUpdated} existing. Created ${categoriesCreated} new categories. ${tiersSet} tier pricing records saved.`
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to parse and import CSV file." };
  }
}


export async function importSuppliersCSVActionDirect(formData: FormData) {
  try {
    requireRole(["AD"]);
  } catch (err) {
    return { success: false, error: "Unauthorized. Admin role required." };
  }

  const file = formData.get("file") as File;
  if (!file || file.size === 0) {
    return { success: false, error: "No CSV file selected or file is empty." };
  }

  try {
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length <= 1) {
      return { success: false, error: "CSV file has no data rows." };
    }

    const db = database();
    let suppliersCreated = 0;
    let suppliersUpdated = 0;

    const findSupplier = db.prepare("SELECT id FROM suppliers WHERE name = ?");
    const insertSupplierQuery = db.prepare(`
      INSERT INTO suppliers (
        name, code, contact_job_title, contact_person, phone, represented_products, email, region, address
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const updateSupplierQuery = db.prepare(`
      UPDATE suppliers
      SET
        code = ?,
        contact_job_title = ?,
        contact_person = ?,
        phone = ?,
        represented_products = ?,
        email = ?,
        region = ?,
        address = ?
      WHERE id = ?
    `);

    const runTransaction = db.transaction(() => {
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < 1) continue;

        const name = row[0]?.trim();
        const code = row[1]?.trim() || "";
        const jobTitle = row[2]?.trim() || "";
        const contactPerson = row[3]?.trim() || "";
        const phone = row[4]?.trim() || "";
        const products = row[5]?.trim() || "";
        const email = row[6]?.trim() || "";
        const region = row[7]?.trim() || "";
        const address = row[8]?.trim() || "";

        if (!name) continue;

        const supplierRow = findSupplier.get(name) as { id: number } | undefined;
        if (supplierRow) {
          updateSupplierQuery.run(code, jobTitle, contactPerson, phone, products, email, region, address, supplierRow.id);
          suppliersUpdated++;
        } else {
          insertSupplierQuery.run(name, code, jobTitle, contactPerson, phone, products, email, region, address);
          suppliersCreated++;
        }
      }
    });

    runTransaction();

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/purchasing");
    revalidatePath("/dashboard/manager");
    revalidatePath("/dashboard/sales");

    return {
      success: true,
      message: `Successfully imported: ${suppliersCreated} new suppliers, updated ${suppliersUpdated} existing suppliers.`
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to parse and import CSV file." };
  }
}

export async function getSupplierQuotesHistoryAction(supplierId: number): Promise<{ success: boolean; quotes?: any[]; error?: string }> {
  try {
    requireRole(["AD", "SC", "WH"]);
    const db = database();
    const quotes = db.prepare(`
      SELECT 
        pe.id,
        pe.price,
        pe.currency,
        pe.month,
        pe.notes,
        pe.collected_by,
        pe.recorded_at,
        i.name as item_name,
        i.id as item_id,
        c.name as category_name
      FROM price_entries pe
      JOIN items i ON pe.item_id = i.id
      JOIN categories c ON i.category_id = c.id
      WHERE pe.supplier_id = ?
      ORDER BY pe.month ASC, i.name ASC
    `).all(supplierId) as any[];

    return { success: true, quotes };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to load supplier quotes history." };
  }
}

export async function getSupplierConfirmedPricesAction(supplierId: number): Promise<{ success: boolean; history?: any[]; error?: string }> {
  try {
    requireRole(["AD", "SC", "WH", "SA"]);
    const db = database();
    const history = db.prepare(`
      SELECT 
        sp.month,
        i.name AS item_name,
        i.unit,
        c.name AS category_name,
        sp.strategy,
        COALESCE(
          (SELECT price FROM price_entries 
           WHERE item_id = sp.item_id 
             AND month = sp.month 
             AND supplier_id = sp.confirmed_supplier_id 
             AND status = 'approved' 
           LIMIT 1),
          CASE 
            WHEN sp.strategy = 'min' THEN sp.buy_min
            WHEN sp.strategy = 'max' THEN sp.buy_max
            ELSE sp.buy_avg
          END
        ) AS cost_base,
        sp.sell_min,
        sp.sell_max
      FROM selling_prices sp
      JOIN items i ON sp.item_id = i.id
      JOIN categories c ON i.category_id = c.id
      WHERE sp.confirmed_supplier_id = ?
        AND sp.approval_status = 'approved'
      ORDER BY sp.month DESC, i.name ASC
    `).all(supplierId) as any[];

    return { success: true, history };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to load supplier confirmed prices history." };
  }
}
