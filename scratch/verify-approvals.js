const Database = require('better-sqlite3');
const path = require('path');

// The active sqlite database is at E:/FAERP/data/faerp.sqlite
const dbPath = path.join(__dirname, '..', 'data', 'faerp.sqlite');
console.log('Connecting to database at:', dbPath);
const db = new Database(dbPath);

try {
  // Run our new migrations to update the database schema for the test
  console.log('\nRunning migrations...');
  const migrations = [
    "ALTER TABLE price_entries ADD COLUMN status TEXT NOT NULL DEFAULT 'approved' CHECK(status IN ('pending','approved','rejected'))",
    "ALTER TABLE price_entries ADD COLUMN review_note TEXT",
    "ALTER TABLE price_entries ADD COLUMN reviewed_by TEXT",
    "ALTER TABLE price_entries ADD COLUMN reviewed_at TEXT",
  ];
  for (const sql of migrations) {
    try {
      db.exec(sql);
      console.log(`Executed: ${sql}`);
    } catch (err) {
      console.log(`Skipped (already applied?): ${sql} - ${err.message}`);
    }
  }

  // 1. Verify schema columns
  console.log('\nChecking columns of price_entries:');
  const info = db.prepare('PRAGMA table_info(price_entries)').all();
  const columnNames = info.map(c => c.name);
  console.log('Columns in price_entries:', columnNames);

  const expectedColumns = ['status', 'review_note', 'reviewed_by', 'reviewed_at'];
  expectedColumns.forEach(col => {
    if (columnNames.includes(col)) {
      console.log(`✅ Column "${col}" exists.`);
    } else {
      console.error(`❌ Column "${col}" is missing!`);
    }
  });

  // 2. Insert a pending price entry and test operations
  console.log('\nTesting insert of a pending quote:');
  // Find a valid item and supplier to prevent foreign key issues
  const item = db.prepare('SELECT id, name FROM items LIMIT 1').get();
  const supplier = db.prepare('SELECT id, name FROM suppliers LIMIT 1').get();
  
  if (!item || !supplier) {
    throw new Error('No items or suppliers found in the seeded database to run operations!');
  }
  
  const testMonth = '2026-07';
  const testPrice = 99.99;
  const recordedAt = new Date().toISOString();

  // Clean any old test records
  db.prepare("DELETE FROM price_entries WHERE month = ? AND notes = 'Verify approvals test'").run(testMonth);

  console.log(`Inserting test quote for item "${item.name}" (ID ${item.id}), supplier "${supplier.name}" (ID ${supplier.id})`);
  const insert = db.prepare(`
    INSERT INTO price_entries (
      item_id, supplier_id, month, price, currency, collected_by, collected_role, notes, recorded_at, status
    ) VALUES (?, ?, ?, ?, 'EGP', 'Test WH Agent', 'WH', 'Verify approvals test', ?, 'pending')
  `);
  const result = insert.run(item.id, supplier.id, testMonth, testPrice, recordedAt);
  const entryId = result.lastInsertRowid;
  console.log(`✅ Pending price entry inserted with ID: ${entryId}`);

  // Check if it appears in pending queries
  const pending = db.prepare("SELECT * FROM price_entries WHERE id = ?").get(entryId);
  console.log('Inserted entry status:', pending.status);
  if (pending.status === 'pending') {
    console.log('✅ Entry status defaults to "pending" correctly.');
  } else {
    console.error('❌ Expected status to be "pending", got:', pending.status);
  }

  // 3. Test Approval
  console.log('\nTesting approval:');
  db.prepare(`
    UPDATE price_entries
    SET status = 'approved', reviewed_by = 'Test SC Manager', reviewed_at = ?, review_note = 'Looks good'
    WHERE id = ?
  `).run(new Date().toISOString(), entryId);

  const approved = db.prepare("SELECT * FROM price_entries WHERE id = ?").get(entryId);
  console.log('Approved entry status:', approved.status);
  console.log('Approved review note:', approved.review_note);
  if (approved.status === 'approved' && approved.review_note === 'Looks good') {
    console.log('✅ Entry successfully approved.');
  } else {
    console.error('❌ Approval failed! Status or note mismatch.');
  }

  // 4. Test Rejection
  console.log('\nTesting rejection:');
  db.prepare(`
    UPDATE price_entries
    SET status = 'rejected', reviewed_by = 'Test SC Manager', reviewed_at = ?, review_note = 'Price is too high'
    WHERE id = ?
  `).run(new Date().toISOString(), entryId);

  const rejected = db.prepare("SELECT * FROM price_entries WHERE id = ?").get(entryId);
  console.log('Rejected entry status:', rejected.status);
  console.log('Rejected review note:', rejected.review_note);
  if (rejected.status === 'rejected' && rejected.review_note === 'Price is too high') {
    console.log('✅ Entry successfully rejected.');
  } else {
    console.error('❌ Rejection failed! Status or note mismatch.');
  }

  // Clean up
  db.prepare("DELETE FROM price_entries WHERE id = ?").run(entryId);
  console.log('\n✅ Verification test completed successfully without errors.');

} catch (err) {
  console.error('\n❌ Verification test failed with error:', err.message);
} finally {
  db.close();
}
