const Database = require("better-sqlite3");
const db = new Database("data/faerp.sqlite");

// Check tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log("Tables:", tables.map(t => t.name).join(", "));

if (!tables.find(t => t.name === "categories")) {
  console.log("DB not seeded yet — categories table missing");
  db.close();
  process.exit(0);
}

// Get pallets category
const cats = db.prepare("SELECT id, name FROM categories").all();
console.log("\nCategories:");
cats.forEach(c => console.log("  " + c.id + ": " + c.name));

// Find pallet category — actual name is بالتات (id 1)
const palletCat = cats.find(c => c.name && (
  c.name.includes("\u0628\u0627\u0644\u062a\u0627\u062a") ||
  c.name.includes("\u0637\u0628\u0644\u064a\u0627\u062a") ||
  c.name.toLowerCase().includes("pallet")
));
if (!palletCat) { console.error("No pallet category found"); db.close(); process.exit(1); }
console.log("\nPallet category ID:", palletCat.id, palletCat.name);

const palletItems = db.prepare("SELECT id, name FROM items WHERE category_id = ?").all(palletCat.id);
console.log("Items:", palletItems.length);

const upsert = db.prepare(
  "INSERT INTO item_tiers (item_id,is_tiered,tier1_max,tier1_discount,tier2_max,tier2_discount,tier3_max,tier3_discount,tier4_max,tier4_discount) " +
  "VALUES (?,1,100,0.77,200,0.83,800,0.85,0,0.89) " +
  "ON CONFLICT(item_id) DO UPDATE SET " +
  "is_tiered=1,tier1_max=100,tier1_discount=0.77," +
  "tier2_max=200,tier2_discount=0.83," +
  "tier3_max=800,tier3_discount=0.85," +
  "tier4_max=0,tier4_discount=0.89"
);

const go = db.transaction((items) => {
  for (const item of items) {
    upsert.run(item.id);
    console.log("  item " + item.id + ": " + item.name.slice(0, 45));
  }
});
go(palletItems);

const sample = db.prepare("SELECT * FROM item_tiers WHERE item_id=?").get(palletItems[0].id);
console.log("\nVerification:", JSON.stringify(sample));
db.close();
console.log("Done - " + palletItems.length + " pallet items: tiers 0.77/0.83/0.85/0.89");
