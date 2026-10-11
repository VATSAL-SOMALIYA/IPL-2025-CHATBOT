# 🏏 IPL 2025 Database & AI Chatbot

A production-ready JavaScript full-stack application for querying complete **IPL 2025 ball-by-ball match data** using Natural Language to SQL, powered by **LangChain.js** and **Groq AI** (with Google Gemini fallback), featuring dynamic points table standings and full support for **Aiven PostgreSQL**.

---

## 🌟 Key Features

1. **Complete Authentic IPL 2025 Dataset**:
   - **74 Matches**: Full tournament coverage from Match 1 (KKR vs RCB) to Match 74 (Final: RCB vs PBKS).
   - **16,514 Ball-by-Ball Deliveries**: Authentic player stats, runs, balls, boundaries (4s & 6s), wickets, and commentary extracted directly from Cricbuzz official scorecards.
   - **226 Players & 16 Host Venues**: Real squad rosters and stadiums.

2. **Live Dynamic Points Table**:
   - Matches played, wins, losses, points, and Net Run Rate (NRR) calculated dynamically match-by-match.

3. **Natural Language to SQL Chatbot**:
   - Ask cricket questions in plain English (*"Give scorecard of match 5"*, *"Who won the final?"*, *"Which batter hit the most sixes?"*).
   - Translates questions into validated, read-only SQL queries using **Groq** (with automatic **Gemini** fallback).
   - Executes SQL directly against the database and displays formatted results and tables.

4. **Dual Database Architecture**:
   - **SQLite**: Zero-configuration local database (`ipl_database.sqlite`).
   - **Aiven Cloud PostgreSQL**: Seamless migration via `DATABASE_URL` or the generated standalone SQL dump (`aiven_ipl2025_dump.sql`).

---

## 🏗️ Architecture

```
User asks a question in English ("Give scorecard of match 5")
                        │
                        ▼
           Frontend Web UI (HTML / CSS / JS)
                        │
                        ▼
            Express.js Server (`POST /api/chat`)
                        │
                        ▼
     LangChain.js + AI Model (Groq / Gemini)
     (Database schema + prompt -> SQL SELECT query)
                        │
                        ▼
         SQL Query Validator (Read-only Guardrail)
                        │
                        ▼
          Database Engine (SQLite / PostgreSQL)
        Matches · Innings · Deliveries · Players · Standings
                        │
                        ▼
   Interactive Answer + SQL Code Card + Results Table
```

---

## 📁 Project Structure

```
IPL-2025-CHATBOT/
├── src/
│   ├── db.js                      # PostgreSQL (Aiven) & SQLite universal adapter
│   ├── schema.sql                 # Relational schema (teams, venues, players, matches, innings, deliveries, points_table)
│   ├── exportToAiven.js           # Exporter to Aiven Cloud PostgreSQL & SQL dump generator
│   ├── routes/
│   │   ├── chat.js                # POST /api/chat (Text-to-SQL endpoint)
│   │   └── stats.js               # GET /api/stats (Database summary & points table)
│   ├── services/
│   │   ├── insertDeliveries.js    # Foreign key resolvers & dynamic NRR calculator
│   │   └── sqlGenerator.js        # LangChain.js AI Text-to-SQL generator (Groq + Gemini)
│   └── server.js                  # Express.js application entry point
├── public/
│   ├── index.html                 # Web dashboard UI
│   ├── style.css                  # Modern dark theme styling
│   └── app.js                     # Frontend interactive chat & standings logic
├── aiven_ipl2025_dump.sql         # 1.95 MB standalone SQL dump for Aiven PostgreSQL
├── ipl2025_cricbuzz_scorecards.json # Authentic raw Cricbuzz scorecard data for all 74 matches
├── populate_authentic_ipl2025.js  # Database populator script
├── G4-T1_DDL_script.txt           # Project DDL schema reference
├── .env.example                   # Environment configuration template
├── .gitignore                     # Git ignore rules (protects credentials)
└── package.json                   # Dependencies and scripts
```

---

## 🚀 Quickstart

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (`.env`)
Create a `.env` file from `.env.example`:
```env
# AI Model (Free API key from https://console.groq.com)
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-120b

# Google Gemini (Optional fallback)
GEMINI_API_KEY=your_gemini_key_here
GEMINI_MODEL=gemini-3.5-flash

# Database: Leave empty for local SQLite (zero-config), or paste your Aiven PostgreSQL URL:
DATABASE_URL=
```

### 3. Populate Database (If starting clean)
```bash
npm run populate-db
```
*Populates all 74 matches, 16,514 deliveries, and computes the points table.*

### 4. Start Application
```bash
npm start
```
Open **`http://localhost:3000`** in your browser.

---

## 🐘 Export to Aiven Cloud PostgreSQL

When you create your Aiven PostgreSQL service:
1. Paste your service URI into `.env`:
   ```env
   DATABASE_URL=postgres://avnadmin:password@host:port/defaultdb?sslmode=require
   ```
2. Run the migration script:
   ```bash
   npm run export-to-aiven
   ```
   *Or execute `aiven_ipl2025_dump.sql` directly inside the Aiven Web Console.*

---

## 📜 License
ISC License
