(() => {
  const slug = 'mayaguez-sultans';
  const toggle = document.getElementById('navToggle');
  const get = async path => {
    const response = await fetch(path, {cache: 'no-store'});
    if (!response.ok) throw new Error(`Unable to load ${path}`);
    return response.json();
  };
  const element = (tag, value) => {
    const node = document.createElement(tag);
    node.textContent = String(value ?? '—');
    return node;
  };
  get('current/standings.json').then(standings => {
    const record = Object.values(standings.divisions).flat().find(row => row.slug === slug);
    if (!record) return;
    for (const [id, value] of Object.entries({record: `${record.w}–${record.l}`, pct: record.pct, runs: record.rs, allowed: record.ra, diff: record.diff})) {
      document.getElementById(`stat-${id}`).textContent = value;
    }
    document.getElementById('record-date').textContent = `2026 season · As of ${standings.as_of}`;
  }).catch(error => console.warn(error));
  Promise.all([get('data/season/games.json'), get('data/teams/teams.json')]).then(([games, registry]) => {
    const names = new Map(Object.values(registry.divisions).flat().map(team => [team.slug, team.team]));
    const rows = games.filter(game => (game.home === slug || game.away === slug) && game.status === 'final')
      .sort((a, b) => a.date.localeCompare(b.date)).slice(-5).reverse();
    if (!rows.length) return;
    const list = document.getElementById('recent-results');
    list.replaceChildren();
    for (const game of rows) {
      const home = game.home === slug;
      const own = home ? game.homeScore : game.awayScore;
      const other = home ? game.awayScore : game.homeScore;
      const link = document.createElement('a');
      link.className = 'result';
      link.href = `box.html?date=${encodeURIComponent(game.date)}&game=${encodeURIComponent(`${game.away}@${game.home}`)}`;
      const date = element('time', game.date);
      date.dateTime = game.date;
      link.append(date, element('strong', `${home ? 'vs.' : 'at'} ${names.get(home ? game.away : game.home) || (home ? game.away : game.home)}`), element('span', `${own > other ? 'W' : 'L'} ${own}–${other} →`));
      list.append(link);
    }
  }).catch(error => console.warn(error));
})();

(async()=>{
  const host=document.getElementById('mayaguezCards');
  try{
    const response=await fetch('data/rosters/mayaguez-sultans.json',{cache:'no-store'});
    if(!response.ok)throw Error('Roster unavailable');
    const roster=await response.json();
    let seasons=[];
    try{seasons=await GLBPlayerCards.loadSeasons();}catch(error){console.warn(error);}
    const cards=await Promise.all(roster.players.map(async player=>{
      const entry=document.createElement('article');entry.className='tpe-card-entry';
      entry.id='card-'+player.card_id.toLowerCase();entry.dataset.cardId=player.card_id;
      entry.append(GLBPlayerCards.createCard({...player,teamSlug:'mayaguez-sultans',teamName:roster.team},GLBPlayerCards.careerFor(player.slug,seasons)));
      entry.append(await TaipeiFieldstock.createClaimPanel(player,{teamSlug:'mayaguez-sultans',teamName:roster.team}));
      return entry;
    }));
    host.replaceChildren(...cards);
    if(location.hash.startsWith('#card-'))document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }catch(error){host.textContent='The card collection could not load. Please refresh.';console.warn(error);}
})();
