/* Browser views of the canonical, derived GLB season JSON. */
(() => {
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const fetchJSON = async file => {
    const response = await fetch(file, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
    return response.json();
  };
  const dateText = date => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC'
  });
  const names = new Map();
  const label = slug => names.get(slug) || slug;
  const boxLink = game => `box.html?date=${encodeURIComponent(game.date)}&game=${encodeURIComponent(`${game.away}@${game.home}`)}`;
  const cell = (tag, value, className) => {
    const el = document.createElement(tag);
    el.textContent = String(value ?? '—');
    if (className) el.className = className;
    return el;
  };
  function teamRows(tbody, rows) {
    tbody.replaceChildren(...rows.map((row, i) => {
      const tr = document.createElement('tr');
      if (i === 0) tr.className = 'leader-row';
      const first = document.createElement('td');
      first.className = 'team-cell';
      const a = document.createElement('a');
      a.className = 'team-link';
      a.href = `team.html?team=${encodeURIComponent(row.slug)}`;
      a.append(cell('span', i + 1, 'rank-badge'), cell('span', row.team, 'team-text'));
      first.append(a);
      tr.append(first, ...[row.w, row.l, row.pct, row.gb, row.rs, row.ra, row.diff].map((value, j) =>
        cell('td', value, j === 6 ? (String(value).startsWith('+') ? 'diff-positive' : '') : j === 4 || j === 5 ? 'secondary' : '')));
      return tr;
    }));
  }
  function scoreCard(game) {
    const a = document.createElement('a');
    a.className = 'score-cell'; a.href = boxLink(game);
    const top = document.createElement('div'); top.className = 'score-top';
    top.append(cell('span', `${game.date} · Final`), cell('span', 'Box', 'score-status'));
    a.append(top);
    for (const side of ['away', 'home']) {
      const line = document.createElement('div'); line.className = 'team-line';
      line.append(cell('span', label(game[side]), 'team-name'), cell('span', game[`${side}Score`], 'team-score'));
      a.append(line);
    }
    return a;
  }
  function showError(message) {
    const target = $('#season-status') || $('main') || $('body');
    const p = cell('p', `Season data unavailable: ${message}`);
    p.setAttribute('role', 'alert'); target.prepend(p);
  }
  async function load() {
    const page = document.body.dataset.seasonPage;
    if (!page) return;
    try {
      const [teams, standings, games, stats, leaders] = await Promise.all([
        fetchJSON('data/teams/teams.json'), fetchJSON('current/standings.json'),
        fetchJSON('data/season/games.json'), fetchJSON('data/season/player-stats.json'), fetchJSON('current/leaders.json')
      ]);
      for (const team of Object.values(teams.divisions).flat()) names.set(team.slug, team.team);
      if (page === 'standings') {
        const sections = $$('.standings-block .division');
        for (const [section, division] of sections.map(s => [s, s.querySelector('h2').id.startsWith('pacific') ? 'Pacific' : 'Americas'])) {
          teamRows(section.querySelector('tbody'), standings.divisions[division]);
        }
        const meta = $('.page-meta');
        if (meta) meta.replaceChildren(cell('span', `${games.length} official games`), cell('span', `As of ${dateText(standings.as_of)}`), cell('span', 'Season 1'));
        const rail = $('.mini-table tbody');
        if (rail) rail.replaceChildren(...Object.entries(standings.divisions).map(([division, rows]) => {
          const tr = document.createElement('tr');
          tr.append(cell('td', division), cell('td', rows[0].team), cell('td', rows[0].pct));
          return tr;
        }));
        $$('.rail-section').slice(1).forEach(el => el.remove());
        const strip = $('.scores-row');
        if (strip) strip.replaceChildren(...games.slice(-4).reverse().map(scoreCard));
      }
      if (page === 'home') {
        const strip = $('.scores-row');
        if (strip) strip.replaceChildren(...games.slice(-4).reverse().map(scoreCard));
        const tbody = $('.mini-standings tbody');
        if (tbody) tbody.replaceChildren(...standings.divisions.Pacific.slice(0, 4).map((row, i) => {
          const tr = document.createElement('tr');
          tr.append(cell('td', row.team, i === 0 ? 'leader' : ''), cell('td', row.w), cell('td', row.l), cell('td', row.pct));
          return tr;
        }));
        const module = $('.modules .card');
        if (module) {
          const title = module.querySelector('.module-title');
          if (title) title.textContent = 'Latest Results';
          const list = module.querySelector('.schedule-list');
          if (list) list.replaceChildren(...games.slice(-3).reverse().map(g => {
            const a = document.createElement('a'); a.className = 'schedule-item'; a.href = boxLink(g);
            a.append(cell('span', dateText(g.date), 'schedule-date'),
              cell('h3', `${label(g.away)} at ${label(g.home)}`, 'schedule-matchup'),
              cell('div', `${g.awayScore}–${g.homeScore} · Final`, 'schedule-meta'));
            return a;
          }));
        }
        const story = $('.story-list');
        if (story) story.replaceChildren(...[['batting','HR','Home runs'],['batting','AVG','Batting average'],['pitching','K','Strikeouts']].map(([group,key,title]) => {
          const first = leaders[group]?.[key]?.[0];
          const a = document.createElement('a'); a.className = 'story-item'; a.href = 'stats.html';
          a.append(cell('span', title, 'story-type'), cell('h3', first ? `${first.player} · ${first.value}` : 'No recorded leader', 'story-title-sm'),
            cell('div', first?.team || '', 'story-meta'));
          return a;
        }));
        const teamList = $('.team-list');
        if (teamList) teamList.replaceChildren(...Object.entries(standings.divisions).map(([division, rows]) => {
          const row = rows[0]; const a = document.createElement('a'); a.className = 'team-item'; a.href = `team.html?team=${encodeURIComponent(row.slug)}`;
          a.append(cell('span', division, 'team-label'), cell('h3', row.team, 'team-title'),
            cell('div', `${row.w}–${row.l} · ${row.pct} · ${row.diff} run differential`, 'team-meta'));
          return a;
        }));
        const heroCopy = $('.hero-deck');
        if (heroCopy) heroCopy.textContent = `${games.length} official games recorded through ${dateText(standings.as_of)}. Explore the season results and club standings.`;
        const headlines = $$('.news-headline');
        if (headlines[0]) headlines[0].textContent = 'The league reaches 75% of its inaugural season';
        if (headlines[1]) headlines[1].textContent = 'Club standings and player leaders updated';
        if (headlines[2]) headlines[2].textContent = 'Explore box scores from across the league';
      }
      if (page === 'schedule') {
        const sheet = $('.record-sheet');
        $('#season-loading')?.remove();
        $$('.date-group').forEach(el => el.remove());
        const detail = $('.meta-detail'); if (detail) detail.textContent = `Season 1 · ${games.length} final games through ${dateText(standings.as_of)}`;
        const controls = document.createElement('div'); controls.className = 'season-controls';
        const select = document.createElement('select'); select.setAttribute('aria-label', 'Select month');
        const months = [...new Set(games.map(g => g.date.slice(0, 7)))];
        for (const month of months) { const option = document.createElement('option'); option.value = month; option.textContent = new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-US', {month:'long', year:'numeric', timeZone:'UTC'}); select.append(option); }
        select.value = months.at(-1);
        const list = document.createElement('div');
        function renderMonth() {
          list.replaceChildren();
          const byDate = new Map();
          for (const game of games.filter(g => g.date.startsWith(select.value))) {
            if (!byDate.has(game.date)) byDate.set(game.date, []);
            byDate.get(game.date).push(game);
          }
          for (const [date, slate] of byDate) {
            const group = document.createElement('div'); group.className = 'date-group';
            group.append(cell('div', dateText(date), 'date-header'));
            const table = document.createElement('table');
            const tbody = document.createElement('tbody');
            for (const game of slate) {
              const tr = document.createElement('tr');
              const linkTd = document.createElement('td'); linkTd.className = 'col-link';
              const a = cell('a', 'Box', 'box-link'); a.href = boxLink(game); linkTd.append(a);
              tr.append(cell('td', 'Final', 'col-time'), cell('td', label(game.away), 'col-team col-team-away'),
                cell('td', '@', 'col-at'), cell('td', label(game.home), 'col-team'),
                cell('td', `${game.awayScore}–${game.homeScore}`, 'col-result'), linkTd);
              tbody.append(tr);
            }
            table.append(tbody); group.append(table); list.append(group);
          }
        }
        select.addEventListener('change', renderMonth); controls.append(select);
        sheet.insertBefore(controls, sheet.querySelector('footer'));\n        sheet.insertBefore(list, sheet.querySelector('footer')); renderMonth();
      }
      if (page === 'scores') {
        const select = $('#month');
        const months = [...new Set(games.map(g => g.date.slice(0, 7)))];
        for (const month of months) { const option = document.createElement('option'); option.value = month; option.textContent = new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-US',{month:'long',year:'numeric',timeZone:'UTC'}); select.append(option); }
        select.value = months.at(-1);
        const list = $('#game-list');
        const render = () => list.replaceChildren(...games.filter(g => g.date.startsWith(select.value)).reverse().map(g => {
          const a = document.createElement('a'); a.className = 'result'; a.href = boxLink(g);
          a.append(cell('time', dateText(g.date)), cell('strong', `${label(g.away)} ${g.awayScore} · ${label(g.home)} ${g.homeScore}`), cell('span', 'Box score →'));
          return a;
        }));
        select.addEventListener('change', render); render();
        $('#as-of').textContent = `${games.length} official games · through ${dateText(standings.as_of)}`;
      }
      if (page === 'stats') {
        $('#as-of').textContent = `${stats.length} players with recorded stats · through ${dateText(standings.as_of)}`;
        const select = $('#category');
        const categories = [['batting','HR','Home runs'],['batting','RBI','RBI'],['batting','AVG','Batting average'],['batting','OPS','OPS'],['batting','H','Hits'],['batting','SB','Stolen bases'],['pitching','W','Wins'],['pitching','K','Strikeouts'],['pitching','ERA','ERA'],['pitching','WHIP','WHIP'],['pitching','SV','Saves']];
        for (const [group, key, title] of categories) { const option = document.createElement('option'); option.value = `${group}.${key}`; option.textContent = title; select.append(option); }
        const render = () => {
          const [group, key] = select.value.split('.');
          const eligible = stats.filter(p => group === 'batting' ? p.batting?.AB > 0 : p.pitching?.OUTS > 0);
          eligible.sort((a,b) => {
            const av = Number(a[group]?.[key] ?? (key === 'ERA' || key === 'WHIP' ? Infinity : -Infinity));
            const bv = Number(b[group]?.[key] ?? (key === 'ERA' || key === 'WHIP' ? Infinity : -Infinity));
            return (key === 'ERA' || key === 'WHIP' ? av-bv : bv-av) || a.name.localeCompare(b.name);
          });
          $('#stat-body').replaceChildren(...eligible.slice(0,50).map((player, i) => {
            const tr = document.createElement('tr');
            const playerCell = document.createElement('td');
            const playerLink = cell('a', player.name);
            playerLink.href = `player.html?team=${encodeURIComponent(player.team_slug)}&player=${encodeURIComponent(player.player)}`;
            playerCell.append(playerLink);
            tr.append(cell('td', i+1), playerCell, cell('td',player.team),cell('td',player[group][key]));
            return tr;
          }));
        };
        select.addEventListener('change', render); render();
      }
      if (page === 'box') {
        const date = new URLSearchParams(location.search).get('date');
        const matchup = new URLSearchParams(location.search).get('game');
        if (!/^2026-\d\d-\d\d$/.test(date || '') || !/^[a-z0-9-]+@[a-z0-9-]+$/.test(matchup || '')) throw new Error('Invalid box-score link');
        const g = await fetchJSON(`data/games/${date}/${matchup}.json`);
        const [away, home] = matchup.split('@');
        $('#game-title').textContent = `${label(away)} at ${label(home)}`;
        $('#as-of').textContent = `${dateText(date)} · Final · ${g.final.away}–${g.final.home}`;
        const inningRows = Array.isArray(g.linescore?.innings) ? g.linescore.innings :
          Array.isArray(g.linescore?.away) && Array.isArray(g.linescore?.home) ?
          g.linescore.away.map((runs, i) => ({ inning: i + 1, away: runs, home: g.linescore.home[i] ?? '' })) : null;
        if (inningRows) {
          $('#inning-head').replaceChildren(cell('th','Team'),...inningRows.map(i=>cell('th',i.inning)),cell('th','R'),cell('th','H'),cell('th','E'));
          $('#inning-body').replaceChildren(...['away','home'].map(side=>{
            const tr=document.createElement('tr');
            tr.append(cell('th',label(side==='away'?away:home)),...inningRows.map(i=>cell('td',i[side])),
              cell('td',g.final[side]),cell('td',g.linescore.totals?.[side]?.H ?? '—'),cell('td',g.linescore.totals?.[side]?.E ?? '—')); return tr;
          }));
        } else {
          $('#inning-head').replaceChildren(cell('th','Team'),cell('th','R'));
          $('#inning-body').replaceChildren(...['away','home'].map(side=>{
            const tr=document.createElement('tr'); tr.append(cell('th',label(side==='away'?away:home)),cell('td',g.final[side])); return tr;
          }));
        }
        for (const kind of ['batting','pitching']) {
          const container = $(`#${kind}`);
          if (!g[kind]) { container.textContent = 'Player lines were not recorded for this Opening Day game.'; continue; }
          for (const side of ['away','home']) {
            const heading = cell('h3',label(side==='away'?away:home));
            const table=document.createElement('table'); const head=document.createElement('tr');
            const keys=kind==='batting' ? ['AB','R','H','2B','3B','HR','RBI','BB','K','SB'] : ['IP','H','R','ER','BB','K','HR'];
            head.append(cell('th','Player'),...keys.map(k=>cell('th',k)));
            const body=document.createElement('tbody');
            for(const row of g[kind][side]) { const tr=document.createElement('tr'); tr.append(cell('th',row.name || row.player),...keys.map(k=>cell('td',row[k] ?? (k==='IP' ? `${Math.floor(row.IP_outs/3)}.${row.IP_outs%3}`:'—')))); body.append(tr); }
            table.append(head,body);container.append(heading,table);
          }
        }
      }
    } catch (error) { showError(error.message); console.error(error); }
  }
  load();
})();
