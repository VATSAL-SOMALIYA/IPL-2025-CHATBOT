
DROP TABLE IF EXISTS wickets CASCADE;
DROP TABLE IF EXISTS partnership CASCADE;
DROP TABLE IF EXISTS player_performance_in_a_match CASCADE;
DROP TABLE IF EXISTS final_result CASCADE;
DROP TABLE IF EXISTS per_ball_data CASCADE;
DROP TABLE IF EXISTS playing_11 CASCADE;
DROP TABLE IF EXISTS match_officials CASCADE;
DROP TABLE IF EXISTS match_details CASCADE;
DROP TABLE IF EXISTS points_table CASCADE;
DROP TABLE IF EXISTS team CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS venue CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop legacy table names if they exist from previous session
DROP TABLE IF EXISTS deliveries CASCADE;
DROP TABLE IF EXISTS innings CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS venues CASCADE;

-- 1. Users
CREATE TABLE users (
    user_id INT PRIMARY KEY,
    password VARCHAR(255),
    last_access DATE,
    date_of_sign_in DATE
);

-- 2. Venue
CREATE TABLE venue (
    venue_id INT PRIMARY KEY,
    city VARCHAR(100),
    state VARCHAR(100),
    grd_name VARCHAR(255) UNIQUE
);

-- 3. Team
CREATE TABLE team (
    team_id INT PRIMARY KEY,
    tname VARCHAR(255),
    captain_id INT,
    home_ground VARCHAR(255),
    FOREIGN KEY (home_ground) REFERENCES venue(grd_name)
);

-- 4. Players
CREATE TABLE players (
    player_id INT PRIMARY KEY,
    batting_style VARCHAR(50),
    bowling_style VARCHAR(50),
    name VARCHAR(255),
    role VARCHAR(50),
    team_id INT,
    nationality VARCHAR(50),
    FOREIGN KEY (team_id) REFERENCES team(team_id)
);

ALTER TABLE team
ADD CONSTRAINT FK_Team_Captain
FOREIGN KEY (captain_id) REFERENCES players(player_id);

-- 5. Match Details
CREATE TABLE match_details (
    match_id INT PRIMARY KEY,
    match_date DATE,
    toss_decision VARCHAR(50),
    status VARCHAR(50),
    team1 INT,
    team2 INT,
    toss_winner INT,
    venue VARCHAR(255),
    match_time VARCHAR(50),
    FOREIGN KEY (team1) REFERENCES team(team_id),
    FOREIGN KEY (team2) REFERENCES team(team_id),
    FOREIGN KEY (toss_winner) REFERENCES team(team_id),
    FOREIGN KEY (venue) REFERENCES venue(grd_name)
);

-- 6. Playing 11
CREATE TABLE playing_11 (
    match_id INT,
    player_id INT,
    team_id INT,
    is_substitute BOOLEAN DEFAULT FALSE,
    substituted_out BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (match_id, player_id),
    FOREIGN KEY (match_id) REFERENCES match_details(match_id),
    FOREIGN KEY (player_id) REFERENCES players(player_id),
    FOREIGN KEY (team_id) REFERENCES team(team_id)
);

-- 7. Per Ball Data
CREATE TABLE per_ball_data (
    ball_id INT PRIMARY KEY,
    over_no INT,
    ball_no INT,
    of_match INT,
    inning_no INT,
    extras INT,
    wicket_no INT,
    total_score INT,
    run_scored INT,
    on_strike INT,
    off_strike INT,
    bowled_by INT,
    ball_speed NUMERIC,
    type_of_extra VARCHAR(20),
    striker_batting_position INT,
    boundary INT,
    FOREIGN KEY (of_match) REFERENCES match_details(match_id),
    FOREIGN KEY (on_strike) REFERENCES players(player_id),
    FOREIGN KEY (off_strike) REFERENCES players(player_id),
    FOREIGN KEY (bowled_by) REFERENCES players(player_id)
);

-- 8. Wickets
CREATE TABLE wickets (
    wicket_id INT PRIMARY KEY,
    wicket_type VARCHAR(50),
    player_got_out INT,
    caught_by INT,
    run_out_by INT,
    on_ball INT,
    stumped_by INT,
    FOREIGN KEY (player_got_out) REFERENCES players(player_id),
    FOREIGN KEY (caught_by) REFERENCES players(player_id),
    FOREIGN KEY (run_out_by) REFERENCES players(player_id),
    FOREIGN KEY (stumped_by) REFERENCES players(player_id),
    FOREIGN KEY (on_ball) REFERENCES per_ball_data(ball_id)
);

-- 9. Player Performance in a Match
CREATE TABLE player_performance_in_a_match (
    match_id INT,
    player_id INT,
    runs INT DEFAULT 0,
    balls_played INT DEFAULT 0,
    wickets_taken INT DEFAULT 0,
    balls_bowled INT DEFAULT 0,
    runs_conceded INT DEFAULT 0,
    fours INT DEFAULT 0,
    sixes INT DEFAULT 0,
    fours_conceded INT DEFAULT 0,
    sixes_conceded INT DEFAULT 0,
    PRIMARY KEY (match_id, player_id),
    FOREIGN KEY (match_id) REFERENCES match_details(match_id),
    FOREIGN KEY (player_id) REFERENCES players(player_id)
);

-- 10. Final Result
CREATE TABLE final_result (
    match_id INT PRIMARY KEY,
    winner INT,
    loser INT,
    score_of_winner INT,
    score_of_loser INT,
    win_run_margin INT,
    win_wicket_margin INT,
    player_of_the_match INT,
    FOREIGN KEY (match_id) REFERENCES match_details(match_id),
    FOREIGN KEY (winner) REFERENCES team(team_id),
    FOREIGN KEY (loser) REFERENCES team(team_id),
    FOREIGN KEY (player_of_the_match) REFERENCES players(player_id)
);

-- 11. Match Officials
CREATE TABLE match_officials (
    match_id INT PRIMARY KEY,
    on_field1 VARCHAR(255),
    on_field2 VARCHAR(255),
    third_ump VARCHAR(255),
    FOREIGN KEY (match_id) REFERENCES match_details(match_id)
);

-- 12. Partnership
CREATE TABLE partnership (
    partnership_id INT PRIMARY KEY,
    player1 INT,
    player2 INT,
    match_id INT,
    runs INT,
    partnership_no INT,
    inning_no INT,
    FOREIGN KEY (player1) REFERENCES players(player_id),
    FOREIGN KEY (player2) REFERENCES players(player_id),
    FOREIGN KEY (match_id) REFERENCES match_details(match_id)
);

-- 13. Points Table
CREATE TABLE points_table (
    team_id INT PRIMARY KEY,
    matches_played INT DEFAULT 0,
    wins INT DEFAULT 0,
    losses INT DEFAULT 0,
    no_results INT DEFAULT 0,
    points INT DEFAULT 0,
    nrr NUMERIC DEFAULT 0.0,
    FOREIGN KEY (team_id) REFERENCES team(team_id)
);
