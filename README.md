# 🏏 IPL 2025 Database Management System & AI Text-to-SQL Chatbot

An enterprise-grade, BCNF-normalized Relational Database Management System (DBMS) and Conversational AI Chatbot for querying complete **IPL 2025 tournament data** (Matches 1 to 74) in natural language. Powered by **Node.js**, **Express**, **LangChain.js**, and **Groq LPU AI** (with Google Gemini fallback).

[![GitHub](https://img.shields.io/badge/GitHub-Repository-blue?logo=github)](https://github.com/VATSAL-SOMALIYA/IPL-2025-CHATBOT)
[![Database](https://img.shields.io/badge/Database-SQLite%20%7C%20PostgreSQL-green?logo=postgresql)](https://github.com/VATSAL-SOMALIYA/IPL-2025-CHATBOT)
[![AI Engine](https://img.shields.io/badge/AI-Groq%20%7C%20Gemini-orange?logo=openai)](https://github.com/VATSAL-SOMALIYA/IPL-2025-CHATBOT)

---

## 📌 Project Overview

This project bridges traditional relational database systems and modern generative AI by translating natural language cricket queries into syntactically valid, read-only SQL statements. Users can ask questions in plain English—from match scorecards and dismissal modes to player economy rates and net run rate (NRR) calculations—and receive instant query execution with structured data visualization.

The database models the entire 2025 Indian Premier League season containing authentic ball-by-ball commentary, player rosters, venues, wickets, partnerships, and match results.

---

## 🏛️ Database Architecture & Normalization

The database adheres to **Boyce-Codd Normal Form (BCNF)** to eliminate data redundancy and ensure relational integrity across **13 relational tables**:

| Table Name | Description | Key Attributes |
|---|---|---|
| **`match_details`** | Schedule, status, toss decision, and timings for all 74 matches | `match_id`, `match_date`, `toss_decision`, `status`, `team1`, `team2`, `toss_winner`, `venue`, `match_time` |
| **`per_ball_data`** | Ball-by-ball deliveries (16,514 records) with runs, extras, and speeds | `ball_id`, `over_no`, `ball_no`, `of_match`, `inning_no`, `extras`, `wicket_no`, `total_score`, `run_scored`, `on_strike`, `off_strike`, `bowled_by`, `ball_speed`, `boundary` |
| **`wickets`** | Detailed dismissal records linked to individual deliveries | `wicket_id`, `wicket_type`, `player_got_out`, `caught_by`, `run_out_by`, `on_ball`, `stumped_by` |
| **`final_result`** | Official match outcomes, margins, and Player of the Match awards | `match_id`, `winner`, `loser`, `score_of_winner`, `score_of_loser`, `win_run_margin`, `win_wicket_margin`, `player_of_the_match` |
| **`player_performance_in_a_match`** | Aggregated match metrics per player | `match_id`, `player_id`, `runs`, `balls_played`, `wickets_taken`, `balls_bowled`, `runs_conceded`, `fours`, `sixes` |
| **`partnership`** | Wicket-by-wicket partnership runs and progressions | `partnership_id`, `player1`, `player2`, `match_id`, `runs`, `partnership_no`, `inning_no` |
| **`playing_11`** | Match appearances and player participation records | `match_id`, `player_id`, `team_id`, `is_substitute`, `substituted_out` |
| **`players`** | Master directory of tournament players | `player_id`, `name`, `batting_style`, `bowling_style`, `role`, `team_id`, `nationality` |
| **`team`** | Franchise profiles, captain mappings, and home grounds | `team_id`, `tname`, `captain_id`, `home_ground` |
| **`venue`** | Host stadiums, cities, and states | `venue_id`, `grd_name`, `city`, `state` |
| **`points_table`** | Dynamically updated standings with Net Run Rate (NRR) | `team_id`, `matches_played`, `wins`, `losses`, `no_results`, `points`, `nrr` |
| **`match_officials`** | On-field umpires and third umpires per match | `match_id`, `on_field1`, `on_field2`, `third_ump` |
| **`users`** | Authentication and access audit log | `user_id`, `password`, `last_access`, `date_of_sign_in` |

---

## ⚡ Technical Stack

- **Backend Runtime**: Node.js (ES Modules), Express.js
- **Database Engine**: SQLite (Embedded via Node.js `DatabaseSync`) / PostgreSQL (Cloud compatibility)
- **AI / LLM Framework**: LangChain.js
- **Primary AI Model**: Groq LPU Inference Engine (`openai/gpt-oss-120b`) for ultra-low latency inference
- **Fallback AI Model**: Google Gemini (`gemini-3.5-flash`) for multi-tier failover
- **Frontend Interface**: HTML5, CSS3, Vanilla JavaScript (responsive dark-themed dashboard)

---

## 🛡️ Security & Guardrails

1. **Strict Read-Only Enforcement**: The query execution pipeline validates all AI-generated SQL using AST parsing and regular expressions, rejecting any destructive statements (`DROP`, `TRUNCATE`, `ALTER`, `DELETE`, `INSERT`, `UPDATE`).
2. **SQL Injection Mitigation**: All parameterized and validated queries execute in a controlled database sandbox.
3. **Dual Model Failover**: If the primary AI provider encounters rate limits or service disruptions, the system automatically switches to the secondary model without user-facing interruptions.

---

## 📂 Project Structure

```
IPL-2025-CHATBOT/
├── src/
│   ├── db.js                      # Database adapter & connection manager
│   ├── schema.sql                 # 13-table BCNF relational schema DDL
│   ├── server.js                  # Express.js server & API bootstrap
│   ├── routes/
│   │   ├── chat.js                # POST /api/chat (Natural language to SQL pipeline)
│   │   └── stats.js               # GET /api/stats (Database summary & points table)
│   └── services/
│       └── sqlGenerator.js        # Multi-model LangChain.js Text-to-SQL engine
├── public/
│   ├── index.html                 # Interactive chat dashboard UI
│   ├── style.css                  # Modern UI styling & responsive layout
│   └── app.js                     # Frontend event handling & API integration
├── ipl_database.sqlite            # Complete dataset (74 matches, 16,514 deliveries)
├── package.json                   # Project dependencies and startup scripts
└── README.md                      # Project documentation & architectural specs
```

---

## 📜 License

ISC License — Developed by [Vatsal Somaliya](https://github.com/VATSAL-SOMALIYA).
