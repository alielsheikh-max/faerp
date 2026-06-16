const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(process.cwd(), 'data', 'faerp.sqlite');
console.log('Migrating database at:', dbPath);

if (!fs.existsSync(dbPath)) {
  console.log('Database file does not exist yet. Exiting.');
  process.exit(0);
}

const db = new Database(dbPath);

const sellingPricesCols = db.pragma('table_info(selling_prices)');
if (!sellingPricesCols.some(col => col.name === 'tier_pricing_enabled')) {
  db.exec("ALTER TABLE selling_prices ADD COLUMN tier_pricing_enabled INTEGER NOT NULL DEFAULT 0");
  console.log("Added column tier_pricing_enabled to selling_prices");
}

const historyCols = db.pragma('table_info(selling_price_history)');
if (!historyCols.some(col => col.name === 'new_tier_pricing_enabled')) {
  db.exec("ALTER TABLE selling_price_history ADD COLUMN new_tier_pricing_enabled INTEGER NOT NULL DEFAULT 0");
  console.log("Added column new_tier_pricing_enabled to selling_price_history");
}
if (!historyCols.some(col => col.name === 'prev_tier_pricing_enabled')) {
  db.exec("ALTER TABLE selling_price_history ADD COLUMN prev_tier_pricing_enabled INTEGER");
  console.log("Added column prev_tier_pricing_enabled to selling_price_history");
}

console.log('Migration complete!');
db.close();
