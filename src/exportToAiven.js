/**
 * ==============================================================================
 * AIVEN POSTGRESQL EXPORTER & MIGRATOR (src/exportToAiven.js)
 * ==============================================================================
 * 
 * Transfers all 74 IPL 2025 matches, venues, teams, players, innings,
 * deliveries, and points table records from the database directly into
 * an Aiven PostgreSQL instance (using DATABASE_URL from .env).
 * Also outputs a standalone SQL dump file (aiven_ipl2025_dump.sql).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { query as localQuery } from './db.js';
import pg from 'pg';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function exportDump() {
  console.log('📦 Reading all tables from local database...');

  const { rows: teams } = await localQuery('SELECT * FROM teams ORDER BY team_id');
  const { rows: venues } = await localQuery('SELECT * FROM venues ORDER BY venue_id');
  const { rows: players } = await localQuery('SELECT * FROM players ORDER BY player_id');
  const { rows: matches } = await localQuery('SELECT * FROM matches ORDER BY match_id');
  const { rows: innings } = await localQuery('SELECT * FROM innings ORDER BY innings_id');
  const { rows: deliveries } = await localQuery('SELECT * FROM deliveries ORDER BY delivery_id');
  const { rows: pointsTable } = await localQuery('SELECT * FROM points_table ORDER BY points DESC, nrr DESC');

  console.log(`Extracted:
  - Teams: ${teams.length}
  - Venues: ${venues.length}
  - Players: ${players.length}
  - Matches: ${matches.length}
  - Innings: ${innings.length}
  - Deliveries: ${deliveries.length}
  - Points Table: ${pointsTable.length}`);

  // 1. Generate standalone aiven_ipl2025_dump.sql
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  let sqlDump = `-- ==============================================================================
-- AIVEN POSTGRESQL IPL 2025 COMPLETE DATABASE DUMP
-- Generated on: ${new Date().toISOString()}
-- Matches: ${matches.length} | Deliveries: ${deliveries.length} | Teams: ${teams.length}
-- ==============================================================================

-- Drop existing tables if re-importing
DROP TABLE IF EXISTS deliveries CASCADE;
DROP TABLE IF EXISTS innings CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS points_table CASCADE;
DROP TABLE IF EXISTS venues CASCADE;
DROP TABLE IF EXISTS teams CASCADE;

-- Create Schema
${schemaSql}

-- Disable foreign key constraints temporarily during bulk insert
SET session_replication_role = 'replica';

`;

  // Helper to escape SQL strings
  function esc(val) {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return val;
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    return `'${String(val).replace(/'/g, "''")}'`;
  }

  // 1. Teams
  sqlDump += '\n-- 1. Teams\n';
  for (const t of teams) {
    sqlDump += `INSERT INTO teams (team_id, team_name, short_name) VALUES (${t.team_id}, ${esc(t.team_name)}, ${esc(t.short_name)}) ON CONFLICT (team_id) DO NOTHING;\n`;
  }

  // 2. Venues
  sqlDump += '\n-- 2. Venues\n';
  for (const v of venues) {
    sqlDump += `INSERT INTO venues (venue_id, venue_name, city) VALUES (${v.venue_id}, ${esc(v.venue_name)}, ${esc(v.city)}) ON CONFLICT (venue_id) DO NOTHING;\n`;
  }

  // 3. Players
  sqlDump += '\n-- 3. Players\n';
  for (const p of players) {
    sqlDump += `INSERT INTO players (player_id, player_name, team_id) VALUES (${p.player_id}, ${esc(p.player_name)}, ${p.team_id ?? 'NULL'});\n`;
  }

  // 4. Matches
  sqlDump += '\n-- 4. Matches\n';
  for (const m of matches) {
    sqlDump += `INSERT INTO matches (match_id, season, match_date, venue_id, team1_id, team2_id, winner_team_id) VALUES (${m.match_id}, ${m.season}, ${esc(m.match_date)}, ${m.venue_id ?? 'NULL'}, ${m.team1_id}, ${m.team2_id}, ${m.winner_team_id ?? 'NULL'});\n`;
  }

  // 5. Innings
  sqlDump += '\n-- 5. Innings\n';
  for (const inn of innings) {
    sqlDump += `INSERT INTO innings (innings_id, match_id, batting_team_id, bowling_team_id, innings_number) VALUES (${inn.innings_id}, ${inn.match_id}, ${inn.batting_team_id}, ${inn.bowling_team_id}, ${inn.innings_number});\n`;
  }

  // 6. Deliveries (batch into 500-row chunks for high performance)
  sqlDump += '\n-- 6. Deliveries (Ball-by-Ball)\n';
  const chunkSize = 200;
  for (let i = 0; i < deliveries.length; i += chunkSize) {
    const chunk = deliveries.slice(i, i + chunkSize);
    sqlDump += `INSERT INTO deliveries (delivery_id, innings_id, over_number, ball_number, batter_id, bowler_id, batter_runs, extra_runs, total_runs, is_wicket, dismissal_type, commentary) VALUES\n`;
    const rowsSql = chunk.map(d => 
      `(${d.delivery_id}, ${d.innings_id}, ${d.over_number}, ${d.ball_number}, ${d.batter_id}, ${d.bowler_id}, ${d.batter_runs}, ${d.extra_runs}, ${d.total_runs}, ${d.is_wicket ? 'TRUE' : 'FALSE'}, ${esc(d.dismissal_type)}, ${esc(d.commentary)})`
    ).join(',\n');
    sqlDump += rowsSql + ';\n';
  }

  // 7. Points Table
  sqlDump += '\n-- 7. Points Table\n';
  for (const pt of pointsTable) {
    sqlDump += `INSERT INTO points_table (team_id, matches_played, wins, losses, no_results, points, nrr) VALUES (${pt.team_id}, ${pt.matches_played}, ${pt.wins}, ${pt.losses}, ${pt.no_results ?? 0}, ${pt.points}, ${pt.nrr}) ON CONFLICT (team_id) DO UPDATE SET matches_played = EXCLUDED.matches_played, wins = EXCLUDED.wins, losses = EXCLUDED.losses, points = EXCLUDED.points, nrr = EXCLUDED.nrr;\n`;
  }

  sqlDump += `\n-- Re-enable constraints\nSET session_replication_role = 'origin';\n`;

  const dumpPath = path.resolve(__dirname, '../aiven_ipl2025_dump.sql');
  fs.writeFileSync(dumpPath, sqlDump, 'utf8');
  console.log(`\n💾 Saved complete SQL dump to: ${dumpPath} (${(sqlDump.length / 1024 / 1024).toFixed(2)} MB)`);

  // 2. If DATABASE_URL is provided, upload directly to Aiven PostgreSQL!
  const aivenUrl = process.env.DATABASE_URL;
  if (aivenUrl && (aivenUrl.startsWith('postgres://') || aivenUrl.startsWith('postgresql://'))) {
    console.log('\n🚀 DATABASE_URL found. Directly pushing data into Aiven PostgreSQL...');
    const client = new pg.Client({
      connectionString: aivenUrl,
      ssl: { rejectUnauthorized: false }
    });

    try {
      await client.connect();
      console.log('✅ Connected to Aiven PostgreSQL!');
      console.log('Executing dump script on Aiven...');
      await client.query(sqlDump);
      console.log('🎉 Successfully populated Aiven PostgreSQL database with all IPL 2025 data!');
      await client.end();
    } catch (err) {
      console.error('❌ Error executing dump on Aiven PostgreSQL:', err.message);
      if (client) await client.end().catch(() => {});
    }
  } else {
    console.log('\nℹ️ No Aiven DATABASE_URL configured yet in .env.');
    console.log('   When your Aiven PostgreSQL instance is created:');
    console.log('   1. Put DATABASE_URL=postgres://... in your .env');
    console.log('   2. Run: npm run export-to-aiven');
    console.log('   OR run the generated aiven_ipl2025_dump.sql directly in Aiven console.');
  }
}

exportDump().catch(console.error);
