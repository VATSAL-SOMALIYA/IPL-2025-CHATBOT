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

RULES:
- In the matches table, match_id is sequentially numbered from 1 to 74 representing the IPL 2025 match number (Match 1 has match_id = 1, Match 2 has match_id = 2 ... Final has match_id = 74).
- The matches table also contains match_name (e.g. '1st Match', '2nd Match', 'Qualifier 1', 'Eliminator', 'Qualifier 2', 'Final').
- When a user asks for "match 1" or "match X", filter by match_id = X (or i.match_id = X on innings).
- When a user asks for "scorecard of match X", join innings, deliveries, players, and teams on i.match_id = X to calculate player runs, balls, fours, sixes grouped by innings_number, player_name.
- Use only existing tables and columns.
- Use correct joins and aggregations.
- Do not invent player names or statistics.
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
