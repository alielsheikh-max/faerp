"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
  setSupplierCategories
} from "@/lib/db";
import { asNumber, asString } from "@/lib/format";
import { requireRole } from "@/lib/auth";

function fail(message: string): never {
  redirect(`/dashboard/admin?error=${encodeURIComponent(message)}`);
}

function done(message: string): never {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/purchasing");
  revalidatePath("/dashboard/manager");
  revalidatePath("/dashboard/sales");
  redirect(`/dashboard/admin?success=${encodeURIComponent(message)}`);
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

  createUser({
    username,
    password,
    role,
    displayName
  });

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

  updateUser({
    id,
    username,
    password: password || undefined,
    role,
    displayName,
    active
  });

  done("User updated.");
}

export async function deleteUserAction(formData: FormData) {
  requireRole(["AD"]);
  const id = asNumber(formData.get("id"));

  if (id === null) {
    fail("User id is missing.");
  }

  deleteUser(id);
  done("User deleted.");
}

export async function createCategoryAction(formData: FormData) {
  requireRole(["AD"]);
  const name = asString(formData.get("name"));
  const description = asString(formData.get("description"));

  if (!name) {
    fail("Category name is required.");
  }

  createCategory({ name, description });
  done("Category created.");
}

export async function updateCategoryAction(formData: FormData) {
  requireRole(["AD"]);
  const id = asNumber(formData.get("id"));
  const name = asString(formData.get("name"));
  const description = asString(formData.get("description"));

  if (id === null || !name) {
    fail("Category update is incomplete.");
  }

  updateCategory({ id, name, description });
  done("Category updated.");
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
    fail(error instanceof Error ? error.message : "Category delete failed.");
  }

  done("Category deleted.");
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
    fail("Supplier name is required.");
  }

  createSupplier({ name, fameName, contactPerson, phone, code, contactJobTitle, representedProducts, email, region, address });
  done("Supplier created.");
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
    fail("Supplier update is incomplete.");
  }

  updateSupplier({ id, name, fameName, contactPerson, phone, code, contactJobTitle, representedProducts, email, region, address });
  done("Supplier updated.");
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
    fail(error instanceof Error ? error.message : "Supplier delete failed.");
  }

  done("Supplier deleted.");
}

export async function createItemAction(formData: FormData) {
  requireRole(["AD"]);
  const categoryId = asNumber(formData.get("categoryId"));
  const name = asString(formData.get("name"));
  const unit = asString(formData.get("unit"));
  const description = asString(formData.get("description"));
  const transportationPerUnit = asNumber(formData.get("transportationPerUnit")) || 0;
  const moq = asNumber(formData.get("moq")) || 0;

  if (categoryId === null || !name || !unit) {
    fail("Item creation is incomplete.");
  }

  createItem({ categoryId, name, unit, description, transportationPerUnit, moq });
  done("Item created.");
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

  if (id === null || categoryId === null || !name || !unit) {
    fail("Item update is incomplete.");
  }

  updateItem({
    id,
    categoryId,
    name,
    unit,
    description,
    active,
    transportationPerUnit,
    moq
  });

  done("Item updated.");
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

  done("Item deleted.");
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

import { database } from "@/lib/db";

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
