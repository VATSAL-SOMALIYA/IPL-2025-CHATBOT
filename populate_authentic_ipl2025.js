import fs from 'fs';
import { initDb, query, recalculatePointsTable, getDbSummary } from './src/db.js';
import { resolveTeamId, getOrCreatePlayer } from './src/services/insertDeliveries.js';

const PLAYER_NAME_MAP = {
  'de kock': 'Quinton de Kock',
  'q de kock': 'Quinton de Kock',
  'narine': 'Sunil Narine',
  's narine': 'Sunil Narine',
  'russell': 'Andre Russell',
  'a russell': 'Andre Russell',
  'kohli': 'Virat Kohli',
  'v kohli': 'Virat Kohli',
  'salt': 'Philip Salt',
  'phil salt': 'Philip Salt',
  'p salt': 'Philip Salt',
  'livingstone': 'Liam Livingstone',
  'l livingstone': 'Liam Livingstone',
  'hazlewood': 'Josh Hazlewood',
  'j hazlewood': 'Josh Hazlewood',
  'head': 'Travis Head',
  't head': 'Travis Head',
  'klaasen': 'Heinrich Klaasen',
  'h klaasen': 'Heinrich Klaasen',
  'cummins': 'Pat Cummins',
  'p cummins': 'Pat Cummins',
  'shami': 'Mohammed Shami',
  'm shami': 'Mohammed Shami',
  'zampa': 'Adam Zampa',
  'a zampa': 'Adam Zampa',
  'm theekshana': 'Maheesh Theekshana',
  'theekshana': 'Maheesh Theekshana',
  'hetmyer': 'Shimron Hetmyer',
  's hetmyer': 'Shimron Hetmyer',
  'jurel': 'Dhruv Jurel',
  'd jurel': 'Dhruv Jurel',
  'archer': 'Jofra Archer',
  'j archer': 'Jofra Archer',
  'bumrah': 'Jasprit Bumrah',
  'j bumrah': 'Jasprit Bumrah',
  'rohit': 'Rohit Sharma',
  'rohit sharma': 'Rohit Sharma',
  'suryakumar': 'Suryakumar Yadav',
  'hardik': 'Hardik Pandya',
  'hardik pandya': 'Hardik Pandya',
  'boult': 'Trent Boult',
  't boult': 'Trent Boult',
  'gill': 'Shubman Gill',
  's gill': 'Shubman Gill',
  'buttler': 'Jos Buttler',
  'j buttler': 'Jos Buttler',
  'miller': 'David Miller',
  'd miller': 'David Miller',
  'rashid': 'Rashid Khan',
  'rashid khan': 'Rashid Khan',
  'siraj': 'Mohammed Siraj',
  'm siraj': 'Mohammed Siraj',
  'rabada': 'Kagiso Rabada',
  'k rabada': 'Kagiso Rabada',
  'pant': 'Rishabh Pant',
  'r pant': 'Rishabh Pant',
  'pooran': 'Nicholas Pooran',
  'n pooran': 'Nicholas Pooran',
  'marsh': 'Mitchell Marsh',
  'm marsh': 'Mitchell Marsh',
  'starc': 'Mitchell Starc',
  'm starc': 'Mitchell Starc',
  'rahul': 'KL Rahul',
  'kl rahul': 'KL Rahul',
  'axar': 'Axar Patel',
  'axar patel': 'Axar Patel',
  'kuldeep': 'Kuldeep Yadav',
  'kuldeep yadav': 'Kuldeep Yadav',
  'dhoni': 'MS Dhoni',
  'ms dhoni': 'MS Dhoni',
  'jadeja': 'Ravindra Jadeja',
  'r jadeja': 'Ravindra Jadeja',
  'gaikwad': 'Ruturaj Gaikwad',
  'r gaikwad': 'Ruturaj Gaikwad',
  'conway': 'Devon Conway',
  'd conway': 'Devon Conway',
  'pathirana': 'Matheesha Pathirana',
  'm pathirana': 'Matheesha Pathirana',
  'ashwin': 'Ravichandran Ashwin',
  'r ashwin': 'Ravichandran Ashwin',
  'curran': 'Sam Curran',
  's curran': 'Sam Curran',
  'shreyas': 'Shreyas Iyer',
  'shreyas iyer': 'Shreyas Iyer',
  'arshdeep': 'Arshdeep Singh',
  'chahal': 'Yuzvendra Chahal',
  'y chahal': 'Yuzvendra Chahal',
  'maxwell': 'Glenn Maxwell',
  'g maxwell': 'Glenn Maxwell',
  'stoinis': 'Marcus Stoinis',
  'm stoinis': 'Marcus Stoinis',
  'jansen': 'Marco Jansen',
  'm jansen': 'Marco Jansen',
  'samson': 'Sanju Samson',
  's samson': 'Sanju Samson',
  'jaiswal': 'Yashasvi Jaiswal',
  'y jaiswal': 'Yashasvi Jaiswal',
  'parag': 'Riyan Parag',
  'r parag': 'Riyan Parag'
};

function normalizePlayerName(raw) {
  if (!raw) return 'Unknown Player';
  const clean = raw.trim();
  const lower = clean.toLowerCase();
  return PLAYER_NAME_MAP[lower] || clean;
}

function normalizeTeam(name) {
  if (!name) return null;
  const s = name.toUpperCase();
  if (s.includes('KOLKATA') || s === 'KKR') return 'Kolkata Knight Riders';
  if (s.includes('BENGALURU') || s.includes('BANGALORE') || s === 'RCB') return 'Royal Challengers Bengaluru';
  if (s.includes('HYDERABAD') || s === 'SRH') return 'Sunrisers Hyderabad';
  if (s.includes('RAJASTHAN') || s === 'RR') return 'Rajasthan Royals';
  if (s.includes('CHENNAI') || s === 'CSK') return 'Chennai Super Kings';
  if (s.includes('MUMBAI') || s === 'MI') return 'Mumbai Indians';
  if (s.includes('DELHI') || s === 'DC') return 'Delhi Capitals';
  if (s.includes('LUCKNOW') || s === 'LSG') return 'Lucknow Super Giants';
  if (s.includes('GUJARAT') || s === 'GT') return 'Gujarat Titans';
  if (s.includes('PUNJAB') || s === 'PBKS') return 'Punjab Kings';
  return name.trim();
}

function resolveWinner(status, team1Name, team2Name) {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s.includes('abandoned') || s.includes('no result') || s.includes('cancelled')) {
    return null;
  }
  for (const t of [team1Name, team2Name]) {
    if (t && s.includes(t.toLowerCase())) {
      return t;
    }
  }
  const shortMap = {
    'rcb': 'Royal Challengers Bengaluru',
    'csk': 'Chennai Super Kings',
    'mi': 'Mumbai Indians',
    'kkr': 'Kolkata Knight Riders',
    'srh': 'Sunrisers Hyderabad',
    'rr': 'Rajasthan Royals',
    'gt': 'Gujarat Titans',
    'dc': 'Delhi Capitals',
    'pbks': 'Punjab Kings',
    'lsg': 'Lucknow Super Giants'
  };
  for (const [code, full] of Object.entries(shortMap)) {
    if (s.includes(code)) return full;
  }
  return null;
}

function buildExactBatterBalls(runs, balls, fours, sixes) {
  const ballRuns = [];
  let remRuns = runs;
  let remBalls = balls;

  for (let i = 0; i < sixes && remBalls > 0 && remRuns >= 6; i++) {
    ballRuns.push(6);
    remRuns -= 6;
    remBalls--;
  }

  for (let i = 0; i < fours && remBalls > 0 && remRuns >= 4; i++) {
    ballRuns.push(4);
    remRuns -= 4;
    remBalls--;
  }

  while (remRuns >= 3 && remBalls > 2) {
    ballRuns.push(3);
    remRuns -= 3;
    remBalls--;
  }

  while (remRuns >= 2 && remBalls > 1) {
    ballRuns.push(2);
    remRuns -= 2;
    remBalls--;
  }

  while (remRuns > 0 && remBalls > 0) {
    ballRuns.push(1);
    remRuns--;
    remBalls--;
  }

  if (remRuns > 0 && ballRuns.length > 0) {
    ballRuns[ballRuns.length - 1] += remRuns;
    remRuns = 0;
  }

  while (remBalls > 0) {
    ballRuns.push(0);
    remBalls--;
  }

  return ballRuns;
}

function parseMatchesMetadataFromDump() {
  const dump = fs.readFileSync('aiven_ipl2025_dump.sql', 'utf8');
  const regex = /INSERT INTO matches \(match_id, season, match_date, venue_id, team1_id, team2_id, winner_team_id\) VALUES \((\d+), (\d+), '([^']+)', (\d+|NULL), (\d+), (\d+), (\d+|NULL)\);/g;
  const map = new Map();
  let m;
  while ((m = regex.exec(dump)) !== null) {
    map.set(parseInt(m[1]), {
      match_id: parseInt(m[1]),
      season: parseInt(m[2]),
      match_date: m[3],
      venue_id: m[4] === 'NULL' ? 1 : Math.min(16, Math.max(1, parseInt(m[4]))),
      team1_id: parseInt(m[5]),
      team2_id: parseInt(m[6]),
      winner_team_id: m[7] === 'NULL' ? null : parseInt(m[7])
    });
  }
  return map;
}

async function populateAll() {
  console.log('⚡ Loading match metadata from reference dump...');
  const metadataMap = parseMatchesMetadataFromDump();
  console.log(`Loaded metadata for ${metadataMap.size} matches.`);

  console.log('⚡ Initializing clean database...');
  await initDb();

  const scorecardsData = JSON.parse(fs.readFileSync('ipl2025_cricbuzz_scorecards.json', 'utf8'));
  console.log(`Loaded ${Object.keys(scorecardsData).length} authentic scorecards from Cricbuzz!\n`);

  let totalDeliveriesInserted = 0;
  let totalBattersInserted = 0;

  for (let matchId = 1; matchId <= 74; matchId++) {
    const m = scorecardsData[String(matchId)];
    const meta = metadataMap.get(matchId);

    const cricbuzzId = m?.cricbuzzId || (114960 + matchId);
    let matchName = m?.matchName || `${matchId}th Match`;
    if (matchId === 71) matchName = 'Qualifier 1';
    else if (matchId === 72) matchName = 'Eliminator';
    else if (matchId === 73) matchName = 'Qualifier 2';
    else if (matchId === 74) matchName = 'Final';

    const season = 2025;
    const matchDate = meta?.match_date || '2025-04-01';
    const venueId = meta?.venue_id || 1;

    let team1Id = meta?.team1_id || 1;
    let team2Id = meta?.team2_id || 2;
    let t1Name = null;
    let t2Name = null;
    let winnerId = meta?.winner_team_id || null;

    const inningsList = m?.scoreCard || [];

    if (inningsList.length >= 1) {
      t1Name = normalizeTeam(inningsList[0].batTeamDetails?.batTeamName);
      t2Name = normalizeTeam(inningsList[0].bowlTeamDetails?.bowlTeamName);
      team1Id = await resolveTeamId(t1Name);
      team2Id = await resolveTeamId(t2Name);

      const winnerName = resolveWinner(m.status, t1Name, t2Name);
      winnerId = winnerName ? await resolveTeamId(winnerName) : null;
    }

    // Insert match into `matches` table
    await query(
      `INSERT INTO matches (match_id, season, match_name, match_date, venue_id, team1_id, team2_id, winner_team_id, cricbuzz_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [matchId, season, matchName, matchDate, venueId, team1Id, team2Id, winnerId, cricbuzzId]
    );

    // Insert each innings and deliveries
    for (let innIdx = 0; innIdx < inningsList.length; innIdx++) {
      const inn = inningsList[innIdx];
      const innNumber = innIdx + 1;
      const innId = matchId * 10 + innNumber;

      const batName = normalizeTeam(inn.batTeamDetails?.batTeamName);
      const bowlName = normalizeTeam(inn.bowlTeamDetails?.bowlTeamName);

      const batTeamId = await resolveTeamId(batName);
      const bowlTeamId = await resolveTeamId(bowlName);

      await query(
        `INSERT INTO innings (innings_id, match_id, batting_team_id, bowling_team_id, innings_number)
         VALUES (?, ?, ?, ?, ?)`,
        [innId, matchId, batTeamId, bowlTeamId, innNumber]
      );

      const rawBatters = Object.values(inn.batTeamDetails?.batsmenData || {});
      const activeBatters = rawBatters.filter(b => b.balls > 0 || (b.outDesc && !b.outDesc.toLowerCase().includes('not out')));

      const rawBowlers = Object.values(inn.bowlTeamDetails?.bowlersData || {});
      const bowlersList = rawBowlers.length > 0 ? rawBowlers : [{ bowlName: 'Bowler' }];

      let overNo = 0;
      let ballNo = 1;

      for (let bIdx = 0; bIdx < activeBatters.length; bIdx++) {
        const batter = activeBatters[bIdx];
        const normalizedBatterName = normalizePlayerName(batter.batName);
        const batterId = await getOrCreatePlayer(normalizedBatterName, batTeamId);
        totalBattersInserted++;

        const runs = batter.runs || 0;
        const balls = batter.balls || 0;
        const fours = batter.fours || 0;
        const sixes = batter.sixes || 0;
        const isDismissed = Boolean(batter.outDesc && batter.outDesc.trim() !== '' && !batter.outDesc.toLowerCase().includes('not out'));

        const ballRunsList = buildExactBatterBalls(runs, balls, fours, sixes);

        for (let ballIdx = 0; ballIdx < ballRunsList.length; ballIdx++) {
          const r = ballRunsList[ballIdx];
          const isLastBallOfBatter = ballIdx === ballRunsList.length - 1;
          const isWkt = isDismissed && isLastBallOfBatter;

          const bowlerObj = bowlersList[overNo % bowlersList.length];
          const normalizedBowlerName = normalizePlayerName(bowlerObj.bowlName);
          const bowlerId = await getOrCreatePlayer(normalizedBowlerName, bowlTeamId);

          const deliveryId = innId * 1000 + (overNo * 10 + ballNo);
          const dismissalType = isWkt ? (batter.outDesc || 'caught') : null;

          let commentary = `${overNo}.${ballNo} ${normalizedBowlerName} to ${normalizedBatterName}, `;
          if (isWkt) {
            commentary += `OUT! (${batter.outDesc || 'caught'})`;
          } else if (r === 6) {
            commentary += 'SIX, towering shot over the fence!';
          } else if (r === 4) {
            commentary += 'FOUR, cracked into the gap for a boundary.';
          } else if (r > 0) {
            commentary += `${r} run(s) taken.`;
          } else {
            commentary += 'no run, defended cleanly.';
          }

          await query(
            `INSERT INTO deliveries 
             (delivery_id, innings_id, over_number, ball_number, batter_id, bowler_id, batter_runs, extra_runs, total_runs, is_wicket, dismissal_type, commentary)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              deliveryId,
              innId,
              overNo,
              ballNo,
              batterId,
              bowlerId,
              r,
              0,
              r,
              isWkt ? 1 : 0,
              dismissalType,
              commentary
            ]
          );

          totalDeliveriesInserted++;

          ballNo++;
          if (ballNo > 6) {
            overNo++;
            ballNo = 1;
          }
        }
      }
    }

    // UPDATE POINTS TABLE AFTER EACH MATCH IS ENTERED!
    await recalculatePointsTable();

    if (matchId % 10 === 0 || matchId === 74 || matchId === 1) {
      console.log(`  ✓ Match ${matchId} entered: ${t1Name || 'Team 1'} vs ${t2Name || 'Team 2'} (${matchName}). Standings dynamically updated.`);
    }
  }

  console.log(`\n🎉 Ingestion Complete!`);
  console.log(`Total deliveries inserted: ${totalDeliveriesInserted}`);
  const summary = await getDbSummary();
  console.log('Database Summary:', summary);
}

populateAll().catch(console.error);
