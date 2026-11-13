(() => {
  const slug = 'durham-gold';
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

(async () => {
  const host = document.getElementById('triangleCards');
  if (!host) return;
  try {
    const response = await fetch('data/rosters/durham-gold.json', {cache:'no-store'});
    if (!response.ok) throw Error('Roster unavailable');
    const roster = await response.json();
    let seasons = [];
    try { seasons = await GLBPlayerCards.loadSeasons(); } catch (error) { console.warn(error); }
    const featured = ['caleb-rowan','ethan-bowen','omar-salcedo','mateo-rios'];
    const players = featured.map(slug => roster.players.find(player => player.slug === slug))
      .concat(roster.players.filter(player => !featured.includes(player.slug)));
    const entries = await Promise.all(players.map(async player => {
      const article = document.createElement('article');
      article.className = 'tpe-card-entry';
      article.id = 'card-' + player.card_id.toLowerCase();
      article.dataset.cardId = player.card_id;
      const record = GLBPlayerCards.careerFor(player.slug, seasons);
      article.append(GLBPlayerCards.createCard({...player, teamSlug:'durham-gold', teamName:roster.team}, record));
      const details = document.createElement('details');
      details.className = 'tpe-card-details';
      const summary = document.createElement('summary');
      summary.textContent = 'Read card details';
      details.append(summary);
      const facts = document.createElement('dl');
      const season = record?.seasons.find(row => Number(row.year) === 2026);
      const pitcher = ['SP','RP','CL'].includes(player.position);
      const stats = season?.[pitcher ? 'pitching' : 'batting'];
      const values = [
        ['Card',player.card_id],['Born',player.dob],['Birthplace',player.birthplace],['Height / weight',`${player.height} / ${player.weight} lb`],['Age',player.age],['Bats / throws',`${player.bats} / ${player.throws}`],
        ['2026 club',roster.team],
        ...(pitcher ? ['G','IP','W','L','SV','K','ERA'] : ['G','AB','H','HR','RBI','AVG','OPS']).map(key => [key,stats?.[key] ?? '—'])
      ];
      for (const [label,value] of values) {
        const term = document.createElement('dt'), description = document.createElement('dd');
        term.textContent = label; description.textContent = String(value);
        facts.append(term,description);
      }
      details.append(facts);
      for (const copy of [player.scouting_report,player.factoid].filter(Boolean)) {
        const paragraph = document.createElement('p'); paragraph.textContent = copy;
        details.append(paragraph);
      }
      article.append(details, await TaipeiFieldstock.createClaimPanel(player,{teamSlug:'durham-gold',teamName:roster.team}));
      return article;
    }));
    host.replaceChildren(...entries);
  } catch (error) {
    console.warn(error);
    host.textContent = 'The card collection could not load. Please refresh or use the player links in the roster below.';
  }
})();
