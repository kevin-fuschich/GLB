/* Player records and reusable baseball cards. Years come only from the season index. */
(() => {
  const battingKeys = ['G', 'AB', 'R', 'H', '2B', '3B', 'HR', 'RBI', 'BB', 'K', 'SB'];
  const pitchingKeys = ['G', 'OUTS', 'H', 'R', 'ER', 'BB', 'K', 'HR', 'W', 'L', 'SV'];
  const rate3 = value => value.toFixed(3).replace(/^0/, '');

  async function loadSeasons() {
    const get = async path => {
      const response = await fetch(path, { cache: 'no-store' });
      if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
      return response.json();
    };
    const index = await get('data/season/seasons.json');
    if (index.schema !== 'glb.season-index.v1' || !Array.isArray(index.seasons) || !index.seasons.length)
      throw new Error('Season index unavailable');
    const seasons = await Promise.all(index.seasons.map(async entry => ({
      year: entry.year, players: await get(entry.player_stats_path)
    })));
    return seasons.sort((a, b) => a.year - b.year);
  }

  function careerFor(slug, seasons) {
    const rows = seasons.flatMap(({ year, players }) => players
      .filter(row => row.player === slug)
      .map(row => ({ year, ...row })));
    if (!rows.length) return null;
    const first = rows[rows.length - 1];
    const batting = Object.fromEntries(battingKeys.map(key => [key, 0]));
    const pitching = Object.fromEntries(pitchingKeys.map(key => [key, 0]));
    for (const row of rows) {
      for (const key of battingKeys) batting[key] += Number(row.batting?.[key] || 0);
      for (const key of pitchingKeys) pitching[key] += Number(row.pitching?.[key] || 0);
    }
    const singles = batting.H - batting['2B'] - batting['3B'] - batting.HR;
    const bases = singles + 2 * batting['2B'] + 3 * batting['3B'] + 4 * batting.HR;
    const obp = batting.AB + batting.BB ? (batting.H + batting.BB) / (batting.AB + batting.BB) : 0;
    batting.AVG = batting.AB ? rate3(batting.H / batting.AB) : '.000';
    batting.OPS = batting.AB ? (obp + bases / batting.AB).toFixed(3) : '.000';
    pitching.IP = `${Math.floor(pitching.OUTS / 3)}.${pitching.OUTS % 3}`;
    pitching.ERA = pitching.OUTS ? (27 * pitching.ER / pitching.OUTS).toFixed(2) : null;
    pitching.WHIP = pitching.OUTS ? (3 * (pitching.H + pitching.BB) / pitching.OUTS).toFixed(2) : null;
    return { player: slug, name: first.name, team: first.team, team_slug: first.team_slug,
      position: first.position, seasons: rows, batting, pitching };
  }

  const palettes = [
    ['#163a54', '#7ac0ca'], ['#422e52', '#d6a6d1'], ['#2b443f', '#a9c494'],
    ['#523625', '#dda572'], ['#243a62', '#a9bfe1'], ['#524135', '#e2c68c']
  ];
  function photoPath(player) {
    if (player.teamSlug === 'spokane-alloys')
      return `assets/images/players/spokane-alloys/spokane-${player.slug}.png`;
    if (player.teamSlug === 'albuquerque-aeros')
      return `assets/teams/albuquerque-aeros/images/players/albuquerque-${player.slug}${player.slug === 'carmine-sforza' ? '.pthinnng' : ''}.png`;
    if (player.teamSlug === 'durham-gold')
      return `assets/images/players/durham-gold/durham-${player.slug}.jpg`;
    return null;
  }
  function text(tag, value, className) {
    const element = document.createElement(tag);
    element.textContent = String(value ?? '—');
    if (className) element.className = className;
    return element;
  }
  function createCard(player, record, { link = true } = {}) {
    const card = document.createElement(link ? 'a' : 'article');
    card.className = 'glb-player-card';
    if (link) card.href = `player.html?team=${encodeURIComponent(player.teamSlug)}&player=${encodeURIComponent(player.slug)}`;
    card.setAttribute('aria-label', `${player.name}, ${player.position}, ${player.teamName} player card`);
    const palette = player.teamSlug === 'durham-gold' ? ['#18283d', '#d9ad65'] :
      palettes[[...player.teamSlug].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palettes.length];
    card.style.setProperty('--player-deep', palette[0]);
    card.style.setProperty('--player-accent', palette[1]);
    const top = text('div', '', 'glb-player-card__top');
    top.append(text('span', 'GLB', 'glb-player-card__mark'), text('span', 'Player Card', 'glb-player-card__edition'));
    const portrait = text('div', '', 'glb-player-card__portrait');
    const initials = () => {
      const badge = portrait.querySelector('.glb-player-card__position');
      portrait.replaceChildren(text('span', player.name.split(/\s+/).slice(0, 2)
        .map(part => part[0]).join(''), 'glb-player-card__initials'));
      if (badge) portrait.append(badge);
    };
    const source = photoPath(player);
    if (source) {
      const img = document.createElement('img');
      img.src = source;
      img.alt = `${player.name} portrait`;
      img.loading = 'lazy';
      img.onerror = initials;
      portrait.append(img);
    } else initials();
    portrait.append(text('span', player.position, 'glb-player-card__position'));
    const identity = text('div', '', 'glb-player-card__identity');
    identity.append(text('span', player.teamName, 'glb-player-card__club'),
      text('strong', player.name, 'glb-player-card__name'));
    const stats = text('div', '', 'glb-player-card__stats');
    const pitcher = ['SP', 'RP', 'CL'].includes(player.position);
    const metrics = pitcher
      ? [['IP', record?.pitching.IP], ['K', record?.pitching.K], [player.position === 'SP' ? 'W' : 'SV', player.position === 'SP' ? record?.pitching.W : record?.pitching.SV]]
      : [['AVG', record?.batting.AVG], ['HR', record?.batting.HR], ['RBI', record?.batting.RBI]];
    for (const [label, value] of metrics) {
      const item = text('div', '', 'glb-player-card__stat');
      item.append(text('strong', value ?? '—'), text('span', label));
      stats.append(item);
    }
    card.append(top, portrait, identity, stats,
      text('div', 'Recorded career totals', 'glb-player-card__footer'));
    return card;
  }

  window.GLBPlayerCards = { loadSeasons, careerFor, createCard, photoPath };
})();
