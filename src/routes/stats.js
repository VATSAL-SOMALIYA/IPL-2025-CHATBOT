/**
 * ==============================================================================
 * STATS ROUTES (src/routes/stats.js)
 * ==============================================================================
 * 
 * Provides:
 * - GET /api/stats (Database summary & Live Points Table)
 */

import express from 'express';
import { getDbSummary, query } from '../db.js';

const router = express.Router();

/**
 * GET /api/stats
 * Returns database summary and live points table.
 */
router.get('/stats', async (req, res) => {
  try {
    const { rows: pointsTable } = await query(
      `SELECT t.tname AS team_name, pt.matches_played, pt.wins, pt.losses, pt.points, pt.nrr
       FROM points_table pt
       JOIN team t ON pt.team_id = t.team_id
       ORDER BY pt.points DESC, pt.nrr DESC`
    );
    const summary = await getDbSummary();
    res.json({ summary, pointsTable });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
