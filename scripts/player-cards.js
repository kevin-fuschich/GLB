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
    const expansionSpokanePortraits = new Set(['jonah-sato','rene-bouchard','malachi-boone','tesfaye-mebrahtu','hamza-qureshi','ellis-wren','branislav-vukovic']);
    if (player.teamSlug === 'spokane-alloys' && expansionSpokanePortraits.has(player.slug))
      return `assets/images/players/spokane-alloys/${player.slug}.jpg`;
    const pendingSpokanePortraits = new Set(['dae-hyun-park','miguel-angel-serrano']);
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
    if (player.teamSlug === 'vancouver-current') return null;
    return null;
  }
  // Display original recovered artwork without altering the source image.
  const recoveredVancouver = {'nico-penfold':47,'silas-boudreau':418,'eamon-kerr':797,'alejo-santillan':1185};
  function recoveredPortrait(player) {
    const x = player.teamSlug === 'vancouver-current' ? recoveredVancouver[player.slug] : undefined;
    if (x === undefined) return null;
    const frame = document.createElement('span');
    frame.style.cssText = 'display:block;position:relative;overflow:hidden;width:100%;aspect-ratio:300/335;';
    frame.setAttribute('role','img'); frame.setAttribute('aria-label',player.name || player.slug);
    const image=document.createElement('img');
    image.src='assets/images/players/vancouver-current/restored-fieldstock-sheet.png';
    image.alt='';
    image.style.cssText=`position:absolute!important;width:512%!important;max-width:none!important;height:auto!important;left:${-x/3}%;top:${-40/3.35}%;`;
    frame.append(image);return frame;
  }
  const tijuanaCards = {"rafael-montoya":1,"diego-verdugo":2,"esteban-arce":3,"tomas-zepeda":4,"mauricio-cota":5,"ivan-lizarraga":6,"julian-ochoa":7,"sergio-hinojosa":8,"bruno-valdes":9,"matias-camarena":10,"nicolas-paredes":11,"adrian-fierro":12,"emilio-barron":13,"gael-marrufo":14,"cristobal-saucedo":15,"hector-belmonte":16};
  const monterreyCards = {'emilio-zendejas':1,'masato-yanagisawa':2,'kofi-mensah':12,'andres-cazares':15};
  const tijuanaCardArt = {"julian-ochoa":"assets/images/cards/fieldstock/tij-07-julian-ochoa-front-v3.webp","ivan-lizarraga":"assets/images/cards/fieldstock/tij-06-ivan-lizarraga-front-v3.webp","diego-verdugo":"assets/images/cards/fieldstock/tij-02-diego-verdugo-front-v3.webp","bruno-valdes":"assets/images/cards/fieldstock/tij-09-bruno-valdes-front-v2.webp","esteban-arce": "assets/images/cards/fieldstock/tij-03-esteban-arce-front-v2.webp", "tomas-zepeda": "assets/images/cards/fieldstock/tij-04-tomas-zepeda-front-v2.webp", "sergio-hinojosa": "assets/images/cards/fieldstock/tij-08-sergio-hinojosa-front-v3.webp", "matias-camarena": "assets/images/cards/fieldstock/tij-10-matias-camarena-front-v2.webp", "nicolas-paredes": "assets/images/cards/fieldstock/tij-11-nicolas-paredes-front-v2.webp", "cristobal-saucedo": "assets/images/cards/fieldstock/tij-15-cristobal-saucedo-front-v2.webp"};
  function cardFront(player) {
    if(player.teamSlug === 'tijuana-tecnicos' && tijuanaCards[player.slug]) return tijuanaCardArt[player.slug] || player.card_front || 'assets/images/cards/fieldstock/tij-'+String(tijuanaCards[player.slug]).padStart(2,'0')+'-'+player.slug+'-front.webp';
    return player.teamSlug === 'monterrey-cementeros' && monterreyCards[player.slug]
      ? 'assets/images/cards/fieldstock/mty-'+String(monterreyCards[player.slug]).padStart(2,'0')+'-'+player.slug+'-front.png' : null;
  }
  function text(tag, value, className) {
    const element = document.createElement(tag);
    element.textContent = String(value ?? '—');
    if (className) element.className = className;
    return element;
  }
  function createPhysicalCard(player, { link = true } = {}) {
    const card = text('article', '', 'tij-physical-card');
    const number = tijuanaCards[player.slug];
    const code = 'TIJ-' + String(number).padStart(2, '0');
    card.setAttribute('aria-label', player.name + ' ' + code + ' card');
    const heading = text('div', '', 'tij-card-identity');
    heading.append(text('strong', player.name), text('span', code + ' · ' + player.position + (player.rookie ? ' · Rookie' : '')));
    const controls = text('div', '', 'tij-card-controls');
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', 'Card side for ' + player.name);
    const frontButton = text('button', 'Front');
    const backButton = text('button', 'Back');
    frontButton.type = backButton.type = 'button';
    controls.append(frontButton, backButton);
    const image = document.createElement('img');
    image.className = 'tij-card-art';
    image.loading = 'lazy';
    const front = cardFront(player);
    const back = player.card_back || front.replace(/-front(-v\d+)?\.webp$/, '-back$1.svg');
    const status = text('p', '', 'tij-card-error');
    status.setAttribute('role', 'status');
    status.hidden = true;
    const show = reverse => {
      image.hidden = false; status.hidden = true;
      image.alt = player.name + ' ' + code + ' card ' + (reverse ? 'back: biography and 2026 statistics' : 'front');
      image.src = reverse ? back : front;
      frontButton.setAttribute('aria-pressed', String(!reverse));
      backButton.setAttribute('aria-pressed', String(reverse));
    };
    frontButton.addEventListener('click', () => show(false));
    backButton.addEventListener('click', () => show(true));
    image.addEventListener('error', () => {image.hidden = true; status.hidden = false; status.textContent = 'This card image could not load. Try the other side or refresh.';});
    card.append(heading, controls, image, status);
    show(false);
    if (link) {
      const file = text('a', 'Player file →', 'tij-card-file');
      file.href = 'player.html?team=tijuana-tecnicos&player=' + encodeURIComponent(player.slug);
      card.append(file);
    }
    return card;
  }
  function createCard(player, record, { link = true } = {}) {
    if (player.teamSlug === 'tijuana-tecnicos' && tijuanaCards[player.slug]) return createPhysicalCard(player, {link});
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
    const recovered = recoveredPortrait(player);
    const source = photoPath(player);
    if (recovered) { portrait.append(recovered); } else if (source) {
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
    back.append(text('div','FIELDSTOCK · '+player.teamName,'glb-player-card__backmark'),text('h3',player.name,'glb-player-card__backname'),text('p',player.position+' · '+(record?.seasons?.length||1)+' recorded season(s)','glb-player-card__backcopy'),text('p',identityLine||'Official '+player.teamName+' player record','glb-player-card__backcopy'),text('p',player.field_note||notes[player.slug]||'Additional player notes are opening soon.','glb-player-card__backcopy'),text('div',serial,'glb-player-card__serial'),text('div','Tap to return to front','glb-player-card__fliphint'));
    const physicalFront = cardFront(player);
    if (physicalFront && player.teamSlug === 'tijuana-tecnicos') {
      card.style.setProperty('border','0','important');
      front.style.cssText='padding:0;border:0!important;background:none;display:block;height:100%';
      const art=document.createElement('img');art.src=physicalFront;art.alt=player.name+' FIELDSTOCK card front';art.style.cssText='width:100%;height:100%;object-fit:contain';front.replaceChildren(art);
      const reverse=document.createElement('img');reverse.src=player.card_back||physicalFront.replace(/-front(-v\d+)?\.webp$/, '-back$1.svg');reverse.alt=player.name+' FIELDSTOCK card back';reverse.style.cssText='width:100%;height:100%;object-fit:contain';
      back.style.cssText='padding:0;border:0!important;background:none';back.replaceChildren(reverse);
      card.tabIndex=0;card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();card.classList.toggle('is-flipped')}});
    } else if (physicalFront) {
      card.style.setProperty('border','0','important');
      card.style.setProperty('background','#fffaf1','important');
      front.style.cssText='padding:0;border:0!important;background:none;display:block;height:100%';
      const art=document.createElement('img');art.src=physicalFront;art.alt=player.name+' physical FIELDSTOCK card front';art.style.cssText='display:block;width:100%;height:100%;object-fit:contain';
      front.replaceChildren(art);
      back.style.setProperty('background','#fffaf1','important');
      back.style.color='#6b294c';
      for(const child of back.children)child.style.color='#6b294c';
      back.querySelector('.glb-player-card__serial').textContent='MTY-'+String(monterreyCards[player.slug]).padStart(2,'0');
      const statLine=metrics.map(([label,value])=>(value??'—')+' '+label).join(' · ');
      back.insertBefore(text('p','Recorded totals · '+statLine,'glb-player-card__backcopy'),back.querySelector('.glb-player-card__serial'));
      const clubNotes = {
        'emilio-zendejas':'Marks every bullpen session in a pocket scorebook; a clean inning earns a small pink square.',
        'masato-yanagisawa':'Rehearses his pickoff footwork on the hotel carpet using two rolled-up socks as bases.',
        'kofi-mensah':'Keeps a tally of every double play turned with a different second baseman.',
        'andres-cazares':'Labels batting-practice bats by the outfield gap he is trying to reach that day.'
      };
      back.children[4].textContent=player.field_note||clubNotes[player.slug];
      back.firstElementChild.textContent=player.teamName;
      back.firstElementChild.style.cssText='color:#6b294c;font-size:10px;letter-spacing:1px';
      const season=record?.seasons?.find(row=>Number(row.year)===2026);
      const seasonStats=pitcher?season?.pitching:season?.batting;
      const seasonLine=(pitcher?['IP','K','ERA']:['AVG','HR','RBI'])
        .map(label=>(seasonStats?.[label]??'—')+' '+label).join(' · ');
      back.querySelector('.glb-player-card__serial').previousElementSibling.textContent='2026 · '+seasonLine;
      back.lastElementChild.textContent='FIELDSTOCK · Public preview · Tap to return';
      back.lastElementChild.style.cssText='color:#876b77;font-size:8px;letter-spacing:.4px';
      card.style.setProperty('--player-deep','#6b294c');
      card.style.setProperty('--player-accent','#e84b91');
      card.tabIndex=0;
      card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();card.classList.toggle('is-flipped')}});
    }
    card.replaceChildren(front,back); card.addEventListener('click',e=>{if(e.target.closest('a'))return;e.preventDefault();card.classList.toggle('is-flipped')});
    return card;
  }

  window.GLBPlayerCards = { loadSeasons, careerFor, createCard, photoPath, recoveredPortrait, cardFront, createPhysicalCard };
})();




