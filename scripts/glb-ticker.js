(() => {
  if (document.querySelector(".scores-strip,.glb-score-strip")) return;
  const css = [
    ".glb-score-strip{overflow:hidden;background:#fff;border-bottom:1px solid #d9dee5;color:#142234;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif}",
    ".glb-score-window{overflow:hidden}.glb-score-track{display:flex;width:max-content;min-width:100%;animation:glbScoreScroll var(--glb-duration,48s) linear infinite}",
    ".glb-score-track:hover,.glb-score-track:focus-within{animation-play-state:paused}",
    ".glb-score-card{flex:0 0 250px;display:grid;grid-template-columns:1fr auto;gap:3px 14px;padding:10px 16px;border-right:1px solid #d9dee5;background:#fff}",
    ".glb-score-date{grid-column:1/-1;color:#6b7681;font-size:8px;font-weight:850;letter-spacing:.75px;text-transform:uppercase}",
    ".glb-score-team{overflow:hidden;color:#142234;font-size:11px;font-weight:750;text-overflow:ellipsis;white-space:nowrap;text-decoration:none}",
    ".glb-score-team:hover{color:#1d4f91;text-decoration:underline}.glb-score-value{font-size:12px;font-weight:900;text-align:right}",
    ".glb-score-box{grid-column:1/-1;margin-top:2px;color:#1d4f91;font-size:8px;font-weight:850;letter-spacing:.6px;text-transform:uppercase;text-decoration:none}",
    "@keyframes glbScoreScroll{from{transform:translateX(-50%)}to{transform:translateX(0)}}",
    "@media(prefers-reduced-motion:reduce){.glb-score-window{overflow-x:auto}.glb-score-track{animation:none}.glb-score-copy{display:none}}"
  ].join("");
  const style = document.createElement("style"); style.textContent = css; document.head.append(style);
  const strip = document.createElement("section"); strip.className = "glb-score-strip"; strip.setAttribute("aria-label","Recent GLB scores");
  strip.innerHTML = '<div class="glb-score-window"><div class="glb-score-track"><div class="glb-score-card">Loading recent results…</div></div></div>';
  const header = document.querySelector(".site-header") || document.querySelector("body > header") || document.querySelector("header");
  if (header) header.insertAdjacentElement("afterend",strip); else document.body.prepend(strip);
  const safe = value => String(value ?? "—").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  Promise.all([
    fetch("data/season/games.json",{cache:"no-store"}).then(r=>r.json()),
    fetch("data/teams/teams.json",{cache:"no-store"}).then(r=>r.json())
  ]).then(([games,registry])=>{
    const teams=Object.values(registry.divisions).flat(), names=new Map(teams.map(team=>[team.slug,team.team]));
    const date=games.at(-1)?.date, slate=date?games.filter(game=>game.date===date):[];
    if(!slate.length) throw Error("No results");
    const card=(game,copy)=>'<article class="glb-score-card'+(copy?' glb-score-copy':'')+'"'+(copy?' aria-hidden="true"':'')+'><span class="glb-score-date">'+safe(game.date)+' · '+safe(game.status||"Final")+'</span><a class="glb-score-team" href="team.html?team='+encodeURIComponent(game.away)+'">'+safe(names.get(game.away)||game.away)+'</a><strong class="glb-score-value">'+safe(game.awayScore)+'</strong><a class="glb-score-team" href="team.html?team='+encodeURIComponent(game.home)+'">'+safe(names.get(game.home)||game.home)+'</a><strong class="glb-score-value">'+safe(game.homeScore)+'</strong><a class="glb-score-box" href="box.html?date='+encodeURIComponent(game.date)+'&game='+encodeURIComponent(game.away+"@"+game.home)+'">Box score →</a></article>';
    const track=strip.querySelector(".glb-score-track");
    track.innerHTML=slate.map(g=>card(g,false)).join("")+slate.map(g=>card(g,true)).join("");
    track.style.setProperty("--glb-duration",Math.max(28,slate.length*7)+"s");
  }).catch(()=>strip.remove());
})();