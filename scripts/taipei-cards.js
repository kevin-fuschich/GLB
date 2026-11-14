/* One stable card ID and claim state across club and player pages. */
(() => {
  const create = (tag, value, className) => {
    const el = document.createElement(tag);
    if (value !== undefined) el.textContent = value;
    if (className) el.className = className;
    return el;
  };
  const read = async path => {
    const r = await fetch(path, {cache:'no-store'});
    if (!r.ok) throw Error('Card registry unavailable');
    return r.json();
  };
  let registryRequest;
  const registry = () => registryRequest ||= Promise.all([
    read('data/cards/approved-claims.json'),
    fetch('https://uyjncyvlumakuqtfuicc.supabase.co/rest/v1/glb_claims?select=artifact_id,user_id,collaboration_open',{headers:{apikey:'sb_publishable_VjJqbpi9zo2143JF1qq91A_0mAfJuUy'},cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Availability unavailable');return r.json();})
  ]).then(([value,live]) => {
    if(value.schema!=='glb.approved-card-claims.v1')throw Error('Unknown registry schema');
    return {...(value.claims || {}),...Object.fromEntries(live.map(row=>[row.artifact_id,row]))};
  });
  const pending = {
    get(id) { try {return localStorage.getItem('glb-fieldstock-pending-'+id)==='1';} catch {return false;} },
    set(id) { try {localStorage.setItem('glb-fieldstock-pending-'+id,'1');} catch {} },
    clear(id) { try {localStorage.removeItem('glb-fieldstock-pending-'+id);} catch {} }
  };
  async function createClaimPanel(player, { teamSlug = 'taipei-neon', teamName = 'Taipei Neon' } = {}) {
    const panel = create('div',undefined,'tpe-claim-panel');
    const state = create('p',undefined,'tpe-claim-state');
    state.setAttribute('role','status');state.setAttribute('aria-live','polite');
    panel.append(state);
    let claims;
    try {claims = await registry();} catch {
      state.textContent='Claims temporarily unavailable. Please refresh to check the registry.';
      return panel;
    }
    const id=player.card_id;
    const owner=claims[id]?.user_id;
    if(owner) {
      pending.clear(id);state.textContent='Claimed by '+owner;
      const link=create('a','View the claim and collaboration notes →');link.href='artifact.html?artifact_id='+encodeURIComponent(id);panel.append(link);return panel;
    }
    if(!player.claim_open){state.textContent='Claims opening soon';return panel;}
    state.textContent='Unclaimed · Open for your contribution';
    const link=create('a','Claim & craft this player →');
    link.href='contribute.html?'+new URLSearchParams({artifact_id:id,team:teamSlug,type:'player',artifact:player.name})+'#contribute';
    panel.append(link,create('p','Sign in to submit with your public User ID. Track Board review and approved claims in your account.','tpe-claim-note'));
    return panel;
  }
  let releaseRequest;
  const release = () => releaseRequest ||= read('data/cards/taipei-neon-series-01.json').then(value => {
    if (value.schema !== 'glb.fieldstock-release.v1') throw Error('Unknown release schema');
    return value;
  });
  async function createCardDetails(player) {
    const details = create('details', undefined, 'tpe-card-details');
    details.append(create('summary', 'Card details & 2026 line'));
    try {
      const collection = await release();
      const card = collection.cards.find(card => card.card_id === player.card_id && card.player_slug === player.slug);
      if (!card) throw Error('Card record unavailable');
      const bio = card.biography;
      const facts = create('dl', undefined, 'tpe-card-facts');
      for (const [label, value] of [
        ['Born', bio.dob], ['Birthplace', bio.birthplace], ['Height', bio.height],
        ['Weight', bio.weight + ' lb'], ['Bats / throws', bio.bats + ' / ' + bio.throws],
        ['Card', card.card_id]
      ]) facts.append(create('dt', label), create('dd', value));
      details.append(facts);
      const pitcher = ['SP', 'RP', 'CL'].includes(player.position);
      const group = card.stats[pitcher ? 'pitching' : 'batting'];
      const keys = pitcher ? ['G','IP','W','L','SV','K','ERA','WHIP'] : ['G','AB','H','HR','RBI','SB','AVG','OPS'];
      const stats = create('dl', undefined, 'tpe-card-stats');
      stats.setAttribute('aria-label', collection.season + ' season statistics');
      for (const key of keys) {
        const item = create('div');
        item.append(create('dt', key), create('dd', group[key] ?? '—'));
        stats.append(item);
      }
      details.append(create('h4', collection.season + ' season'), stats, create('p', card.factoid, 'tpe-card-factoid'));
    } catch {
      details.append(create('p', 'Card details could not load. Open the player file or refresh to try again.'));
    }
    return details;
  }
  function renderRoster(roster) {
    const body = document.getElementById('taipeiRosterRows');
    if (!body) return;
    const rows = roster.players.map(player => {
      const row = create('tr'), name = create('td');
      const file = create('a', player.name);
      file.href = 'player.html?team=taipei-neon&player=' + encodeURIComponent(player.slug);
      name.append(file);
      row.append(name, create('td', player.position), create('td', player.bats + '/' + player.throws),
        create('td', String(player.age)), create('td', player.birthplace));
      const cell = create('td'), link = create('a', player.card_id);
      link.href = '#card-' + player.card_id.toLowerCase();
      link.setAttribute('aria-label', 'View ' + player.name + ' card ' + player.card_id);
      cell.append(link); row.append(cell);
      return row;
    });
    body.replaceChildren(...rows);
  }
  window.TaipeiFieldstock={createClaimPanel,createCardDetails};
  async function initialize() {
    const host=document.getElementById('taipeiCards');
    if(!host)return;
    try {
      const roster=await read('data/rosters/taipei-neon.json');
      renderRoster(roster);
      const cards=await Promise.all(roster.players.map(async player => {
        const article=create('article',undefined,'tpe-card-entry');
        article.dataset.cardId=player.card_id;
        article.id='card-'+player.card_id.toLowerCase();
        article.append(GLBPlayerCards.createPhysicalCard({...player,teamSlug:'taipei-neon'},{link:true}));
        article.append(await createCardDetails(player));
        article.append(await createClaimPanel(player));
        return article;
      }));
      host.replaceChildren(...cards);
    } catch {
      host.replaceChildren(create('p','The card collection could not load. Please refresh.'));
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});
  else initialize();
})();
