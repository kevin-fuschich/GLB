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
  const teamLink = (slug, className) => {
    const a = cell('a', label(slug), className);
    a.href = `team.html?team=${encodeURIComponent(slug)}`;
    return a;
  };
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
    const card = document.createElement('div');
    card.className = 'score-cell';
    const top = document.createElement('div'); top.className = 'score-top';
    const box = cell('a', 'Box', 'score-status'); box.href = boxLink(game);
    top.append(cell('span', `${game.date} · Final`), box);
    card.append(top);
    for (const side of ['away', 'home']) {
      const line = document.createElement('div'); line.className = 'team-line';
      line.append(teamLink(game[side], 'team-name team-page-link'), cell('span', game[`${side}Score`], 'team-score'));
      card.append(line);
    }
    return card;
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
      const seasonYear = standings.as_of?.slice(0, 4) || 'Current';
      $$('.header-meta').forEach(el => { el.textContent = `${seasonYear} Season`; });
      const clubRows = Object.values(standings.divisions).flat();
      const seasonComplete = clubRows.every(row => row.w + row.l >= 162);
      const stretchRun = clubRows.every(row => row.w + row.l >= 120);
      if (page === 'standings') {
        const sections = $$('.standings-block .division');
        for (const [section, division] of sections.map(s => [s, s.querySelector('h2').id.startsWith('pacific') ? 'Pacific' : 'Americas'])) {
          teamRows(section.querySelector('tbody'), standings.divisions[division]);
        }
        const meta = $('.page-meta');
        if (meta) meta.replaceChildren(cell('span', 'Regular Season'), cell('span', `As of ${dateText(standings.as_of)}`));
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
        if (strip) {
          const latestDate = games.at(-1)?.date;
          const slate = latestDate ? games.filter(game => game.date === latestDate) : [];
          if (slate.length) {
            const cards = slate.map(scoreCard);
            const copy = cards.map(card => {
              const duplicate = card.cloneNode(true);
              duplicate.classList.add('ticker-copy');
              duplicate.setAttribute('aria-hidden', 'true');
              duplicate.tabIndex = -1;
              return duplicate;
            });
            strip.replaceChildren(...cards, ...copy);
            strip.style.setProperty('--ticker-duration', `${Math.max(25, slate.length * 7)}s`);
          } else strip.replaceChildren(cell('span', 'No recent results'));
        }
        const tbody = $('.mini-standings tbody');
        if (tbody) tbody.replaceChildren(...standings.divisions.Pacific.slice(0, 4).map((row, i) => {
          const tr = document.createElement('tr');
          const teamCell = document.createElement('td');
          if (i === 0) teamCell.className = 'leader';
          teamCell.append(teamLink(row.slug, 'team-page-link'));
          tr.append(teamCell, cell('td', row.w), cell('td', row.l), cell('td', row.pct));
          return tr;
        }));
        const module = $('.modules .card');
        if (module) {
          const title = module.querySelector('.module-title');
          if (title) title.textContent = 'Latest Results';
          const list = module.querySelector('.schedule-list');
          if (list) list.replaceChildren(...games.slice(-3).reverse().map(g => {
            const item = document.createElement('div'); item.className = 'schedule-item';
            const matchup = document.createElement('h3'); matchup.className = 'schedule-matchup';
            matchup.append(teamLink(g.away, 'team-page-link'), document.createTextNode(' at '), teamLink(g.home, 'team-page-link'));
            const result = document.createElement('div'); result.className = 'schedule-meta';
            const box = cell('a', 'Box score', 'box-link'); box.href = boxLink(g);
            result.append(document.createTextNode(`${g.awayScore}–${g.homeScore} · Final · `), box);
            item.append(cell('span', dateText(g.date), 'schedule-date'), matchup, result);
            return item;
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
        const heroKicker = $('.hero-kicker');
        if (heroKicker) heroKicker.textContent = seasonComplete ? 'Regular Season Complete' : stretchRun ? 'The Stretch Run' : 'On the Diamond';
        const heroCopy = $('.hero-deck');
        if (heroCopy) heroCopy.textContent = seasonComplete
          ? 'The regular season is in the books. Explore the final standings, scores, and player leaders.'
          : stretchRun
            ? 'The stretch run is on. Follow the latest scores, division races, and players shaping the league.'
            : 'Follow the latest scores, division races, and players shaping the league.';
        const heroMedia = $('.hero-media');
        const heroTitle = $('.hero-title');
        const heroControls = $('.hero-controls');
        if (heroMedia && heroTitle && heroCopy && heroKicker && heroControls) {
          const race = Object.entries(standings.divisions).map(([division, rows]) => ({
            division, leader: rows[0], chaser: rows[1], gap: Number(rows[1]?.gb)
          })).filter(item => item.chaser && Number.isFinite(item.gap))
            .sort((a, b) => a.gap - b.gap)[0];
          const lastDate = games.at(-1)?.date;
          const lastSlate = games.filter(game => game.date === lastDate);
          const lastGame = lastSlate.at(-1);
          const homer = leaders.batting?.HR?.[0];
          const slides = [
            {
              image: 'images/hero/hero-01.png', kicker: seasonComplete ? 'Final Standings' : 'Division Race',
              title: seasonComplete ? 'The division races are decided' : 'The division race is on',
              deck: race ? (race.gap === 0 ? `The ${race.division} is tied at the top. Explore the standings.` : `The closest race is in the ${race.division}, with ${race.gap} ${race.gap === 1 ? 'game' : 'games'} separating the top two clubs.`) : 'Explore the GLB standings.',
              href: 'standings.html', link: 'View Standings'
            },
            {
              image: 'images/hero/hero-02.png', kicker: 'Latest Results',
              title: 'The latest slate is in',
              deck: lastGame ? `${lastSlate.length} ${lastSlate.length === 1 ? 'game' : 'games'} from ${dateText(lastDate)}. See every final score and box score.` : 'See the latest results across GLB.',
              href: 'scores.html', link: 'See All Scores'
            },
            {
              image: 'images/hero/hero-03.png', kicker: 'Player Watch',
              title: 'The home-run chase',
              deck: homer ? `The league leader has ${homer.value} home runs. See the hitters and pitchers setting the pace.` : 'See the hitters and pitchers setting the pace.',
              href: 'stats.html', link: 'Player Stats'
            },
            {
              image: 'assets/teams/spokane-alloys/images/stadium/club-spokane-alloys-mascot.png',
              kicker: 'Club Culture', title: 'Meet the Spokane Alloys mascot',
              deck: 'A familiar face at OGWA Stadium. Step inside the world the Alloys have built around the game.',
              href: 'club-spokane-alloys.html', link: 'Explore the Alloys'
            }
          ];
          slides.slice(1).forEach(slide => { const preload = new Image(); preload.src = slide.image; });
          let active = 0;
          let changeTimer;
          const heroLink = $('.hero-links .hero-link');
          const buttons = slides.map((slide, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = index + 1;
            button.setAttribute('aria-label', `Show featured story ${index + 1}: ${slide.kicker}`);
            button.addEventListener('click', () => showSlide(index));
            return button;
          });
          heroControls.replaceChildren(...buttons);
          function showSlide(index) {
            active = index;
            const slide = slides[index];
            clearTimeout(changeTimer);
            heroMedia.classList.add('hero-changing');
            changeTimer = setTimeout(() => {
              heroMedia.style.backgroundImage = `linear-gradient(to top, rgba(0,0,0,0.65), rgba(0,0,0,0.12)), url("${slide.image}")`;
              heroKicker.textContent = slide.kicker;
              heroTitle.textContent = slide.title;
              heroCopy.textContent = slide.deck;
              if (heroLink) { heroLink.href = slide.href; heroLink.textContent = slide.link; }
              buttons.forEach((button, i) => button.setAttribute('aria-current', i === index ? 'true' : 'false'));
              heroMedia.classList.remove('hero-changing');
            }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220);
          }
          showSlide(0);
          if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            let rotation;
            const start = () => { if (!rotation) rotation = setInterval(() => showSlide((active + 1) % slides.length), 8000); };
            const stop = () => { clearInterval(rotation); rotation = null; };
            heroMedia.addEventListener('mouseenter', stop);
            heroMedia.addEventListener('mouseleave', start);
            heroMedia.addEventListener('focusin', stop);
            heroMedia.addEventListener('focusout', event => { if (!heroMedia.contains(event.relatedTarget)) start(); });
            document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
            start();
          }
        }
        const stories = document.querySelectorAll('.news-list .news-item');
        const setStory = (index, tag, headline, meta, href) => {
          const card = stories[index];
          if (!card) return;
          card.href = href;
          card.querySelector('.news-tag').textContent = tag;
          card.querySelector('.news-headline').textContent = headline;
          card.querySelector('.news-meta').textContent = meta;
        };
        const race = Object.entries(standings.divisions).map(([division, rows]) => ({
          division, leader: rows[0], chaser: rows[1], gap: Number(rows[1]?.gb)
        })).filter(item => item.chaser && Number.isFinite(item.gap))
          .sort((a, b) => a.gap - b.gap)[0];
        if (race) {
          const headline = seasonComplete
            ? `${race.leader.team} finishes atop the ${race.division}`
            : race.gap === 0
              ? `${race.leader.team} and ${race.chaser.team} are level atop the ${race.division}`
              : race.gap <= 6
                ? `${race.chaser.team} trails ${race.leader.team} by ${race.gap} ${race.gap === 1 ? 'game' : 'games'}`
                : `${race.leader.team} leads the ${race.division} by ${race.gap} games`;
          setStory(0, 'Division Race', headline,
            `${race.division} · ${race.leader.w}–${race.leader.l} to ${race.chaser.w}–${race.chaser.l}`,
            'standings.html');
        }
        const form = clubRows.map(row => {
          const recent = games.filter(g => g.home === row.slug || g.away === row.slug).slice(-10);
          return { row, played: recent.length, wins: recent.filter(g =>
            g[g.home === row.slug ? 'homeScore' : 'awayScore'] >
            g[g.home === row.slug ? 'awayScore' : 'homeScore']).length };
        }).filter(item => item.played >= 5)
          .sort((a, b) => b.wins - a.wins || b.row.w - a.row.w)[0];
        if (form) setStory(1, 'Recent Form',
          `${form.row.team} wins ${form.wins} of its last ${form.played}`,
          `${form.row.w}–${form.row.l} this season · See the club`,
          `team.html?team=${encodeURIComponent(form.row.slug)}`);
        const homerLeader = leaders.batting?.HR?.[0];
        if (homerLeader) setStory(2, 'Player Watch',
          Number(leaders.batting.HR?.[1]?.value) === Number(homerLeader.value)
            ? `${homerLeader.player} shares the GLB home-run lead at ${homerLeader.value}`
            : `${homerLeader.player} leads GLB with ${homerLeader.value} home runs`,
          `${homerLeader.team} · Home run leader`,
          `player.html?team=${encodeURIComponent(homerLeader.team_slug)}&player=${encodeURIComponent(homerLeader.player_slug)}`);
      }
      if (page === 'schedule') {
        const sheet = $('.record-sheet');
        $('#season-loading')?.remove();
        $$('.date-group').forEach(el => el.remove());
        const detail = $('.meta-detail'); if (detail) detail.textContent = `${seasonYear} · Results through ${dateText(standings.as_of)}`;
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
              const awayTd = document.createElement('td'); awayTd.className = 'col-team col-team-away'; awayTd.append(teamLink(game.away, 'team-page-link'));
              const homeTd = document.createElement('td'); homeTd.className = 'col-team'; homeTd.append(teamLink(game.home, 'team-page-link'));
              tr.append(cell('td', 'Final', 'col-time'), awayTd,
                cell('td', '@', 'col-at'), homeTd,
                cell('td', `${game.awayScore}–${game.homeScore}`, 'col-result'), linkTd);
              tbody.append(tr);
            }
            table.append(tbody); group.append(table); list.append(group);
          }
        }
        select.addEventListener('change', renderMonth); controls.append(select);
        sheet.insertBefore(controls, sheet.querySelector('footer'));
        sheet.insertBefore(list, sheet.querySelector('footer')); renderMonth();
      }
      if (page === 'scores') {
        const select = $('#month');
        const months = [...new Set(games.map(g => g.date.slice(0, 7)))];
        for (const month of months) { const option = document.createElement('option'); option.value = month; option.textContent = new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-US',{month:'long',year:'numeric',timeZone:'UTC'}); select.append(option); }
        select.value = months.at(-1);
        const list = $('#game-list');
        const render = () => list.replaceChildren(...games.filter(g => g.date.startsWith(select.value)).reverse().map(g => {
          const result = document.createElement('div'); result.className = 'result';
          const score = document.createElement('strong');
          score.append(teamLink(g.away, 'team-page-link'), document.createTextNode(` ${g.awayScore} · `), teamLink(g.home, 'team-page-link'), document.createTextNode(` ${g.homeScore}`));
          const box = cell('a', 'Box score →'); box.href = boxLink(g);
          result.append(cell('time', dateText(g.date)), score, box);
          return result;
        }));
        select.addEventListener('change', render); render();
        $('#as-of').textContent = `Results through ${dateText(standings.as_of)}`;
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
        $('#game-title').replaceChildren(teamLink(away, 'team-page-link'), document.createTextNode(' at '), teamLink(home, 'team-page-link'));
        $('#as-of').textContent = `${dateText(date)} · Final · ${g.final.away}–${g.final.home}`;
        const inningRows = Array.isArray(g.linescore?.innings) ? g.linescore.innings :
          Array.isArray(g.linescore?.away) && Array.isArray(g.linescore?.home) ?
          g.linescore.away.map((runs, i) => ({ inning: i + 1, away: runs, home: g.linescore.home[i] ?? '' })) : null;
        if (inningRows) {
          $('#inning-head').replaceChildren(cell('th','Team'),...inningRows.map(i=>cell('th',i.inning)),cell('th','R'),cell('th','H'),cell('th','E'));
          $('#inning-body').replaceChildren(...['away','home'].map(side=>{
            const tr=document.createElement('tr');
            const teamHead = document.createElement('th'); teamHead.append(teamLink(side === 'away' ? away : home, 'team-page-link'));
            tr.append(teamHead,...inningRows.map(i=>cell('td',i[side])),
              cell('td',g.final[side]),cell('td',g.linescore.totals?.[side]?.H ?? '—'),cell('td',g.linescore.totals?.[side]?.E ?? '—')); return tr;
          }));
        } else {
          $('#inning-head').replaceChildren(cell('th','Team'),cell('th','R'));
          $('#inning-body').replaceChildren(...['away','home'].map(side=>{
            const tr=document.createElement('tr'); const teamHead=document.createElement('th'); teamHead.append(teamLink(side === 'away' ? away : home, 'team-page-link')); tr.append(teamHead,cell('td',g.final[side])); return tr;
          }));
        }
        for (const kind of ['batting','pitching']) {
          const container = $(`#${kind}`);
          if (!g[kind]) { container.textContent = 'Player lines were not recorded for this Opening Day game.'; continue; }
          for (const side of ['away','home']) {
            const heading = document.createElement('h3'); heading.append(teamLink(side === 'away' ? away : home, 'team-page-link'));
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
