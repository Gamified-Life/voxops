// SQLite via Node's built-in `node:sqlite` — no external database server,
// no install step, no credentials. The file lives in server/data/ and is
// created automatically on first boot.
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'voxops.db');

fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');

function initSchema() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
}

// MySQL-flavoured SQL still reads/writes correctly against SQLite for every
// query this app issues, aside from a couple of dialect quirks handled here:
// `INSERT IGNORE`, JS booleans as bind params, and JSON columns coming back
// as text. This keeps every route file's `db.pool.query(...)` call unchanged.
function coerce(params) {
  return (params || []).map((p) => (typeof p === 'boolean' ? (p ? 1 : 0) : p));
}

const JSON_COLUMNS = new Set(['actions_json']);
const BOOL_COLUMNS = new Set(['done']);

function hydrateRow(row) {
  if (!row) return row;
  for (const col of JSON_COLUMNS) {
    if (typeof row[col] === 'string') {
      try {
        row[col] = JSON.parse(row[col]);
      } catch (e) {
        /* leave as-is */
      }
    }
  }
  for (const col of BOOL_COLUMNS) {
    if (col in row) row[col] = !!row[col];
  }
  return row;
}

async function query(sql, params = []) {
  const translated = sql.trim().replace(/INSERT IGNORE/i, 'INSERT OR IGNORE');
  const args = coerce(params);
  if (/^SELECT/i.test(translated)) {
    const rows = db.prepare(translated).all(...args);
    rows.forEach(hydrateRow);
    return [rows];
  }
  const info = db.prepare(translated).run(...args);
  return [{ insertId: Number(info.lastInsertRowid), affectedRows: info.changes }];
}

module.exports = { pool: { query }, initSchema };
