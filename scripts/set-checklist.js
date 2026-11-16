(async () => {
  const byId = id => document.getElementById(id);
  const club = byId('club'), subject = byId('player'), edition = byId('edition');
  const query = new URLSearchParams(location.search);
  const read = async path => {
    const response = await fetch(path);
    if (!response.ok) throw Error('Could not load ' + path);
    return response.json();
  };
  try {
    const [plan, stats, proofs] = await Promise.all([
      read('data/cards/production-2026.json'), read('data/season/player-stats.json'), read('data/pack-preview.json')
    ]);
    const rosters = new Map();
    let discovery, ledgerFailed = false, revision = 0;
    const subset = byId('subset');
    let archiveCards = [];
    function updateDiscovery() {
      if (subset.value !== 'Baseball') return;
      const id = subject.value + '-' + edition.value.toLowerCase();
      const row = discovery?.find(item => item.edition_id === id);
      byId('discovery').textContent = row ? row.discovered + ' discovered / ' + row.quantity :
        ledgerFailed ? 'Discovery counts unavailable.' : discovery ? 'Planned edition · awaiting release' : 'Checking discoveries…';
    }
    async function draw() {
      const ticket = ++revision;
      if (subset.value !== 'Baseball') {
        const entry = archiveCards.find(item => item.id === subject.value);
        if (!entry) return;
        const url = new URL(location.href);
        url.searchParams.set('card', entry.id);
        url.searchParams.delete('edition');
        history.replaceState(null, '', url);
        byId('print').replaceChildren(FieldstockSubsets.card(entry));
        byId('name').textContent = entry.name;
        byId('number').textContent = entry.id;
        byId('clubLine').textContent = entry.subset;
        byId('fieldNote').textContent = '';
        byId('discovery').textContent = 'Awaiting release';
        byId('status').textContent = 'FIELDSTOCK 2026';
        byId('profileLink').href = entry.archiveLink;
        byId('profileLink').textContent = 'Visit the DONK archive →';
        return;
      }
      byId('profileLink').textContent = 'Read or contribute to the player record →';
      const card = plan.players.find(item => item.id === subject.value);
      const variant = plan.edition_plan.find(item => item.name === edition.value);
      const slug = card.subject_key.split('/').pop();
      const url = new URL(location.href);
      url.searchParams.set('card',card.id);
      url.searchParams.set('edition',variant.name);
      history.replaceState(null,'',url);
      byId('print').replaceChildren();
      byId('status').textContent = 'Loading card…';
      byId('name').textContent = card.subject_name;
      byId('number').textContent = card.id + ' · ' + variant.name;
      byId('clubLine').textContent = card.team_name + ' · ' + card.facts.position;
      byId('fieldNote').textContent = '';
      byId('profileLink').href = 'player.html?' + new URLSearchParams({team:card.team_slug,player:slug});
      byId('replayLink').href = 'fantasy.html?' + new URLSearchParams({player:card.team_slug + '/' + slug});
      updateDiscovery();
      try {
        if (!rosters.has(card.team_slug)) rosters.set(card.team_slug,read('data/rosters/' + card.team_slug + '.json'));
        const roster = await rosters.get(card.team_slug);
        if (ticket !== revision) return;
        const person = roster.players.find(row => row.slug === slug);
        const line = stats.find(row => row.team_slug === card.team_slug && row.player === slug);
        const proof = proofs.find(row => row.subject_id === card.subject_key && row.variant === variant.name);
        const print = proof || {name:card.subject_name,variant:variant.name,quantity:variant.quantity,facts:{
          player:{...person,...card.facts,name:card.subject_name,slug,teamSlug:card.team_slug,teamName:card.team_name,
            card_id:card.id,photo_source:card.source_image,photo_crop:card.photo_crop},
          record:{seasons:line ? [{...line,year:2026}] : []}
        }};
        byId('print').append(GLBPackReveal.card(print,{serial:proof?.serial || 1}));
        byId('fieldNote').textContent = person?.field_note || person?.factoid || '';
        byId('status').textContent = proof ? 'Photographic proof · sample copy' : 'Design preview · illustrative copy number';
      } catch {
        rosters.delete(card.team_slug);
        if (ticket === revision) byId('status').textContent = 'Card artwork data could not load. Select the player again or refresh to retry.';
      }
    }
    function populatePlayers(preferred) {
      const cards = plan.players.filter(card => card.team_slug === club.value);
      subject.replaceChildren(...cards.map(card => new Option(card.subject_name,card.id)));
      if (cards.some(card => card.id === preferred)) subject.value = preferred;
      draw();
    }
    const clubs = new Map(plan.players.map(card => [card.team_slug,card.team_name]));
    club.replaceChildren(...Array.from(clubs,([id,name]) => new Option(name,id)));
    edition.replaceChildren(...plan.edition_plan.map(v => new Option(v.name + ' /' + v.quantity,v.name)));
    const first = plan.players.find(card => card.id === query.get('card')) || plan.players[0];
    club.value = first.team_slug;
    if (plan.edition_plan.some(v => v.name === query.get('edition'))) edition.value = query.get('edition');
    club.onchange = () => populatePlayers();
    subject.onchange = edition.onchange = draw;
    byId('catalog').hidden = false;
    async function chooseSubset(preferred) {
      const baseball = subset.value === 'Baseball';
      club.parentElement.hidden = edition.parentElement.hidden = !baseball;
      byId('replayLink').hidden = !baseball;
      byId('subjectLabel').textContent = baseball ? 'Player' : 'Card';
      if (baseball) { populatePlayers(preferred); return; }
      const ticket = ++revision;
      byId('print').replaceChildren();
      subject.replaceChildren();
      byId('status').textContent = 'Loading subset…';
      try {
        archiveCards = await FieldstockSubsets.catalog();
        if (ticket !== revision) return;
        const rows = archiveCards.filter(item => item.subset === subset.value);
        subject.replaceChildren(...rows.map(item => new Option(item.id + " · " + item.name, item.id)));
        if (rows.some(item => item.id === preferred)) subject.value = preferred;
        draw();
      } catch {
        if (ticket === revision) byId('status').textContent = 'The subset could not load. Refresh to retry.';
      }
    }
    subset.onchange = () => chooseSubset();
    if (/^DB-/.test(query.get('card'))) subset.value = 'DONK Drivers';
    if (/^D26-/.test(query.get('card'))) subset.value = 'Road to Tijuana';
    chooseSubset(query.get('card') || first.id);
    try {
      const result = await window.GLBAuth.client.rpc('glb_discovery');
      if (result.error || !Array.isArray(result.data)) throw Error();
      discovery = result.data;
    } catch { ledgerFailed = true; }
    updateDiscovery();
  } catch { byId('status').textContent = 'The set checklist could not load. Refresh to try again.'; }
})();
