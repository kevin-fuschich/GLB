const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PREVIEW = path.join(ROOT, 'data/generated-preview');
const TEAMS = path.join(ROOT, 'data/teams/teams.json');

const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const write = (p, data) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
};
const clamp = (v,a,b) => Math.max(a, Math.min(b,v));
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function hash01(str){
  let h = 2166136261;
  for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}
function percentileRank(value, values, asc=false){
  if (!values.length) return 0.5;
  const sorted=[...values].sort((a,b)=>a-b);
  const count = sorted.filter(v => asc ? v >= value : v <= value).length;
  return count / sorted.length;
}

function loadRosterIndex(){
  const teams = read(TEAMS);
  const rosterIndex = new Map();
  const teamIndex = new Map();
  for (const [division, clubs] of Object.entries(teams.divisions || {})) {
    for (const club of clubs) {
      teamIndex.set(club.slug, { ...club, division });
      const roster = read(path.join(ROOT, club.roster_path));
      for (const p of roster.players || []) rosterIndex.set(`${club.slug}::${p.slug}`, { ...p, team: club.slug, team_name: club.team, division });
    }
  }
  return { rosterIndex, teamIndex };
}

function battingTalent(row, league){
  const opsVals = league.map(x=>x.OPS || 0);
  const iso = row.AB ? ((row.TB || 0) - row.H) / row.AB : 0;
  const isoVals = league.map(x=>x.AB ? ((x.TB || 0) - x.H) / x.AB : 0);
  const hrRate = row.AB ? row.HR / row.AB : 0;
  const hrVals = league.map(x=>x.AB ? x.HR/x.AB : 0);
  const speed = (row.SB || 0) / Math.max(1, row.G || 1);
  const speedVals = league.map(x=>(x.SB||0)/Math.max(1,x.G||1));
  return 0.55*percentileRank(row.OPS||0, opsVals) + 0.2*percentileRank(iso,isoVals) + 0.15*percentileRank(hrRate,hrVals) + 0.1*percentileRank(speed,speedVals);
}

function pitchingTalent(row, league){
  const eraVals=league.map(x=>x.ERA || 99);
  const whipVals=league.map(x=>x.WHIP || 9);
  const k9 = row.outs ? (row.K*27/row.outs) : 0;
  const kVals=league.map(x=>x.outs ? x.K*27/x.outs : 0);
  return 0.45*percentileRank(row.ERA||99,eraVals,true) + 0.35*percentileRank(row.WHIP||9,whipVals,true) + 0.2*percentileRank(k9,kVals);
}

function hitterTier(score){
  if(score>=0.88) return 'star';
  if(score>=0.36) return 'everyday';
  return 'bench';
}
function pitcherTier(score, p){
  if(score>=0.9) return 'star';
  if(p.position==='SP') return score>=0.35 ? 'rotation' : 'depth-starter';
  if(p.position==='CL') return 'closer';
  return score>=0.55 ? 'high-leverage' : 'fringe-reliever';
}
function completenessFor(tier, key){
  const base = {star:.95,everyday:.86,bench:.60,rotation:.84,'depth-starter':.66,closer:.90,'high-leverage':.72,'fringe-reliever':.45}[tier] || .65;
  const jitter=(hash01(key)-.5)*.08;
  return Number(clamp(base+jitter,.40,.98).toFixed(2));
}
function advancedBat(row, lg){
  const lgOPS = lg.reduce((s,x)=>s+(x.OPS||0),0)/Math.max(1,lg.length);
  const PA=(row.AB||0)+(row.BB||0);
  const iso=row.AB?((row.TB||0)-row.H)/row.AB:0;
  const bip=Math.max(1,(row.AB||0)-(row.K||0)-(row.HR||0));
  const babip=clamp(((row.H||0)-(row.HR||0))/bip,0,1);
  const opsPlus=lgOPS ? Math.round(100*(row.OPS||0)/lgOPS) : 100;
  const wrcPlus=Math.round(100 + (opsPlus-100)*0.92);
  return { PA, ISO:Number(iso.toFixed(3)), BABIP:Number(babip.toFixed(3)), OPS_PLUS:opsPlus, WRC_PLUS:wrcPlus };
}
function advancedPitch(row){
  const ip=row.outs?row.outs/3:0;
  const k9=ip?row.K*9/ip:0;
  const bb9=ip?row.BB*9/ip:0;
  const hr9=ip?row.HR*9/ip:0;
  const fip=ip ? ((13*(row.HR||0)+3*(row.BB||0)-2*(row.K||0))/ip)+3.10 : 0;
  return { K9:Number(k9.toFixed(2)), BB9:Number(bb9.toFixed(2)), HR9:Number(hr9.toFixed(2)), FIP:Number(fip.toFixed(2)) };
}

function fieldVisibility(tier, completeness, key, group){
  const core = group==='batting' ? ['G','AB','R','H','HR','RBI','BB','K','AVG','OBP','SLG','OPS'] : ['G','GS','IP','W','L','SV','H','ER','BB','K','ERA','WHIP'];
  const secondary = group==='batting' ? ['2B','3B','SB','TB','PA','ISO','BABIP','OPS_PLUS','WRC_PLUS'] : ['R','HR','K9','BB9','HR9','FIP'];
  const visible={};
  for(const f of core) visible[f]=true;
  secondary.forEach((f,i)=>{ visible[f]=hash01(`${key}:${f}:${i}`) <= completeness; });
  if(tier==='star') for(const f of secondary) if(hash01(`${key}:star:${f}`)<.94) visible[f]=true;
  return visible;
}

function main(){
  const batting=read(path.join(PREVIEW,'batting.json'));
  const pitching=read(path.join(PREVIEW,'pitching.json'));
  const {rosterIndex}=loadRosterIndex();
  const batterRows=batting.filter(x=>(x.AB||0)>0);
  const pitcherRows=pitching.filter(x=>(x.outs||0)>0);
  const players=[];

  for(const row of batterRows){
    const key=`${row.team}::${row.player}`;
    const p=rosterIndex.get(key); if(!p) continue;
    const score=battingTalent(row,batterRows), tier=hitterTier(score), completeness=completenessFor(tier,key);
    const advanced=advancedBat(row,batterRows);
    players.push({player:row.player,name:p.name,team:row.team,team_name:p.team_name,position:p.position,role:'position-player',talent_tier:tier,talent_score:Number(score.toFixed(3)),completeness,visibility:fieldVisibility(tier,completeness,key,'batting'),advanced});
  }
  for(const row of pitcherRows){
    const key=`${row.team}::${row.player}`;
    const p=rosterIndex.get(key); if(!p) continue;
    const score=pitchingTalent(row,pitcherRows), tier=pitcherTier(score,p), completeness=completenessFor(tier,key);
    const advanced=advancedPitch(row);
    players.push({player:row.player,name:p.name,team:row.team,team_name:p.team_name,position:p.position,role:'pitcher',talent_tier:tier,talent_score:Number(score.toFixed(3)),completeness,visibility:fieldVisibility(tier,completeness,key,'pitching'),advanced});
  }

  const byTier={}; players.forEach(p=>byTier[p.talent_tier]=(byTier[p.talent_tier]||0)+1);
  const avgCompleteness=players.reduce((s,p)=>s+p.completeness,0)/Math.max(1,players.length);
  const summary={generated:true,official:false,player_records:players.length,average_player_completeness:Number(avgCompleteness.toFixed(3)),target_overall:0.75,tiers:byTier,note:'Completeness controls public stat richness only. Core simulation totals remain intact.'};
  write(path.join(PREVIEW,'player-population.json'),players.sort((a,b)=>b.talent_score-a.talent_score));
  write(path.join(PREVIEW,'population-summary.json'),summary);
  console.log(`Player population layer built: ${players.length} stat-bearing player records.`);
  console.log(`Average visible completeness: ${(avgCompleteness*100).toFixed(1)}%`);
  console.log(JSON.stringify(byTier,null,2));
}
main();
