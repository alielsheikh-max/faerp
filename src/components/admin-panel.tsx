"use client";

import { useState } from "react";
import {
  createCategoryAction,
  createItemAction,
  createSupplierAction,
  createUserAction,
  deleteCategoryAction,
  deleteItemAction,
  deleteSupplierAction,
  deleteUserAction,
  updateCategoryAction,
  updateItemAction,
  updateSupplierAction,
  updateUserAction,
  purgeDataAction
} from "@/app/actions/admin";

type User = {
  id: number;
  username: string;
  role: string;
  display_name: string;
  active: number;
};

type Category = {
  id: number;
  name: string;
  description: string;
  item_count: number;
};

type Supplier = {
  id: number;
  name: string;
  contact_person: string;
  phone: string;
  quote_count: number;
};

type Item = {
  id: number;
  name: string;
  unit: string;
  description: string;
  active: number;
  category_id: number;
  category_name: string;
  quote_count: number;
};

type AdminPanelProps = {
  users: User[];
  categories: Category[];
  suppliers: Supplier[];
  items: Item[];
  showOnly?: string;
  role?: string;
};

export default function AdminPanel({ users, categories, suppliers, items, showOnly, role }: AdminPanelProps) {
  const [userQuery, setUserQuery] = useState("");
  const [categoryQuery, setCategoryQuery] = useState("");
  const [supplierQuery, setSupplierQuery] = useState("");
  const [itemQuery, setItemQuery] = useState("");
  const [itemCategoryFilter, setItemCategoryFilter] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<{
    type: "user" | "category" | "supplier" | "item";
    id: number;
  } | null>(null);

  // Live client-side filters
  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(userQuery.toLowerCase()) ||
    u.display_name.toLowerCase().includes(userQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(userQuery.toLowerCase())
  );

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(categoryQuery.toLowerCase()) ||
    c.description.toLowerCase().includes(categoryQuery.toLowerCase())
  );

  const filteredSuppliers = suppliers.filter((s) =>
    s.name.toLowerCase().includes(supplierQuery.toLowerCase()) ||
    s.contact_person.toLowerCase().includes(supplierQuery.toLowerCase()) ||
    s.phone.includes(supplierQuery)
  );

  const filteredItems = items.filter((i) => {
    const matchesText =
      i.name.toLowerCase().includes(itemQuery.toLowerCase()) ||
      i.unit.toLowerCase().includes(itemQuery.toLowerCase()) ||
      i.description.toLowerCase().includes(itemQuery.toLowerCase()) ||
      i.category_name.toLowerCase().includes(itemQuery.toLowerCase());
    
    const matchesCategory = itemCategoryFilter === "" || String(i.category_id) === itemCategoryFilter;

    return matchesText && matchesCategory;
  });

  const isReadOnly = role !== "AD";

  const handlePrintCatalog = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const categoriesHtml = filteredCategories.map((c, i) => `
      <tr style="background-color: ${i % 2 === 0 ? "#ffffff" : "#f9fafb"}; border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 8px 10px; font-weight: bold; color: #111827;">${c.name}</td>
        <td style="padding: 8px 10px; color: #4b5563;">${c.description || "—"}</td>
        <td style="padding: 8px 10px; font-weight: bold; color: #2563eb; text-align: center;">${c.item_count}</td>
      </tr>
    `).join("");

    const itemsHtml = filteredItems.map((item, i) => `
      <tr style="background-color: ${i % 2 === 0 ? "#ffffff" : "#f9fafb"}; border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 8px 10px; font-weight: bold; color: #1e3a8a;">${item.category_name}</td>
        <td style="padding: 8px 10px; font-weight: 600; color: #111827;">${item.name}</td>
        <td style="padding: 8px 10px; color: #4b5563;">${item.unit}</td>
        <td style="padding: 8px 10px; color: #4b5563;">${item.description || "—"}</td>
        <td style="padding: 8px 10px; text-align: center;">
          <span style="padding: 2px 6px; font-size: 10px; font-weight: bold; border-radius: 4px; ${item.active === 1 ? "background-color: #d1fae5; color: #065f46;" : "background-color: #fee2e2; color: #991b1b;"}">
            ${item.active === 1 ? "Active" : "Inactive"}
          </span>
        </td>
        <td style="padding: 8px 10px; text-align: center; color: #6b7280;">${item.quote_count}</td>
      </tr>
    `).join("");

    const title = "ERP Catalog Report";
    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <meta charset="utf-8" />
        <style>
          body {
            font-family: system-ui, -apple-system, sans-serif;
            color: #111827;
            margin: 20px;
            line-height: 1.4;
          }
          h1, h2 {
            margin: 0;
            color: #1e3a8a;
          }
          .header {
            border-bottom: 2px solid #1e3a8a;
            padding-bottom: 8px;
            margin-bottom: 20px;
          }
          .section {
            margin-bottom: 25px;
          }
          .section-title {
            font-size: 14px;
            font-weight: bold;
            color: #1e3a8a;
            margin-bottom: 8px;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 4px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin-top: 8px;
          }
          th {
            background-color: #f3f4f6;
            color: #374151;
            font-weight: bold;
            text-align: left;
            padding: 6px 8px;
            border-bottom: 2px solid #d1d5db;
          }
          td {
            padding: 6px 8px;
            border-bottom: 1px solid #e5e7eb;
          }
          @media print {
            body { margin: 0; padding: 10px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header" style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h1>ERP Item & Category Catalog</h1>
            <div style="font-size: 11px; color: #4b5563; margin-top: 2px;">
              Printed on ${new Date().toLocaleString()}
            </div>
          </div>
          <div class="no-print">
            <button onclick="window.print();" style="padding: 6px 12px; font-weight: bold; background-color: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
              Print Catalog
            </button>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Categories (${filteredCategories.length})</div>
          <table>
            <thead>
              <tr>
                <th style="width: 30%;">Category Name</th>
                <th style="width: 55%;">Description</th>
                <th style="width: 15%; text-align: center;">Item Count</th>
              </tr>
            </thead>
            <tbody>
              ${categoriesHtml || '<tr><td colspan="3" style="text-align: center; color: #6b7280;">No categories found</td></tr>'}
            </tbody>
          </table>
        </div>

        <div class="section">
          <div class="section-title">Items Catalog (${filteredItems.length})</div>
          <table>
            <thead>
              <tr>
                <th style="width: 20%;">Category</th>
                <th style="width: 25%;">Item Name</th>
                <th style="width: 15%;">Trading Unit</th>
                <th style="width: 25%;">Specification / Description</th>
                <th style="width: 10%; text-align: center;">Status</th>
                <th style="width: 5%; text-align: center;">Quotes</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml || '<tr><td colspan="6" style="text-align: center; color: #6b7280;">No items found</td></tr>'}
            </tbody>
          </table>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
  };

  if (showOnly === "items") {
    return (
      <div className="page-stack">
        <section className="admin-section-grid">
          {/* Categories Panel */}
          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Master catalog</p>
                <h2>Categories</h2>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                {isReadOnly && (
                  <button
                    type="button"
                    onClick={handlePrintCatalog}
                    className="button button-secondary"
                    style={{ padding: "6px 12px", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px", height: "30px" }}
                  >
                    🖨️ Print Catalog
                  </button>
                )}
                <span className="badge badge-strong">{categories.length} groups</span>
              </div>
            </div>

            {!isReadOnly && (
              <form action={createCategoryAction} className="form-grid">
                <label className="field">
                  <span>Category Name</span>
                  <input name="name" type="text" placeholder="e.g. Pallets" required />
                </label>
                <label className="field">
                  <span>Category Description</span>
                  <input name="description" type="text" placeholder="e.g. Wooden & plastic crates" />
                </label>
                <div className="form-actions" style={{ gridColumn: "1 / -1" }}>
                  <button type="submit" className="button button-primary button-block">
                    Create new category
                  </button>
                </div>
              </form>
            )}

            {/* Category Search Filter */}
            <div style={{ marginTop: "16px" }}>
              <input
                type="text"
                className="search-input"
                style={{ width: "100%", padding: "10px 14px", fontSize: "13px" }}
                placeholder="🔍 Search categories instantly..."
                value={categoryQuery}
                onChange={(e) => setCategoryQuery(e.target.value)}
              />
            </div>

            <div className="stack-list" style={{ maxHeight: "400px", overflowY: "auto", paddingRight: "4px" }}>
              {filteredCategories.length === 0 ? (
                <p className="muted" style={{ padding: "12px", textAlign: "center" }}>No categories match search.</p>
              ) : isReadOnly ? (
                filteredCategories.map((category) => (
                  <div
                    key={category.id}
                    className="inline-editor"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 16px",
                      backgroundColor: "var(--bg-subtle)",
                      borderRadius: "8px",
                      border: "1px solid var(--border-light)",
                      marginBottom: "8px"
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: "700", color: "var(--text-primary)" }}>{category.name}</div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>{category.description || "—"}</div>
                    </div>
                    <span className="badge badge-strong" style={{ fontSize: "11px" }}>
                      {category.item_count} items
                    </span>
                  </div>
                ))
              ) : (
                filteredCategories.map((category) => (
                  <form key={category.id} action={updateCategoryAction} className="inline-editor">
                    <input type="hidden" name="id" value={category.id} />
                    <label className="field">
                      <span>Name</span>
                      <input name="name" defaultValue={category.name} required />
                    </label>
                    <label className="field">
                      <span>Description</span>
                      <input name="description" defaultValue={category.description} />
                    </label>
                    <span className="mini-stat" style={{ paddingBottom: "10px", fontSize: "11px" }}>
                      {category.item_count} items
                    </span>
                    <div className="inline-editor-actions">
                      <button type="submit" className="button button-primary" style={{ padding: "10px 16px" }}>
                        Save
                      </button>
                    </div>
                    {confirmDeleteId?.type === "category" && confirmDeleteId.id === category.id ? (
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          type="submit"
                          formAction={deleteCategoryAction}
                          className="button button-danger"
                          style={{ padding: "10px 16px" }}
                          name="id"
                          value={category.id}
                        >
                          Confirm?
                        </button>
                        <button
                          type="button"
                          className="button button-secondary"
                          style={{ padding: "10px 16px" }}
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="button button-secondary button-danger"
                        style={{ padding: "10px 16px" }}
                        onClick={() => setConfirmDeleteId({ type: "category", id: category.id })}
                      >
                        Delete
                      </button>
                    )}
                  </form>
                ))
              )}
            </div>
          </article>

          {/* Items Panel */}
          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Product master</p>
                <h2>Items</h2>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                {isReadOnly && (
                  <button
                    type="button"
                    onClick={handlePrintCatalog}
                    className="button button-secondary"
                    style={{ padding: "6px 12px", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px", height: "30px" }}
                  >
                    🖨️ Print Catalog
                  </button>
                )}
                <span className="badge badge-strong">{items.length} items</span>
              </div>
            </div>

            {!isReadOnly && (
              <form action={createItemAction} className="form-grid compact-form">
                <label className="field">
                  <span>Category</span>
                  <select name="categoryId" defaultValue="" required>
                    <option value="" disabled>
                      Select category
                    </option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Item Name</span>
                  <input name="name" type="text" placeholder="Item name" required />
                </label>
                <label className="field">
                  <span>Trading Unit</span>
                  <input name="unit" type="text" placeholder="e.g. Piece / Box / Roll" required />
                </label>
                <label className="field field-wide">
                  <span>Specification description</span>
                  <input name="description" type="text" placeholder="Item description" />
                </label>
                <div className="form-actions" style={{ gridColumn: "1 / -1" }}>
                  <button type="submit" className="button button-primary button-block">
                    Create new product item
                  </button>
                </div>
              </form>
            )}

            {/* Advanced Items Multi-Filter Search */}
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "10px", marginTop: "16px" }}>
              <input
                type="text"
                className="search-input"
                style={{ padding: "10px 14px", fontSize: "13px" }}
                placeholder="🔍 Filter items by name, description, unit..."
                value={itemQuery}
                onChange={(e) => setItemQuery(e.target.value)}
              />
              <select
                className="search-input"
                style={{ padding: "10px 14px", fontSize: "13px" }}
                value={itemCategoryFilter}
                onChange={(e) => setItemCategoryFilter(e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="stack-list" style={{ maxHeight: "400px", overflowY: "auto", paddingRight: "4px" }}>
              {filteredItems.length === 0 ? (
                <p className="muted" style={{ padding: "12px", textAlign: "center" }}>No product items match filter.</p>
              ) : isReadOnly ? (
                filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className="inline-editor inline-editor-wide"
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "12px",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 16px",
                      backgroundColor: "var(--bg-subtle)",
                      borderRadius: "8px",
                      border: "1px solid var(--border-light)",
                      marginBottom: "8px"
                    }}
                  >
                    <div style={{ flex: 1, minWidth: "200px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "var(--primary)" }}>
                          {item.category_name}
                        </span>
                        {item.active !== 1 && (
                          <span className="badge badge-danger" style={{ fontSize: "9px", padding: "1px 6px" }}>Inactive</span>
                        )}
                      </div>
                      <div style={{ fontWeight: "800", fontSize: "14px", color: "var(--text-primary)", marginTop: "4px" }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                        {item.description || "—"}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "16px", flexShrink: 0 }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>Unit</div>
                        <div style={{ fontWeight: "700", fontSize: "13px", color: "var(--text-primary)" }}>{item.unit}</div>
                      </div>
                      <div style={{ textAlign: "right", minWidth: "70px" }}>
                        <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>Quotes</div>
                        <div style={{ fontWeight: "700", fontSize: "13px", color: "var(--text-primary)" }}>{item.quote_count} quotes</div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                filteredItems.map((item) => (
                  <form key={item.id} action={updateItemAction} className="inline-editor inline-editor-wide">
                    <input type="hidden" name="id" value={item.id} />
                    <label className="field">
                      <span>Category</span>
                      <select name="categoryId" defaultValue={item.category_id} required>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field" style={{ minWidth: "140px" }}>
                      <span>Name</span>
                      <input name="name" defaultValue={item.name} required />
                    </label>
                    <label className="field" style={{ minWidth: "70px" }}>
                      <span>Unit</span>
                      <input name="unit" defaultValue={item.unit} required />
                    </label>
                    <label className="field">
                      <span>Description</span>
                      <input name="description" defaultValue={item.description} />
                    </label>
                    <label className="checkbox-row checkbox-inline" style={{ marginTop: "24px" }}>
                      <input type="checkbox" name="active" defaultChecked={item.active === 1} />
                      <span>Active</span>
                    </label>
                    <span className="mini-stat" style={{ paddingBottom: "10px", fontSize: "11px" }}>
                      {item.quote_count} quotes
                    </span>
                    <div className="inline-editor-actions">
                      <button type="submit" className="button button-primary" style={{ padding: "10px 12px" }}>
                        Save
                      </button>
                    </div>
                    {confirmDeleteId?.type === "item" && confirmDeleteId.id === item.id ? (
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          type="submit"
                          formAction={deleteItemAction}
                          className="button button-danger"
                          style={{ padding: "10px 12px" }}
                          name="id"
                          value={item.id}
                        >
                          Confirm?
                        </button>
                        <button
                          type="button"
                          className="button button-secondary"
                          style={{ padding: "10px 12px" }}
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="button button-secondary button-danger"
                        style={{ padding: "10px 12px" }}
                        onClick={() => setConfirmDeleteId({ type: "item", id: item.id })}
                      >
                        Delete
                      </button>
                    )}
                  </form>
                ))
              )}
            </div>
          </article>
        </section>
      </div>
    );
  }

  if (showOnly === "users") {
    return (
      <div className="page-stack">
        <section className="admin-section-grid" style={{ gridTemplateColumns: "1fr" }}>
          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">User administration</p>
                <h2>Users</h2>
              </div>
              <span className="badge badge-strong">{users.length} accounts</span>
            </div>

            <form action={createUserAction} className="form-grid compact-form">
              <label className="field">
                <span>Username</span>
                <input name="username" type="text" placeholder="username" required />
              </label>
              <label className="field">
                <span>Password</span>
                <input name="password" type="text" placeholder="password" required />
              </label>
              <label className="field">
                <span>Role</span>
                <select name="role" defaultValue="WH">
                  <option value="WH">WH Purchasing</option>
                  <option value="SC">SC Manager</option>
                  <option value="SA">SA Sales</option>
                </select>
              </label>
              <label className="field field-wide">
                <span>Display Name</span>
                <input name="displayName" type="text" placeholder="Display name" required />
              </label>
              <div className="form-actions" style={{ gridColumn: "1 / -1" }}>
                <button type="submit" className="button button-primary button-block">
                  Create new user account
                </button>
              </div>
            </form>

            {/* User Search Filter */}
            <div style={{ marginTop: "16px" }}>
              <input
                type="text"
                className="search-input"
                style={{ width: "100%", padding: "10px 14px", fontSize: "13px" }}
                placeholder="🔍 Search users instantly by name, role, or username..."
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
              />
            </div>

            <div className="stack-list" style={{ maxHeight: "400px", overflowY: "auto", paddingRight: "4px" }}>
              {filteredUsers.length === 0 ? (
                <p className="muted" style={{ padding: "12px", textAlign: "center" }}>No users match search.</p>
              ) : (
                filteredUsers.map((user) => (
                  <form key={user.id} action={updateUserAction} className="inline-editor">
                    <input type="hidden" name="id" value={user.id} />
                    <label className="field">
                      <span>Username</span>
                      <input name="username" defaultValue={user.username} required />
                    </label>
                    <label className="field">
                      <span>Display name</span>
                      <input name="displayName" defaultValue={user.display_name} required />
                    </label>
                    <label className="field">
                      <span>Role</span>
                      <select name="role" defaultValue={user.role}>
                        <option value="WH">WH Purchasing</option>
                        <option value="SC">SC Manager</option>
                        <option value="SA">SA Sales</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>New Password</span>
                      <input name="password" placeholder="Keep current" type="password" />
                    </label>
                    <label className="checkbox-row checkbox-inline" style={{ marginTop: "24px" }}>
                      <input type="checkbox" name="active" defaultChecked={user.active === 1} />
                      <span>Active</span>
                    </label>
                    <div className="inline-editor-actions">
                      <button type="submit" className="button button-primary" style={{ padding: "10px 16px" }}>
                        Save
                      </button>
                    </div>
                    {confirmDeleteId?.type === "user" && confirmDeleteId.id === user.id ? (
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          type="submit"
                          formAction={deleteUserAction}
                          className="button button-danger"
                          style={{ padding: "10px 16px" }}
                          name="id"
                          value={user.id}
                        >
                          Confirm?
                        </button>
                        <button
                          type="button"
                          className="button button-secondary"
                          style={{ padding: "10px 16px" }}
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="button button-secondary button-danger"
                        style={{ padding: "10px 16px" }}
                        onClick={() => setConfirmDeleteId({ type: "user", id: user.id })}
                      >
                        Delete
                      </button>
                    )}
                  </form>
                ))
              )}
            </div>
          </article>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack">
      {/* SECTION 1: Users & Categories */}
      <section className="admin-section-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">User administration</p>
              <h2>Users</h2>
            </div>
            <span className="badge badge-strong">{users.length} accounts</span>
          </div>

          <form action={createUserAction} className="form-grid compact-form">
            <label className="field">
              <span>Username</span>
              <input name="username" type="text" placeholder="username" required />
            </label>
            <label className="field">
              <span>Password</span>
              <input name="password" type="text" placeholder="password" required />
            </label>
            <label className="field">
              <span>Role</span>
              <select name="role" defaultValue="WH">
                <option value="WH">WH Purchasing</option>
                <option value="SC">SC Manager</option>
                <option value="SA">SA Sales</option>
              </select>
            </label>
            <label className="field field-wide">
              <span>Display Name</span>
              <input name="displayName" type="text" placeholder="Display name" required />
            </label>
            <div className="form-actions" style={{ gridColumn: "1 / -1" }}>
              <button type="submit" className="button button-primary button-block">
                Create new user account
              </button>
            </div>
          </form>

          {/* User Search Filter */}
          <div style={{ marginTop: "16px" }}>
            <input
              type="text"
              className="search-input"
              style={{ width: "100%", padding: "10px 14px", fontSize: "13px" }}
              placeholder="🔍 Search users instantly by name, role, or username..."
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
            />
          </div>

          <div className="stack-list" style={{ maxHeight: "400px", overflowY: "auto", paddingRight: "4px" }}>
            {filteredUsers.length === 0 ? (
              <p className="muted" style={{ padding: "12px", textAlign: "center" }}>No users match search.</p>
            ) : (
              filteredUsers.map((user) => (
                <form key={user.id} action={updateUserAction} className="inline-editor">
                  <input type="hidden" name="id" value={user.id} />
                  <label className="field">
                    <span>Username</span>
                    <input name="username" defaultValue={user.username} required />
                  </label>
                  <label className="field">
                    <span>Display name</span>
                    <input name="displayName" defaultValue={user.display_name} required />
                  </label>
                  <label className="field">
                    <span>Role</span>
                    <select name="role" defaultValue={user.role}>
                      <option value="WH">WH Purchasing</option>
                      <option value="SC">SC Manager</option>
                      <option value="SA">SA Sales</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>New Password</span>
                    <input name="password" placeholder="Keep current" type="password" />
                  </label>
                  <label className="checkbox-row checkbox-inline" style={{ marginTop: "24px" }}>
                    <input type="checkbox" name="active" defaultChecked={user.active === 1} />
                    <span>Active</span>
                  </label>
                  <div className="inline-editor-actions">
                    <button type="submit" className="button button-primary" style={{ padding: "10px 16px" }}>
                      Save
                    </button>
                  </div>
                  {confirmDeleteId?.type === "user" && confirmDeleteId.id === user.id ? (
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="submit"
                        formAction={deleteUserAction}
                        className="button button-danger"
                        style={{ padding: "10px 16px" }}
                        name="id"
                        value={user.id}
                      >
                        Confirm?
                      </button>
                      <button
                        type="button"
                        className="button button-secondary"
                        style={{ padding: "10px 16px" }}
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="button button-secondary button-danger"
                      style={{ padding: "10px 16px" }}
                      onClick={() => setConfirmDeleteId({ type: "user", id: user.id })}
                    >
                      Delete
                    </button>
                  )}
                </form>
              ))
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Master catalog</p>
              <h2>Categories</h2>
            </div>
            <span className="badge badge-strong">{categories.length} groups</span>
          </div>

          <form action={createCategoryAction} className="form-grid">
            <label className="field">
              <span>Category Name</span>
              <input name="name" type="text" placeholder="e.g. Pallets" required />
            </label>
            <label className="field">
              <span>Category Description</span>
              <input name="description" type="text" placeholder="e.g. Wooden & plastic crates" />
            </label>
            <div className="form-actions" style={{ gridColumn: "1 / -1" }}>
              <button type="submit" className="button button-primary button-block">
                Create new category
              </button>
            </div>
          </form>

          {/* Category Search Filter */}
          <div style={{ marginTop: "16px" }}>
            <input
              type="text"
              className="search-input"
              style={{ width: "100%", padding: "10px 14px", fontSize: "13px" }}
              placeholder="🔍 Search categories instantly..."
              value={categoryQuery}
              onChange={(e) => setCategoryQuery(e.target.value)}
            />
          </div>

          <div className="stack-list" style={{ maxHeight: "400px", overflowY: "auto", paddingRight: "4px" }}>
            {filteredCategories.length === 0 ? (
              <p className="muted" style={{ padding: "12px", textAlign: "center" }}>No categories match search.</p>
            ) : (
              filteredCategories.map((category) => (
                <form key={category.id} action={updateCategoryAction} className="inline-editor">
                  <input type="hidden" name="id" value={category.id} />
                  <label className="field">
                    <span>Name</span>
                    <input name="name" defaultValue={category.name} required />
                  </label>
                  <label className="field">
                    <span>Description</span>
                    <input name="description" defaultValue={category.description} />
                  </label>
                  <span className="mini-stat" style={{ paddingBottom: "10px", fontSize: "11px" }}>
                    {category.item_count} items
                  </span>
                  <div className="inline-editor-actions">
                    <button type="submit" className="button button-primary" style={{ padding: "10px 16px" }}>
                      Save
                    </button>
                  </div>
                  {confirmDeleteId?.type === "category" && confirmDeleteId.id === category.id ? (
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="submit"
                        formAction={deleteCategoryAction}
                        className="button button-danger"
                        style={{ padding: "10px 16px" }}
                        name="id"
                        value={category.id}
                      >
                        Confirm?
                      </button>
                      <button
                        type="button"
                        className="button button-secondary"
                        style={{ padding: "10px 16px" }}
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="button button-secondary button-danger"
                      style={{ padding: "10px 16px" }}
                      onClick={() => setConfirmDeleteId({ type: "category", id: category.id })}
                    >
                      Delete
                    </button>
                  )}
                </form>
              ))
            )}
          </div>
        </article>
      </section>

      {/* SECTION 2: Suppliers & Items */}
      <section className="admin-section-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Suppliers</p>
              <h2>Supplier directory</h2>
            </div>
            <span className="badge badge-strong">{suppliers.length} active</span>
          </div>

          <form action={createSupplierAction} className="form-grid">
            <label className="field">
              <span>Supplier Name</span>
              <input name="name" type="text" placeholder="Supplier name" required />
            </label>
            <label className="field">
              <span>Contact Person</span>
              <input name="contactPerson" type="text" placeholder="Contact person" />
            </label>
            <label className="field field-wide">
              <span>Contact Phone</span>
              <input name="phone" type="text" placeholder="+20..." />
            </label>
            <div className="form-actions" style={{ gridColumn: "1 / -1" }}>
              <button type="submit" className="button button-primary button-block">
                Add new supplier
              </button>
            </div>
          </form>

          {/* Supplier Search Filter */}
          <div style={{ marginTop: "16px" }}>
            <input
              type="text"
              className="search-input"
              style={{ width: "100%", padding: "10px 14px", fontSize: "13px" }}
              placeholder="🔍 Search supplier directory..."
              value={supplierQuery}
              onChange={(e) => setSupplierQuery(e.target.value)}
            />
          </div>

          <div className="stack-list" style={{ maxHeight: "400px", overflowY: "auto", paddingRight: "4px" }}>
            {filteredSuppliers.length === 0 ? (
              <p className="muted" style={{ padding: "12px", textAlign: "center" }}>No suppliers match search.</p>
            ) : (
              filteredSuppliers.map((supplier) => (
                <form key={supplier.id} action={updateSupplierAction} className="inline-editor">
                  <input type="hidden" name="id" value={supplier.id} />
                  <label className="field">
                    <span>Name</span>
                    <input name="name" defaultValue={supplier.name} required />
                  </label>
                  <label className="field">
                    <span>Contact person</span>
                    <input name="contactPerson" defaultValue={supplier.contact_person} />
                  </label>
                  <label className="field">
                    <span>Phone</span>
                    <input name="phone" defaultValue={supplier.phone} />
                  </label>
                  <span className="mini-stat" style={{ paddingBottom: "10px", fontSize: "11px" }}>
                    {supplier.quote_count} quotes
                  </span>
                  <div className="inline-editor-actions">
                    <button type="submit" className="button button-primary" style={{ padding: "10px 16px" }}>
                      Save
                    </button>
                  </div>
                  {confirmDeleteId?.type === "supplier" && confirmDeleteId.id === supplier.id ? (
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="submit"
                        formAction={deleteSupplierAction}
                        className="button button-danger"
                        style={{ padding: "10px 16px" }}
                        name="id"
                        value={supplier.id}
                      >
                        Confirm?
                      </button>
                      <button
                        type="button"
                        className="button button-secondary"
                        style={{ padding: "10px 16px" }}
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="button button-secondary button-danger"
                      style={{ padding: "10px 16px" }}
                      onClick={() => setConfirmDeleteId({ type: "supplier", id: supplier.id })}
                    >
                      Delete
                    </button>
                  )}
                </form>
              ))
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Product master</p>
              <h2>Items</h2>
            </div>
            <span className="badge badge-strong">{items.length} items</span>
          </div>

          <form action={createItemAction} className="form-grid compact-form">
            <label className="field">
              <span>Category</span>
              <select name="categoryId" defaultValue="" required>
                <option value="" disabled>
                  Select category
                </option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Item Name</span>
              <input name="name" type="text" placeholder="Item name" required />
            </label>
            <label className="field">
              <span>Trading Unit</span>
              <input name="unit" type="text" placeholder="e.g. Piece / Box / Roll" required />
            </label>
            <label className="field field-wide">
              <span>Specification description</span>
              <input name="description" type="text" placeholder="Item description" />
            </label>
            <div className="form-actions" style={{ gridColumn: "1 / -1" }}>
              <button type="submit" className="button button-primary button-block">
                Create new product item
              </button>
            </div>
          </form>

          {/* Advanced Items Multi-Filter Search */}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "10px", marginTop: "16px" }}>
            <input
              type="text"
              className="search-input"
              style={{ padding: "10px 14px", fontSize: "13px" }}
              placeholder="🔍 Filter items by name, description, unit..."
              value={itemQuery}
              onChange={(e) => setItemQuery(e.target.value)}
            />
            <select
              className="search-input"
              style={{ padding: "10px 14px", fontSize: "13px" }}
              value={itemCategoryFilter}
              onChange={(e) => setItemCategoryFilter(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="stack-list" style={{ maxHeight: "400px", overflowY: "auto", paddingRight: "4px" }}>
            {filteredItems.length === 0 ? (
              <p className="muted" style={{ padding: "12px", textAlign: "center" }}>No product items match filter.</p>
            ) : (
              filteredItems.map((item) => (
                <form key={item.id} action={updateItemAction} className="inline-editor inline-editor-wide">
                  <input type="hidden" name="id" value={item.id} />
                  <label className="field">
                    <span>Category</span>
                    <select name="categoryId" defaultValue={item.category_id} required>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field" style={{ minWidth: "140px" }}>
                    <span>Name</span>
                    <input name="name" defaultValue={item.name} required />
                  </label>
                  <label className="field" style={{ minWidth: "70px" }}>
                    <span>Unit</span>
                    <input name="unit" defaultValue={item.unit} required />
                  </label>
                  <label className="field">
                    <span>Description</span>
                    <input name="description" defaultValue={item.description} />
                  </label>
                  <label className="checkbox-row checkbox-inline" style={{ marginTop: "24px" }}>
                    <input type="checkbox" name="active" defaultChecked={item.active === 1} />
                    <span>Active</span>
                  </label>
                  <span className="mini-stat" style={{ paddingBottom: "10px", fontSize: "11px" }}>
                    {item.quote_count} quotes
                  </span>
                  <div className="inline-editor-actions">
                    <button type="submit" className="button button-primary" style={{ padding: "10px 12px" }}>
                      Save
                    </button>
                  </div>
                  {confirmDeleteId?.type === "item" && confirmDeleteId.id === item.id ? (
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="submit"
                        formAction={deleteItemAction}
                        className="button button-danger"
                        style={{ padding: "10px 12px" }}
                        name="id"
                        value={item.id}
                      >
                        Confirm?
                      </button>
                      <button
                        type="button"
                        className="button button-secondary"
                        style={{ padding: "10px 12px" }}
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="button button-secondary button-danger"
                      style={{ padding: "10px 12px" }}
                      onClick={() => setConfirmDeleteId({ type: "item", id: item.id })}
                    >
                      Delete
                    </button>
                  )}
                </form>
              ))
            )}
          </div>
        </article>
      </section>

      {/* SECTION 3: Dangerous Zone / Database Purge */}
      <section style={{ marginTop: "24px" }}>
        <article className="panel" style={{ border: "1.5px solid rgba(239, 68, 68, 0.4)", background: "rgba(239, 68, 68, 0.02)" }}>
          <div className="panel-header" style={{ marginBottom: "16px", borderBottom: "1px solid rgba(239, 68, 68, 0.15)", paddingBottom: "12px" }}>
            <div>
              <p className="eyebrow" style={{ color: "var(--danger)" }}>Dangerous Zone</p>
              <h2 style={{ color: "var(--danger)" }}>Purge Database</h2>
            </div>
            <span className="badge badge-danger">Destructive Action</span>
          </div>
          
          <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px", lineHeight: "1.5" }}>
            This utility wipes all transactional, catalog, and pricing data from the system, including: 
            <strong> Categories, Items, Suppliers, Price Change Requests, Margin Floor Rules, Quote Entries, and Sell Price History</strong>. 
            All registered <strong>User Accounts will be preserved</strong>. This action is irreversible.
          </div>

          <form action={purgeDataAction} style={{ display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap" }}>
            <label className="field" style={{ flex: "1 1 240px", maxWidth: "320px" }}>
              <span style={{ color: "var(--danger)", fontWeight: 700 }}>Purge Protection Password</span>
              <input 
                name="password" 
                type="password" 
                placeholder="Enter password to confirm purge" 
                required 
                style={{ borderColor: "rgba(239, 68, 68, 0.3)", background: "var(--bg-elevated)" }}
              />
            </label>
            <button 
              type="submit" 
              className="button button-danger" 
              style={{ padding: "10px 20px", fontSize: "13px", height: "38px" }}
              onClick={(e) => {
                if (!confirm("WARNING: Are you absolutely sure you want to purge all pricing and catalog data? This cannot be undone!")) {
                  e.preventDefault();
                }
              }}
            >
              ☢️ Wipe All Data Except Users
            </button>
          </form>
        </article>
      </section>
    </div>
  );
}
