/**
 * ==============================================================================
 * TEXT-TO-SQL AI GENERATOR & EXECUTOR (src/services/sqlGenerator.js)
 * ==============================================================================
 * 
 * Flow:
 * 1. Read database schema from src/schema.sql
 * 2. Send schema + user question to AI:
 *    - Primary: Groq (using GROQ_API_KEY)
 *    - Fallback: Google Gemini (using GEMINI_API_KEY if Groq is unavailable)
 *    - Tertiary: OpenAI (using OPENAI_API_KEY if configured)
 * 3. Validate generated SQL SELECT query (strictly read-only guardrails)
 * 4. Execute SQL against database
 * 5. Return structured answer, query, and data rows
 * 
 * Strictly AI-only: NO offline fallback rules or simulated queries.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { query, getDbDialect } from '../db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read schema once
const schemaPath = path.resolve(__dirname, '../schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');

/**
 * Builds candidate AI model providers in priority order:
 * 1. Groq (primary)
 * 2. Gemini (fallback)
 * 3. OpenAI (tertiary)
 */
async function getCandidateAiModels() {
  const candidates = [];

  // 1. Primary: Groq
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey && groqKey.trim() !== '') {
    const { ChatGroq } = await import('@langchain/groq');
    const modelName = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
    candidates.push({
      provider: `Groq (${modelName})`,
      getModel: () => new ChatGroq({
        apiKey: groqKey.trim(),
        model: modelName,
        temperature: 0.1,
        maxRetries: 1
      })
    });
  }

  // 2. Fallback: Google Gemini
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (geminiKey && geminiKey.trim() !== '') {
    const { ChatGoogleGenerativeAI } = await import('@langchain/google-genai');
    const modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
    candidates.push({
      provider: `Google Gemini (${modelName})`,
      getModel: () => new ChatGoogleGenerativeAI({
        apiKey: geminiKey.trim(),
        model: modelName,
        temperature: 0.1,
        maxRetries: 0
      })
    });
  }

  // 3. Tertiary: OpenAI
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey && openaiKey.trim() !== '') {
    const { ChatOpenAI } = await import('@langchain/openai');
    const modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    candidates.push({
      provider: `OpenAI (${modelName})`,
      getModel: () => new ChatOpenAI({
        apiKey: openaiKey.trim(),
        modelName,
        temperature: 0.1,
        maxRetries: 0
      })
    });
  }

  if (candidates.length === 0) {
    throw new Error('No AI API key found! Please configure GROQ_API_KEY or GEMINI_API_KEY in your .env file.');
  }

  return candidates;
}

/**
 * Validates generated SQL to ensure it is strictly read-only.
 */
export function validateSql(sql) {
  if (!sql || typeof sql !== 'string') {
    throw new Error('AI did not return any SQL query.');
  }

  const clean = sql.trim();
  const upper = clean.toUpperCase();

  const forbidden = ['DROP ', 'TRUNCATE ', 'ALTER ', 'DELETE ', 'INSERT ', 'UPDATE ', 'GRANT '];
  for (const word of forbidden) {
    if (upper.includes(word)) {
      throw new Error(`Security Violation: Destructive command rejected (${word.trim()}).`);
    }
  }

  if (!upper.startsWith('SELECT') && !upper.startsWith('WITH')) {
    throw new Error('Security Violation: Only SELECT or WITH queries are permitted.');
  }

  return clean;
}

/**
 * Translates natural language question to SQL using AI (Groq first, Gemini fallback),
 * executes it, and returns results.
 * 
 * @param {string} userQuestion - User's cricket question
 * @returns {Promise<{ question: string, sql: string, rows: Array<Object>, rowCount: number, answer: string, provider: string }>}
 */
export async function processQuestion(userQuestion) {
  const candidates = await getCandidateAiModels();
  const dialect = getDbDialect();

  const systemPrompt = `You are an IPL database assistant. You will receive the database schema and a user question. Generate one valid SQL SELECT query that answers the question using only the supplied schema.

DATABASE SCHEMA:
${schemaSql}

DIALECT: ${dialect === 'postgres' ? 'PostgreSQL' : 'SQLite'}

TABLES & USAGE GUIDELINES:
- team (team_id, tname, captain_id, home_ground)
- venue (venue_id, city, state, grd_name)
- players (player_id, batting_style, bowling_style, name, role, team_id, nationality)
- match_details (match_id, match_date, toss_decision, status, team1, team2, toss_winner, venue, match_time)
- playing_11 (match_id, player_id, team_id, is_substitute, substituted_out)
- per_ball_data (ball_id, over_no, ball_no, of_match, inning_no, extras, wicket_no, total_score, run_scored, on_strike, off_strike, bowled_by, ball_speed, type_of_extra, striker_batting_position, boundary)
- wickets (wicket_id, wicket_type, player_got_out, caught_by, run_out_by, on_ball, stumped_by)
- player_performance_in_a_match (match_id, player_id, runs, balls_played, wickets_taken, balls_bowled, runs_conceded, fours, sixes, fours_conceded, sixes_conceded)
- final_result (match_id, winner, loser, score_of_winner, score_of_loser, win_run_margin, win_wicket_margin, player_of_the_match)
- match_officials (match_id, on_field1, on_field2, third_ump)
- partnership (partnership_id, player1, player2, match_id, runs, partnership_no, inning_no)
- points_table (team_id, matches_played, wins, losses, no_results, points, nrr)
- users (user_id, password, last_access, date_of_sign_in)

CRICKET TERMINOLOGY & CALCULATION RULES:
1. Bowling Economy Rate:
   - Formula: (Runs Conceded * 6.0) / Balls Bowled
   - In SQL: ROUND((SUM(ppm.runs_conceded) * 6.0) / NULLIF(SUM(ppm.balls_bowled), 0), 2) AS economy_rate
   - When asked for "best economy" / "economy list of season":
     Filter by minimum qualification to exclude part-timers (e.g. HAVING SUM(ppm.balls_bowled) >= 60 for the tournament, or >= 12 in a single match).
     Order by economy_rate ASC.
2. Batting Strike Rate:
   - Formula: (Runs Scored * 100.0) / Balls Faced
   - In SQL: ROUND((SUM(ppm.runs) * 100.0) / NULLIF(SUM(ppm.balls_played), 0), 2) AS strike_rate
3. Bowling Average:
   - Formula: Runs Conceded / Wickets Taken
   - In SQL: ROUND((SUM(ppm.runs_conceded) * 1.0) / NULLIF(SUM(ppm.wickets_taken), 0), 2) AS bowling_average
4. Bowling Strike Rate:
   - Formula: Balls Bowled / Wickets Taken
   - In SQL: ROUND((SUM(ppm.balls_bowled) * 1.0) / NULLIF(SUM(ppm.wickets_taken), 0), 2) AS bowling_strike_rate
5. Orange Cap / Most Runs of the Season:
   - SUM(ppm.runs) AS total_runs FROM player_performance_in_a_match ppm GROUP BY ppm.player_id ORDER BY total_runs DESC LIMIT 10
6. Purple Cap / Most Wickets of the Season:
   - SUM(ppm.wickets_taken) AS total_wickets FROM player_performance_in_a_match ppm GROUP BY ppm.player_id ORDER BY total_wickets DESC LIMIT 10
7. Most Sixes / Most Fours:
   - SUM(ppm.sixes) AS total_sixes, SUM(ppm.fours) AS total_fours
8. Best Bowling Figures:
   - In a match: ORDER BY ppm.wickets_taken DESC, ppm.runs_conceded ASC LIMIT 10
9. Dot Balls:
   - Deliveries in per_ball_data where run_scored = 0 AND extras = 0
10. Match Winner & Margin:
    - In final_result: win_run_margin is set when the winning team defended (batted first); win_wicket_margin is set when the winning team chased (batted second).
11. Standings / Points Table:
    - Query points_table JOIN team ON points_table.team_id = team.team_id ORDER BY points DESC, nrr DESC.

CRITICAL SQL SYNTAX RULES:
- Write standard ANSI SQL compatible with both PostgreSQL and SQLite.
- DO NOT use PostgreSQL-specific type casting like "::numeric" or "::text". Use standard "CAST(x AS FLOAT)" or multiply by "1.0" (e.g. "1.0 * x / y").
- Always protect divisions with "NULLIF(divisor, 0)" to prevent divide-by-zero errors.
- Always JOIN players table to display player names ("p.name").
- Always JOIN team table to display team names ("t.tname").
- When a user asks for "match 1" or "match X", filter by match_details.match_id = X or per_ball_data.of_match = X.
- Use only existing tables and columns.
- Use correct joins and aggregations.
- Return SQL only inside a \`\`\`sql ... \`\`\` block.
- Never generate INSERT, UPDATE, DELETE, or DROP queries.
- If the question cannot be answered from the schema, explain what information is missing.`;

  const { HumanMessage, SystemMessage } = await import('@langchain/core/messages');

  let sql = '';
  let activeProvider = '';
  let lastError = null;

  // Try each configured AI provider in priority order (Groq first, then Gemini)
  for (const candidate of candidates) {
    try {
      activeProvider = candidate.provider;
      const model = candidate.getModel();
      const response = await model.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(userQuestion)
      ]);

      const rawContent = response.content.toString();
      const sqlMatch = rawContent.match(/```sql([\s\S]*?)```/i);
      sql = sqlMatch ? sqlMatch[1].trim() : rawContent.trim();

      if (sql) {
        lastError = null;
        break; // Successfully generated SQL!
      }
    } catch (err) {
      console.warn(`⚠️ AI call failed on ${candidate.provider}: ${err.message}.`);
      lastError = err;
    }
  }

  if (lastError || !sql) {
    throw new Error(`AI Generation Failed: ${lastError?.message || 'No SQL generated by AI.'}`);
  }

  // Strip trailing semicolon if needed
  sql = sql.replace(/;+\s*$/, '');

  // Validate SQL strictly
  const validatedSql = validateSql(sql);

  // Execute SQL against database
  let rows = [];
  let rowCount = 0;
  try {
    const res = await query(validatedSql);
    rows = res.rows || [];
    rowCount = res.rowCount || rows.length;
  } catch (err) {
    throw new Error(`SQL Execution Failed: ${err.message}\nGenerated Query: ${validatedSql}`);
  }

  // Synthesize friendly natural answer
  let answer = '';
  if (rows.length === 0) {
    answer = `No matching records found in the database for "${userQuestion}".`;
  } else if (rows.length === 1 && Object.keys(rows[0]).length === 1) {
    const val = Object.values(rows[0])[0];
    answer = `Result: **${val}**`;
  } else {
    answer = `Found **${rowCount}** result(s) for your query. See table below.`;
  }

  return {
    question: userQuestion,
    sql: validatedSql,
    rows: rows.slice(0, 50),
    rowCount,
    answer,
    provider: activeProvider
  };
}
