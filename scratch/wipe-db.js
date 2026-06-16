const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "..", "data", "faerp.sqlite");
console.log("Opening database at:", dbPath);
const db = new Database(dbPath);

console.log("Wiping database tables...");
db.exec(`
  DELETE FROM price_entries;
  DELETE FROM selling_prices;
  DELETE FROM selling_price_history;
  DELETE FROM margin_floors;
  DELETE FROM price_change_requests;
  DELETE FROM item_tiers;
  DELETE FROM monthly_settings;
  DELETE FROM items;
  DELETE FROM categories;
  DELETE FROM suppliers;
  DELETE FROM sqlite_sequence WHERE name IN ('categories', 'items', 'suppliers', 'price_entries', 'selling_prices', 'selling_price_history', 'margin_floors', 'price_change_requests');
`);

console.log("Wipe completed successfully (users table preserved)!");
db.close();
