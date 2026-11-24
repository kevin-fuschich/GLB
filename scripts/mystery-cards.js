(() => {
  const hub = document.getElementById('mysteries');
  const team = document.body.dataset.mysteryTeam;
  const labels = {player:'player',donk:'DONK entry',donk_driver:'DONK driver',mascot:'mascot',sponsor:'sponsor',tradition:'fan tradition',giveaway:'giveaway'};
  const sections = {donk:'donk',donk_driver:'donk',mascot:'mascot',sponsor:'stadium',tradition:'traditions',giveaway:'giveaway'};
  const make = (tag, text, cls) => {
    const node = document.createElement(tag);
    node.textContent = text;
    if (cls) node.className = cls;
    return node;
  };
  function card(slot) {
    const item = make('article','','mystery-card');
    const revealed = slot.state === 'revealed';
    const label = labels[slot.type];
    const mark = make('span',revealed ? slot.creation_name.slice(0,1) : '?','mystery-mark');
    if (!revealed) {
      const glyph = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      glyph.setAttribute('viewBox', '0 0 24 32');
      glyph.setAttribute('width', '30');
      glyph.setAttribute('height', '40');
      const ink = document.createElementNS(glyph.namespaceURI, 'path');
      ink.setAttribute('fill', 'currentColor');
      ink.setAttribute('d', 'M2 5 6 1h12l4 4v9l-7 6v3H9v-6l7-6V7H8v4H2z M9 26h6v6H9z');
      glyph.append(ink);
      mark.replaceChildren(glyph);
    }
    mark.setAttribute('aria-hidden','true');
    item.append(mark,make('small','FIELDSTOCK · Round '+slot.round_no),make('h3',revealed ? slot.creation_name : slot.type==='donk_driver' ? 'Who’s driving for '+slot.team_name.replace(/ (Frost|Assembly)$/, '')+'?' : 'Create a '+label));
    item.append(make('p',revealed ? 'Created by '+slot.creator : slot.prompt));
    if (['pending','upcoming'].includes(slot.state)) {
      item.append(make('strong',slot.state==='pending' ? 'In Board review' : 'Opens in round '+slot.round_no));
    } else {
      const link = make('a',revealed ? 'View record' : slot.type==='donk_driver' ? 'Create the driver and car' : 'Create a '+label);
      link.href = revealed ? GLBRecords.href(slot.id) : 'contribute.html?artifact_id='+encodeURIComponent(slot.id)+'#contribute';
      item.append(link);
    }
    return item;
  }
  const roster = document.querySelector('section#cards,section#players,section#roster,details#roster');
  async function load() {
    const rows = await GLBRecords.read('rpc/glb_mysteries',{});
    if (hub) {
      const select = hub.querySelector('select');
      const grid = hub.querySelector('.mystery-grid');
      for (const [slug,name] of new Map(rows.map(s=>[s.team_slug,s.team_name]))) select.add(new Option(name,slug));
      function render() {
        grid.replaceChildren(...rows.filter(s=>s.team_slug===select.value).map(card));
      }
      select.addEventListener('change',render);
      render();
      return;
    }
    for (const slot of rows.filter(s=>s.team_slug===team)) {
      const section = slot.type==='player' ? roster : document.getElementById(sections[slot.type]);
      if (!section) continue;
      if (slot.type==='donk_driver') {
        const jump=document.querySelector('.tol-actions a[href="#donk"]');
        if (jump) jump.textContent=['newcomers','open'].includes(slot.state) ? 'Create a DONK driver' : 'DONK driver';
      }
      let grid = section.querySelector('.mystery-grid');
      if (!grid) {
        grid = make('div','','mystery-grid');
        (section.querySelector('.glb-fold-body') || section).append(grid);
      }
      const preview = grid.querySelector('[data-slot-id="'+CSS.escape(slot.id)+'"]');
      if (preview) preview.replaceWith(card(slot));
      else grid.append(card(slot));
    }
  }
  load().catch(()=>{
    const host = hub || roster;
    if(host) host.append(make('p','Open cards could not load. Refresh to try again.'));
  });
})();
