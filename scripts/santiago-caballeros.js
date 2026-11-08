(() => {
  const slug = 'santiago-caballeros';
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
    document.getElementById('record-date').textContent = `2026 season · As of ${standings.as_of}`;
  }).catch(error => console.warn(error));
  Promise.all([get('data/season/games.json'), get('data/teams/teams.json')]).then(([games, registry]) => {
    const names = new Map(Object.values(registry.divisions).flat().map(team => [team.slug, team.team]));
    const rows = games.filter(game => (game.home === slug || game.away === slug) && game.status === 'final')
      .sort((a, b) => a.date.localeCompare(b.date)).slice(-3).reverse();
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
  const host=document.getElementById('santiagoCards');
  try{
    const response=await fetch('data/rosters/santiago-caballeros.json',{cache:'no-store'});
    if(!response.ok)throw Error('Roster unavailable');
    const roster=await response.json();
    let seasons=[];
    try{seasons=await GLBPlayerCards.loadSeasons();}catch(error){console.warn(error);}
    const featured=['aron-videla','damian-velasquez','noam-finkel','dalton-reyes'];
    const players=featured.map(slug=>roster.players.find(player=>player.slug===slug)).filter(Boolean)
      .concat(roster.players.filter(player=>!featured.includes(player.slug)));
    const cards=await Promise.all(players.map(async player=>{
      const entry=document.createElement('article');entry.className='tpe-card-entry';
      entry.id='card-'+player.card_id.toLowerCase();entry.dataset.cardId=player.card_id;
      entry.append(GLBPlayerCards.createCard({...player,teamSlug:'santiago-caballeros',teamName:roster.team},GLBPlayerCards.careerFor(player.slug,seasons)));
      entry.append(await TaipeiFieldstock.createClaimPanel(player,{teamSlug:'santiago-caballeros',teamName:roster.team}));
      return entry;
    }));
    host.replaceChildren(...cards);
    const control=document.getElementById('viewAllCards');
    let expanded=false;
    const showCards=(all)=>{
      expanded=all;
      cards.forEach((entry,index)=>{entry.hidden=!all&&index>=4;});
      control.setAttribute('aria-expanded',String(all));
      control.textContent=all?'Show fewer cards':`View all ${cards.length} cards`;
      document.getElementById('cardCount').textContent=all?`${cards.length} of ${cards.length} players`:`4 of ${cards.length} players`;
    };
    showCards(false);control.hidden=false;
    control.addEventListener('click',()=>{
      const activeIndex=cards.indexOf(document.activeElement?.closest('.tpe-card-entry'));
      showCards(!expanded);
      if(!expanded&&activeIndex>=4)control.focus();
      if(!expanded)document.getElementById('cards').scrollIntoView({block:'start'});
    });
    const revealCard=()=>{
      if(!location.hash.startsWith('#card-'))return;
      const target=document.getElementById(location.hash.slice(1));
      if(target&&host.contains(target)){
        if(target.hidden)showCards(true);
        requestAnimationFrame(()=>target.scrollIntoView({block:'start'}));
      }
    };
    window.addEventListener('hashchange',revealCard);revealCard();
  }catch(error){host.textContent='The card collection could not load. Please refresh.';console.warn(error);}
})();

// Keep artifact links useful when their full records are folded away.
(() => {
  const revealRecord=()=>{
    let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}
    const target=document.getElementById(id);if(!target)return;
    let node=target;
    while(node){if(node.tagName==='DETAILS')node.open=true;node=node.parentElement;}
    if(!id.startsWith('card-'))requestAnimationFrame(()=>target.scrollIntoView({block:'start'}));
  };
  window.addEventListener('hashchange',revealRecord);revealRecord();
})();
