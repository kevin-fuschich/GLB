const fs = require("fs");
const path = require("path");

// === CONFIG ===
const ROOT = path.join(__dirname, "..");
const TEAMS_PATH = path.join(ROOT, "data/teams/teams.json");
const ROSTERS_DIR = path.join(ROOT, "data/rosters");

// === LOAD TEAMS ===
function loadTeams() {
  const raw = fs.readFileSync(TEAMS_PATH);
  const data = JSON.parse(raw);

  let teams = [];

  Object.values(data.divisions).forEach(div => {
    div.forEach(team => {
      teams.push(team);
    });
  });

  return teams;
}

// === LOAD ROSTER ===
function loadRoster(team) {
  const filePath = path.join(ROOT, team.roster_path);

  if (!fs.existsSync(filePath)) {
    console.log(`❌ Missing roster: ${team.slug}`);
    return null;
  }

  const raw = fs.readFileSync(filePath);
  return JSON.parse(raw);
}

// === VALIDATE EVERYTHING ===
function validate() {
  console.log("🔍 Validating GLB data...\n");

  const teams = loadTeams();

  let allGood = true;

  teams.forEach(team => {
    const roster = loadRoster(team);

    if (!roster) {
      allGood = false;
      return;
    }

    if (!roster.players || roster.players.length === 0) {
      console.log(`⚠️ Empty roster: ${team.slug}`);
      allGood = false;
    } else {
      console.log(`✅ ${team.slug} (${roster.players.length} players)`);
    }
  });

  if (allGood) {
    console.log("\n🎉 All teams validated successfully.");
  } else {
    console.log("\n⚠️ Fix issues before generating season.");
  }
}

// === RUN ===
validate();
