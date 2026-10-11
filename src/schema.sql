-- ==============================================================================
-- IPL RELATIONAL DATABASE SCHEMA (src/schema.sql)
-- ==============================================================================

-- 1. Teams
CREATE TABLE IF NOT EXISTS teams (
    team_id INT PRIMARY KEY,
    team_name VARCHAR(100) NOT NULL,
    short_name VARCHAR(10) NOT NULL UNIQUE
);

-- 2. Venues
CREATE TABLE IF NOT EXISTS venues (
    venue_id INT PRIMARY KEY,
    venue_name VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL
);

-- 3. Players
CREATE TABLE IF NOT EXISTS players (
    player_id INT PRIMARY KEY,
    player_name VARCHAR(100) NOT NULL,
    team_id INT,
    FOREIGN KEY (team_id) REFERENCES teams(team_id)
);

-- 4. Matches
CREATE TABLE IF NOT EXISTS matches (
    match_id INT PRIMARY KEY,
    season INT NOT NULL DEFAULT 2025,
    match_name VARCHAR(100),
    match_date DATE,
    venue_id INT,
    team1_id INT,
    team2_id INT,
    winner_team_id INT,
    cricbuzz_id INT,
    FOREIGN KEY (venue_id) REFERENCES venues(venue_id),
    FOREIGN KEY (team1_id) REFERENCES teams(team_id),
    FOREIGN KEY (team2_id) REFERENCES teams(team_id),
    FOREIGN KEY (winner_team_id) REFERENCES teams(team_id)
);

-- 5. Innings
CREATE TABLE IF NOT EXISTS innings (
    innings_id INT PRIMARY KEY,
    match_id INT NOT NULL,
    batting_team_id INT NOT NULL,
    bowling_team_id INT NOT NULL,
    innings_number INT NOT NULL,
    FOREIGN KEY (match_id) REFERENCES matches(match_id),
    FOREIGN KEY (batting_team_id) REFERENCES teams(team_id),
    FOREIGN KEY (bowling_team_id) REFERENCES teams(team_id)
);

-- 6. Deliveries (Ball-by-Ball)
CREATE TABLE IF NOT EXISTS deliveries (
    delivery_id INT PRIMARY KEY,
    innings_id INT NOT NULL,
    over_number INT NOT NULL,
    ball_number INT NOT NULL,
    batter_id INT NOT NULL,
    bowler_id INT NOT NULL,
    batter_runs INT NOT NULL DEFAULT 0,
    extra_runs INT NOT NULL DEFAULT 0,
    total_runs INT NOT NULL DEFAULT 0,
    is_wicket BOOLEAN NOT NULL DEFAULT FALSE,
    dismissal_type VARCHAR(50),
    commentary TEXT,
    FOREIGN KEY (innings_id) REFERENCES innings(innings_id),
    FOREIGN KEY (batter_id) REFERENCES players(player_id),
    FOREIGN KEY (bowler_id) REFERENCES players(player_id)
);

-- 7. Points Table (Dynamically updated after every match)
CREATE TABLE IF NOT EXISTS points_table (
    team_id INT PRIMARY KEY,
    matches_played INT NOT NULL DEFAULT 0,
    wins INT NOT NULL DEFAULT 0,
    losses INT NOT NULL DEFAULT 0,
    no_results INT NOT NULL DEFAULT 0,
    points INT NOT NULL DEFAULT 0,
    nrr NUMERIC NOT NULL DEFAULT 0.0,
    FOREIGN KEY (team_id) REFERENCES teams(team_id)
);
