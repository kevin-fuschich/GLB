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
    const pendingSpokanePortraits = new Set(['jonah-sato','rene-bouchard','malachi-boone','dae-hyun-park','tesfaye-mebrahtu','hamza-qureshi','ellis-wren','miguel-angel-serrano','branislav-vukovic']);
    if (player.teamSlug === 'spokane-alloys' && pendingSpokanePortraits.has(player.slug))
      return 'assets/images/players/spokane-alloys/portrait-pending.svg';
    if (player.teamSlug === 'spokane-alloys' && player.slug === 'benoit-leduc')
      return 'assets/images/players/spokane-alloys/spokane-benoit-leduc.jpg';
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
    top.append(text('span', 'FIELDSTOCK', 'glb-player-card__mark'), text('span', '2026 Player Card', 'glb-player-card__edition'));
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
    const front=document.createElement('div'); front.className='glb-player-card__front'; front.append(top, portrait, identity, stats, text('div','Official 2026 season record','glb-player-card__footer'));
    const back=document.createElement('div'); back.className='glb-player-card__back';
    const notes={"kellan-brynden":"Keeps a notebook of every hotel ice machine he has ever trusted.","oskar-svanholm":"Can identify most Pacific Northwest birds by sound, but refuses to explain how.","mateusz-kasprowicz":"Carries a tiny level in his glove bag and checks the clubhouse tables before every start.","diego-alvarez-mora":"Makes elaborate grilled-cheese sandwiches for teammates after late arrivals.","lukas-havel":"Collects perfectly round stones and labels them by where he found them.","caleb-reidman":"Has never lost a game of Connect Four on a team flight.","sergio-ibarra-lugo":"Keeps a running list of the best vending-machine snacks in every visiting park.","yaw-mensah":"Ties one bright orange lace before every appearance, even when both laces are already tied.","nikolai-dobrynin":"Can repair a broken zipper with fishing line and a dugout sunflower-seed packet.","evan-carroll-iv":"Knows the exact weight of his favorite first-base mitt to the nearest gram.","marco-delvecchio":"Names every houseplant after a retired infielder.","tomasz-kubas":"Practices turning double plays with two paperback books when traveling.","andres-mireles":"Keeps a photo of every ballpark sunrise he has seen before batting practice.","wyatt-hollander":"Once played an entire road trip wearing mismatched socks and called it a career high point.","luis-quinones":"Makes a different playlist for every series, including one song chosen by the clubhouse cleaner.","pieter-van-wyk":"Builds miniature wooden scoreboards during the offseason."};
    const spokaneCards=['kellan-brynden','oskar-svanholm','mateusz-kasprowicz','diego-alvarez-mora','lukas-havel','caleb-reidman','sergio-ibarra-lugo','yaw-mensah','nikolai-dobrynin','evan-carroll-iv','marco-delvecchio','tomasz-kubas','andres-mireles','wyatt-hollander','luis-quinones','pieter-van-wyk','jonah-sato','rene-bouchard','malachi-boone','dae-hyun-park','tesfaye-mebrahtu','benoit-leduc','hamza-qureshi','ellis-wren','miguel-angel-serrano','branislav-vukovic'];
    const serial=player.teamSlug==='spokane-alloys'?'SPK-'+String(spokaneCards.indexOf(player.slug)+1).padStart(2,'0'):'GLB-'+player.slug.toUpperCase();
    const identityLine=[player.height,player.weight?`${player.weight} lb`:null,player.birthplace].filter(Boolean).join(' · ');
    back.append(text('div','FIELDSTOCK · '+player.teamName,'glb-player-card__backmark'),text('h3',player.name,'glb-player-card__backname'),text('p',player.position+' · '+(record?.seasons?.length||1)+' recorded season(s)','glb-player-card__backcopy'),text('p',identityLine||'Official Spokane Alloys player record','glb-player-card__backcopy'),text('p',player.field_note||notes[player.slug]||'A distinctive presence in the Spokane Alloys record.','glb-player-card__backcopy'),text('div',serial,'glb-player-card__serial'),text('div','Tap to return to front','glb-player-card__fliphint'));
    card.replaceChildren(front,back); card.addEventListener('click',e=>{if(e.target.closest('a'))return;e.preventDefault();card.classList.toggle('is-flipped')});
    return card;
  }

  window.GLBPlayerCards = { loadSeasons, careerFor, createCard, photoPath };
})();
