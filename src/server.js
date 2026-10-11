/**
 * ==============================================================================
 * EXPRESS APPLICATION SERVER (src/server.js)
 * ==============================================================================
 */

import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import statsRoutes from './routes/stats.js';
import chatRoutes from './routes/chat.js';
import { ensureTablesExist, getDbDialect } from './db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api', statsRoutes);
app.use('/api', chatRoutes);

// Ensure database tables exist on server startup without wiping data
ensureTablesExist()
  .then(() => {
    console.log(`⚡ IPL DBMS ready on [${getDbDialect()}]`);
  })
  .catch((err) => {
    console.error('❌ Database initialization error:', err);
  });

app.listen(PORT, () => {
  console.log(`\n🏏 IPL Chatbot Server running on http://localhost:${PORT}`);
  console.log(`📡 Endpoints:`);
  console.log(`   - POST /api/chat     (Natural language -> SQL -> Answer)`);
  console.log(`   - GET  /api/stats    (Database summary & points table)\n`);
});
