/**
 * ==============================================================================
 * NATURAL LANGUAGE CHAT ROUTE (src/routes/chat.js)
 * ==============================================================================
 * 
 * POST /api/chat
 * Takes user question, generates SQL using schema, executes it, and returns answer.
 */

import express from 'express';
import { processQuestion, validateSql } from '../services/sqlGenerator.js';
import { query } from '../db.js';

const router = express.Router();

/**
 * POST /api/chat
 */
router.post('/chat', async (req, res) => {
  try {
    const question = req.body.question || req.body.message;
    const history = Array.isArray(req.body.history) ? req.body.history : [];

    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'Question is required.' });
    }

    const result = await processQuestion(question.trim(), history);
    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    console.error('Chat Error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/query
 * Executes a direct read-only SELECT query.
 */
router.post('/query', async (req, res) => {
  try {
    const { sql } = req.body;
    if (!sql) {
      return res.status(400).json({ error: 'SQL query is required.' });
    }

    const validated = validateSql(sql);
    const { rows, rowCount } = await query(validated);

    res.json({
      success: true,
      sql: validated,
      rowCount,
      rows
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
