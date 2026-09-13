const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PREVIEW = path.join(ROOT, 'data/generated-preview');
const REGISTRY = path.join(ROOT, 'data/league-identity-registry.json');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const write = (p, data) => fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
const key = (team, player) => `${team}::${player}`;
const isPitcher = pos => ['SP','RP','CL','P'].includes(pos);

function main(){
  if(!fs.existsSync(REGISTRY)) throw new Error('Missing data/league-identity-registry.json');
  const registry = read(REGISTRY);
  const populationPath = path.join(PREVIEW, 'player-population.json');
  const summaryPath = path.join(PREVIEW, 'population-summary.json');
  const standingsPath = path.join(PREVIEW, 'standings.json');
  const population = read(populationPath);
  const standings = read(standingsPath);
  const marquee = new Map((registry.marquee_players || []).map(p => [key(p.team,p.player), p]));
  const found = new Set();

  for(const row of population){
    const identity = marquee.get(key(row.team,row.player));
    if(!identity) { row.identity_persistent = false; continue; }
    const primaryRole = isPitcher(identity.position) ? 'pitcher' : 'position-player';
    if(row.role !== primaryRole) continue;
    found.add(key(row.team,row.player));
    row.identity_persistent = true;
    row.identity_archetype = identity.archetype;
    row.identity_baseline_talent = identity.baseline_talent;
    row.talent_tier = 'star';
    row.completeness = Math.max(0.94, row.completeness || 0);
    for(const stat of Object.keys(row.visibility || {})) row.visibility[stat] = true;
  }

  const missing = [...marquee.keys()].filter(k => !found.has(k));
  if(missing.length) throw new Error(`Marquee identities missing from primary population rows: ${missing.join(', ')}`);

  const byTier = {};
  for(const p of population) byTier[p.talent_tier] = (byTier[p.talent_tier] || 0) + 1;
  const avg = population.reduce((s,p)=>s+(p.completeness||0),0) / Math.max(1,population.length);
  const oldSummary = fs.existsSync(summaryPath) ? read(summaryPath) : {};
  write(populationPath, population.sort((a,b)=>b.talent_score-a.talent_score));
  write(summaryPath, {...oldSummary, average_player_completeness:Number(avg.toFixed(3)), tiers:byTier, persistent_marquee_players:found.size});

  const standingsBy = new Map(standings.map(s=>[s.slug,s]));
  const teamReport = (registry.team_identities || []).map(t => ({...t, current_preview: standingsBy.get(t.slug) || null}));
  const playerReport = population.filter(p=>p.identity_persistent).map(p=>({
    team:p.team, player:p.player, name:p.name, position:p.position,
    archetype:p.identity_archetype, baseline_talent:p.identity_baseline_talent,
    preview_talent:p.talent_score, completeness:p.completeness
  }));
  write(path.join(PREVIEW,'league-identity-report.json'), {
    generated:true, official:false, registry_version:registry.version,
    marquee_players:playerReport,
    teams:teamReport,
    note:'Identity registry is a continuity layer. Preview results remain simulated and may vary.'
  });
  console.log(`Persistent identity layer applied: ${found.size} marquee players and ${teamReport.length} team identities.`);
}
main();
