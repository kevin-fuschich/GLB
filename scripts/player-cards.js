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

  const taipeiCards = {"kaito-ueda":1,"adebayo-olumide":2,"han-wei-tseng":3,"martin-echevarria":4,"dariusz-wierzbik":5,"owen-rasmusson":6,"eric-lawson":7,"jose-ramirez-tpe":8,"david-morales-tpe":9,"hiroto-kuzumi":10,"joaquin-iturriaga":11,"eitan-ben-sasson":12,"tsai-ming-hao":13,"idris-el-amin":14,"miguel-santos-tpe":15};
  function photoPath(player) {
    if (player.teamSlug === 'taipei-neon' && ['kaito-ueda','adebayo-olumide'].includes(player.slug)) return `assets/teams/taipei-neon/images/players/${player.slug}.webp`;
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
  function recoveredPortrait(player, {photoOnly=false}={}) {
    const x = player.teamSlug === 'vancouver-current' ? recoveredVancouver[player.slug] : undefined;
    if (x === undefined) return null;
    if (photoOnly) {
      // Exclude the old printed wordmark and nameplate from the shared card face.
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.classList.add('fs-photo-image');
      svg.setAttribute('viewBox',`${x} 84 300 283`);
      svg.setAttribute('preserveAspectRatio','xMidYMid slice');
      svg.setAttribute('role','img');svg.setAttribute('aria-label',player.name || player.slug);
      const image=document.createElementNS(svg.namespaceURI,'image');
      image.setAttribute('href','assets/images/players/vancouver-current/restored-fieldstock-sheet.png');
      image.setAttribute('width','1536');image.setAttribute('height','1024');
      svg.append(image);return svg;
    }
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
  const tijuanaCardArt = {"rafael-montoya": "assets/images/cards/fieldstock/tij-01-rafael-montoya-front-photo.webp", "diego-verdugo": "assets/images/cards/fieldstock/tij-02-diego-verdugo-front-photo.webp", "esteban-arce": "assets/images/cards/fieldstock/tij-03-esteban-arce-front-photo.webp", "tomas-zepeda": "assets/images/cards/fieldstock/tij-04-tomas-zepeda-front-photo.webp", "mauricio-cota": "assets/images/cards/fieldstock/tij-05-mauricio-cota-front-photo.webp", "ivan-lizarraga": "assets/images/cards/fieldstock/tij-06-ivan-lizarraga-front-photo.webp", "julian-ochoa": "assets/images/cards/fieldstock/tij-07-julian-ochoa-front-photo.webp", "sergio-hinojosa": "assets/images/cards/fieldstock/tij-08-sergio-hinojosa-front-photo.webp", "bruno-valdes": "assets/images/cards/fieldstock/tij-09-bruno-valdes-front-photo.webp", "matias-camarena": "assets/images/cards/fieldstock/tij-10-matias-camarena-front-photo.webp", "nicolas-paredes": "assets/images/cards/fieldstock/tij-11-nicolas-paredes-front-photo.webp", "adrian-fierro": "assets/images/cards/fieldstock/tij-12-adrian-fierro-front-photo.webp", "emilio-barron": "assets/images/cards/fieldstock/tij-13-emilio-barron-front-photo.webp", "gael-marrufo": "assets/images/cards/fieldstock/tij-14-gael-marrufo-front-photo.webp", "cristobal-saucedo": "assets/images/cards/fieldstock/tij-15-cristobal-saucedo-front-photo.webp", "hector-belmonte": "assets/images/cards/fieldstock/tij-16-hector-belmonte-front-photo.webp"};
  function cardFront(player) {
    if (player.teamSlug === 'spokane-alloys' && player.card_id) return `assets/images/cards/fieldstock/${player.card_id.toLowerCase()}-${player.slug}-front.webp`;
    if (player.teamSlug === 'osaka-spirits') return player.card_front || null;
    if (player.teamSlug === 'taipei-neon' && taipeiCards[player.slug]) return player.card_front || 'assets/images/cards/fieldstock/tpe-'+String(taipeiCards[player.slug]).padStart(2,'0')+'-'+player.slug+'-front.webp';
    if(player.teamSlug === 'tijuana-tecnicos' && tijuanaCards[player.slug]) return player.card_front || tijuanaCardArt[player.slug] || 'assets/images/cards/fieldstock/tij-'+String(tijuanaCards[player.slug]).padStart(2,'0')+'-'+player.slug+'-front.webp';
    return player.teamSlug === 'monterrey-cementeros' && monterreyCards[player.slug]
      ? player.card_front || 'assets/images/cards/fieldstock/mty-'+String(monterreyCards[player.slug]).padStart(2,'0')+'-'+player.slug+'-front-photo.webp' : null;
  }
  function text(tag, value, className) {
    const element = document.createElement(tag);
    element.textContent = String(value ?? '—');
    if (className) element.className = className;
    return element;
  }
  const brandRoot = new URL('../assets/fieldstock/', document.currentScript.src).href;
  const teamAccents = {
    'louisville-naturals':'#bca36a', 'santiago-caballeros':'#b67d60', 'mayaguez-sultans':'#e88975', 'san-pedro-cocolos':'#ad873e', 'durham-gold':'#d9ad65', 'spokane-alloys':'#8bbfc0', 'vancouver-current':'#65b1bf',
    'taipei-neon':'#a594d9', 'osaka-spirits':'#9175b3',
    'monterrey-cementeros':'#df81a1', 'tijuana-tecnicos':'#a5b95e'
  };
  const prefixes = {'spokane-alloys':'SPK','vancouver-current':'VAN','taipei-neon':'TPE',
    'osaka-spirits':'OSA','tijuana-tecnicos':'TIJ','monterrey-cementeros':'MTY','durham-gold':'TRI','albuquerque-aeros':'ABQ',
    'fresno-yield':'FRE','st-paul-frost':'STP','birmingham-vulcans':'BIR','toledo-assembly':'TOL',
    'louisville-naturals':'LOU','san-pedro-cocolos':'SPD','santiago-caballeros':'SAN','mayaguez-sultans':'MAY'};
  const rosterRequests = new Map();
  let seasonRequest;
  let designRequest;
  async function readRoster(slug) {
    if (!rosterRequests.has(slug)) rosterRequests.set(slug, fetch(`data/rosters/${slug}.json`)
      .then(response => { if (!response.ok) throw Error('Roster unavailable'); return response.json(); }));
    return rosterRequests.get(slug);
  }
  function brand() {
    const lockup = text('span', '', 'fs-brand');
    for (const [file, className] of [['symbol.svg','fs-symbol'],['wordmark.svg','fs-wordmark']]) {
      const image = document.createElement('img');
      image.src = brandRoot + file; image.alt = ''; image.className = className;
      lockup.append(image);
    }
    lockup.setAttribute('aria-label', 'FIELDSTOCK');
    return lockup;
  }
  // Crop only the photograph out of older printed artwork at display time.
  // Source files and their original card designs remain archival assets.
  function photograph(player) {
    const recovered = recoveredPortrait(player, {photoOnly:true});
    if (recovered) return recovered;
    const art = cardFront(player);
    const portrait = photoPath(player);
    const source = player.photo_source || (portrait?.endsWith('portrait-pending.svg') ? art : portrait || art);
    if (!source) return text('span', player.name.split(/\s+/).map(part => part[0]).slice(0,2).join(''), 'fs-initials');
    const image = document.createElement('img');
    image.src = source; image.loading = 'lazy'; image.alt = player.card_front_alt || player.name;
    image.className = 'fs-photo-image';
    image.addEventListener('error', () => image.replaceWith(text('span', 'Photo pending', 'fs-initials')), {once:true});
    if (source !== art && !player.photo_crop) return image;
    const crops = {'spokane-alloys':[.15,.21,.70,.51], 'osaka-spirits':[.044,.083,.912,.728], 'taipei-neon':[.05,.10,.90,.68],
      'tijuana-tecnicos':[.14,.17,.75,.62], 'monterrey-cementeros':[.135,.135,.73,.64]};
    const crop = player.photo_crop || crops[player.teamSlug];
    if (!crop) return image;
    // This sizing image stays detached; lazy loading would never intersect the viewport.
    image.loading = 'eager';
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.classList.add('fs-photo-image'); svg.setAttribute('preserveAspectRatio',['san-pedro-cocolos','mayaguez-sultans','santiago-caballeros','louisville-naturals'].includes(player.teamSlug)?'xMidYMin slice':'xMidYMid slice');
    svg.setAttribute('role','img'); svg.setAttribute('aria-label', image.alt);
    const photo = document.createElementNS(svg.namespaceURI,'image');
    photo.setAttribute('href',source);
    image.addEventListener('load', () => {
      const w=image.naturalWidth, h=image.naturalHeight;
      svg.setAttribute('viewBox',`${crop[0]*w} ${crop[1]*h} ${crop[2]*w} ${crop[3]*h}`);
      photo.setAttribute('width',w);photo.setAttribute('height',h);
      svg.append(photo);
    }, {once:true});
    image.addEventListener('error', () => svg.replaceWith(text('span','Photo pending','fs-initials')), {once:true});
    return svg;
  }
  function seasonTable(player, record) {
    const pitcher = ['P','SP','RP','CL'].includes(player.position);
    const keys = pitcher ? ['G','IP','W','L','SV','K','ERA'] : ['G','AB','H','HR','RBI','AVG','OPS'];
    const table = document.createElement('table');table.className='fs-stats';
    const caption=text('caption','2026 Season');table.append(caption);
    const head=document.createElement('thead'), headings=document.createElement('tr');
    for (const label of ['CLUB',...keys]) {const th=text('th',label);th.scope='col';headings.append(th);}
    head.append(headings);table.append(head);
    const body=document.createElement('tbody'), row=document.createElement('tr');
    const season=record?.seasons?.find(row => Number(row.year)===2026);
    const stats=season?.[pitcher?'pitching':'batting'];
    row.append(text('td',prefixes[player.teamSlug] || player.teamSlug.slice(0,3).toUpperCase()));
    for (const key of keys) {
      let value=stats?.[key];
      if (key==='IP' && value===undefined && stats?.OUTS!==undefined) value=`${Math.floor(stats.OUTS/3)}.${stats.OUTS%3}`;
      row.append(text('td',value));
    }
    body.append(row);table.append(body);return table;
  }
  function reverse(player, record, code) {
    const back=text('div','','fs-face fs-back');
    const header=text('div','','fs-back-header');header.append(brand(),text('span',code));
    back.append(header,text('strong',player.name,'fs-back-name'),
      text('div',`${player.teamName} / ${player.position}`,'fs-back-club'));
    const facts=text('dl','','fs-facts');
    for (const [label,value] of [['BORN',player.dob],['BIRTHPLACE',player.birthplace],
      ['HT',player.height],['WT',player.weight ? `${player.weight} lb` : null],['BATS',player.bats],['THROWS',player.throws]]) {
      const item=text('div','');item.append(text('dt',label),text('dd',value));facts.append(item);
    }
    back.append(facts,seasonTable(player,record));
    const report=text('section','','fs-report');
    report.append(text('h4','PLAYER RECORD'),text('p',player.scouting_report || player.bio ||
      `${player.position} · ${player.teamName}. Bats ${player.bats || '—'}, throws ${player.throws || '—'}.`));
    const note=text('section','','fs-record');
    note.append(text('h4','FROM THE RECORD'),text('p',player.factoid || player.field_note || 'Additional player details await contribution.'));
    const footer=text('div','','fs-back-footer');footer.append(text('span','GLB'),text('span','◆'),text('span','FIELDSTOCK 2026'));
    back.append(report,note,footer);return back;
  }
  function createCard(player, record, {link=true}={}) {
    const card=text('article','','fs-card');
    const button=document.createElement('button');button.type='button';button.className='fs-flipper';
    const inner=text('span','','fs-inner');
    let flipped=false;
    const update=()=>{
      button.classList.toggle('is-flipped',flipped);button.setAttribute('aria-pressed',String(flipped));
      button.setAttribute('aria-label',`${player.name} FIELDSTOCK card. ${flipped?'Back':'Front'} shown. Activate to flip.`);
      inner.children[0]?.setAttribute('aria-hidden',String(flipped));
      inner.children[1]?.setAttribute('aria-hidden',String(!flipped));
    };
    const paint=(data,stats)=>{
      const name=data.teamName || data.teamSlug.split('-').map(word=>word[0].toUpperCase()+word.slice(1)).join(' ');
      data={...data,teamName:name};
      const code=data.card_id || `${prefixes[data.teamSlug] || data.teamSlug.slice(0,3).toUpperCase()} · ${data.position}`;
      card.style.setProperty('--fs-accent',teamAccents[data.teamSlug] || '#dfb65d');
      const front=text('span','','fs-face fs-front');
      const photo=text('span','','fs-photo');photo.append(photograph(data));
      const mark=brand();mark.classList.add('fs-front-brand');
      const plate=text('span','','fs-nameplate');
      plate.append(text('strong',data.name,'fs-name'),text('span',`${name} • ${data.position}`,'fs-club'),text('span','2026','fs-year'));
      front.append(photo,mark,plate);inner.replaceChildren(front,reverse(data,stats,code));update();
    };
    button.addEventListener('click',()=>{flipped=!flipped;update();});
    button.append(inner);card.append(button,text('p','Select card to flip','fs-flip-note'));
    if(link){const file=text('a','Player file →','fs-file');file.href=`player.html?team=${encodeURIComponent(player.teamSlug)}&player=${encodeURIComponent(player.slug)}`;card.append(file);}
    paint(player,record);
    // Read canonical roster details and one shared season request for all cards on the page.
    const roster=readRoster(player.teamSlug).catch(()=>null);
    seasonRequest ||= loadSeasons().catch(()=>null);
    designRequest ||= fetch('data/cards/fieldstock-2026.json')
      .then(response=>{if(!response.ok)throw Error('Design records unavailable');return response.json();}).catch(()=>null);
    Promise.all([roster,seasonRequest,designRequest]).then(([roster,seasons,design])=>{
      const index=roster?.players.findIndex(row=>row.slug===player.slug) ?? -1;
      const canonical=index>=0 ? roster.players[index] : {};
      const data={...design?.players?.[player.teamSlug+'/'+player.slug],...player,...canonical,teamName:roster?.team || player.teamName};
      const numbered = player.teamSlug==='spokane-alloys' ||
        (player.teamSlug==='vancouver-current' && index<8) ||
        (player.teamSlug==='tijuana-tecnicos' && tijuanaCards[player.slug]) ||
        (player.teamSlug==='monterrey-cementeros' && monterreyCards[player.slug]);
      data.card_id ||= numbered && index>=0
        ? `${prefixes[player.teamSlug]}-${String(index+1).padStart(2,'0')}`
        : player.teamSlug.slice(0,3).toUpperCase()+'-'+player.slug.toUpperCase();
      paint(data,seasons ? careerFor(player.slug,seasons) : record);
    });
    return card;
  }
  function createPhysicalCard(player,options) { return createCard(player,null,options); }
  window.GLBPlayerCards = {loadSeasons,careerFor,createCard,photoPath,recoveredPortrait,cardFront,createPhysicalCard,photograph};
})();
