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
  purgeAllDataExceptUsers
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

export async function createUserAction(formData: FormData) {
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
  const id = asNumber(formData.get("id"));

  if (id === null) {
    fail("User id is missing.");
  }

  deleteUser(id);
  done("User deleted.");
}

export async function createCategoryAction(formData: FormData) {
  const name = asString(formData.get("name"));
  const description = asString(formData.get("description"));

  if (!name) {
    fail("Category name is required.");
  }

  createCategory({ name, description });
  done("Category created.");
}

export async function updateCategoryAction(formData: FormData) {
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
  const name = asString(formData.get("name"));
  const contactPerson = asString(formData.get("contactPerson"));
  const phone = asString(formData.get("phone"));

  if (!name) {
    fail("Supplier name is required.");
  }

  createSupplier({ name, contactPerson, phone });
  done("Supplier created.");
}

export async function updateSupplierAction(formData: FormData) {
  const id = asNumber(formData.get("id"));
  const name = asString(formData.get("name"));
  const contactPerson = asString(formData.get("contactPerson"));
  const phone = asString(formData.get("phone"));

  if (id === null || !name) {
    fail("Supplier update is incomplete.");
  }

  updateSupplier({ id, name, contactPerson, phone });
  done("Supplier updated.");
}

export async function deleteSupplierAction(formData: FormData) {
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
  const categoryId = asNumber(formData.get("categoryId"));
  const name = asString(formData.get("name"));
  const unit = asString(formData.get("unit"));
  const description = asString(formData.get("description"));

  if (categoryId === null || !name || !unit) {
    fail("Item creation is incomplete.");
  }

  createItem({ categoryId, name, unit, description });
  done("Item created.");
}

export async function updateItemAction(formData: FormData) {
  const id = asNumber(formData.get("id"));
  const categoryId = asNumber(formData.get("categoryId"));
  const name = asString(formData.get("name"));
  const unit = asString(formData.get("unit"));
  const description = asString(formData.get("description"));
  const active = asString(formData.get("active")) === "on";

  if (id === null || categoryId === null || !name || !unit) {
    fail("Item update is incomplete.");
  }

  updateItem({
    id,
    categoryId,
    name,
    unit,
    description,
    active
  });

  done("Item updated.");
}

export async function deleteItemAction(formData: FormData) {
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
  requireRole(["SC"]);
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
