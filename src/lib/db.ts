import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { currentMonth, shiftMonth } from "@/lib/format";

type Db = Database.Database;

type FilterInput = {
  month: string;
  categoryId?: number;
  itemId?: number;
  supplierIds?: number[];
};

declare global {
  var __faerpDb: Db | undefined;
}

function getDatabasePath() {
  return path.join(process.cwd(), "data", "faerp.sqlite");
}

function openDatabase() {
  const databasePath = getDatabasePath();
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new Database(databasePath);
  db.pragma("journal_mode = WAL");
  initializeSchema(db);
  migrateItemTiers(db);
  migratePriceAcknowledgments(db);
  seedDatabase(db);
  return db;
}

export function database() {
  if (!global.__faerpDb) {
    global.__faerpDb = openDatabase();
  }

  return global.__faerpDb;
}

function initializeSchema(db: Db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      unit TEXT NOT NULL,
      description TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      transportation_per_unit REAL NOT NULL DEFAULT 0.0,
      moq INTEGER NOT NULL DEFAULT 0,
      UNIQUE(category_id, name),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      contact_person TEXT,
      phone TEXT,
      code TEXT,
      contact_job_title TEXT,
      represented_products TEXT,
      email TEXT,
      region TEXT,
      address TEXT
    );

    CREATE TABLE IF NOT EXISTS supplier_categories (
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      assigned_by TEXT,
      assigned_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (supplier_id, category_id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      display_name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS price_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      supplier_id INTEGER NOT NULL,
      month TEXT NOT NULL,
      price REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'EGP',
      collected_by TEXT NOT NULL,
      collected_role TEXT NOT NULL,
      notes TEXT,
      recorded_at TEXT NOT NULL,
      actual_transport REAL,
      FOREIGN KEY (item_id) REFERENCES items(id),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    );

    CREATE TABLE IF NOT EXISTS selling_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      month TEXT NOT NULL,
      strategy TEXT NOT NULL,
      markup_type TEXT NOT NULL DEFAULT 'percent',
      buy_min REAL NOT NULL,
      buy_max REAL NOT NULL,
      buy_avg REAL NOT NULL,
      markup_min REAL NOT NULL,
      markup_max REAL NOT NULL,
      sell_min REAL NOT NULL,
      sell_max REAL NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      transportation REAL NOT NULL DEFAULT 0.0,
      other_expenses REAL NOT NULL DEFAULT 0.0,
      tier_pricing_enabled INTEGER NOT NULL DEFAULT 0,
      UNIQUE(item_id, month),
      FOREIGN KEY (item_id) REFERENCES items(id)
    );

    -- ── Improvement #2: Full price change audit trail ─────────────────────
    -- Every time a selling price is created or updated, the previous values
    -- are snapshotted here. Immutable — never updated, only inserted.
    CREATE TABLE IF NOT EXISTS selling_price_history (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id       INTEGER NOT NULL,
      month         TEXT    NOT NULL,
      -- snapshot of values BEFORE the change (null on first publish)
      prev_sell_min REAL,
      prev_sell_max REAL,
      prev_markup_min REAL,
      prev_markup_max REAL,
      prev_strategy   TEXT,
      prev_transportation REAL,
      prev_other_expenses REAL,
      -- new values being written
      new_sell_min  REAL    NOT NULL,
      new_sell_max  REAL    NOT NULL,
      new_markup_min REAL   NOT NULL,
      new_markup_max REAL   NOT NULL,
      new_strategy  TEXT    NOT NULL,
      new_markup_type TEXT  NOT NULL,
      new_buy_avg   REAL    NOT NULL,
      new_transportation REAL NOT NULL DEFAULT 0.0,
      new_other_expenses REAL NOT NULL DEFAULT 0.0,
      new_tier_pricing_enabled INTEGER NOT NULL DEFAULT 0,
      -- who / when
      changed_by    TEXT    NOT NULL,
      changed_at    TEXT    NOT NULL,
      change_reason TEXT,
      -- is this the first publish or an update?
      is_update     INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (item_id) REFERENCES items(id)
    );

    -- ── Improvement #3: Per-item and per-category margin floor enforcement ─
    -- floor_type: 'item' targets a specific item_id,
    --             'category' targets all items in category_id
    -- min_markup_pct: minimum allowed markup percentage (e.g. 5.0 = 5%)
    -- Precedence: item-level floor overrides category-level floor
    CREATE TABLE IF NOT EXISTS margin_floors (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      floor_type     TEXT    NOT NULL CHECK(floor_type IN ('item','category')),
      item_id        INTEGER,
      category_id    INTEGER,
      min_markup_pct REAL    NOT NULL DEFAULT 5.0,
      set_by         TEXT    NOT NULL,
      set_at         TEXT    NOT NULL,
      notes          TEXT,
      FOREIGN KEY (item_id)     REFERENCES items(id),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );
    -- ── Price change request workflow (Task 2) ──────────────────────────────
    -- When WH wants to update an already-confirmed price entry (for a month where
    -- SC has already seen the price), the new price goes into this table as PENDING.
    -- SC can approve (write it into price_entries) or reject it.
    -- status: 'pending' | 'approved' | 'rejected'
    CREATE TABLE IF NOT EXISTS price_change_requests (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id         INTEGER NOT NULL,
      supplier_id     INTEGER NOT NULL,
      month           TEXT    NOT NULL,
      old_price       REAL    NOT NULL,
      new_price       REAL    NOT NULL,
      reason          TEXT    NOT NULL,
      requested_by    TEXT    NOT NULL,
      requested_at    TEXT    NOT NULL,
      status          TEXT    NOT NULL DEFAULT 'pending'
                      CHECK(status IN ('pending','approved','rejected')),
      reviewed_by     TEXT,
      reviewed_at     TEXT,
      review_note     TEXT,
      FOREIGN KEY (item_id)    REFERENCES items(id),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    );
  `);

  // Safe migrations for columns added after initial release
  const migrations = [
    "ALTER TABLE selling_prices ADD COLUMN markup_type TEXT NOT NULL DEFAULT 'percent'",
    "ALTER TABLE selling_prices ADD COLUMN transportation REAL NOT NULL DEFAULT 0.0",
    "ALTER TABLE selling_prices ADD COLUMN other_expenses REAL NOT NULL DEFAULT 0.0",
    "ALTER TABLE selling_price_history ADD COLUMN new_transportation REAL NOT NULL DEFAULT 0.0",
    "ALTER TABLE selling_price_history ADD COLUMN new_other_expenses REAL NOT NULL DEFAULT 0.0",
    "ALTER TABLE selling_price_history ADD COLUMN prev_transportation REAL",
    "ALTER TABLE selling_price_history ADD COLUMN prev_other_expenses REAL",
    "ALTER TABLE selling_prices ADD COLUMN tier_pricing_enabled INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE selling_price_history ADD COLUMN new_tier_pricing_enabled INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE selling_price_history ADD COLUMN prev_tier_pricing_enabled INTEGER",
    "ALTER TABLE selling_price_history ADD COLUMN new_transport_override_enabled INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE selling_price_history ADD COLUMN new_transport_override_amount REAL NOT NULL DEFAULT 0",
    "ALTER TABLE suppliers ADD COLUMN code TEXT",
    "ALTER TABLE suppliers ADD COLUMN contact_job_title TEXT",
    "ALTER TABLE suppliers ADD COLUMN represented_products TEXT",
    "ALTER TABLE suppliers ADD COLUMN email TEXT",
    "ALTER TABLE suppliers ADD COLUMN region TEXT",
    "ALTER TABLE suppliers ADD COLUMN address TEXT",
    "ALTER TABLE suppliers ADD COLUMN fame_name TEXT",
    // T5: per-month transport override by SC
    "ALTER TABLE selling_prices ADD COLUMN transport_override_enabled INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE selling_prices ADD COLUMN transport_override_amount REAL NOT NULL DEFAULT 0.0",
    // T17: two note fields — internal (SC-only) and SA notification
    "ALTER TABLE selling_prices ADD COLUMN internal_note TEXT",
    "ALTER TABLE selling_prices ADD COLUMN sa_note TEXT",
    "ALTER TABLE selling_price_history ADD COLUMN internal_note TEXT",
    "ALTER TABLE selling_price_history ADD COLUMN sa_note TEXT",
    // T25: WH can record actual transportation cost per price entry
    "ALTER TABLE price_entries ADD COLUMN actual_transport REAL",
    // T26: Admin can allow SC to override transportation per item/month
    "ALTER TABLE monthly_settings ADD COLUMN sc_transport_override_enabled INTEGER NOT NULL DEFAULT 0",
    // T27: Support transport revision in price change requests
    "ALTER TABLE price_change_requests ADD COLUMN old_transport REAL",
    "ALTER TABLE price_change_requests ADD COLUMN new_transport REAL",
    "ALTER TABLE price_entries ADD COLUMN negotiated_price REAL",
    "ALTER TABLE price_entries ADD COLUMN negotiated_notes TEXT",
    "ALTER TABLE price_entries ADD COLUMN status TEXT NOT NULL DEFAULT 'approved' CHECK(status IN ('pending','approved','rejected'))",
    "ALTER TABLE price_entries ADD COLUMN review_note TEXT",
    "ALTER TABLE price_entries ADD COLUMN reviewed_by TEXT",
    "ALTER TABLE price_entries ADD COLUMN reviewed_at TEXT",
    "ALTER TABLE price_entries ADD COLUMN read_by_wh INTEGER NOT NULL DEFAULT 0",
    // Custom volume tier overrides
    "ALTER TABLE selling_prices ADD COLUMN tier1_max INTEGER",
    "ALTER TABLE selling_prices ADD COLUMN tier1_discount REAL",
    "ALTER TABLE selling_prices ADD COLUMN tier2_max INTEGER",
    "ALTER TABLE selling_prices ADD COLUMN tier2_discount REAL",
    "ALTER TABLE selling_prices ADD COLUMN tier3_max INTEGER",
    "ALTER TABLE selling_prices ADD COLUMN tier3_discount REAL",
    "ALTER TABLE selling_prices ADD COLUMN tier4_max INTEGER",
    "ALTER TABLE selling_prices ADD COLUMN tier4_discount REAL",
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch (_) { /* column already exists */ }
  }

  // Auto-populate fame_name for any supplier that doesn't have one yet
  function autoFameName(name: string): string {
    const dashIdx = name.lastIndexOf(" - ");
    if (dashIdx !== -1) {
      const afterDash = name.substring(dashIdx + 3).trim();
      if (afterDash.length > 0 && afterDash.length <= 25) return afterDash;
    }
    if (name.length <= 20) return name;
    const words = name.split(/\s+/).filter(Boolean);
    return words.slice(0, 2).join(" ");
  }
  const suppliersNoFame = db.prepare(
    "SELECT id, name FROM suppliers WHERE fame_name IS NULL OR TRIM(fame_name) = ''"
  ).all() as Array<{ id: number; name: string }>;
  const setFame = db.prepare("UPDATE suppliers SET fame_name = ? WHERE id = ?");
  for (const s of suppliersNoFame) setFame.run(autoFameName(s.name), s.id);

  // Safe table migrations — CREATE IF NOT EXISTS is idempotent; safe to run every startup
  db.exec(`
    CREATE TABLE IF NOT EXISTS selling_price_history (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id         INTEGER NOT NULL,
      month           TEXT    NOT NULL,
      prev_sell_min   REAL,
      prev_sell_max   REAL,
      prev_markup_min REAL,
      prev_markup_max REAL,
      prev_strategy   TEXT,
      new_sell_min    REAL    NOT NULL,
      new_sell_max    REAL    NOT NULL,
      new_markup_min  REAL    NOT NULL,
      new_markup_max  REAL    NOT NULL,
      new_strategy    TEXT    NOT NULL,
      new_markup_type TEXT    NOT NULL,
      new_buy_avg     REAL    NOT NULL,
      changed_by      TEXT    NOT NULL,
      changed_at      TEXT    NOT NULL,
      change_reason   TEXT,
      is_update       INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (item_id) REFERENCES items(id)
    );

    CREATE TABLE IF NOT EXISTS margin_floors (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      floor_type     TEXT    NOT NULL CHECK(floor_type IN ('item','category')),
      item_id        INTEGER,
      category_id    INTEGER,
      min_markup_pct REAL    NOT NULL DEFAULT 5.0,
      set_by         TEXT    NOT NULL,
      set_at         TEXT    NOT NULL,
      notes          TEXT,
      FOREIGN KEY (item_id)     REFERENCES items(id),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS price_change_requests (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id         INTEGER NOT NULL,
      supplier_id     INTEGER NOT NULL,
      month           TEXT    NOT NULL,
      old_price       REAL    NOT NULL,
      new_price       REAL    NOT NULL,
      reason          TEXT    NOT NULL,
      requested_by    TEXT    NOT NULL,
      requested_at    TEXT    NOT NULL,
      status          TEXT    NOT NULL DEFAULT 'pending'
                      CHECK(status IN ('pending','approved','rejected')),
      reviewed_by     TEXT,
      reviewed_at     TEXT,
      review_note     TEXT,
      FOREIGN KEY (item_id)     REFERENCES items(id),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    );

    CREATE TABLE IF NOT EXISTS monthly_settings (
      month TEXT PRIMARY KEY,
      tier_pricing_enabled INTEGER NOT NULL DEFAULT 0,
      sc_transport_override_enabled INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS item_tiers (
      item_id INTEGER PRIMARY KEY,
      is_tiered INTEGER NOT NULL DEFAULT 0,
      tier1_max INTEGER NOT NULL DEFAULT 100,
      tier1_discount REAL NOT NULL DEFAULT 0.0,
      tier2_max INTEGER NOT NULL DEFAULT 200,
      tier2_discount REAL NOT NULL DEFAULT 5.0,
      tier3_max INTEGER NOT NULL DEFAULT 300,
      tier3_discount REAL NOT NULL DEFAULT 10.0,
      tier4_max INTEGER NOT NULL DEFAULT 0,
      tier4_discount REAL NOT NULL DEFAULT 0.0,
      FOREIGN KEY (item_id) REFERENCES items(id)
    );

    CREATE TABLE IF NOT EXISTS exchange_rates (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      currency   TEXT    NOT NULL,
      rate       REAL    NOT NULL,
      source     TEXT,
      fetched_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- T18: SA acknowledges price changes — SC gets notified
    CREATE TABLE IF NOT EXISTS price_acknowledgments (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      history_id     INTEGER NOT NULL,
      acknowledged_by TEXT   NOT NULL,
      acknowledged_at TEXT   NOT NULL DEFAULT (datetime('now')),
      read_by_sc     INTEGER NOT NULL DEFAULT 0,
      UNIQUE(history_id),
      FOREIGN KEY (history_id) REFERENCES selling_price_history(id)
    );

    -- Activity / Audit Log — captures main business events
    CREATE TABLE IF NOT EXISTS activity_log (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      actor        TEXT NOT NULL,    -- username of the person
      role         TEXT NOT NULL,    -- WH | SC | SA | AD | system
      event_type   TEXT NOT NULL,    -- snake_case event key
      summary      TEXT NOT NULL,    -- human-readable one-liner
      detail       TEXT,             -- JSON blob (item name, price, month, etc.)
      performed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

// ── Migrate existing item_tiers table to add tier3_max / tier4 columns ──────
function migrateItemTiers(db: Db) {
  const cols = (db.prepare("PRAGMA table_info(item_tiers)").all() as Array<{ name: string }>)
    .map((c) => c.name);
  if (!cols.includes("tier3_max"))
    db.prepare("ALTER TABLE item_tiers ADD COLUMN tier3_max INTEGER NOT NULL DEFAULT 300").run();
  if (!cols.includes("tier4_max"))
    db.prepare("ALTER TABLE item_tiers ADD COLUMN tier4_max INTEGER NOT NULL DEFAULT 0").run();
  if (!cols.includes("tier4_discount"))
    db.prepare("ALTER TABLE item_tiers ADD COLUMN tier4_discount REAL NOT NULL DEFAULT 0.0").run();
}

function migratePriceAcknowledgments(db: Db) {
  const cols = (db.prepare("PRAGMA table_info(price_acknowledgments)").all() as Array<{ name: string }>)
    .map((c) => c.name);
  if (!cols.includes("read_by_sc")) {
    db.prepare("ALTER TABLE price_acknowledgments ADD COLUMN read_by_sc INTEGER NOT NULL DEFAULT 0").run();
  }
}

function seedDatabase(db: Db) {
  const checkItem = db.prepare("SELECT name FROM items LIMIT 1").get() as { name: string } | undefined;
  
  if (checkItem && !checkItem.name.match(/[\u0600-\u06FF]/)) {
    // Drop existing data in FK-safe order (children before parents) to allow
    // a clean migration to the Arabic seed dataset
    db.exec(`
      DELETE FROM price_change_requests;
      DELETE FROM selling_price_history;
      DELETE FROM selling_prices;
      DELETE FROM price_entries;
      DELETE FROM item_tiers;
      DELETE FROM margin_floors;
      DELETE FROM monthly_settings;
      DELETE FROM items;
      DELETE FROM categories;
      DELETE FROM suppliers;
      DELETE FROM sqlite_sequence WHERE name IN (
        'categories', 'items', 'suppliers',
        'price_entries', 'selling_prices', 'selling_price_history',
        'price_change_requests', 'item_tiers', 'margin_floors'
      );
    `);
  }

  const categoryCount = db.prepare("SELECT COUNT(*) as count FROM categories").get() as { count: number };
  const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };

  const insertCategory = db.prepare("INSERT INTO categories (name, description) VALUES (@name, @description)");
  const insertItem = db.prepare(
    "INSERT INTO items (category_id, name, unit, description) VALUES (@category_id, @name, @unit, @description)"
  );
  const insertSupplier = db.prepare(
    "INSERT INTO suppliers (name, contact_person, phone) VALUES (@name, @contact_person, @phone)"
  );
  const insertUser = db.prepare(
    "INSERT INTO users (username, password, role, display_name, active) VALUES (@username, @password, @role, @display_name, 1)"
  );
  const insertPrice = db.prepare(`
    INSERT INTO price_entries (
      item_id, supplier_id, month, price, currency, collected_by, collected_role, notes, recorded_at, status
    ) VALUES (
      @item_id, @supplier_id, @month, @price, @currency, @collected_by, @collected_role, @notes, @recorded_at, 'approved'
    )
  `);
  const insertSelling = db.prepare(`
    INSERT INTO selling_prices (
      item_id, month, strategy, buy_min, buy_max, buy_avg, markup_min, markup_max, sell_min, sell_max, created_by, created_at
    ) VALUES (
      @item_id, @month, @strategy, @buy_min, @buy_max, @buy_avg, @markup_min, @markup_max, @sell_min, @sell_max, @created_by, @created_at
    )
  `);

  const users = [
    { username: "wh", password: "wh123", role: "WH", display_name: "WH Purchasing" },
    { username: "sc", password: "sc123", role: "SC", display_name: "SC Manager" },
    { username: "sa", password: "sa123", role: "SA", display_name: "SA Sales" },
    { username: "admin", password: "admin123", role: "AD", display_name: "System Admin" }
  ];

  if (userCount.count === 0) {
    users.forEach((user) => insertUser.run(user));
  } else {
    // If users already seeded, ensure admin user exists
    const adminExists = db.prepare("SELECT COUNT(*) as count FROM users WHERE username = 'admin'").get() as { count: number };
    if (adminExists.count === 0) {
      insertUser.run({ username: "admin", password: "admin123", role: "AD", display_name: "System Admin" });
    }
  }

  // We no longer seed mock categories, items, suppliers, or price entries
  return;

  const categories = [
    { name: "بالتات (طبليات)", description: "بالتات خشبية، بلاستيكية، ومعدنية بمختلف المقاسات والحمولات والألوان." },
    { name: "صناديق كرتونية وبلاستيكية", description: "صناديق كرتون مموج للتعبئة وصناديق بلاستيكية للتخزين بأحجام متعددة." },
    { name: "أقفاص وحاويات شحن", description: "أقفاص خشبية وبلاستيكية مهواة ومغلقة لنقل المنتجات الزراعية والصناعية." }
  ];

  categories.forEach((category) => insertCategory.run(category));

  const categoryIds = db
    .prepare("SELECT id, name FROM categories ORDER BY id")
    .all() as Array<{ id: number; name: string }>;

  const categoryMap = Object.fromEntries(categoryIds.map((category) => [category.name, category.id]));

  const items = [
    // PALLETS (12 Items)
    { category_id: categoryMap["بالتات (طبليات)"], name: "بالتة خشبية يورو قياسية (١٢٠٠×٨٠٠ مم) - بني - خشب طبيعي معالج", unit: "قطعة", description: "طبلية خشبية معالجة حرارياً عالية الجودة للتصدير والشحن الدولي." },
    { category_id: categoryMap["بالتات (طبليات)"], name: "بالتة بلاستيكية للحمولات الثقيلة (١٢٠٠×١٠٠٠ مم) - أزرق - بولي إيثيلين", unit: "قطعة", description: "طبلية بلاستيكية صناعية متينة حمولة ثقيلة قابلة للغسيل والتعقيم." },
    { category_id: categoryMap["بالتات (طبليات)"], name: "بالتة بلاستيكية خفيفة للتصدير (١٢٠٠×٨٠٠ مم) - أسود معاد تدويره", unit: "قطعة", description: "طبلية بلاستيكية خفيفة الوزن وموفرة للمساحة مثالية للشحنات ذات الاتجاه الواحد." },
    { category_id: categoryMap["بالتات (طبليات)"], name: "بالتة خشبية كتلة معالجة IPPC للتصدير - خشب صنوبر معقم", unit: "قطعة", description: "طبلية خشبية معقمة ومختومة بشعار سلامة النباتات الدولي لشحن البضائع خارج الدولة." },
    { category_id: categoryMap["بالتات (طبليات)"], name: "بالتة خشبية مزدوجة الوجه قابلة للانعكاس - خشب طبيعي سميك", unit: "قطعة", description: "طبلية ذات وجهين متطابقين علوي وسفلي لزيادة متانة التحميل والتوزيع المتوازن." },
    { category_id: categoryMap["بالتات (طبليات)"], name: "بالتة كرتونية مموجة خفيفة الوزن (١٢٠٠×١٠٠٠ مم) - كرتون مقوى معاد تدويره", unit: "قطعة", description: "طبلية صديقة للبيئة وخفيفة جداً ومناسبة للشحن الجوي السريع." },
    { category_id: categoryMap["بالتات (طبليات)"], name: "بالتة معدنية فولاذية مجلفنة للحمولات الفائقة - فضي مقاوم للصدأ", unit: "قطعة", description: "طبلية حديد فولاذ مجلفن مضاد للرطوبة والحرائق مخصصة للمصانع والرفوف المرتفعة." },
    { category_id: categoryMap["بالتات (طبليات)"], name: "بالتة يورو نصف حجم (٨٠٠×٦٠٠ مم) - خشب صنوبر للعرض بالتجزئة", unit: "قطعة", description: "طبلية عرض مدمجة الحجم تستخدم لعرض المنتجات مباشرة في صالات البيع والتجزئة." },
    { category_id: categoryMap["بالتات (طبليات)"], name: "قاعدة خشبية مخصصة للآلات الثقيلة (سكيد) - خشب زان مقوى للمصانع", unit: "قطعة", description: "قاعدة خشبية متينة للغاية بدون عوارض سفلية مصممة خصيصاً لدعم الآلات الكبيرة." },
    { category_id: categoryMap["بالتات (طبليات)"], name: "بالتة بلاستيكية قابلة للتداخل لتوفير المساحة - أسود معاد تدويره", unit: "قطعة", description: "طبلية بلاستيكية خفيفة تتداخل داخل بعضها لتوفير ٦٠٪ من مساحة التخزين والشحن الفارغ." },
    { category_id: categoryMap["بالتات (طبليات)"], name: "بالتة خشبية إطار محيطي كامل (٥ عوارض سفلية) - خشب طبيعي", unit: "قطعة", description: "طبلية خشبية ذات قاعدة دائرية محيطية كاملة لتسهيل حركة الرافعات الشوكية في كل الاتجاهات." },
    { category_id: categoryMap["بالتات (طبليات)"], name: "بالتة مضغوطة ألياف خشبية جاهزة للتصدير (Nest) - بني فاتح", unit: "قطعة", description: "طبلية مصنوعة من نشارة الخشب المضغوطة تحت حرارة عالية، معفاة من معالجة التصدير الدولية." },

    // BOXES (12 Items)
    { category_id: categoryMap["صناديق كرتونية وبلاستيكية"], name: "صندوق كرتون جدار مزدوج مقوى كبير (٦٠×٤٠×٤٠ سم) - بني للتعبئة", unit: "ربطة من ١٠ قطع", description: "صناديق كرتون مموج ثنائي الطبقات للشحن والتخزين الثقيل والمنزلي." },
    { category_id: categoryMap["صناديق كرتونية وبلاستيكية"], name: "صندوق كرتون جدار فردي قياسي متوسط (٤٠×٣٠×٣٠ سم) - بني خفيف", unit: "ربطة من ٢٥ قطعة", description: "صناديق كرتون مموجة أحادية الطبقة مناسبة للمنتجات خفيفة الوزن والشحن البري." },
    { category_id: categoryMap["صناديق كرتونية وبلاستيكية"], name: "صندوق تخزين بلاستيكي صناعي مع غطاء متصل (٦٠ لتر) - أزرق غامق", unit: "قطعة", description: "صندوق تخزين بلاستيكي صلب ومحكم الإغلاق قابل للتكديس لحفظ المواد والأدوات." },
    { category_id: categoryMap["صناديق كرتونية وبلاستيكية"], name: "صندوق كرتون خزانة الملابس مع قضيب تعليق معدني - بني للشحن", unit: "قطعة", description: "صندوق كرتوني طويل ومقوى مع قضيب حديدي لتعليق الملابس وشحنها دون تجعد." },
    { category_id: categoryMap["صناديق كرتونية وبلاستيكية"], name: "صندوق بلاستيكي مضاد للكهرباء الساكنة ESD للإلكترونيات - أسود غير لامع", unit: "قطعة", description: "حاوية تخزين واقية من الشحنات الاستاتيكية لحماية الدوائر والقطع الإلكترونية الحساسة." },
    { category_id: categoryMap["صناديق كرتونية وبلاستيكية"], name: "صندوق فوم عازل للحرارة مع غطاء للمأكولات والأدوية - أبيض سميك", unit: "قطعة", description: "صندوق من الفلين عالي الكثافة لحفظ درجات الحرارة للمأكولات البحرية والأدوية الحساسة." },
    { category_id: categoryMap["صناديق كرتونية وبلاستيكية"], name: "علبة كرتون مسطحة للبيتزا والمخبوزات مقاس ١٢ بوصة - أبيض مقوى", unit: "ربطة من ٥٠ قطعة", description: "علب كرتون دائرية مقواة وصديقة للبيئة مخصصة لتوصيل البيتزا والمخبوزات الساخنة." },
    { category_id: categoryMap["صناديق كرتونية وبلاستيكية"], name: "صندوق حفظ الأرشيف والمستندات مع مقابض حمل - كرتون أبيض مطبوع", unit: "ربطة من ١٠ قطع", description: "صندوق كرتوني للتخزين المكتبي وحفظ المستندات والملفات الورقية وتصنيفها." },
    { category_id: categoryMap["صناديق كرتونية وبلاستيكية"], name: "صندوق هدايا خشبي مصقول بغطاء منزلق - خشب صنوبر طبيعي ممتاز", unit: "قطعة", description: "علبة خشبية فاخرة ومصقولة مناسبة لعلب التقديم والهدايا والتغليف الراقي." },
    { category_id: categoryMap["صناديق كرتونية وبلاستيكية"], name: "صندوق بريدي كرتوني ذاتي القفل وسهل الطي - بني لشحن البريد", unit: "ربطة من ٥٠ قطعة", description: "كرتون شحن مخصص لشركات التجارة الإلكترونية، يغلق ذاتياً بدون الحاجة لشريط لاصق." },
    { category_id: categoryMap["صناديق كرتونية وبلاستيكية"], name: "علبة عرض كرتونية شفافة للتجزئة - بلاستيك PVC مقوى ومقاوم للخدش", unit: "ربطة من ١٠٠ قطعة", description: "علبة بلاستيكية شفافة تماماً لعرض المنتجات التجميلية والهدايا الفاخرة على الرفوف." },
    { category_id: categoryMap["صناديق كرتونية وبلاستيكية"], name: "صندوق عدة معدني فولاذي كبير مع قفل أمان ومقبض - أحمر لامع", unit: "قطعة", description: "صندوق معدني صلب لتخزين وتنظيم الأدوات والعدد اليدوية والآلية للمهندسين والفنيين." },

    // CRATES (12 Items)
    { category_id: categoryMap["أقفاص وحاويات شحن"], name: "قفص بلاستيكي قابل للطي لتوفير مساحة الشحن - رمادي غامق", unit: "قطعة", description: "قفص بلاستيكي موفر للمساحة يطوى بالكامل عند عدم الاستخدام لتسهيل عملية الإرجاع والتخزين." },
    { category_id: categoryMap["أقفاص وحاويات شحن"], name: "قفص بلاستيكي مهيأ للمحاصيل الزراعية والفواكه - أخضر مهوى", unit: "قطعة", description: "صندوق جني الفواكه والخضروات مزود بفتحات تهوية للحفاظ على نضارة المحاصيل أثناء النقل." },
    { category_id: categoryMap["أقفاص وحاويات شحن"], name: "قفص شحن خشبي مغلق بالكامل للتصدير - خشب صنوبر طبيعي متين", unit: "قطعة", description: "قفص خشبي مقوى بجدران مغلقة بالكامل لحماية المعدات الحساسة والبضائع من الأتربة والرطوبة." },
    { category_id: categoryMap["أقفاص وحاويات شحن"], name: "قفص بلاستيكي جدار صلب للحمولات الصناعية - أزرق داكن متين", unit: "قطعة", description: "قفص تخزين بلاستيكي صناعي ذو جدران سميكة صلبة ومغلقة لتحمل الحمولات والمواد الكيميائية." },
    { category_id: categoryMap["أقفاص وحاويات شحن"], name: "قفص بلاستيكي مقسم لزجاجات المشروبات - أحمر متين بـ ٢٤ عين", unit: "قطعة", description: "قفص شحن beverages مقسم داخلياً لحمل ٢٤ زجاجة زجاجية وتثبيتها أثناء التوزيع." },
    { category_id: categoryMap["أقفاص وحاويات شحن"], name: "قفص شبكي سلكي فولاذي مجلفن قابل للتكديس - فضي معدني مقاوم للصدأ", unit: "قطعة", description: "قفص حديدي شبكي مخصص للمخازن يسهل رؤية المحتوى ومقاوم للرطوبة والصدأ وقابل للطي." },
    { category_id: categoryMap["أقفاص وحاويات شحن"], name: "حاوية شحن سلكية معدنية قابلة للطي مع قاعدة بالتة - فضي", unit: "قطعة", description: "حاوية شبكية كبيرة الحجم مع قاعدة طبلية مدمجة لنقل البضائع السائبة في المراكز اللوجستية." },
    { category_id: categoryMap["أقفاص وحاويات شحن"], name: "قفص بلاستيكي مهيأ مع فتحات تصريف للأسماك - أبيض معقم", unit: "قطعة", description: "قفص شحن مأكولات بحرية مصمم بفتحات تصريف للمياه الناتجة عن ذوبان الثلج." },
    { category_id: categoryMap["أقفاص وحاويات شحن"], name: "قفص خشبي ضخم للآلات والمعدات الثقيلة - ألواح خشب معالجة بالحرارة", unit: "قطعة", description: "حاوية خشبية عملاقة مخصصة لتعبئة وتصدير محركات الديزل ومعدات المصانع." },
    { category_id: categoryMap["أقفاص وحاويات شحن"], name: "صينية بلاستيكية ضحلة للمخبوزات والحلويات - بيج لتوزيع المخابز", unit: "قطعة", description: "صينية بلاستيكية مسطحة خفيفة الوزن مصممة لنقل الخبز الطازج والمعجنات للمحلات بالتجزئة." },
    { category_id: categoryMap["أقفاص وحاويات شحن"], name: "حاوية بالتة خشبية مشتركة (إطار قفص مدمج) - خشب معالج للتصدير", unit: "قطعة", description: "حاوية لوجستية تجمع بين قاعدة الطبلية الخشبية وإطار القفص الجانبي المغلق لحماية مثالية." },
    { category_id: categoryMap["أقفاص وحاويات شحن"], name: "قفص بلاستيكي مقسم لقطع غيار السيارات والأجهزة - أصفر بـ ١٢ قسم", unit: "قطعة", description: "حاوية بلاستيكية مقسمة لحماية المكونات والقطع الحساسة أثناء النقل الداخلي في المصانع." }
  ];

  items.forEach((item) => insertItem.run(item));

  const suppliers = [
    { name: "أطلس للتوريدات", contact_person: "منى علي", phone: "+20-100-000-1001" },
    { name: "النيل للتجارة", contact_person: "عمر حسن", phone: "+20-100-000-1002" },
    { name: "برايم للمصادر", contact_person: "لينا عادل", phone: "+20-100-000-1003" },
    { name: "بلو ريدج كو.", contact_person: "تامر نبيل", phone: "+20-100-000-1004" }
  ];

  suppliers.forEach((supplier) => insertSupplier.run(supplier));

  const itemIds = db.prepare("SELECT id, name FROM items ORDER BY id").all() as Array<{ id: number; name: string }>;
  const supplierIds = db
    .prepare("SELECT id, name FROM suppliers ORDER BY id")
    .all() as Array<{ id: number; name: string }>;

  const activeMonth = currentMonth();
  const prevMonth1 = shiftMonth(activeMonth, -1);
  const prevMonth2 = shiftMonth(activeMonth, -2);
  const prevMonth3 = shiftMonth(activeMonth, -3);
  const months = [prevMonth3, prevMonth2, prevMonth1, activeMonth];

  // Base prices for each item index to generate consistent trends
  const basePrices = [
    // Pallets
    12.50, 15.80, 23.60, 14.20, 18.00, 7.50, 45.00, 9.80, 85.00, 16.50, 13.90, 11.20,
    // Boxes
    19.50, 11.20, 24.50, 15.00, 28.00, 6.20, 8.40, 12.80, 22.00, 9.50, 4.80, 65.00,
    // Crates
    9.20, 6.80, 32.00, 18.50, 11.50, 38.00, 55.00, 14.50, 95.00, 8.20, 48.00, 24.00
  ];

  const monthMultipliers: Record<string, number> = {
    [prevMonth3]: 0.93, // March
    [prevMonth2]: 0.96, // April
    [prevMonth1]: 0.99, // May
    [activeMonth]: 1.03  // June
  };

  // Generate around 570+ price entries!
  itemIds.forEach((item, itemIdx) => {
    const basePrice = basePrices[itemIdx % basePrices.length];
    
    months.forEach((m) => {
      const mult = monthMultipliers[m];
      
      supplierIds.forEach((supplier, sIdx) => {
        // Supplier-specific price factor (e.g. Supplier 0 is cheapest, Supplier 3 is most expensive)
        const supplierFactor = 0.96 + (sIdx * 0.03); // 0.96, 0.99, 1.02, 1.05
        
        // Random variance (+/- 2%)
        const randomVariance = 0.98 + (Math.sin(item.id + sIdx + months.indexOf(m)) * 0.02);
        
        const finalPrice = Math.round(basePrice * mult * supplierFactor * randomVariance * 100) / 100;

        insertPrice.run({
          item_id: item.id,
          supplier_id: supplier.id,
          month: m,
          price: finalPrice,
          currency: "EGP",
          collected_by: "WH Purchasing",
          collected_role: "WH",
          notes: `سعر توريد معتمد لشهر ${m}`,
          recorded_at: `${m}-05T10:00:00`
        });

        // Revision seeding for standard Euro Pallet (index 0) and Double-wall Box (index 12)
        // in May and June, showing mid-month revisions.
        if ((itemIdx === 0 || itemIdx === 12) && (m === prevMonth1 || m === activeMonth) && sIdx === 0) {
          const revisedPrice = Math.round(finalPrice * 1.05 * 100) / 100; // 5% price increase revision
          insertPrice.run({
            item_id: item.id,
            supplier_id: supplier.id,
            month: m,
            price: revisedPrice,
            currency: "EGP",
            collected_by: "WH Purchasing",
            collected_role: "WH",
            notes: "تعديل وتحديث السعر بسبب ارتفاع تكلفة المواد الخام والشحن",
            recorded_at: `${m}-18T14:30:00`
          });
        }
      });
    });
  });

  // Pre-publish some selling prices for the active month (June 2026) for the first 3 items in each category
  const activeMonthItemsToPublish = [0, 1, 2, 12, 13, 14, 24, 25, 26];
  activeMonthItemsToPublish.forEach((idx) => {
    const item = itemIds[idx];
    if (!item) return;

    const stats = db.prepare(`
      SELECT MIN(price) as min_p, MAX(price) as max_p, AVG(price) as avg_p
      FROM price_entries
      WHERE item_id = ? AND month = ?
    `).get(item.id, activeMonth) as { min_p: number; max_p: number; avg_p: number };

    if (stats.min_p) {
      insertSelling.run({
        item_id: item.id,
        month: activeMonth,
        strategy: idx % 3 === 0 ? "avg" : idx % 3 === 1 ? "min" : "max",
        buy_min: stats.min_p,
        buy_max: stats.max_p,
        buy_avg: stats.avg_p,
        markup_min: 8,
        markup_max: 15,
        sell_min: Math.round(stats.min_p * 1.08 * 100) / 100,
        sell_max: Math.round(stats.max_p * 1.15 * 100) / 100,
        created_by: "SC Manager",
        created_at: `${activeMonth}-22T09:00:00`
      });
    }
  });
}

function buildFilterSql(filters: FilterInput, options?: { includeMonth?: boolean; includeItem?: boolean }) {
  const clauses: string[] = [];
  const params: Record<string, string | number> = {};

  if (options?.includeMonth !== false) {
    clauses.push("pe.month = @month");
    params.month = filters.month;
  }

  if (filters.categoryId) {
    clauses.push("i.category_id = @categoryId");
    params.categoryId = filters.categoryId;
  }

  if (options?.includeItem !== false && filters.itemId) {
    clauses.push("pe.item_id = @itemId");
    params.itemId = filters.itemId;
  }

  if ((filters.supplierIds ?? []).length > 0) {
    const placeholders = (filters.supplierIds ?? []).map((supplierId, index) => {
      const key = `supplierId${index}`;
      params[key] = supplierId;
      return `@${key}`;
    });
    clauses.push(`pe.supplier_id IN (${placeholders.join(", ")})`);
  }

  return {
    where: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    params
  };
}

export function getCategories() {
  return database()
    .prepare("SELECT id, name, description FROM categories ORDER BY name")
    .all() as Array<{ id: number; name: string; description: string }>;
}

export function getSuppliers() {
  const db = database();
  const rows = db
    .prepare("SELECT id, name, fame_name, contact_person, phone, code, contact_job_title, represented_products, email, region, address FROM suppliers ORDER BY name")
    .all() as Array<{
      id: number; name: string; fame_name: string | null;
      contact_person: string; phone: string;
      code: string | null; contact_job_title: string | null;
      represented_products: string | null; email: string | null;
      region: string | null; address: string | null;
    }>;

  // Attach category_ids per supplier from the junction table
  const catRows = db.prepare(
    "SELECT supplier_id, category_id FROM supplier_categories"
  ).all() as Array<{ supplier_id: number; category_id: number }>;

  const catMap = new Map<number, number[]>();
  for (const r of catRows) {
    if (!catMap.has(r.supplier_id)) catMap.set(r.supplier_id, []);
    catMap.get(r.supplier_id)!.push(r.category_id);
  }

  return rows.map(s => ({ ...s, category_ids: catMap.get(s.id) ?? [] }));
}

/** Replace all category assignments for a supplier (transactional). */
export function setSupplierCategories(supplierId: number, categoryIds: number[], assignedBy: string): void {
  const db = database();
  const del = db.prepare("DELETE FROM supplier_categories WHERE supplier_id = ?");
  const ins = db.prepare(
    "INSERT OR IGNORE INTO supplier_categories (supplier_id, category_id, assigned_by) VALUES (?, ?, ?)"
  );
  db.transaction(() => {
    del.run(supplierId);
    for (const catId of categoryIds) ins.run(supplierId, catId, assignedBy);
  })();
}

export function getUsers() {
  return database()
    .prepare(`
      SELECT
        id,
        username,
        role,
        display_name,
        active
      FROM users
      ORDER BY role, username
    `)
    .all() as Array<{
      id: number;
      username: string;
      role: string;
      display_name: string;
      active: number;
    }>;
}

export function getUserByCredentials(username: string, password: string) {
  return database()
    .prepare(`
      SELECT
        id,
        username,
        role,
        display_name
      FROM users
      WHERE username = ? AND password = ? AND active = 1
    `)
    .get(username, password) as
    | {
        id: number;
        username: string;
        role: string;
        display_name: string;
      }
    | undefined;
}

/** Like getUserByCredentials but ignores the active flag — used to detect disabled-account logins. */
export function getUserByUsernameAndPassword(username: string, password: string) {
  return database()
    .prepare(`
      SELECT
        id,
        username,
        role,
        display_name,
        active
      FROM users
      WHERE username = ? AND password = ?
    `)
    .get(username, password) as
    | {
        id: number;
        username: string;
        role: string;
        display_name: string;
        active: number;
      }
    | undefined;
}

export function getUserByUsername(username: string) {
  return database()
    .prepare(`
      SELECT
        id,
        username,
        role,
        display_name
      FROM users
      WHERE username = ? AND active = 1
    `)
    .get(username) as
    | {
        id: number;
        username: string;
        role: string;
        display_name: string;
      }
    | undefined;
}

export function getItems(categoryId?: number) {
  const params: Record<string, number> = {};
  const where = categoryId ? "WHERE i.category_id = @categoryId" : "";

  if (categoryId) {
    params.categoryId = categoryId;
  }

  return database()
    .prepare(`
      SELECT
        i.id,
        i.name,
        i.unit,
        i.description,
        i.active,
        i.category_id,
        c.name as category_name,
        i.transportation_per_unit,
        i.moq,
        IFNULL(it.is_tiered, 0) as is_tiered,
        IFNULL(it.tier1_max, 100) as tier1_max,
        IFNULL(it.tier1_discount, 0.0) as tier1_discount,
        IFNULL(it.tier2_max, 200) as tier2_max,
        IFNULL(it.tier2_discount, 5.0) as tier2_discount,
        IFNULL(it.tier3_max, 300) as tier3_max,
        IFNULL(it.tier3_discount, 10.0) as tier3_discount,
        IFNULL(it.tier4_max, 0) as tier4_max,
        IFNULL(it.tier4_discount, 0.0) as tier4_discount
      FROM items i
      JOIN categories c ON c.id = i.category_id
      LEFT JOIN item_tiers it ON it.item_id = i.id
      ${where}
      ORDER BY i.active DESC, c.name, i.id
    `)
    .all(params) as Array<{
      id: number;
      name: string;
      unit: string;
      description: string;
      active: number;
      category_id: number;
      category_name: string;
      transportation_per_unit: number;
      moq: number;
      is_tiered: number;
      tier1_max: number;
      tier1_discount: number;
      tier2_max: number;
      tier2_discount: number;
      tier3_max: number;
      tier3_discount: number;
      tier4_max: number;
      tier4_discount: number;
    }>;
}

export function createUser(input: {
  username: string;
  password: string;
  role: string;
  displayName: string;
}) {
  database()
    .prepare(`
      INSERT INTO users (username, password, role, display_name, active)
      VALUES (@username, @password, @role, @display_name, 1)
    `)
    .run({
      username: input.username.toLowerCase(),
      password: input.password,
      role: input.role,
      display_name: input.displayName
    });
}

export function updateUser(input: {
  id: number;
  username: string;
  password?: string;
  role: string;
  displayName: string;
  active: boolean;
}) {
  const db = database();

  if (input.password) {
    db.prepare(`
      UPDATE users
      SET
        username = @username,
        password = @password,
        role = @role,
        display_name = @display_name,
        active = @active
      WHERE id = @id
    `).run({
      id: input.id,
      username: input.username.toLowerCase(),
      password: input.password,
      role: input.role,
      display_name: input.displayName,
      active: input.active ? 1 : 0
    });
    return;
  }

  db.prepare(`
    UPDATE users
    SET
      username = @username,
      role = @role,
      display_name = @display_name,
      active = @active
    WHERE id = @id
  `).run({
    id: input.id,
    username: input.username.toLowerCase(),
    role: input.role,
    display_name: input.displayName,
    active: input.active ? 1 : 0
  });
}

export function deleteUser(id: number) {
  database().prepare("DELETE FROM users WHERE id = ?").run(id);
}

export function createCategory(input: { name: string; description: string }) {
  database()
    .prepare("INSERT INTO categories (name, description) VALUES (@name, @description)")
    .run(input);
}

export function updateCategory(input: { id: number; name: string; description: string }) {
  database()
    .prepare("UPDATE categories SET name = @name, description = @description WHERE id = @id")
    .run(input);
}

export function deleteCategory(id: number) {
  const itemCount = database()
    .prepare("SELECT COUNT(*) as count FROM items WHERE category_id = ?")
    .get(id) as { count: number };

  if (itemCount.count > 0) {
    throw new Error("Cannot delete a category that still has items.");
  }

  database().prepare("DELETE FROM categories WHERE id = ?").run(id);
}

export function createSupplier(input: {
  name: string;
  fameName?: string;
  contactPerson: string;
  phone: string;
  code?: string;
  contactJobTitle?: string;
  representedProducts?: string;
  email?: string;
  region?: string;
  address?: string;
}) {
  database()
    .prepare(`
      INSERT INTO suppliers (
        name, fame_name, contact_person, phone, code, contact_job_title, represented_products, email, region, address
      )
      VALUES (
        @name, @fame_name, @contact_person, @phone, @code, @contact_job_title, @represented_products, @email, @region, @address
      )
    `)
    .run({
      name: input.name,
      fame_name: input.fameName || null,
      contact_person: input.contactPerson,
      phone: input.phone,
      code: input.code || null,
      contact_job_title: input.contactJobTitle || null,
      represented_products: input.representedProducts || null,
      email: input.email || null,
      region: input.region || null,
      address: input.address || null
    });
}

export function updateSupplier(input: {
  id: number;
  name: string;
  fameName?: string;
  contactPerson: string;
  phone: string;
  code?: string;
  contactJobTitle?: string;
  representedProducts?: string;
  email?: string;
  region?: string;
  address?: string;
}) {
  database()
    .prepare(`
      UPDATE suppliers
      SET
        name = @name,
        fame_name = @fame_name,
        contact_person = @contact_person,
        phone = @phone,
        code = @code,
        contact_job_title = @contact_job_title,
        represented_products = @represented_products,
        email = @email,
        region = @region,
        address = @address
      WHERE id = @id
    `)
    .run({
      id: input.id,
      name: input.name,
      fame_name: input.fameName || null,
      contact_person: input.contactPerson,
      phone: input.phone,
      code: input.code || null,
      contact_job_title: input.contactJobTitle || null,
      represented_products: input.representedProducts || null,
      email: input.email || null,
      region: input.region || null,
      address: input.address || null
    });
}

export function deleteSupplier(id: number) {
  const usage = database()
    .prepare("SELECT COUNT(*) as count FROM price_entries WHERE supplier_id = ?")
    .get(id) as { count: number };

  if (usage.count > 0) {
    throw new Error("Cannot delete a supplier that already has price history.");
  }

  database().prepare("DELETE FROM suppliers WHERE id = ?").run(id);
}

export function createItem(input: {
  categoryId: number;
  name: string;
  unit: string;
  description: string;
  transportationPerUnit: number;
  moq: number;
}) {
  database()
    .prepare(`
      INSERT INTO items (category_id, name, unit, description, active, transportation_per_unit, moq)
      VALUES (@category_id, @name, @unit, @description, 1, @transportation_per_unit, @moq)
    `)
    .run({
      category_id: input.categoryId,
      name: input.name,
      unit: input.unit,
      description: input.description,
      transportation_per_unit: input.transportationPerUnit,
      moq: input.moq
    });
}

export function updateItem(input: {
  id: number;
  categoryId: number;
  name: string;
  unit: string;
  description: string;
  active: boolean;
  transportationPerUnit: number;
  moq: number;
}) {
  database()
    .prepare(`
      UPDATE items
      SET
        category_id = @category_id,
        name = @name,
        unit = @unit,
        description = @description,
        active = @active,
        transportation_per_unit = @transportation_per_unit,
        moq = @moq
      WHERE id = @id
    `)
    .run({
      id: input.id,
      category_id: input.categoryId,
      name: input.name,
      unit: input.unit,
      description: input.description,
      active: input.active ? 1 : 0,
      transportation_per_unit: input.transportationPerUnit,
      moq: input.moq
    });
}

export function deleteItem(id: number) {
  const db = database();
  const usage = db
    .prepare(`
      SELECT
        (SELECT COUNT(*) FROM price_entries WHERE item_id = @id) +
        (SELECT COUNT(*) FROM selling_prices WHERE item_id = @id) as count
    `)
    .get({ id }) as { count: number };

  if (usage.count > 0) {
    throw new Error("Cannot delete an item with pricing history. Set it inactive instead.");
  }

  db.prepare("DELETE FROM items WHERE id = ?").run(id);
}

/** Bulk-set active flag for multiple items. */
export function bulkSetItemActive(ids: number[], active: boolean) {
  if (ids.length === 0) return;
  const db = database();
  const val = active ? 1 : 0;
  const placeholders = ids.map(() => "?").join(",");
  db.prepare(`UPDATE items SET active = ? WHERE id IN (${placeholders})`).run(val, ...ids);
}

/** Bulk-move items to a different category. */
export function bulkMoveItemCategory(ids: number[], categoryId: number) {
  if (ids.length === 0) return;
  const db = database();
  const placeholders = ids.map(() => "?").join(",");
  db.prepare(`UPDATE items SET category_id = ? WHERE id IN (${placeholders})`).run(categoryId, ...ids);
}

/** Bulk-delete items (only those with no pricing history). Returns count deleted. */
export function bulkDeleteItems(ids: number[]): { deleted: number; skipped: number } {
  const db = database();
  let deleted = 0;
  let skipped = 0;
  for (const id of ids) {
    const usage = db.prepare(`
      SELECT (SELECT COUNT(*) FROM price_entries WHERE item_id = ?) +
             (SELECT COUNT(*) FROM selling_prices WHERE item_id = ?) as count
    `).get(id, id) as { count: number };
    if (usage.count > 0) { skipped++; continue; }
    db.prepare("DELETE FROM items WHERE id = ?").run(id);
    deleted++;
  }
  return { deleted, skipped };
}

/** Bulk-delete categories (only those with no items). Returns count deleted. */
export function bulkDeleteCategories(ids: number[]): { deleted: number; skipped: number } {
  const db = database();
  let deleted = 0;
  let skipped = 0;
  for (const id of ids) {
    const usage = db.prepare("SELECT COUNT(*) as count FROM items WHERE category_id = ?").get(id) as { count: number };
    if (usage.count > 0) { skipped++; continue; }
    db.prepare("DELETE FROM categories WHERE id = ?").run(id);
    deleted++;
  }
  return { deleted, skipped };
}

export function getMonthlyMetrics(month: string) {
  const db = database();
  const quotes = db.prepare("SELECT COUNT(*) as count FROM price_entries WHERE month = ?").get(month) as { count: number };
  const suppliers = db
    .prepare("SELECT COUNT(DISTINCT supplier_id) as count FROM price_entries WHERE month = ?")
    .get(month) as { count: number };
  const products = db
    .prepare("SELECT COUNT(DISTINCT item_id) as count FROM price_entries WHERE month = ?")
    .get(month) as { count: number };
  const selling = db
    .prepare("SELECT COUNT(*) as count FROM selling_prices WHERE month = ?")
    .get(month) as { count: number };
  const lastUpdate = db
    .prepare("SELECT MAX(recorded_at) as value FROM price_entries WHERE month = ?")
    .get(month) as { value: string | null };
  const changes = db.prepare(`
    SELECT COALESCE(SUM(grouped.extra_changes), 0) as count
    FROM (
      SELECT COUNT(*) - 1 as extra_changes
      FROM price_entries
      WHERE month = ?
      GROUP BY item_id, supplier_id
      HAVING COUNT(*) > 1
    ) grouped
  `).get(month) as { count: number };

  const totalItems = db.prepare("SELECT COUNT(*) as count FROM items WHERE active = 1").get() as { count: number };

  return {
    quotes: quotes.count,
    suppliers: suppliers.count,
    products: products.count,
    selling: selling.count,
    changes: changes.count,
    lastUpdate: lastUpdate.value,
    totalItems: totalItems.count
  };
}

export function getRecentPriceEntries(limit = 10) {
  return database()
    .prepare(`
      SELECT
        pe.id,
        pe.supplier_id,
        pe.month,
        pe.price,
        pe.collected_by,
        pe.notes,
        pe.recorded_at,
        pe.negotiated_price,
        pe.negotiated_notes,
        pe.actual_transport,
        pe.status,
        pe.review_note,
        i.name as item_name,
        i.id as item_id,
        c.name as category_name,
        COALESCE(NULLIF(TRIM(s.fame_name), ''), s.name) as supplier_name,
        COALESCE(NULLIF(TRIM(s.fame_name), ''), s.name) as supplier_display_name
      FROM price_entries pe
      JOIN items i ON i.id = pe.item_id
      JOIN categories c ON c.id = i.category_id
      JOIN suppliers s ON s.id = pe.supplier_id
      ORDER BY pe.recorded_at DESC, pe.id DESC
      LIMIT ?
    `)
    .all(limit) as Array<{
      id: number;
      supplier_id: number;
      month: string;
      price: number;
      collected_by: string;
      notes: string;
      recorded_at: string;
      negotiated_price: number | null;
      negotiated_notes: string | null;
      actual_transport: number | null;
      status: string;
      review_note: string | null;
      item_name: string;
      item_id: number;
      category_name: string;
      supplier_name: string;
      supplier_display_name: string;
    }>;
}

export function updatePriceEntry(id: number, price: number, notes: string, actualTransport?: number) {
  if (actualTransport != null) {
    database()
      .prepare(`UPDATE price_entries SET price = ?, notes = ?, actual_transport = ?, recorded_at = ? WHERE id = ?`)
      .run(price, notes, actualTransport, new Date().toISOString(), id);
  } else {
    database()
      .prepare(`UPDATE price_entries SET price = ?, notes = ?, recorded_at = ? WHERE id = ?`)
      .run(price, notes, new Date().toISOString(), id);
  }
}

export function addPriceEntry(input: {
  itemId: number;
  supplierId: number;
  month: string;
  price: number;
  collectedBy: string;
  collectedRole: string;
  notes: string;
  actualTransport?: number;
}) {
  // Server-side month lock: only allow writes to the current month
  const now = currentMonth();
  if (input.month !== now) {
    throw new Error(`MONTH_LOCKED: Prices can only be added for the current month (${now}). Past months are locked.`);
  }

  database()
    .prepare(`
      INSERT INTO price_entries (
        item_id, supplier_id, month, price, currency, collected_by, collected_role, notes, recorded_at, actual_transport, status
      ) VALUES (
        @item_id, @supplier_id, @month, @price, 'EGP', @collected_by, @collected_role, @notes, @recorded_at, @actual_transport, @status
      )
    `)
    .run({
      item_id: input.itemId,
      supplier_id: input.supplierId,
      month: input.month,
      price: input.price,
      collected_by: input.collectedBy,
      collected_role: input.collectedRole,
      notes: input.notes,
      recorded_at: new Date().toISOString(),
      actual_transport: input.actualTransport ?? null,
      status: input.collectedRole === "WH" ? "pending" : "approved",
    });
}

/**
 * SC-only: extend the previous month's confirmed price for a specific item
 * into the current month. Copies the latest price_entry from prevMonth into
 * currentMonth for all suppliers that have a price in prevMonth but not yet
 * in currentMonth (or all suppliers if supplierIds is provided).
 *
 * Returns the number of entries created.
 */
export function extendPreviousMonthPrices(input: {
  itemId: number;
  supplierIds?: number[];   // if omitted, extends all suppliers that have prev-month data
  extendedBy: string;
}): number {
  const db = database();
  const curr = currentMonth();
  const prev = shiftMonth(curr, -1);

  // Get latest price per supplier for prev month
  const prevRows = db.prepare(`
    WITH ranked AS (
      SELECT
        pe.supplier_id,
        pe.price,
        ROW_NUMBER() OVER (
          PARTITION BY pe.supplier_id
          ORDER BY pe.recorded_at DESC, pe.id DESC
        ) as rn
      FROM price_entries pe
      WHERE pe.item_id = ? AND pe.month = ?
    )
    SELECT supplier_id, price FROM ranked WHERE rn = 1
  `).all(input.itemId, prev) as Array<{ supplier_id: number; price: number }>;

  if (prevRows.length === 0) {
    throw new Error("No previous month prices found to extend.");
  }

  const targets = input.supplierIds && input.supplierIds.length > 0
    ? prevRows.filter(r => input.supplierIds!.includes(r.supplier_id))
    : prevRows;

  const now = new Date().toISOString();
  let created = 0;

  const insert = db.prepare(`
    INSERT INTO price_entries
      (item_id, supplier_id, month, price, currency, collected_by, collected_role, notes, recorded_at)
    VALUES
      (?, ?, ?, ?, 'EGP', ?, 'SC', ?, ?)
  `);

  db.transaction(() => {
    for (const row of targets) {
      // Only extend if no price already exists for current month for this supplier
      const existing = db.prepare(
        "SELECT COUNT(*) as cnt FROM price_entries WHERE item_id = ? AND supplier_id = ? AND month = ?"
      ).get(input.itemId, row.supplier_id, curr) as { cnt: number };

      if (existing.cnt === 0) {
        insert.run(
          input.itemId,
          row.supplier_id,
          curr,
          row.price,
          input.extendedBy,
          `Extended from ${prev} — price unchanged (SC approved)`,
          now
        );
        created++;
      }
    }
  })();

  return created;
}

function getLatestComparisonRows(filters: FilterInput) {
  const db = database();
  const { where, params } = buildFilterSql(filters, { includeItem: false });

  const rows = db.prepare(`
    WITH ranked AS (
      SELECT
        pe.item_id,
        pe.supplier_id,
        pe.month,
        pe.price,
        pe.recorded_at,
        i.name as item_name,
        i.unit,
        c.name as category_name,
        COALESCE(NULLIF(TRIM(s.fame_name), ''), s.name) as supplier_name,
        ROW_NUMBER() OVER (
          PARTITION BY pe.item_id, pe.supplier_id, pe.month
          ORDER BY pe.recorded_at DESC, pe.id DESC
        ) as row_number
      FROM price_entries pe
      JOIN items i ON i.id = pe.item_id
      JOIN categories c ON c.id = i.category_id
      JOIN suppliers s ON s.id = pe.supplier_id
      ${where}
    )
    SELECT
      item_id,
      supplier_id,
      month,
      price,
      recorded_at,
      item_name,
      unit,
      category_name,
      supplier_name
    FROM ranked
    WHERE row_number = 1
    ORDER BY category_name, item_name, supplier_name
  `).all(params) as Array<{
    item_id: number;
    supplier_id: number;
    month: string;
    price: number;
    recorded_at: string;
    item_name: string;
    unit: string;
    category_name: string;
    supplier_name: string;
  }>;

  const grouped = new Map<number, {
    itemId: number;
    itemName: string;
    unit: string;
    categoryName: string;
    quotes: Record<string, { price: number; recordedAt: string; supplierName: string }>;
  }>();

  rows.forEach((row) => {
    if (!grouped.has(row.item_id)) {
      grouped.set(row.item_id, {
        itemId: row.item_id,
        itemName: row.item_name,
        unit: row.unit,
        categoryName: row.category_name,
        quotes: {}
      });
    }

    grouped.get(row.item_id)!.quotes[String(row.supplier_id)] = {
      price: row.price,
      recordedAt: row.recorded_at,
      supplierName: row.supplier_name
    };
  });

  return Array.from(grouped.values());
}

function getHistoryRows(filters: FilterInput) {
  if (!filters.itemId) {
    return [];
  }

  const db = database();
  const { where, params } = buildFilterSql(filters, { includeMonth: false });

  return db.prepare(`
    SELECT
      pe.month,
      pe.price,
      pe.recorded_at,
      COALESCE(NULLIF(TRIM(s.fame_name), ''), s.name) as supplier_name
    FROM price_entries pe
    JOIN items i ON i.id = pe.item_id
    JOIN suppliers s ON s.id = pe.supplier_id
    ${where}
    ORDER BY pe.month DESC, s.name, pe.recorded_at DESC, pe.id DESC
    LIMIT 36
  `).all(params) as Array<{
    month: string;
    price: number;
    recorded_at: string;
    supplier_name: string;
  }>;
}

function getVolatilityRows(filters: FilterInput) {
  const db = database();
  const { where, params } = buildFilterSql(filters, { includeItem: false });

  return db.prepare(`
    SELECT
      pe.item_id as item_id,
      pe.supplier_id as supplier_id,
      i.name as item_name,
      s.name as supplier_name,
      COUNT(*) as updates,
      MIN(pe.price) as low_price,
      MAX(pe.price) as high_price,
      MAX(pe.recorded_at) as last_change
    FROM price_entries pe
    JOIN items i ON i.id = pe.item_id
    JOIN suppliers s ON s.id = pe.supplier_id
    ${where}
    GROUP BY pe.item_id, pe.supplier_id, pe.month
    HAVING COUNT(*) > 1
    ORDER BY updates DESC, (MAX(pe.price) - MIN(pe.price)) DESC, item_name, supplier_name
  `).all(params) as Array<{
    item_id: number;
    supplier_id: number;
    item_name: string;
    supplier_name: string;
    updates: number;
    low_price: number;
    high_price: number;
    last_change: string;
  }>;
}

export function getRecommendation(month: string, itemId: number) {
  const db = database();

  const stats = db.prepare(`
    WITH ranked AS (
      SELECT
        pe.supplier_id,
        pe.price,
        ROW_NUMBER() OVER (
          PARTITION BY pe.supplier_id, pe.item_id, pe.month
          ORDER BY pe.recorded_at DESC, pe.id DESC
        ) as row_number
      FROM price_entries pe
      WHERE pe.month = ? AND pe.item_id = ?
    )
    SELECT
      COUNT(*) as quotes,
      MIN(price) as buy_min,
      MAX(price) as buy_max,
      AVG(price) as buy_avg
    FROM ranked
    WHERE row_number = 1
  `).get(month, itemId) as {
    quotes: number;
    buy_min: number | null;
    buy_max: number | null;
    buy_avg: number | null;
  };

  const existing = db.prepare(`
    SELECT
      strategy,
      markup_type,
      buy_min,
      buy_max,
      buy_avg,
      markup_min,
      markup_max,
      sell_min,
      sell_max,
      created_by,
      created_at,
      tier_pricing_enabled
    FROM selling_prices
    WHERE month = ? AND item_id = ?
  `).get(month, itemId) as {
    strategy: string;
    markup_type: string;
    buy_min: number;
    buy_max: number;
    buy_avg: number;
    markup_min: number;
    markup_max: number;
    sell_min: number;
    sell_max: number;
    created_by: string;
    created_at: string;
    tier_pricing_enabled: number;
  } | undefined;

  return {
    quotes: stats.quotes,
    buyMin: stats.buy_min,
    buyMax: stats.buy_max,
    buyAvg: stats.buy_avg,
    existing
  };
}

export function getManagerSnapshot(filters: FilterInput) {
  const comparisonRows = getLatestComparisonRows(filters);
  const historyRows = getHistoryRows(filters);
  const volatilityRows = getVolatilityRows(filters);
  const recommendation = filters.itemId ? getRecommendation(filters.month, filters.itemId) : null;
  const monthlySellingPrices = getSalesCatalog(filters.month, filters.categoryId);

  return {
    comparisonRows,
    historyRows,
    volatilityRows,
    recommendation,
    monthlySellingPrices
  };
}

export function saveSellingPrice(input: {
  itemId: number;
  month: string;
  strategy: "min" | "max" | "avg";
  markupType: "percent" | "amount" | "divisor";
  markupMin: number;
  markupMax: number;
  createdBy: string;
  changeReason?: string;
  otherExpenses: number;
  tierPricingEnabled?: number;
  /** T5: if provided, overrides the item’s transportation_per_unit for this month only */
  transportOverride?: number | null;
  /** T17: SC internal note (not visible to SA) */
  internalNote?: string;
  /** T17: SA notification message (visible in price update alerts) */
  saNote?: string;
  tier1Max?: number | null;
  tier1Discount?: number | null;
  tier2Max?: number | null;
  tier2Discount?: number | null;
  tier3Max?: number | null;
  tier3Discount?: number | null;
  tier4Discount?: number | null;
}) {
  const db = database();
  const recommendation = getRecommendation(input.month, input.itemId);

  if (
    recommendation.buyMin === null ||
    recommendation.buyMax === null ||
    recommendation.buyAvg === null
  ) {
    throw new Error("No supplier quotes found for this item and month.");
  }

  const strategyBase =
    input.strategy === "min"
      ? recommendation.buyMin
      : input.strategy === "max"
        ? recommendation.buyMax
        : recommendation.buyAvg;

  // Retrieve the item's fixed transportation cost, or use SC override (T5)
  const itemRow = db.prepare("SELECT transportation_per_unit FROM items WHERE id = ?").get(input.itemId) as { transportation_per_unit: number } | undefined;
  const transportation = (input.transportOverride != null && input.transportOverride >= 0)
    ? input.transportOverride
    : (itemRow?.transportation_per_unit ?? 0);
  const transportOverrideEnabled = (input.transportOverride != null && input.transportOverride >= 0) ? 1 : 0;

  // T15: divisor mode — sell = cost / divisor, same for min and max
  const baseSellMin =
    input.markupType === "amount"  ? strategyBase + input.markupMin :
    input.markupType === "divisor" ? (input.markupMin > 0 ? strategyBase / input.markupMin : strategyBase) :
    strategyBase * (1 + input.markupMin / 100);

  const baseSellMax =
    input.markupType === "amount"  ? strategyBase + input.markupMax :
    input.markupType === "divisor" ? (input.markupMin > 0 ? strategyBase / input.markupMin : strategyBase) :
    strategyBase * (1 + input.markupMax / 100);

  // The final prices to be published to SA:
  const sellMin = baseSellMin + transportation + input.otherExpenses;
  const sellMax = baseSellMax + transportation + input.otherExpenses;

  // ── Improvement #3: Margin floor enforcement ──────────────────────────────
  // Resolve effective floor: item-level overrides category-level
  const itemFloor = db.prepare(`
    SELECT min_markup_pct FROM margin_floors
    WHERE floor_type = 'item' AND item_id = ?
    ORDER BY id DESC LIMIT 1
  `).get(input.itemId) as { min_markup_pct: number } | undefined;

  let effectiveFloor: number | null = null;

  if (itemFloor) {
    effectiveFloor = itemFloor.min_markup_pct;
  } else {
    // Fall back to category floor
    const catRow = db.prepare("SELECT category_id FROM items WHERE id = ?").get(input.itemId) as { category_id: number } | undefined;
    if (catRow) {
      const catFloor = db.prepare(`
        SELECT min_markup_pct FROM margin_floors
        WHERE floor_type = 'category' AND category_id = ?
        ORDER BY id DESC LIMIT 1
      `).get(catRow.category_id) as { min_markup_pct: number } | undefined;
      if (catFloor) effectiveFloor = catFloor.min_markup_pct;
    }
  }

  // For percent mode, markupMin must be >= floor
  // For amount mode, convert floor pct to amount and check
  // For divisor mode, convert to implied margin %
  if (effectiveFloor !== null) {
    let effectiveMarkupMinPct: number;
    if (input.markupType === "percent") {
      effectiveMarkupMinPct = input.markupMin;
    } else if (input.markupType === "divisor") {
      // implied margin = (sell/cost - 1) * 100
      effectiveMarkupMinPct = strategyBase > 0 && input.markupMin > 0
        ? ((strategyBase / input.markupMin) / strategyBase - 1) * 100
        : 0;
    } else {
      effectiveMarkupMinPct = strategyBase > 0 ? (input.markupMin / strategyBase) * 100 : 0;
    }
    if (effectiveMarkupMinPct < effectiveFloor) {
      throw new Error(
        `FLOOR_VIOLATION:${effectiveFloor}:Min markup ${effectiveMarkupMinPct.toFixed(1)}% is below the configured floor of ${effectiveFloor}% for this item.`
      );
    }
  }

  const existingRow = db.prepare(`
    SELECT sell_min, sell_max, markup_min, markup_max, strategy, transportation, other_expenses, tier_pricing_enabled
    FROM selling_prices WHERE item_id = ? AND month = ?
  `).get(input.itemId, input.month) as {
    sell_min: number; sell_max: number;
    markup_min: number; markup_max: number;
    strategy: string;
    transportation: number;
    other_expenses: number;
    tier_pricing_enabled: number;
  } | undefined;

  const now = new Date().toISOString();

  // Write to history table first (before upsert overwrites the current row)
  db.prepare(`
    INSERT INTO selling_price_history (
      item_id, month,
      prev_sell_min, prev_sell_max, prev_markup_min, prev_markup_max, prev_strategy,
      prev_transportation, prev_other_expenses, prev_tier_pricing_enabled,
      new_sell_min, new_sell_max, new_markup_min, new_markup_max,
      new_strategy, new_markup_type, new_buy_avg,
      new_transportation, new_other_expenses, new_tier_pricing_enabled,
      new_transport_override_enabled, new_transport_override_amount,
      changed_by, changed_at, change_reason, is_update
    ) VALUES (
      @item_id, @month,
      @prev_sell_min, @prev_sell_max, @prev_markup_min, @prev_markup_max, @prev_strategy,
      @prev_transportation, @prev_other_expenses, @prev_tier_pricing_enabled,
      @new_sell_min, @new_sell_max, @new_markup_min, @new_markup_max,
      @new_strategy, @new_markup_type, @new_buy_avg,
      @new_transportation, @new_other_expenses, @new_tier_pricing_enabled,
      @new_transport_override_enabled, @new_transport_override_amount,
      @changed_by, @changed_at, @change_reason, @is_update
    )
  `).run({
    item_id: input.itemId,
    month: input.month,
    prev_sell_min:    existingRow?.sell_min    ?? null,
    prev_sell_max:    existingRow?.sell_max    ?? null,
    prev_markup_min:  existingRow?.markup_min  ?? null,
    prev_markup_max:  existingRow?.markup_max  ?? null,
    prev_strategy:    existingRow?.strategy    ?? null,
    prev_transportation: existingRow?.transportation ?? null,
    prev_other_expenses: existingRow?.other_expenses ?? null,
    prev_tier_pricing_enabled: existingRow?.tier_pricing_enabled ?? null,
    new_sell_min:     sellMin,
    new_sell_max:     sellMax,
    new_markup_min:   input.markupMin,
    new_markup_max:   input.markupMax,
    new_strategy:     input.strategy,
    new_markup_type:  input.markupType,
    new_buy_avg:      recommendation.buyAvg,
    new_transportation: transportation,
    new_other_expenses: input.otherExpenses,
    new_tier_pricing_enabled: input.tierPricingEnabled ?? 0,
    new_transport_override_enabled: transportOverrideEnabled,
    new_transport_override_amount: (input.transportOverride != null && input.transportOverride >= 0) ? input.transportOverride : 0,
    changed_by:       input.createdBy,
    changed_at:       now,
    change_reason:    input.changeReason ?? null,
    is_update:        existingRow ? 1 : 0,
  });

  // Upsert current selling price
  db.prepare(`
      INSERT INTO selling_prices (
        item_id, month, strategy, markup_type, buy_min, buy_max, buy_avg, markup_min, markup_max,
        sell_min, sell_max, created_by, created_at,
        transportation, other_expenses, tier_pricing_enabled,
        transport_override_enabled, transport_override_amount,
        internal_note, sa_note,
        tier1_max, tier1_discount,
        tier2_max, tier2_discount,
        tier3_max, tier3_discount,
        tier4_max, tier4_discount
      ) VALUES (
        @item_id, @month, @strategy, @markup_type, @buy_min, @buy_max, @buy_avg, @markup_min, @markup_max,
        @sell_min, @sell_max, @created_by, @created_at,
        @transportation, @other_expenses, @tier_pricing_enabled,
        @transport_override_enabled, @transport_override_amount,
        @internal_note, @sa_note,
        @tier1_max, @tier1_discount,
        @tier2_max, @tier2_discount,
        @tier3_max, @tier3_discount,
        @tier4_max, @tier4_discount
      )
      ON CONFLICT(item_id, month) DO UPDATE SET
        strategy = excluded.strategy,
        markup_type = excluded.markup_type,
        buy_min = excluded.buy_min,
        buy_max = excluded.buy_max,
        buy_avg = excluded.buy_avg,
        markup_min = excluded.markup_min,
        markup_max = excluded.markup_max,
        sell_min = excluded.sell_min,
        sell_max = excluded.sell_max,
        created_by = excluded.created_by,
        created_at = excluded.created_at,
        transportation = excluded.transportation,
        other_expenses = excluded.other_expenses,
        tier_pricing_enabled = excluded.tier_pricing_enabled,
        transport_override_enabled = excluded.transport_override_enabled,
        transport_override_amount = excluded.transport_override_amount,
        internal_note = excluded.internal_note,
        sa_note = excluded.sa_note,
        tier1_max = excluded.tier1_max,
        tier1_discount = excluded.tier1_discount,
        tier2_max = excluded.tier2_max,
        tier2_discount = excluded.tier2_discount,
        tier3_max = excluded.tier3_max,
        tier3_discount = excluded.tier3_discount,
        tier4_max = excluded.tier4_max,
        tier4_discount = excluded.tier4_discount
    `)
    .run({
      item_id: input.itemId,
      month: input.month,
      strategy: input.strategy,
      markup_type: input.markupType,
      buy_min: recommendation.buyMin,
      buy_max: recommendation.buyMax,
      buy_avg: recommendation.buyAvg,
      markup_min: input.markupMin,
      markup_max: input.markupMax,
      sell_min: sellMin,
      sell_max: sellMax,
      created_by: input.createdBy,
      created_at: now,
      transportation,
      other_expenses: input.otherExpenses,
      tier_pricing_enabled: input.tierPricingEnabled ?? 0,
      transport_override_enabled: transportOverrideEnabled,
      transport_override_amount: (input.transportOverride != null && input.transportOverride >= 0) ? input.transportOverride : 0,
      internal_note: input.internalNote ?? null,
      sa_note: input.saNote ?? null,
      tier1_max: (input.tierPricingEnabled && input.tier1Max !== undefined && input.tier1Max !== null) ? input.tier1Max : null,
      tier1_discount: (input.tierPricingEnabled && input.tier1Discount !== undefined && input.tier1Discount !== null) ? input.tier1Discount : null,
      tier2_max: (input.tierPricingEnabled && input.tier2Max !== undefined && input.tier2Max !== null) ? input.tier2Max : null,
      tier2_discount: (input.tierPricingEnabled && input.tier2Discount !== undefined && input.tier2Discount !== null) ? input.tier2Discount : null,
      tier3_max: (input.tierPricingEnabled && input.tier3Max !== undefined && input.tier3Max !== null) ? input.tier3Max : null,
      tier3_discount: (input.tierPricingEnabled && input.tier3Discount !== undefined && input.tier3Discount !== null) ? input.tier3Discount : null,
      tier4_max: 0,
      tier4_discount: (input.tierPricingEnabled && input.tier4Discount !== undefined && input.tier4Discount !== null) ? input.tier4Discount : null,
    });
}

export function getSalesCatalog(month: string, categoryId?: number) {
  const params: Record<string, string | number> = { month };
  const where = categoryId ? "WHERE i.category_id = @categoryId" : "";

  if (categoryId) {
    params.categoryId = categoryId;
  }

  return database()
    .prepare(`
      SELECT
        i.id as item_id,
        i.name as item_name,
        i.unit,
        c.name as category_name,
        sp.strategy,
        sp.markup_type,
        sp.buy_min,
        sp.buy_max,
        sp.buy_avg,
        sp.markup_min,
        sp.markup_max,
        sp.sell_min,
        sp.sell_max,
        sp.created_by,
        sp.created_at,
        IFNULL(sp.tier_pricing_enabled, 0) as tier_pricing_enabled,
        IFNULL(it.is_tiered, 0) as is_tiered,
        COALESCE(sp.tier1_max, it.tier1_max, 100) as tier1_max,
        COALESCE(sp.tier1_discount, it.tier1_discount, 0.0) as tier1_discount,
        COALESCE(sp.tier2_max, it.tier2_max, 200) as tier2_max,
        COALESCE(sp.tier2_discount, it.tier2_discount, 5.0) as tier2_discount,
        COALESCE(sp.tier3_max, it.tier3_max, 300) as tier3_max,
        COALESCE(sp.tier3_discount, it.tier3_discount, 10.0) as tier3_discount,
        COALESCE(sp.tier4_max, it.tier4_max, 0) as tier4_max,
        COALESCE(sp.tier4_discount, it.tier4_discount, 0.0) as tier4_discount,
        IFNULL(sp.transportation, 0.0) as transportation,
        IFNULL(sp.other_expenses, 0.0) as other_expenses,
        i.transportation_per_unit,
        i.moq
      FROM items i
      JOIN categories c ON c.id = i.category_id
      LEFT JOIN selling_prices sp ON sp.item_id = i.id AND sp.month = @month
      LEFT JOIN item_tiers it ON it.item_id = i.id
      ${where}
      ORDER BY c.name, i.id
    `)
    .all(params) as Array<{
      item_id: number;
      item_name: string;
      unit: string;
      category_name: string;
      strategy: string | null;
      markup_type: string | null;
      buy_min: number | null;
      buy_max: number | null;
      buy_avg: number | null;
      markup_min: number | null;
      markup_max: number | null;
      sell_min: number | null;
      sell_max: number | null;
      created_by: string | null;
      created_at: string | null;
      tier_pricing_enabled: number;
      is_tiered: number;
      tier1_max: number;
      tier1_discount: number;
      tier2_max: number;
      tier2_discount: number;
      tier3_max: number;
      tier3_discount: number;
      tier4_max: number;
      tier4_discount: number;
      transportation: number;
      other_expenses: number;
      transportation_per_unit: number;
      moq: number;
    }>;
}

export function getSalesCatalogForMonths(startMonth: string, endMonth: string) {
  return database()
    .prepare(`
      SELECT
        i.id as item_id,
        i.name as item_name,
        i.unit,
        c.name as category_name,
        MIN(sp.sell_min) as sell_min,
        MAX(sp.sell_max) as sell_max,
        sp.strategy,
        sp.markup_type
      FROM items i
      JOIN categories c ON c.id = i.category_id
      JOIN selling_prices sp ON sp.item_id = i.id
      WHERE sp.month >= @startMonth AND sp.month <= @endMonth AND sp.sell_min IS NOT NULL
      GROUP BY i.id, i.name, i.unit, c.name
      ORDER BY c.name, i.id
    `)
    .all({ startMonth, endMonth }) as Array<{
      item_id: number;
      item_name: string;
      unit: string;
      category_name: string;
      sell_min: number;
      sell_max: number;
      strategy: string | null;
      markup_type: string | null;
    }>;
}

export function getAdminSnapshot() {
  const db = database();

  const categories = db.prepare(`
    SELECT
      c.id,
      c.name,
      c.description,
      COUNT(i.id) as item_count
    FROM categories c
    LEFT JOIN items i ON i.category_id = c.id
    GROUP BY c.id, c.name, c.description
    ORDER BY c.name
  `).all() as Array<{
    id: number;
    name: string;
    description: string;
    item_count: number;
  }>;

  const suppliers = (() => {
    const rows = db.prepare(`
      SELECT
        s.id, s.name, s.fame_name, s.contact_person, s.phone, s.code, s.contact_job_title,
        s.represented_products, s.email, s.region, s.address,
        COUNT(pe.id) as quote_count,
        GROUP_CONCAT(DISTINCT i.name) as quoted_item_names,
        GROUP_CONCAT(DISTINCT sc.category_id) as category_ids_str
      FROM suppliers s
      LEFT JOIN price_entries pe ON pe.supplier_id = s.id
      LEFT JOIN items i ON pe.item_id = i.id
      LEFT JOIN supplier_categories sc ON sc.supplier_id = s.id
      GROUP BY s.id, s.name, s.fame_name, s.contact_person, s.phone, s.code,
               s.contact_job_title, s.represented_products, s.email, s.region, s.address
      ORDER BY s.name
    `).all() as Array<{
      id: number; name: string; fame_name: string | null;
      contact_person: string; phone: string;
      code: string | null; contact_job_title: string | null;
      represented_products: string | null; email: string | null;
      region: string | null; address: string | null;
      quote_count: number; quoted_item_names: string | null;
      category_ids_str: string | null;
    }>;
    return rows.map(s => ({
      ...s,
      category_ids: s.category_ids_str ? s.category_ids_str.split(',').map(Number) : [] as number[],
    }));
  })();

  const month = currentMonth();
  const items = db.prepare(`
    SELECT
      i.id,
      i.name,
      i.unit,
      i.description,
      i.active,
      i.category_id,
      c.name as category_name,
      i.transportation_per_unit,
      i.moq,
      (SELECT COUNT(*) FROM price_entries pe WHERE pe.item_id = i.id) as quote_count,
      (SELECT sp.sell_min FROM selling_prices sp WHERE sp.item_id = i.id AND sp.month = ?) as sell_min,
      (SELECT sp.sell_max FROM selling_prices sp WHERE sp.item_id = i.id AND sp.month = ?) as sell_max,
      (SELECT AVG(pe.price) FROM price_entries pe WHERE pe.item_id = i.id AND pe.month = ?) as buy_avg,
      (SELECT COUNT(*) FROM price_change_requests pcr WHERE pcr.item_id = i.id AND pcr.status = 'pending') as pending_request_count
    FROM items i
    JOIN categories c ON c.id = i.category_id
    ORDER BY i.active DESC, c.name, i.id
  `).all(month, month, month) as Array<{
    id: number;
    name: string;
    unit: string;
    description: string;
    active: number;
    category_id: number;
    category_name: string;
    transportation_per_unit: number;
    moq: number;
    quote_count: number;
    sell_min: number | null;
    sell_max: number | null;
    buy_avg: number | null;
    pending_request_count: number;
  }>;

  return {
    users: getUsers(),
    categories,
    suppliers,
    items
  };
}

export function getMonthlyReport(month: string, categoryId?: number) {
  const baseFilters: FilterInput = {
    month,
    categoryId
  };

  const comparisonRows = getLatestComparisonRows(baseFilters);
  const volatilityRows = getVolatilityRows(baseFilters);
  const monthlySellingPrices = getSalesCatalog(month, categoryId).filter((row) => row.sell_min !== null);
  const metrics = getMonthlyMetrics(month);

  return {
    month,
    metrics,
    comparisonRows,
    volatilityRows,
    monthlySellingPrices
  };
}

export function getQuotesBySupplier(month: string) {
  return database()
    .prepare(`
      SELECT 
        s.name, 
        COUNT(pe.id) as count
      FROM suppliers s
      LEFT JOIN price_entries pe ON pe.supplier_id = s.id AND pe.month = ?
      GROUP BY s.id, s.name
      ORDER BY count DESC, s.name
    `)
    .all(month) as Array<{ name: string; count: number }>;
}

/** T26: WH collection overview — per-category completion + missing quotes + totals */
export function getWHCollectionOverview(month: string): {
  totals: { possible: number; submitted: number; categories: number };
  byCategory: Array<{
    category_name: string;
    possible: number;
    submitted: number;
    pct: number;
  }>;
  missing: Array<{
    category_name: string;
    category_id: number;
    item_name: string;
    unit: string;
    supplier_name: string;
    supplier_id: number;
    item_id: number;
    prev_price: number | null;
    status: string | null;
    review_note: string | null;
  }>;
} {
  const db = database();

  // Per-category: number of possible quotes (item × supplier combos) vs submitted (approved/pending)
  const byCategory = db.prepare(`
    SELECT
      c.name AS category_name,
      COUNT(DISTINCT i.id || '_' || sc.supplier_id) AS possible,
      COUNT(DISTINCT le.item_id || '_' || le.supplier_id) AS submitted
    FROM categories c
    JOIN items i ON i.category_id = c.id
    JOIN supplier_categories sc ON sc.category_id = c.id
    LEFT JOIN (
      SELECT item_id, supplier_id
      FROM (
        SELECT item_id, supplier_id, status,
               ROW_NUMBER() OVER (PARTITION BY item_id, supplier_id ORDER BY recorded_at DESC, id DESC) as rn
        FROM price_entries
        WHERE month = ?
      ) WHERE rn = 1 AND status IN ('pending', 'approved')
    ) le ON le.item_id = i.id AND le.supplier_id = sc.supplier_id
    GROUP BY c.id, c.name
    ORDER BY c.name
  `).all(month) as Array<{ category_name: string; possible: number; submitted: number }>;

  const categoriesWithPct = byCategory.map(r => ({
    ...r,
    pct: r.possible > 0 ? Math.round((r.submitted / r.possible) * 100) : 0,
  }));

  const totals = {
    possible: categoriesWithPct.reduce((s, r) => s + r.possible, 0),
    submitted: categoriesWithPct.reduce((s, r) => s + r.submitted, 0),
    categories: categoriesWithPct.length,
  };

  // Missing quotes: item × supplier combos with no entry this month, OR rejected entries
  const prevMonth = (() => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();

  const missing = db.prepare(`
    SELECT
      c.name AS category_name,
      c.id AS category_id,
      i.name AS item_name, i.unit,
      COALESCE(NULLIF(TRIM(s.fame_name), ''), s.name) AS supplier_name,
      s.id AS supplier_id, i.id AS item_id,
      prev.price AS prev_price,
      le.status,
      le.review_note
    FROM items i
    JOIN categories c ON c.id = i.category_id
    JOIN supplier_categories sc ON sc.category_id = i.category_id
    JOIN suppliers s ON s.id = sc.supplier_id
    LEFT JOIN (
      SELECT item_id, supplier_id, status, review_note
      FROM (
        SELECT item_id, supplier_id, status, review_note,
               ROW_NUMBER() OVER (PARTITION BY item_id, supplier_id ORDER BY recorded_at DESC, id DESC) as rn
        FROM price_entries
        WHERE month = ?
      ) WHERE rn = 1
    ) le ON le.item_id = i.id AND le.supplier_id = s.id
    LEFT JOIN price_entries prev ON prev.item_id = i.id AND prev.supplier_id = s.id AND prev.month = ? AND prev.status = 'approved'
    WHERE (le.status IS NULL OR le.status = 'rejected') AND i.active = 1
    ORDER BY c.name, i.name, s.name
    LIMIT 80
  `).all(month, prevMonth) as Array<{
    category_name: string; category_id: number; item_name: string; unit: string;
    supplier_name: string; supplier_id: number; item_id: number; prev_price: number | null;
    status: string | null; review_note: string | null;
  }>;

  return { totals, byCategory: categoriesWithPct, missing };
}

export function getQuotesByCategory(month: string) {
  return database()
    .prepare(`
      SELECT 
        c.name, 
        COUNT(pe.id) as count
      FROM categories c
      LEFT JOIN items i ON i.category_id = c.id
      LEFT JOIN price_entries pe ON pe.item_id = i.id AND pe.month = ?
      GROUP BY c.id, c.name
      ORDER BY count DESC, c.name
    `)
    .all(month) as Array<{ name: string; count: number }>;
}

export function getMultiItemHistory(itemIds: number[]) {
  if (itemIds.length === 0) {
    return [];
  }

  // Build placeholders safely
  const placeholders = itemIds.map((_, idx) => `?`).join(", ");

  return database()
    .prepare(`
      SELECT
        pe.item_id,
        i.name as item_name,
        pe.month,
        AVG(pe.price) as avg_price
      FROM price_entries pe
      JOIN items i ON i.id = pe.item_id
      WHERE pe.item_id IN (${placeholders})
      GROUP BY pe.item_id, pe.month, i.name
      ORDER BY pe.month ASC, i.name ASC
    `)
    .all(itemIds) as Array<{
      item_id: number;
      item_name: string;
      month: string;
      avg_price: number;
    }>;
}

export function getAnalyticsData(filters: {
  startMonth: string;
  endMonth: string;
  itemIds: number[];
  supplierIds: number[];
}) {
  if (filters.itemIds.length === 0 || filters.supplierIds.length === 0) {
    return [];
  }

  const db = database();
  const clauses: string[] = [];
  const params: any = {};

  clauses.push("pe.month >= @startMonth");
  params.startMonth = filters.startMonth;

  clauses.push("pe.month <= @endMonth");
  params.endMonth = filters.endMonth;

  const placeholdersItems = filters.itemIds.map((id, index) => {
    const key = `itemId_${index}`;
    params[key] = id;
    return `@${key}`;
  });
  clauses.push(`pe.item_id IN (${placeholdersItems.join(", ")})`);

  const placeholdersSuppliers = filters.supplierIds.map((id, index) => {
    const key = `supplierId_${index}`;
    params[key] = id;
    return `@${key}`;
  });
  clauses.push(`pe.supplier_id IN (${placeholdersSuppliers.join(", ")})`);

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

  return db.prepare(`
    WITH ranked AS (
      SELECT
        pe.id,
        pe.item_id,
        pe.supplier_id,
        pe.month,
        pe.price,
        pe.notes,
        pe.recorded_at,
        i.name as item_name,
        i.unit,
        COALESCE(NULLIF(TRIM(s.fame_name), ''), s.name) as supplier_name,
        c.name as category_name,
        ROW_NUMBER() OVER (
          PARTITION BY pe.item_id, pe.supplier_id, pe.month
          ORDER BY pe.recorded_at DESC, pe.id DESC
        ) as row_number
      FROM price_entries pe
      JOIN items i ON i.id = pe.item_id
      JOIN categories c ON c.id = i.category_id
      JOIN suppliers s ON s.id = pe.supplier_id
      ${where}
    )
    SELECT
      id,
      item_id,
      supplier_id,
      month,
      price,
      notes,
      recorded_at,
      item_name,
      unit,
      supplier_name,
      category_name
    FROM ranked
    WHERE row_number = 1
    ORDER BY month ASC, recorded_at ASC, id ASC
  `).all(params) as Array<{
    id: number;
    item_id: number;
    supplier_id: number;
    month: string;
    price: number;
    notes: string | null;
    recorded_at: string;
    item_name: string;
    unit: string;
    supplier_name: string;
    category_name: string;
  }>;
}

export function getPurchasingHistory(month: string, monthsBack: number = 12) {
  const db = database();
  const months: string[] = [];
  for (let i = 0; i < monthsBack; i++) {
    months.push(shiftMonth(month, -i));
  }
  const placeholders = months.map(() => "?").join(", ");

  return db.prepare(`
    SELECT
      pe.item_id,
      pe.supplier_id,
      pe.month,
      pe.price,
      pe.recorded_at,
      pe.collected_role,
      pe.notes,
      pe.actual_transport,
      pe.negotiated_price,
      pe.negotiated_notes,
      COALESCE(NULLIF(TRIM(s.fame_name), ''), s.name)  as supplier_name,
      i.name  as item_name,
      i.unit  as item_unit,
      c.name  as category_name,
      i.category_id
    FROM price_entries pe
    JOIN suppliers s ON s.id = pe.supplier_id
    JOIN items    i ON i.id = pe.item_id
    JOIN categories c ON c.id = i.category_id
    WHERE pe.month IN (${placeholders})
    ORDER BY pe.recorded_at DESC, pe.id DESC
  `).all(...months) as Array<{
    item_id: number;
    supplier_id: number;
    month: string;
    price: number;
    recorded_at: string;
    collected_role: string;
    notes: string | null;
    actual_transport: number | null;
    negotiated_price: number | null;
    negotiated_notes: string | null;
    supplier_name: string;
    item_name: string;
    item_unit: string;
    category_name: string;
    category_id: number;
  }>;
}

export function getAllPriceEntries() {
  const db = database();
  return db.prepare(`
    SELECT
      pe.id,
      pe.item_id,
      pe.supplier_id,
      pe.month,
      pe.price,
      pe.recorded_at,
      pe.negotiated_price,
      pe.negotiated_notes,
      pe.status,
      pe.review_note,
      i.name as item_name,
      i.unit,
      s.name as supplier_name,
      c.name as category_name,
      i.category_id
    FROM price_entries pe
    JOIN items i ON i.id = pe.item_id
    JOIN categories c ON c.id = i.category_id
    JOIN suppliers s ON s.id = pe.supplier_id
    ORDER BY pe.month ASC, pe.recorded_at ASC
  `).all() as Array<{
    id: number;
    item_id: number;
    supplier_id: number;
    month: string;
    price: number;
    recorded_at: string;
    negotiated_price: number | null;
    negotiated_notes: string | null;
    status: string;
    review_note: string | null;
    item_name: string;
    unit: string;
    supplier_name: string;
    category_name: string;
    category_id: number;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Monthly Review — all items that have price entries for a given month,
// grouped by category, with per-supplier latest prices + stats + existing sell
// + 9 months of history per item
// ─────────────────────────────────────────────────────────────────────────────
export function getMonthlyReviewData(month: string) {
  const db = database();

  // Get all latest price entries for the month (one per item+supplier)
  const rows = db.prepare(`
    WITH ranked AS (
      SELECT
        pe.id         AS quote_id,
        pe.item_id,
        pe.supplier_id,
        pe.price,
        pe.recorded_at,
        pe.status,
        pe.review_note,
        pe.notes,
        pe.actual_transport,
        i.name        AS item_name,
        i.unit,
        i.category_id,
        c.name        AS category_name,
        COALESCE(NULLIF(TRIM(s.fame_name), ''), s.name) AS supplier_name,
        i.transportation_per_unit,
        i.moq,
        IFNULL(it.is_tiered, 0) as is_tiered,
        COALESCE(sp.tier1_max, it.tier1_max, 100) as tier1_max,
        COALESCE(sp.tier1_discount, it.tier1_discount, 0.0) as tier1_discount,
        COALESCE(sp.tier2_max, it.tier2_max, 200) as tier2_max,
        COALESCE(sp.tier2_discount, it.tier2_discount, 5.0) as tier2_discount,
        COALESCE(sp.tier3_max, it.tier3_max, 300) as tier3_max,
        COALESCE(sp.tier3_discount, it.tier3_discount, 10.0) as tier3_discount,
        COALESCE(sp.tier4_max, it.tier4_max, 0) as tier4_max,
        COALESCE(sp.tier4_discount, it.tier4_discount, 0.0) as tier4_discount,
        ROW_NUMBER() OVER (
          PARTITION BY pe.item_id, pe.supplier_id
          ORDER BY pe.recorded_at DESC, pe.id DESC
        ) AS rn
      FROM price_entries pe
      JOIN items      i ON i.id = pe.item_id
      JOIN categories c ON c.id = i.category_id
      JOIN suppliers  s ON s.id = pe.supplier_id
      LEFT JOIN item_tiers it ON it.item_id = i.id
      LEFT JOIN selling_prices sp ON sp.item_id = i.id AND sp.month = pe.month
      WHERE pe.month = ?
    )
    SELECT
      quote_id, item_id, supplier_id, price, recorded_at, status, review_note, notes, actual_transport,
      item_name, unit, category_id, category_name, supplier_name,
      transportation_per_unit, moq, is_tiered,
      tier1_max, tier1_discount, tier2_max, tier2_discount,
      tier3_max, tier3_discount, tier4_max, tier4_discount
    FROM ranked
    WHERE rn = 1
    ORDER BY category_name, item_name, supplier_name
  `).all(month) as Array<{
    quote_id: number;
    item_id: number;
    supplier_id: number;
    price: number;
    recorded_at: string;
    status: string;
    review_note: string | null;
    notes: string | null;
    actual_transport: number | null;
    item_name: string;
    unit: string;
    category_id: number;
    category_name: string;
    supplier_name: string;
    transportation_per_unit: number;
    moq: number;
    is_tiered: number;
    tier1_max: number;
    tier1_discount: number;
    tier2_max: number;
    tier2_discount: number;
    tier3_max: number;
    tier3_discount: number;
    tier4_max: number;
    tier4_discount: number;
  }>;

  // Pull existing selling prices for this month
  const sellingRows = db.prepare(`
    SELECT item_id, sell_min, sell_max, strategy, markup_type,
           markup_min, markup_max, created_by, created_at,
           tier_pricing_enabled, other_expenses
    FROM selling_prices WHERE month = ?
  `).all(month) as Array<{
    item_id: number;
    sell_min: number;
    sell_max: number;
    strategy: string;
    markup_type: string;
    markup_min: number;
    markup_max: number;
    created_by: string;
    created_at: string;
    tier_pricing_enabled: number;
    other_expenses: number;
  }>;
  const sellingMap = new Map(sellingRows.map(r => [r.item_id, r]));

  // Collect item IDs that have quotes this month
  const itemIds = Array.from(new Set(rows.map(r => r.item_id)));

  // Bulk-fetch history for all those items — last 9 months (excluding current)
  type HistoryRow = {
    item_id: number;
    supplier_id: number;
    supplier_name: string;
    month: string;
    price: number;
  };

  let historyRows: HistoryRow[] = [];
  if (itemIds.length > 0) {
    const histMonths: string[] = [];
    for (let i = 1; i <= 9; i++) histMonths.push(shiftMonth(month, -i));

    const itemPlaceholders = itemIds.map((_, i) => `?`).join(", ");
    const monthPlaceholders = histMonths.map(() => `?`).join(", ");

    historyRows = db.prepare(`
      WITH ranked AS (
        SELECT
          pe.item_id,
          pe.supplier_id,
          pe.month,
          pe.price,
          COALESCE(NULLIF(TRIM(s.fame_name), ''), s.name) AS supplier_name,
          ROW_NUMBER() OVER (
            PARTITION BY pe.item_id, pe.supplier_id, pe.month
            ORDER BY pe.recorded_at DESC, pe.id DESC
          ) AS rn
        FROM price_entries pe
        JOIN suppliers s ON s.id = pe.supplier_id
        WHERE pe.item_id IN (${itemPlaceholders})
          AND pe.month IN (${monthPlaceholders})
      )
      SELECT item_id, supplier_id, supplier_name, month, price
      FROM ranked
      WHERE rn = 1
      ORDER BY item_id, month DESC, supplier_name
    `).all(...itemIds, ...histMonths) as HistoryRow[];
  }

  // Group history by item_id
  const historyByItem = new Map<number, HistoryRow[]>();
  for (const h of historyRows) {
    if (!historyByItem.has(h.item_id)) historyByItem.set(h.item_id, []);
    historyByItem.get(h.item_id)!.push(h);
  }

  // Bulk-fetch selling price history - last 9 months
  type SellingHistoryRow = {
    item_id: number;
    month: string;
    sell_min: number;
    sell_max: number;
    strategy: string;
  };
  let sellingHistoryRows: SellingHistoryRow[] = [];

  type LastConfirmedBuyingRow = {
    item_id: number;
    price: number;
    month: string;
    supplier_name: string;
    recorded_at: string;
  };
  let lastConfirmedBuyingRows: LastConfirmedBuyingRow[] = [];

  type LastConfirmedSellingRow = {
    item_id: number;
    sell_min: number;
    sell_max: number;
    month: string;
    strategy: string;
    created_at: string;
    created_by: string;
  };
  let lastConfirmedSellingRows: LastConfirmedSellingRow[] = [];

  if (itemIds.length > 0) {
    const histMonths: string[] = [];
    for (let i = 1; i <= 9; i++) histMonths.push(shiftMonth(month, -i));
    const itemPlaceholders = itemIds.map(() => "?").join(", ");
    const monthPlaceholders = histMonths.map(() => "?").join(", ");

    sellingHistoryRows = db.prepare(`
      SELECT item_id, month, sell_min, sell_max, strategy
      FROM selling_prices
      WHERE item_id IN (${itemPlaceholders})
        AND month IN (${monthPlaceholders})
      ORDER BY item_id, month DESC
    `).all(...itemIds, ...histMonths) as SellingHistoryRow[];

    lastConfirmedBuyingRows = db.prepare(`
      WITH ranked AS (
        SELECT
          pe.item_id,
          pe.price,
          pe.month,
          COALESCE(NULLIF(TRIM(s.fame_name), ''), s.name) AS supplier_name,
          pe.recorded_at,
          ROW_NUMBER() OVER (
            PARTITION BY pe.item_id
            ORDER BY pe.month DESC, pe.recorded_at DESC, pe.id DESC
          ) AS rn
        FROM price_entries pe
        JOIN suppliers s ON s.id = pe.supplier_id
        WHERE pe.item_id IN (${itemPlaceholders})
          AND pe.status = 'approved'
          AND pe.month < ?
      )
      SELECT item_id, price, month, supplier_name, recorded_at
      FROM ranked
      WHERE rn = 1
    `).all(...itemIds, month) as LastConfirmedBuyingRow[];

    lastConfirmedSellingRows = db.prepare(`
      WITH ranked AS (
        SELECT
          item_id, sell_min, sell_max, month, strategy, created_at, created_by,
          ROW_NUMBER() OVER (
            PARTITION BY item_id
            ORDER BY month DESC
          ) AS rn
        FROM selling_prices
        WHERE item_id IN (${itemPlaceholders})
          AND month < ?
      )
      SELECT item_id, sell_min, sell_max, month, strategy, created_at, created_by
      FROM ranked
      WHERE rn = 1
    `).all(...itemIds, month) as LastConfirmedSellingRow[];
  }

  // Group selling history by item_id
  const sellingHistoryByItem = new Map<number, SellingHistoryRow[]>();
  for (const h of sellingHistoryRows) {
    if (!sellingHistoryByItem.has(h.item_id)) sellingHistoryByItem.set(h.item_id, []);
    sellingHistoryByItem.get(h.item_id)!.push(h);
  }

  const lastConfirmedBuyingMap = new Map(lastConfirmedBuyingRows.map(r => [r.item_id, r]));
  const lastConfirmedSellingMap = new Map(lastConfirmedSellingRows.map(r => [r.item_id, r]));

  // Group by category → item
  type SupplierQuote = {
    quoteId: number;
    supplierId: number;
    supplierName: string;
    price: number;
    recordedAt: string;
    status: string;
    reviewNote: string | null;
    notes: string | null;
    actualTransport: number | null;
  };
  type ReviewItem = {
    itemId: number;
    itemName: string;
    unit: string;
    categoryId: number;
    categoryName: string;
    suppliers: SupplierQuote[];
    minPrice: number;
    maxPrice: number;
    avgPrice: number;
    existingSell: typeof sellingRows[0] | null;
    history: HistoryRow[];
    sellingHistory: SellingHistoryRow[];
    lastConfirmedBuying: LastConfirmedBuyingRow | null;
    lastConfirmedSelling: LastConfirmedSellingRow | null;
    transportation_per_unit: number;
    moq: number;
    is_tiered: number;
    tier1_max: number;
    tier1_discount: number;
    tier2_max: number;
    tier2_discount: number;
    tier3_max: number;
    tier3_discount: number;
    tier4_max: number;
    tier4_discount: number;
  };
  type ReviewCategory = { categoryId: number; categoryName: string; items: ReviewItem[] };

  const itemMap = new Map<number, ReviewItem>();
  for (const row of rows) {
    if (!itemMap.has(row.item_id)) {
      itemMap.set(row.item_id, {
        itemId: row.item_id,
        itemName: row.item_name,
        unit: row.unit,
        categoryId: row.category_id,
        categoryName: row.category_name,
        suppliers: [],
        minPrice: Infinity,
        maxPrice: -Infinity,
        avgPrice: 0,
        existingSell: sellingMap.get(row.item_id) ?? null,
        history: historyByItem.get(row.item_id) ?? [],
        sellingHistory: sellingHistoryByItem.get(row.item_id) ?? [],
        lastConfirmedBuying: lastConfirmedBuyingMap.get(row.item_id) ?? null,
        lastConfirmedSelling: lastConfirmedSellingMap.get(row.item_id) ?? null,
        transportation_per_unit: row.transportation_per_unit,
        moq: row.moq,
        is_tiered: row.is_tiered,
        tier1_max: row.tier1_max,
        tier1_discount: row.tier1_discount,
        tier2_max: row.tier2_max,
        tier2_discount: row.tier2_discount,
        tier3_max: row.tier3_max,
        tier3_discount: row.tier3_discount,
        tier4_max: row.tier4_max,
        tier4_discount: row.tier4_discount,
      });
    }
    const item = itemMap.get(row.item_id)!;
    item.suppliers.push({
      quoteId: row.quote_id,
      supplierId: row.supplier_id,
      supplierName: row.supplier_name,
      price: row.price,
      recordedAt: row.recorded_at,
      status: row.status,
      reviewNote: row.review_note,
      notes: row.notes,
      actualTransport: row.actual_transport,
    });
    if (row.price < item.minPrice) item.minPrice = row.price;
    if (row.price > item.maxPrice) item.maxPrice = row.price;
  }

  // Compute averages
  for (const item of itemMap.values()) {
    item.avgPrice = item.suppliers.reduce((s, q) => s + q.price, 0) / (item.suppliers.length || 1);
    if (!isFinite(item.minPrice)) item.minPrice = 0;
    if (!isFinite(item.maxPrice)) item.maxPrice = 0;
  }

  // Build category groups
  const catMap = new Map<number, ReviewCategory>();
  for (const item of itemMap.values()) {
    if (!catMap.has(item.categoryId)) {
      catMap.set(item.categoryId, {
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        items: [],
      });
    }
    catMap.get(item.categoryId)!.items.push(item);
  }

  return Array.from(catMap.values()).sort((a, b) =>
    a.categoryName.localeCompare(b.categoryName)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Universal Search Index — lightweight, used to populate client-side search
// ─────────────────────────────────────────────────────────────────────────────
export function getSearchIndex() {
  const db = database();

  const items = db.prepare(`
    SELECT i.id, i.name, i.unit, i.active, c.name AS category_name, c.id AS category_id
    FROM items i
    JOIN categories c ON c.id = i.category_id
    ORDER BY c.name, i.id
  `).all() as Array<{
    id: number; name: string; unit: string; active: number;
    category_name: string; category_id: number;
  }>;

  const suppliers = db.prepare(`
    SELECT s.id, s.name, s.fame_name, s.contact_person, s.phone,
           COUNT(pe.id) AS quote_count
    FROM suppliers s
    LEFT JOIN price_entries pe ON pe.supplier_id = s.id
    GROUP BY s.id
    ORDER BY s.name
  `).all() as Array<{
    id: number; name: string; fame_name: string | null; contact_person: string;
    phone: string; quote_count: number;
  }>;

  return { items, suppliers };
}

// ─────────────────────────────────────────────────────────────────────────────
// Item Card — full detail for one item across all months & suppliers
// ─────────────────────────────────────────────────────────────────────────────
export function getItemCardData(itemId: number) {
  const db = database();

  const item = db.prepare(`
    SELECT i.id, i.name, i.unit, i.description, i.active,
           c.name AS category_name, c.id AS category_id,
           i.transportation_per_unit, i.moq
    FROM items i JOIN categories c ON c.id = i.category_id
    WHERE i.id = ?
  `).get(itemId) as {
    id: number; name: string; unit: string; description: string;
    active: number; category_name: string; category_id: number;
    transportation_per_unit: number; moq: number;
  } | undefined;

  if (!item) return null;

  // All price entries for this item, latest per supplier per month
  const priceRows = db.prepare(`
    WITH ranked AS (
      SELECT pe.supplier_id, pe.month, pe.price, pe.recorded_at,
             COALESCE(NULLIF(TRIM(s.fame_name), ''), s.name) AS supplier_name,
             ROW_NUMBER() OVER (
               PARTITION BY pe.supplier_id, pe.month
               ORDER BY pe.recorded_at DESC, pe.id DESC
             ) AS rn
      FROM price_entries pe
      JOIN suppliers s ON s.id = pe.supplier_id
      WHERE pe.item_id = ?
    )
    SELECT supplier_id, supplier_name, month, price, recorded_at
    FROM ranked WHERE rn = 1
    ORDER BY month DESC, supplier_name
  `).all(itemId) as Array<{
    supplier_id: number; supplier_name: string;
    month: string; price: number; recorded_at: string;
  }>;

  // Selling prices for this item
  const sellingRows = db.prepare(`
    SELECT month, sell_min, sell_max, strategy, markup_type,
           markup_min, markup_max, created_by, created_at
    FROM selling_prices WHERE item_id = ?
    ORDER BY month DESC
  `).all(itemId) as Array<{
    month: string; sell_min: number; sell_max: number;
    strategy: string; markup_type: string; markup_min: number;
    markup_max: number; created_by: string; created_at: string;
  }>;

  // Unique months and suppliers
  const months = Array.from(new Set(priceRows.map(r => r.month))).sort((a, b) => b.localeCompare(a));
  const supplierNames = Array.from(new Set(priceRows.map(r => r.supplier_name))).sort();

  // Build grid: month -> supplier -> price
  const grid = new Map<string, Map<string, { price: number; recordedAt: string }>>();
  for (const row of priceRows) {
    if (!grid.has(row.month)) grid.set(row.month, new Map());
    grid.get(row.month)!.set(row.supplier_name, { price: row.price, recordedAt: row.recorded_at });
  }

  // Per-supplier stats across all months
  const supplierStats = supplierNames.map(name => {
    const prices = priceRows.filter(r => r.supplier_name === name).map(r => r.price);
    const avg = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
    const min = prices.length > 0 ? Math.min(...prices) : 0;
    const max = prices.length > 0 ? Math.max(...prices) : 0;
    const latestEntry = priceRows.find(r => r.supplier_name === name);
    return { name, avg, min, max, quoteCount: prices.length, latestPrice: latestEntry?.price ?? null, latestMonth: latestEntry?.month ?? null };
  }).sort((a, b) => (a.avg || Infinity) - (b.avg || Infinity));

  // Per-month stats
  const monthStats = months.map(m => {
    const monthPrices = priceRows.filter(r => r.month === m).map(r => r.price);
    const avg = monthPrices.length > 0 ? monthPrices.reduce((a, b) => a + b, 0) / monthPrices.length : 0;
    const min = monthPrices.length > 0 ? Math.min(...monthPrices) : 0;
    const max = monthPrices.length > 0 ? Math.max(...monthPrices) : 0;
    return { month: m, avg, min, max, count: monthPrices.length };
  });

  return { item, priceRows, sellingRows, months, supplierNames, grid, supplierStats, monthStats };
}

// ─────────────────────────────────────────────────────────────────────────────
// Supplier Card — full detail for one supplier across all items & months
// ─────────────────────────────────────────────────────────────────────────────
export function getSupplierCardData(supplierId: number) {
  const db = database();

  const supplier = db.prepare(`
    SELECT s.id, s.name, s.fame_name, s.contact_person, s.phone,
           s.code, s.contact_job_title, s.represented_products, s.email, s.region, s.address,
           COUNT(pe.id) AS total_quotes
    FROM suppliers s
    LEFT JOIN price_entries pe ON pe.supplier_id = s.id
    WHERE s.id = ?
    GROUP BY s.id
  `).get(supplierId) as {
    id: number; name: string; fame_name: string | null; contact_person: string;
    phone: string; code: string | null; contact_job_title: string | null;
    represented_products: string | null; email: string | null;
    region: string | null; address: string | null; total_quotes: number;
  } | undefined;

  if (!supplier) return null;

  // All price entries for this supplier
  const priceRows = db.prepare(`
    WITH ranked AS (
      SELECT pe.item_id, pe.month, pe.price, pe.recorded_at,
             i.name AS item_name, i.unit,
             c.name AS category_name, c.id AS category_id,
             ROW_NUMBER() OVER (
               PARTITION BY pe.item_id, pe.month
               ORDER BY pe.recorded_at DESC, pe.id DESC
             ) AS rn
      FROM price_entries pe
      JOIN items i ON i.id = pe.item_id
      JOIN categories c ON c.id = i.category_id
      WHERE pe.supplier_id = ?
    )
    SELECT item_id, item_name, unit, category_name, category_id, month, price, recorded_at
    FROM ranked WHERE rn = 1
    ORDER BY month DESC, category_name, item_name
  `).all(supplierId) as Array<{
    item_id: number; item_name: string; unit: string;
    category_name: string; category_id: number;
    month: string; price: number; recorded_at: string;
  }>;

  // Active months
  const months = Array.from(new Set(priceRows.map(r => r.month))).sort((a, b) => b.localeCompare(a));

  // Per-item stats
  const itemIds = Array.from(new Set(priceRows.map(r => r.item_id)));
  const itemStats = itemIds.map(itemId => {
    const rows = priceRows.filter(r => r.item_id === itemId);
    const prices = rows.map(r => r.price);
    const avg = prices.reduce((a, b) => a + b, 0) / (prices.length || 1);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const latest = rows[0];

    // Compare with market avg for each month
    const deviations: number[] = [];
    for (const row of rows) {
      const marketAvg = db.prepare(`
        SELECT AVG(p2.price) as avg FROM price_entries p2
        WHERE p2.item_id = ? AND p2.month = ?
      `).get(row.item_id, row.month) as { avg: number };
      if (marketAvg.avg > 0) deviations.push((row.price - marketAvg.avg) / marketAvg.avg * 100);
    }
    const avgDeviation = deviations.length > 0 ? deviations.reduce((a, b) => a + b, 0) / deviations.length : 0;

    return {
      itemId, itemName: latest.item_name, unit: latest.unit,
      categoryName: latest.category_name, categoryId: latest.category_id,
      avg, min, max, quoteCount: prices.length,
      latestPrice: latest.price, latestMonth: latest.month,
      avgDeviation,
    };
  }).sort((a, b) => a.categoryName.localeCompare(b.categoryName) || a.itemName.localeCompare(b.itemName));

  // Per-month summary
  const monthStats = months.slice(0, 12).map(m => {
    const mRows = priceRows.filter(r => r.month === m);
    const prices = mRows.map(r => r.price);
    const avg = prices.reduce((a, b) => a + b, 0) / (prices.length || 1);
    return { month: m, avg, count: mRows.length };
  });

  return { supplier, priceRows, months, itemStats, monthStats };
}

// ─────────────────────────────────────────────────────────────────────────────
// Improvement #2 — Selling Price Audit History
// Returns the full audit log for a specific item+month, newest first.
// ─────────────────────────────────────────────────────────────────────────────
export type SellingPriceHistoryRow = {
  id: number;
  item_id: number;
  month: string;
  prev_sell_min: number | null;
  prev_sell_max: number | null;
  prev_markup_min: number | null;
  prev_markup_max: number | null;
  prev_strategy: string | null;
  prev_transportation: number | null;
  prev_other_expenses: number | null;
  prev_tier_pricing_enabled: number | null;
  new_sell_min: number;
  new_sell_max: number;
  new_markup_min: number;
  new_markup_max: number;
  new_strategy: string;
  new_markup_type: string;
  new_buy_avg: number;
  new_transportation: number;
  new_other_expenses: number;
  new_tier_pricing_enabled: number;
  new_transport_override_enabled: number;
  new_transport_override_amount: number;
  changed_by: string;
  changed_at: string;
  change_reason: string | null;
  is_update: number;
};

export function getSellingPriceHistory(itemId: number, month: string): SellingPriceHistoryRow[] {
  return database()
    .prepare(`
      SELECT * FROM selling_price_history
      WHERE item_id = ? AND month = ?
      ORDER BY changed_at DESC, id DESC
    `)
    .all(itemId, month) as SellingPriceHistoryRow[];
}

export function getSellingPriceHistoryForMonths(itemId: number, months: string[]): SellingPriceHistoryRow[] {
  if (months.length === 0) return [];
  const placeholders = months.map(() => '?').join(',');
  return database()
    .prepare(`
      SELECT * FROM selling_price_history
      WHERE item_id = ? AND month IN (${placeholders})
      ORDER BY changed_at DESC, id DESC
    `)
    .all(itemId, ...months) as SellingPriceHistoryRow[];
}

export function getSellingPriceHistoryForItem(itemId: number, limit = 20): SellingPriceHistoryRow[] {
  return database()
    .prepare(`
      SELECT * FROM selling_price_history
      WHERE item_id = ?
      ORDER BY changed_at DESC, id DESC
      LIMIT ?
    `)
    .all(itemId, limit) as SellingPriceHistoryRow[];
}

// Published sell price per month (latest per month from selling_prices)
export type ItemPublishedPrice = {
  month: string;
  sell_min: number;
  sell_max: number;
  strategy: string;
  markup_type: string;
  markup_min: number;
  markup_max: number;
  transport_override_enabled: number;
  transport_override_amount: number;
  created_at: string;
  tier1_max?: number | null;
  tier1_discount?: number | null;
  tier2_max?: number | null;
  tier2_discount?: number | null;
  tier3_max?: number | null;
  tier3_discount?: number | null;
  tier4_max?: number | null;
  tier4_discount?: number | null;
};

export function getItemPublishedPriceHistory(itemId: number, limit = 3): ItemPublishedPrice[] {
  return database()
    .prepare(`
      SELECT month, sell_min, sell_max, strategy, markup_type,
             markup_min, markup_max,
             transport_override_enabled, transport_override_amount, created_at,
             tier1_max, tier1_discount,
             tier2_max, tier2_discount,
             tier3_max, tier3_discount,
             tier4_max, tier4_discount
      FROM selling_prices
      WHERE item_id = ?
      ORDER BY month DESC
      LIMIT ?
    `)
    .all(itemId, limit) as ItemPublishedPrice[];
}

export function getRecentPriceUpdates(month: string, limit = 5): any[] {
  return database()
    .prepare(`
      WITH latest AS (
        SELECT item_id, MAX(id) as max_id
        FROM selling_price_history
        WHERE month = ? AND is_update = 1
        GROUP BY item_id
      )
      SELECT
        h.*,
        i.name as item_name, i.unit as item_unit, c.name as category_name,
        pa.acknowledged_by as ack_by,
        pa.acknowledged_at as ack_at
      FROM selling_price_history h
      JOIN latest ON h.id = latest.max_id
      JOIN items i ON h.item_id = i.id
      JOIN categories c ON i.category_id = c.id
      LEFT JOIN price_acknowledgments pa ON pa.history_id = h.id
      ORDER BY h.changed_at DESC
      LIMIT ?
    `)
    .all(month, limit) as any[];
}

/** T18: SA marks a price update as seen/acknowledged. */
export function acknowledgePrice(historyId: number, acknowledgedBy: string) {
  const now = new Date().toISOString();
  try {
    database().prepare(`
      INSERT OR IGNORE INTO price_acknowledgments (history_id, acknowledged_by, acknowledged_at)
      VALUES (?, ?, ?)
    `).run(historyId, acknowledgedBy, now);
  } catch (_) { /* unique constraint: already acknowledged */ }
}

/** T18: List acknowledgments visible to SC — recent N entries. */
export function getPriceAcknowledgments(limit = 20): Array<{
  id: number; history_id: number;
  acknowledged_by: string; acknowledged_at: string;
  item_name: string; new_sell_min: number; new_sell_max: number; month: string;
}> {
  return database().prepare(`
    SELECT pa.*, h.new_sell_min, h.new_sell_max, h.month,
           i.name as item_name
    FROM price_acknowledgments pa
    JOIN selling_price_history h ON h.id = pa.history_id
    JOIN items i ON i.id = h.item_id
    ORDER BY pa.acknowledged_at DESC
    LIMIT ?
  `).all(limit) as any[];
}

/** T18: Count unacknowledged price updates for this month — for SC badge. */
export function getUnacknowledgedCount(month: string): number {
  const row = database().prepare(`
    SELECT COUNT(*) as cnt
    FROM selling_price_history h
    LEFT JOIN price_acknowledgments pa ON pa.history_id = h.id
    WHERE h.month = ? AND h.is_update = 1 AND pa.id IS NULL
  `).get(month) as { cnt: number };
  return row?.cnt ?? 0;
}

export function getUnreadPriceAcknowledgmentsCount(): number {
  const row = database().prepare(`
    SELECT COUNT(*) as cnt
    FROM price_acknowledgments
    WHERE read_by_sc = 0
  `).get() as { cnt: number };
  return row?.cnt ?? 0;
}

export function markPriceAcknowledgmentsAsRead() {
  database().prepare(`
    UPDATE price_acknowledgments
    SET read_by_sc = 1
    WHERE read_by_sc = 0
  `).run();
}


// ─────────────────────────────────────────────────────────────────────────────
// Improvement #3 — Margin Floor Management
// ─────────────────────────────────────────────────────────────────────────────
export type MarginFloor = {
  id: number;
  floor_type: "item" | "category";
  item_id: number | null;
  category_id: number | null;
  min_markup_pct: number;
  set_by: string;
  set_at: string;
  notes: string | null;
  // joined display fields
  item_name?: string;
  category_name?: string;
};

export function getMarginFloors(): MarginFloor[] {
  return database()
    .prepare(`
      SELECT
        mf.id,
        mf.floor_type,
        mf.item_id,
        mf.category_id,
        mf.min_markup_pct,
        mf.set_by,
        mf.set_at,
        mf.notes,
        i.name  AS item_name,
        c.name  AS category_name
      FROM margin_floors mf
      LEFT JOIN items      i ON i.id = mf.item_id
      LEFT JOIN categories c ON c.id = mf.category_id
      ORDER BY mf.floor_type, c.name, i.name, mf.id DESC
    `)
    .all() as MarginFloor[];
}

export function getEffectiveFloorForItem(itemId: number): number | null {
  const db = database();

  // Item-level floor takes precedence
  const itemFloor = db.prepare(`
    SELECT min_markup_pct FROM margin_floors
    WHERE floor_type = 'item' AND item_id = ?
    ORDER BY id DESC LIMIT 1
  `).get(itemId) as { min_markup_pct: number } | undefined;
  if (itemFloor) return itemFloor.min_markup_pct;

  // Fall back to category floor
  const catRow = db.prepare("SELECT category_id FROM items WHERE id = ?").get(itemId) as { category_id: number } | undefined;
  if (!catRow) return null;
  const catFloor = db.prepare(`
    SELECT min_markup_pct FROM margin_floors
    WHERE floor_type = 'category' AND category_id = ?
    ORDER BY id DESC LIMIT 1
  `).get(catRow.category_id) as { min_markup_pct: number } | undefined;
  return catFloor?.min_markup_pct ?? null;
}

export function upsertMarginFloor(input: {
  floorType: "item" | "category";
  itemId?: number;
  categoryId?: number;
  minMarkupPct: number;
  setBy: string;
  notes?: string;
}): void {
  const db = database();
  const now = new Date().toISOString();

  if (input.floorType === "item" && input.itemId) {
    // Delete any existing floor for this item, then insert fresh
    db.prepare("DELETE FROM margin_floors WHERE floor_type = 'item' AND item_id = ?").run(input.itemId);
    db.prepare(`
      INSERT INTO margin_floors (floor_type, item_id, category_id, min_markup_pct, set_by, set_at, notes)
      VALUES ('item', ?, NULL, ?, ?, ?, ?)
    `).run(input.itemId, input.minMarkupPct, input.setBy, now, input.notes ?? null);
  } else if (input.floorType === "category" && input.categoryId) {
    db.prepare("DELETE FROM margin_floors WHERE floor_type = 'category' AND category_id = ?").run(input.categoryId);
    db.prepare(`
      INSERT INTO margin_floors (floor_type, item_id, category_id, min_markup_pct, set_by, set_at, notes)
      VALUES ('category', NULL, ?, ?, ?, ?, ?)
    `).run(input.categoryId, input.minMarkupPct, input.setBy, now, input.notes ?? null);
  } else {
    throw new Error("upsertMarginFloor: must provide itemId for 'item' type or categoryId for 'category' type.");
  }
}

export function deleteMarginFloor(id: number): void {
  database().prepare("DELETE FROM margin_floors WHERE id = ?").run(id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 1 — Category Bulk Markup: apply a markup to every item in a category
// for a given month in a single transaction.
// Returns { applied: number, skipped: number, errors: string[] }
// ─────────────────────────────────────────────────────────────────────────────
export function applyCategoryMarkup(input: {
  categoryId: number;
  month: string;
  strategy: "min" | "avg" | "max";
  markupType: "percent" | "amount" | "divisor";
  markupMin: number;
  markupMax: number;
  createdBy: string;
  tierPricingEnabled?: number;
  itemsData?: Array<{
    itemId: number;
    checked: boolean;
    transportation: number;
    tier1Discount: number;
    tier2Discount: number;
    tier3Discount: number;
    tier4Discount: number;
  }>;
}): { applied: number; skipped: number; errors: string[] } {
  const db = database();

  // Fetch all active items in the category
  const items = db.prepare(`
    SELECT id FROM items WHERE category_id = ? AND active = 1
  `).all(input.categoryId) as Array<{ id: number }>;

  let applied = 0;
  let skipped = 0;
  const errors: string[] = [];

  const tx = db.transaction(() => {
    for (const item of items) {
      try {
        const rec = getRecommendation(input.month, item.id);
        // Skip items with no quotes this month
        if (rec.buyAvg === null || rec.buyMin === null || rec.buyMax === null) {
          skipped++;
          continue;
        }

        const state = input.itemsData?.find(s => s.itemId === item.id);

        // If itemsData was passed, and this item is NOT checked (excluded), we skip it!
        if (input.itemsData && (!state || !state.checked)) {
          skipped++;
          continue;
        }

        const existingSp = db.prepare("SELECT other_expenses FROM selling_prices WHERE item_id = ? AND month = ?").get(item.id, input.month) as { other_expenses: number } | undefined;
        const otherExpenses = existingSp?.other_expenses ?? 0;

        // Auto-detect if item is tiered from the database
        const itemTierRow = db.prepare("SELECT is_tiered, tier1_max, tier2_max, tier3_max FROM item_tiers WHERE item_id = ?").get(item.id) as { is_tiered: number, tier1_max: number, tier2_max: number, tier3_max: number } | undefined;
        const isTiered = itemTierRow?.is_tiered === 1;

        let transportOverride: number | null = null;
        if (state !== undefined) {
          transportOverride = state.transportation;
        }

        // Custom divisors
        const t1Disc = state !== undefined ? state.tier1Discount : (isTiered ? input.markupMin : null);
        const t2Disc = state !== undefined ? state.tier2Discount : null;
        const t3Disc = state !== undefined ? state.tier3Discount : null;
        const t4Disc = state !== undefined ? state.tier4Discount : null;

        saveSellingPrice({
          itemId: item.id,
          month: input.month,
          strategy: input.strategy,
          markupType: input.markupType,
          markupMin: input.markupType === "divisor" && t1Disc !== null ? t1Disc : input.markupMin,
          markupMax: isTiered 
            ? (input.markupType === "divisor" && t1Disc !== null ? t1Disc : input.markupMin) 
            : input.markupMax,
          createdBy: input.createdBy,
          changeReason: `Bulk category markup applied by ${input.createdBy}`,
          otherExpenses,
          tierPricingEnabled: isTiered ? 1 : 0,
          transportOverride,
          tier1Max: itemTierRow?.tier1_max,
          tier1Discount: t1Disc,
          tier2Max: itemTierRow?.tier2_max,
          tier2Discount: t2Disc,
          tier3Max: itemTierRow?.tier3_max,
          tier3Discount: t3Disc,
          tier4Discount: t4Disc,
        });
        applied++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Floor violations are skipped with a note, not fatal
        if (msg.startsWith("FLOOR_VIOLATION:")) {
          skipped++;
          errors.push(`Item ${item.id}: below margin floor — skipped`);
        } else {
          skipped++;
          errors.push(`Item ${item.id}: ${msg}`);
        }
      }
    }
  });

  tx();
  return { applied, skipped, errors };
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 2 — Price Change Requests: WH submits a change for SC review
// ─────────────────────────────────────────────────────────────────────────────
export type PriceChangeRequest = {
  id: number;
  item_id: number;
  supplier_id: number;
  month: string;
  old_price: number;
  new_price: number;
  old_transport?: number | null;
  new_transport?: number | null;
  reason: string;
  requested_by: string;
  requested_at: string;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  // joined
  item_name?: string;
  supplier_name?: string;
  category_name?: string;
};

export function submitPriceChangeRequest(input: {
  itemId: number;
  supplierId: number;
  month: string;
  oldPrice: number;
  newPrice: number;
  oldTransport?: number | null;
  newTransport?: number | null;
  reason: string;
  requestedBy: string;
}): void {
  database().prepare(`
    INSERT INTO price_change_requests
      (item_id, supplier_id, month, old_price, new_price, old_transport, new_transport, reason, requested_by, requested_at, status)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(
    input.itemId, input.supplierId, input.month,
    input.oldPrice, input.newPrice,
    input.oldTransport ?? null, input.newTransport ?? null,
    input.reason,
    input.requestedBy, new Date().toISOString()
  );
}

export function getPendingPriceChangeRequests(): PriceChangeRequest[] {
  return database().prepare(`
    SELECT
      pcr.*,
      i.name  AS item_name,
      COALESCE(NULLIF(TRIM(s.fame_name), ''), s.name)  AS supplier_name,
      c.name  AS category_name
    FROM price_change_requests pcr
    JOIN items      i ON i.id = pcr.item_id
    JOIN suppliers  s ON s.id = pcr.supplier_id
    JOIN categories c ON c.id = i.category_id
    WHERE pcr.status = 'pending'
    ORDER BY pcr.requested_at DESC
  `).all() as PriceChangeRequest[];
}

export function getAllPriceChangeRequests(limit = 50): PriceChangeRequest[] {
  return database().prepare(`
    SELECT
      pcr.*,
      i.name  AS item_name,
      COALESCE(NULLIF(TRIM(s.fame_name), ''), s.name)  AS supplier_name,
      c.name  AS category_name
    FROM price_change_requests pcr
    JOIN items      i ON i.id = pcr.item_id
    JOIN suppliers  s ON s.id = pcr.supplier_id
    JOIN categories c ON c.id = i.category_id
    ORDER BY pcr.requested_at DESC
    LIMIT ?
  `).all(limit) as PriceChangeRequest[];
}

export function approvePriceChangeRequest(input: {
  requestId: number;
  reviewedBy: string;
  reviewNote?: string;
}): void {
  const db = database();
  const req = db.prepare("SELECT * FROM price_change_requests WHERE id = ?").get(input.requestId) as PriceChangeRequest | undefined;
  if (!req || req.status !== "pending") throw new Error("Request not found or not pending");

  const now = new Date().toISOString();

  db.transaction(() => {
    // Write the new price as a new price_entry (latest wins via ROW_NUMBER)
    db.prepare(`
      INSERT INTO price_entries
        (item_id, supplier_id, month, price, currency, collected_by, collected_role, notes, recorded_at, actual_transport, status)
      VALUES (?, ?, ?, ?, 'EGP', ?, 'WH', ?, ?, ?, 'approved')
    `).run(
      req.item_id, req.supplier_id, req.month, req.new_price,
      req.requested_by,
      `Price change approved by ${input.reviewedBy}. Reason: ${req.reason}`,
      now,
      req.new_transport ?? null
    );

    // Mark request as approved
    db.prepare(`
      UPDATE price_change_requests
      SET status = 'approved', reviewed_by = ?, reviewed_at = ?, review_note = ?
      WHERE id = ?
    `).run(input.reviewedBy, now, input.reviewNote ?? null, input.requestId);
  })();
}

export function rejectPriceChangeRequest(input: {
  requestId: number;
  reviewedBy: string;
  reviewNote?: string;
}): void {
  const db = database();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE price_change_requests
    SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, review_note = ?
    WHERE id = ? AND status = 'pending'
  `).run(input.reviewedBy, now, input.reviewNote ?? null, input.requestId);
}

/** Check if a price_entry already exists (confirmed) for this item+supplier+month */
export function hasConfirmedPrice(itemId: number, supplierId: number, month: string): boolean {
  const row = database().prepare(`
    SELECT COUNT(*) as cnt FROM price_entries
    WHERE item_id = ? AND supplier_id = ? AND month = ? AND status = 'approved'
  `).get(itemId, supplierId, month) as { cnt: number };
  return row.cnt > 0;
}

/** Count pending requests — used for sidebar badge */
export function countPendingRequests(): number {
  const row = database().prepare(
    "SELECT COUNT(*) as cnt FROM price_change_requests WHERE status = 'pending'"
  ).get() as { cnt: number };
  return row.cnt;
}

/** Get all price change requests submitted by a specific WH user */
export function getPriceChangeRequestsByUser(requestedBy: string): PriceChangeRequest[] {
  return database().prepare(`
    SELECT
      pcr.*,
      i.name  AS item_name,
      COALESCE(NULLIF(TRIM(s.fame_name), ''), s.name)  AS supplier_name,
      c.name  AS category_name
    FROM price_change_requests pcr
    JOIN items      i ON i.id = pcr.item_id
    JOIN suppliers  s ON s.id = pcr.supplier_id
    JOIN categories c ON c.id = i.category_id
    WHERE pcr.requested_by = ?
    ORDER BY pcr.requested_at DESC
    LIMIT 100
  `).all(requestedBy) as PriceChangeRequest[];
}

/** Count pending requests for a specific WH user — sidebar badge */
export function countPendingRequestsByUser(requestedBy: string): number {
  const row = database().prepare(
    "SELECT COUNT(*) as cnt FROM price_change_requests WHERE status = 'pending' AND requested_by = ?"
  ).get(requestedBy) as { cnt: number };
  return row.cnt;
}

export function purgeAllDataExceptUsers() {
  const db = database();
  db.exec(`
    DELETE FROM price_change_requests;
    DELETE FROM margin_floors;
    DELETE FROM selling_price_history;
    DELETE FROM selling_prices;
    DELETE FROM price_entries;
    DELETE FROM items;
    DELETE FROM categories;
    DELETE FROM suppliers;
    DELETE FROM monthly_settings;
    DELETE FROM item_tiers;
    DELETE FROM sqlite_sequence WHERE name IN (
      'categories', 'items', 'suppliers', 'price_entries', 'selling_prices', 
      'selling_price_history', 'margin_floors', 'price_change_requests'
    );
  `);
}

export function isTierPricingEnabled(month: string): boolean {
  const row = database()
    .prepare("SELECT tier_pricing_enabled FROM monthly_settings WHERE month = ?")
    .get(month) as { tier_pricing_enabled: number } | undefined;
  return row ? row.tier_pricing_enabled === 1 : false;
}

export function setMonthlyTierPricing(month: string, enabled: boolean): void {
  database()
    .prepare(`
      INSERT INTO monthly_settings (month, tier_pricing_enabled)
      VALUES (?, ?)
      ON CONFLICT(month) DO UPDATE SET tier_pricing_enabled = excluded.tier_pricing_enabled
    `)
    .run(month, enabled ? 1 : 0);
}

// T26: SC transport override — admin-controlled per month
export function isScTransportOverrideEnabled(month: string): boolean {
  const row = database()
    .prepare("SELECT sc_transport_override_enabled FROM monthly_settings WHERE month = ?")
    .get(month) as { sc_transport_override_enabled: number } | undefined;
  return row ? row.sc_transport_override_enabled === 1 : false;
}

export function setScTransportOverride(month: string, enabled: boolean): void {
  database()
    .prepare(`
      INSERT INTO monthly_settings (month, sc_transport_override_enabled)
      VALUES (?, ?)
      ON CONFLICT(month) DO UPDATE SET sc_transport_override_enabled = excluded.sc_transport_override_enabled
    `)
    .run(month, enabled ? 1 : 0);
}

export type ItemTierConfig = {
  item_id: number;
  item_name: string;
  category_name: string;
  is_tiered: number;
  tier1_max: number;
  tier1_discount: number;
  tier2_max: number;
  tier2_discount: number;
  tier3_max: number;
  tier3_discount: number;
  tier4_max: number;
  tier4_discount: number;
};

export function getItemTiers(): ItemTierConfig[] {
  return database()
    .prepare(`
      SELECT 
        i.id as item_id,
        i.name as item_name,
        c.name as category_name,
        IFNULL(it.is_tiered, 0) as is_tiered,
        IFNULL(it.tier1_max, 100) as tier1_max,
        IFNULL(it.tier1_discount, 0.0) as tier1_discount,
        IFNULL(it.tier2_max, 200) as tier2_max,
        IFNULL(it.tier2_discount, 5.0) as tier2_discount,
        IFNULL(it.tier3_max, 300) as tier3_max,
        IFNULL(it.tier3_discount, 10.0) as tier3_discount,
        IFNULL(it.tier4_max, 0) as tier4_max,
        IFNULL(it.tier4_discount, 0.0) as tier4_discount
      FROM items i
      JOIN categories c ON c.id = i.category_id
      LEFT JOIN item_tiers it ON it.item_id = i.id
      ORDER BY c.name, i.id
    `)
    .all() as ItemTierConfig[];
}

export function upsertItemTier(config: {
  itemId: number;
  isTiered: number;
  tier1Max: number;
  tier1Discount: number;
  tier2Max: number;
  tier2Discount: number;
  tier3Max: number;
  tier3Discount: number;
  tier4Max: number;
  tier4Discount: number;
}): void {
  database()
    .prepare(`
      INSERT INTO item_tiers
        (item_id, is_tiered, tier1_max, tier1_discount, tier2_max, tier2_discount,
         tier3_max, tier3_discount, tier4_max, tier4_discount)
      VALUES
        (@itemId, @isTiered, @tier1Max, @tier1Discount, @tier2Max, @tier2Discount,
         @tier3Max, @tier3Discount, @tier4Max, @tier4Discount)
      ON CONFLICT(item_id) DO UPDATE SET
        is_tiered = excluded.is_tiered,
        tier1_max = excluded.tier1_max,
        tier1_discount = excluded.tier1_discount,
        tier2_max = excluded.tier2_max,
        tier2_discount = excluded.tier2_discount,
        tier3_max = excluded.tier3_max,
        tier3_discount = excluded.tier3_discount,
        tier4_max = excluded.tier4_max,
        tier4_discount = excluded.tier4_discount
    `)
    .run(config);
}

export function deleteItemTier(itemId: number): void {
  database()
    .prepare("DELETE FROM item_tiers WHERE item_id = ?")
    .run(itemId);
}

// ── Exchange Rate helpers ─────────────────────────────────────────────────────

export type ExchangeRateRow = {
  id: number;
  currency: string;
  rate: number;
  source: string | null;
  fetched_at: string;
};

/** Returns the most recently saved rate for the given currency (default USD). */
export function getExchangeRate(currency = "USD"): ExchangeRateRow | null {
  return database()
    .prepare(
      "SELECT id, currency, rate, source, fetched_at FROM exchange_rates WHERE currency = ? ORDER BY fetched_at DESC LIMIT 1"
    )
    .get(currency) as ExchangeRateRow | null;
}

/** Saves a new rate record (keeps history, does not overwrite). */
export function saveExchangeRate(currency: string, rate: number, source: string): void {
  database()
    .prepare(
      "INSERT INTO exchange_rates (currency, rate, source, fetched_at) VALUES (?, ?, ?, datetime('now'))"
    )
    .run(currency, rate, source);
}

export function saveNegotiatedPrice(itemId: number, supplierId: number, month: string, negotiatedPrice: number, notes: string | null): void {
  const db = database();
  const latestEntry = db.prepare(`
    SELECT id FROM price_entries
    WHERE item_id = ? AND supplier_id = ? AND month = ? AND collected_role = 'WH'
    ORDER BY recorded_at DESC, id DESC
    LIMIT 1
  `).get(itemId, supplierId, month) as { id: number } | undefined;

  if (!latestEntry) {
    throw new Error("No existing submitted price entry found to negotiate on.");
  }

  db.prepare(`
    UPDATE price_entries
    SET negotiated_price = ?, negotiated_notes = ?
    WHERE id = ?
  `).run(negotiatedPrice, notes, latestEntry.id);
}

export function getNegotiatedPriceEntries(month: string): any[] {
  return database()
    .prepare(`
      SELECT
        pe.id,
        pe.item_id,
        pe.supplier_id,
        pe.month,
        pe.price as original_price,
        pe.negotiated_price,
        pe.negotiated_notes,
        pe.recorded_at,
        pe.collected_by,
        i.name as item_name,
        c.name as category_name,
        COALESCE(NULLIF(TRIM(s.fame_name), ''), s.name) as supplier_name
      FROM price_entries pe
      JOIN items i ON i.id = pe.item_id
      JOIN categories c ON c.id = i.category_id
      JOIN suppliers s ON s.id = pe.supplier_id
      WHERE pe.month = ? AND pe.negotiated_price IS NOT NULL
      ORDER BY pe.recorded_at DESC
    `)
    .all(month) as any[];
}

// ══════════════════════════════════════════════════════════════════════════════
//  ACTIVITY / AUDIT LOG
// ══════════════════════════════════════════════════════════════════════════════

export interface ActivityLogEntry {
  id: number;
  actor: string;
  role: string;
  event_type: string;
  summary: string;
  detail: string | null;
  performed_at: string;
}

/** Fire-and-forget INSERT — never crashes the calling business action. */
export function logActivity(entry: {
  actor: string;
  role: string;
  eventType: string;
  summary: string;
  detail?: Record<string, unknown>;
}) {
  try {
    database()
      .prepare(
        `INSERT INTO activity_log (actor, role, event_type, summary, detail)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        entry.actor,
        entry.role,
        entry.eventType,
        entry.summary,
        entry.detail ? JSON.stringify(entry.detail) : null
      );
  } catch {
    // intentionally swallowed — logging must never block business logic
  }
}

/** Paginated read with optional role / event_type / actor filters, newest-first. */
export function getActivityLog(opts: {
  limit?: number;
  offset?: number;
  role?: string;
  eventType?: string;
  actor?: string;
} = {}): ActivityLogEntry[] {
  const { limit = 100, offset = 0, role, eventType, actor } = opts;
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  if (role)      { conditions.push("role = ?");       params.push(role); }
  if (eventType) { conditions.push("event_type = ?"); params.push(eventType); }
  if (actor)     { conditions.push("actor = ?");      params.push(actor); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return database()
    .prepare(
      `SELECT id, actor, role, event_type, summary, detail, performed_at
       FROM activity_log ${where}
       ORDER BY performed_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset) as ActivityLogEntry[];
}

export function countActivityLog(opts: { role?: string; eventType?: string; actor?: string } = {}): number {
  const { role, eventType, actor } = opts;
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  if (role)      { conditions.push("role = ?");       params.push(role); }
  if (eventType) { conditions.push("event_type = ?"); params.push(eventType); }
  if (actor)     { conditions.push("actor = ?");      params.push(actor); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const row = database()
    .prepare(`SELECT COUNT(*) as n FROM activity_log ${where}`)
    .get(...params) as { n: number };
  return row.n;
}

export function getPendingPriceEntries(month?: string) {
  const db = database();
  const query = `
    SELECT
      pe.id,
      pe.item_id,
      pe.supplier_id,
      pe.month,
      pe.price,
      pe.recorded_at,
      pe.notes,
      pe.actual_transport,
      pe.status,
      pe.review_note,
      i.name as item_name,
      i.unit,
      c.name as category_name,
      i.category_id,
      COALESCE(NULLIF(TRIM(s.fame_name), ''), s.name) as supplier_name,
      pe.collected_by
    FROM price_entries pe
    JOIN items i ON i.id = pe.item_id
    JOIN categories c ON c.id = i.category_id
    JOIN suppliers s ON s.id = pe.supplier_id
    WHERE pe.status = 'pending' ${month ? "AND pe.month = ?" : ""}
    ORDER BY pe.recorded_at DESC
  `;
  const stmt = db.prepare(query);
  return (month ? stmt.all(month) : stmt.all()) as Array<{
    id: number;
    item_id: number;
    supplier_id: number;
    month: string;
    price: number;
    recorded_at: string;
    notes: string | null;
    actual_transport: number | null;
    status: string;
    review_note: string | null;
    item_name: string;
    unit: string;
    category_name: string;
    category_id: number;
    supplier_name: string;
    collected_by: string;
  }>;
}

export function getItemSupplierPurchasingHistory(itemId: number, supplierId: number, limit = 5) {
  return database().prepare(`
    SELECT price, month, recorded_at, status, notes
    FROM price_entries
    WHERE item_id = ? AND supplier_id = ? AND status = 'approved'
    ORDER BY month DESC, recorded_at DESC
    LIMIT ?
  `).all(itemId, supplierId, limit) as Array<{
    price: number;
    month: string;
    recorded_at: string;
    status: string;
    notes: string | null;
  }>;
}

export function getItemSellingPriceHistory(itemId: number, limit = 5) {
  return database().prepare(`
    SELECT sell_min, sell_max, buy_avg, strategy, month, created_at
    FROM selling_prices
    WHERE item_id = ?
    ORDER BY month DESC, created_at DESC
    LIMIT ?
  `).all(itemId, limit) as Array<{
    sell_min: number;
    sell_max: number;
    buy_avg: number;
    strategy: string;
    month: string;
    created_at: string;
  }>;
}

export function getPreviousApprovedPrice(itemId: number, supplierId: number, currentMonthStr: string): number | null {
  const db = database();
  const prevMonthStr = shiftMonth(currentMonthStr, -1);
  const row = db.prepare(`
    SELECT price FROM price_entries
    WHERE item_id = ? AND supplier_id = ? AND month = ? AND status = 'approved'
    ORDER BY recorded_at DESC, id DESC
    LIMIT 1
  `).get(itemId, supplierId, prevMonthStr) as { price: number } | undefined;
  if (row) return row.price;

  const fallbackRow = db.prepare(`
    SELECT price FROM price_entries
    WHERE item_id = ? AND supplier_id = ? AND month < ? AND status = 'approved'
    ORDER BY month DESC, recorded_at DESC, id DESC
    LIMIT 1
  `).get(itemId, supplierId, currentMonthStr) as { price: number } | undefined;
  return fallbackRow ? fallbackRow.price : null;
}

export function countPendingQuotes(month?: string): number {
  const db = database();
  const query = `SELECT COUNT(*) as count FROM price_entries WHERE status = 'pending' ${month ? "AND month = ?" : ""}`;
  const row = (month ? db.prepare(query).get(month) : db.prepare(query).get()) as { count: number };
  return row.count;
}

export function approvePriceEntry(entryId: number, reviewedBy: string, note?: string) {
  const now = new Date().toISOString();
  database().prepare(`
    UPDATE price_entries
    SET status = 'approved', reviewed_by = ?, reviewed_at = ?, review_note = ?
    WHERE id = ?
  `).run(reviewedBy, now, note ?? null, entryId);
}

export function rejectPriceEntry(entryId: number, reviewedBy: string, note?: string) {
  const now = new Date().toISOString();
  database().prepare(`
    UPDATE price_entries
    SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, review_note = ?, read_by_wh = 0
    WHERE id = ?
  `).run(reviewedBy, now, note ?? null, entryId);
}

export function getRejectedPriceEntriesForWH(username: string) {
  return database().prepare(`
    SELECT
      pe.id AS quote_id,
      pe.item_id,
      pe.supplier_id,
      pe.price,
      pe.month,
      pe.recorded_at,
      pe.review_note,
      pe.reviewed_by,
      pe.reviewed_at,
      pe.read_by_wh,
      i.name AS item_name,
      c.name AS category_name,
      COALESCE(NULLIF(TRIM(s.fame_name), ''), s.name) AS supplier_name
    FROM price_entries pe
    JOIN items i ON i.id = pe.item_id
    JOIN categories c ON c.id = i.category_id
    JOIN suppliers s ON s.id = pe.supplier_id
    WHERE pe.status = 'rejected' AND pe.collected_by = ?
    ORDER BY pe.reviewed_at DESC
  `).all(username) as Array<{
    quote_id: number;
    item_id: number;
    supplier_id: number;
    price: number;
    month: string;
    recorded_at: string;
    review_note: string | null;
    reviewed_by: string | null;
    reviewed_at: string | null;
    read_by_wh: number;
    item_name: string;
    category_name: string;
    supplier_name: string;
  }>;
}

export function getUnreadRejectedPriceEntriesCountForWH(username: string): number {
  const row = database().prepare(`
    SELECT COUNT(*) as cnt
    FROM price_entries
    WHERE status = 'rejected' AND collected_by = ? AND read_by_wh = 0
  `).get(username) as { cnt: number };
  return row.cnt;
}

export function markRejectedPriceEntriesAsReadForWH(username: string) {
  database().prepare(`
    UPDATE price_entries
    SET read_by_wh = 1
    WHERE status = 'rejected' AND collected_by = ? AND read_by_wh = 0
  `).run(username);
}
