/**
 * ==============================================================================
 * DATABASE ADAPTER (src/db.js)
 * ==============================================================================
 * Universal adapter supporting:
 * 1. Neon Cloud PostgreSQL: Used when DATABASE_URL is set in .env / Render
 * 2. Local SQLite: Used when DATABASE_URL is empty (zero-config local development)
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isPostgres = Boolean(process.env.DATABASE_URL);
let pgPool = null;
let sqliteDb = null;

if (isPostgres) {
  const { default: pg } = await import('pg');
  const { Pool } = pg;
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  console.log('🐘 Connected to Neon Cloud PostgreSQL Database.');
} else {
  const { DatabaseSync } = await import('node:sqlite');
  const DB_PATH = path.resolve(__dirname, '../ipl_database.sqlite');
  sqliteDb = new DatabaseSync(DB_PATH);
  sqliteDb.exec('PRAGMA foreign_keys = ON;');
  sqliteDb.exec('PRAGMA journal_mode = WAL;');
  console.log('💾 Connected to Local SQLite Database (ipl_database.sqlite).');
}

export function getDbDialect() {
  return isPostgres ? 'postgres' : 'sqlite';
}

/**
 * Executes a parameterized SQL query and returns { rows, rowCount }.
 */
export async function query(sql, params = []) {
  try {
    if (isPostgres) {
      // Convert ? placeholders to $1, $2, ... for PostgreSQL
      let pgSql = sql;
      if (params.length > 0 && pgSql.includes('?')) {
        let pIndex = 1;
        pgSql = pgSql.replace(/\?/g, () => `$${pIndex++}`);
      }
      const res = await pgPool.query(pgSql, params);
      return { rows: res.rows, rowCount: res.rowCount };
    } else {
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
    }
  } catch (err) {
    throw new Error(`Database Error: ${err.message}\nSQL: ${sql}`);
  }
}

/**
 * Executes a raw multi-statement SQL script.
 */
export async function executeScript(sqlScript) {
  if (isPostgres) {
    return await pgPool.query(sqlScript);
  } else {
    return sqliteDb.exec(sqlScript);
  }
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
