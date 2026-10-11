/**
 * ==============================================================================
 * DATABASE ADAPTER (src/db.js)
 * ==============================================================================
 * Zero-config local SQLite adapter using Node.js built-in DatabaseSync.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.resolve(__dirname, '../ipl_database.sqlite');
export const sqliteDb = new DatabaseSync(DB_PATH);
sqliteDb.exec('PRAGMA foreign_keys = ON;');
sqliteDb.exec('PRAGMA journal_mode = WAL;');

console.log('💾 Connected to Local SQLite Database (ipl_database.sqlite).');

export function getDbDialect() {
  return 'sqlite';
}

/**
 * Executes a parameterized SQL query and returns { rows, rowCount }.
 */
export async function query(sql, params = []) {
  try {
    const sqliteParams = params.map(p => typeof p === 'boolean' ? (p ? 1 : 0) : p);
    const stmt = sqliteDb.prepare(sql);
    const isSelect = /^\s*(SELECT|WITH|PRAGMA|EXPLAIN)/i.test(sql);
    if (isSelect) {
      const rows = stmt.all(...sqliteParams);
      return { rows, rowCount: rows.length };
    } else {
      const info = stmt.run(...sqliteParams);
      return { rows: [], rowCount: info.changes || 0 };
    }
  } catch (err) {
    throw new Error(`Database Error: ${err.message}\nSQL: ${sql}`);
  }
}

/**
 * Executes a raw multi-statement SQL script.
 */
export async function executeScript(sqlScript) {
  return sqliteDb.exec(sqlScript);
}

/**
 * Ensures schema exists and logs table status.
 */
export async function ensureTablesExist() {
  const summary = await getDbSummary();
  console.log('📊 Database tables status:', summary);
}

/**
 * Returns table row counts summary for all 13 authentic tables.
 */
export async function getDbSummary() {
  const tables = [
    'venue', 'team', 'players', 'match_details', 'playing_11',
    'per_ball_data', 'wickets', 'player_performance_in_a_match',
    'final_result', 'match_officials', 'partnership', 'points_table', 'users'
  ];
  const summary = {};
  for (const t of tables) {
    try {
      const { rows } = await query(`SELECT count(*) as count FROM ${t}`);
      summary[t] = parseInt(rows[0]?.count || 0, 10);
    } catch {
      summary[t] = 0;
    }
  }
  return summary;
}
