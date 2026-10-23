(() => {
  const slug = 'taipei-neon';
  const toggle = document.getElementById('navToggle');
  toggle.addEventListener('click', () => {
    const open = document.getElementById('mobileMenu').classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
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
    document.getElementById('record-date').textContent = `Season record · As of ${standings.as_of}`;
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
      link.append(element('time', game.date), element('strong', `${home ? 'vs.' : 'at'} ${names.get(home ? game.away : game.home)}`), element('span', `${own > other ? 'W' : 'L'} ${own}–${other} →`));
      list.append(link);
    }
  }).catch(error => console.warn(error));
})();
