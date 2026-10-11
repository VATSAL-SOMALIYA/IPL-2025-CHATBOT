/**
 * ==============================================================================
 * DATABASE ADAPTER & CONNECTION MANAGER (src/db.js)
 * ==============================================================================
 * 
 * Supports:
 * 1. Aiven Cloud PostgreSQL: Used when DATABASE_URL is set in .env / Render
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
  console.log('🐘 Connected to Aiven Cloud PostgreSQL Database.');
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
      // SQLite execution: convert booleans to 1/0
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
 * Initializes the database:
 * - Creates 6 core tables + points_table from src/schema.sql
 * - Seeds 10 IPL franchises and 10 venues
 * - Sets all 10 teams in points_table to 0 matches and 0 points
 * - Leaves matches, innings, deliveries, and players completely EMPTY!
 */
export async function initDb() {
  console.log(`📋 Initializing schema on [${getDbDialect()}]...`);

  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  // Disable FKs during schema sync on SQLite
  if (!isPostgres) {
    sqliteDb.exec('PRAGMA foreign_keys = OFF;');
  }

  // Clean recreate to ensure fresh column definitions
  const dropTables = ['deliveries', 'innings', 'matches', 'players', 'points_table', 'venues', 'teams', 'team', 'venue', 'playing_11', 'per_ball_data', 'wickets', 'final_result', 'match_details', 'match_officials', 'player_performance_in_a_match', 'partnership', 'users'];
  for (const t of dropTables) {
    try {
      await executeScript(`DROP TABLE IF EXISTS ${t} ${isPostgres ? 'CASCADE' : ''};`);
    } catch {}
  }

  await executeScript(schemaSql);

  // 1. Seed Teams
  const teams = [
    [1, 'Gujarat Titans', 'GT'],
    [2, 'Royal Challengers Bengaluru', 'RCB'],
    [3, 'Mumbai Indians', 'MI'],
    [4, 'Sunrisers Hyderabad', 'SRH'],
    [5, 'Lucknow Super Giants', 'LSG'],
    [6, 'Delhi Capitals', 'DC'],
    [7, 'Chennai Super Kings', 'CSK'],
    [8, 'Punjab Kings', 'PBKS'],
    [9, 'Kolkata Knight Riders', 'KKR'],
    [10, 'Rajasthan Royals', 'RR']
  ];

  for (const t of teams) {
    if (isPostgres) {
      await query(
        `INSERT INTO teams (team_id, team_name, short_name) VALUES (?, ?, ?)
         ON CONFLICT (team_id) DO UPDATE SET team_name = EXCLUDED.team_name, short_name = EXCLUDED.short_name`,
        t
      );
    } else {
      await query('INSERT OR REPLACE INTO teams (team_id, team_name, short_name) VALUES (?, ?, ?)', t);
    }
  }

  // 2. Seed Venues
  const venues = [
    [1, 'Narendra Modi Stadium', 'Ahmedabad'],
    [2, 'M. Chinnaswamy Stadium', 'Bengaluru'],
    [3, 'Wankhede Stadium', 'Mumbai'],
    [4, 'Rajiv Gandhi International Stadium', 'Hyderabad'],
    [5, 'BRSABV Ekana Cricket Stadium', 'Lucknow'],
    [6, 'Arun Jaitley Stadium', 'Delhi'],
    [7, 'MA Chidambaram Stadium (Chepauk)', 'Chennai'],
    [8, 'Maharaja Yadavindra Singh International Cricket Stadium', 'Mullanpur'],
    [9, 'Eden Gardens', 'Kolkata'],
    [10, 'Sawai Mansingh Stadium', 'Jaipur'],
    [11, 'ACA-VDCA Cricket Stadium', 'Visakhapatnam'],
    [12, 'Barsapara Cricket Stadium', 'Guwahati'],
    [13, 'Bharat Ratna Shri Atal Bihari Vajpayee Ekana Cricket Stadium', 'Lucknow'],
    [14, 'M.Chinnaswamy Stadium', 'Bengaluru'],
    [15, 'PCA International Cricket Stadium, Ground A', 'New Chandigarh'],
    [16, 'Himachal Pradesh Cricket Association Stadium', 'Dharamsala']
  ];

  for (const v of venues) {
    if (isPostgres) {
      await query(
        `INSERT INTO venues (venue_id, venue_name, city) VALUES (?, ?, ?)
         ON CONFLICT (venue_id) DO UPDATE SET venue_name = EXCLUDED.venue_name, city = EXCLUDED.city`,
        v
      );
    } else {
      await query('INSERT OR REPLACE INTO venues (venue_id, venue_name, city) VALUES (?, ?, ?)', v);
    }
  }

  // 3. Initialize points_table with 0 points for all teams
  for (const t of teams) {
    const teamId = t[0];
    if (isPostgres) {
      await query(
        `INSERT INTO points_table (team_id, matches_played, wins, losses, no_results, points, nrr)
         VALUES (?, 0, 0, 0, 0, 0, 0.0)
         ON CONFLICT (team_id) DO NOTHING`,
        [teamId]
      );
    } else {
      await query(
        `INSERT OR IGNORE INTO points_table (team_id, matches_played, wins, losses, no_results, points, nrr)
         VALUES (?, 0, 0, 0, 0, 0, 0.0)`,
        [teamId]
      );
    }
  }

  if (!isPostgres) {
    sqliteDb.exec('PRAGMA foreign_keys = ON;');
  }

  // Recalculate points table in case any matches already exist
  await recalculatePointsTable();

  console.log('✅ Database initialized successfully.');
  return await getDbSummary();
}

/**
 * Ensures schema tables and seeds exist without dropping or wiping existing match data.
 */
export async function ensureTablesExist() {
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  await executeScript(schemaSql);

  const teams = [
    [1, 'Gujarat Titans', 'GT'],
    [2, 'Royal Challengers Bengaluru', 'RCB'],
    [3, 'Mumbai Indians', 'MI'],
    [4, 'Sunrisers Hyderabad', 'SRH'],
    [5, 'Lucknow Super Giants', 'LSG'],
    [6, 'Delhi Capitals', 'DC'],
    [7, 'Chennai Super Kings', 'CSK'],
    [8, 'Punjab Kings', 'PBKS'],
    [9, 'Kolkata Knight Riders', 'KKR'],
    [10, 'Rajasthan Royals', 'RR']
  ];

  for (const t of teams) {
    if (isPostgres) {
      await query(
        `INSERT INTO teams (team_id, team_name, short_name) VALUES (?, ?, ?)
         ON CONFLICT (team_id) DO NOTHING`,
        t
      );
    } else {
      await query('INSERT OR IGNORE INTO teams (team_id, team_name, short_name) VALUES (?, ?, ?)', t);
    }
  }

  const venues = [
    [1, 'Narendra Modi Stadium', 'Ahmedabad'],
    [2, 'M. Chinnaswamy Stadium', 'Bengaluru'],
    [3, 'Wankhede Stadium', 'Mumbai'],
    [4, 'Rajiv Gandhi International Stadium', 'Hyderabad'],
    [5, 'BRSABV Ekana Cricket Stadium', 'Lucknow'],
    [6, 'Arun Jaitley Stadium', 'Delhi'],
    [7, 'MA Chidambaram Stadium (Chepauk)', 'Chennai'],
    [8, 'Maharaja Yadavindra Singh International Cricket Stadium', 'Mullanpur'],
    [9, 'Eden Gardens', 'Kolkata'],
    [10, 'Sawai Mansingh Stadium', 'Jaipur'],
    [11, 'ACA-VDCA Cricket Stadium', 'Visakhapatnam'],
    [12, 'Barsapara Cricket Stadium', 'Guwahati'],
    [13, 'Bharat Ratna Shri Atal Bihari Vajpayee Ekana Cricket Stadium', 'Lucknow'],
    [14, 'M.Chinnaswamy Stadium', 'Bengaluru'],
    [15, 'PCA International Cricket Stadium, Ground A', 'New Chandigarh'],
    [16, 'Himachal Pradesh Cricket Association Stadium', 'Dharamsala']
  ];

  for (const v of venues) {
    if (isPostgres) {
      await query(
        `INSERT INTO venues (venue_id, venue_name, city) VALUES (?, ?, ?)
         ON CONFLICT (venue_id) DO NOTHING`,
        v
      );
    } else {
      await query('INSERT OR IGNORE INTO venues (venue_id, venue_name, city) VALUES (?, ?, ?)', v);
    }
  }

  for (const t of teams) {
    const teamId = t[0];
    if (isPostgres) {
      await query(
        `INSERT INTO points_table (team_id, matches_played, wins, losses, no_results, points, nrr)
         VALUES (?, 0, 0, 0, 0, 0, 0.0)
         ON CONFLICT (team_id) DO NOTHING`,
        [teamId]
      );
    } else {
      await query(
        `INSERT OR IGNORE INTO points_table (team_id, matches_played, wins, losses, no_results, points, nrr)
         VALUES (?, 0, 0, 0, 0, 0, 0.0)`,
        [teamId]
      );
    }
  }

  await recalculatePointsTable();
}

/**
 * Dynamically updates the points table based on all matches recorded in the database.
 * Run automatically after every match import!
 */
export async function recalculatePointsTable() {
  const { rows: teamRows } = await query('SELECT team_id FROM teams');

  for (const t of teamRows) {
    const tid = t.team_id;

    // Matches played involving this team
    const { rows: playedRows } = await query(
      'SELECT count(*) as count FROM matches WHERE (team1_id = ? OR team2_id = ?) AND winner_team_id IS NOT NULL',
      [tid, tid]
    );
    const matchesPlayed = parseInt(playedRows[0]?.count || 0, 10);

    // Wins
    const { rows: winRows } = await query(
      'SELECT count(*) as count FROM matches WHERE winner_team_id = ?',
      [tid]
    );
    const wins = parseInt(winRows[0]?.count || 0, 10);

    // Losses
    const losses = Math.max(0, matchesPlayed - wins);
    const points = wins * 2;

    // Calculate NRR: (Runs scored / overs) - (Runs conceded / overs)
    let nrr = 0.0;
    if (matchesPlayed > 0) {
      const { rows: scoredRows } = await query(
        `SELECT COALESCE(SUM(d.total_runs), 0) AS runs, count(d.delivery_id) AS balls
         FROM deliveries d
         JOIN innings i ON d.innings_id = i.innings_id
         WHERE i.batting_team_id = ?`,
        [tid]
      );
      const { rows: concededRows } = await query(
        `SELECT COALESCE(SUM(d.total_runs), 0) AS runs, count(d.delivery_id) AS balls
         FROM deliveries d
         JOIN innings i ON d.innings_id = i.innings_id
         WHERE i.bowling_team_id = ?`,
        [tid]
      );

      const runsFor = parseInt(scoredRows[0]?.runs || 0, 10);
      const ballsFor = parseInt(scoredRows[0]?.balls || 0, 10);
      const runsAgainst = parseInt(concededRows[0]?.runs || 0, 10);
      const ballsAgainst = parseInt(concededRows[0]?.balls || 0, 10);

      const oversFor = ballsFor > 0 ? ballsFor / 6 : matchesPlayed * 20;
      const oversAgainst = ballsAgainst > 0 ? ballsAgainst / 6 : matchesPlayed * 20;

      const rateFor = runsFor / (oversFor || 1);
      const rateAgainst = runsAgainst / (oversAgainst || 1);
      nrr = parseFloat((rateFor - rateAgainst).toFixed(3));
    }

    await query(
      `UPDATE points_table
       SET matches_played = ?, wins = ?, losses = ?, points = ?, nrr = ?
       WHERE team_id = ?`,
      [matchesPlayed, wins, losses, points, nrr, tid]
    );
  }
}

/**
 * Returns table row counts summary.
 */
export async function getDbSummary() {
  const tables = ['teams', 'venues', 'players', 'matches', 'innings', 'deliveries', 'points_table'];
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
