(() => {
  const host = document.getElementById('osakaCards');
  const teamSlug = 'osaka-spirits';
  const teamName = 'Osaka Spirits';
  const create = (tag, value) => {
    const element = document.createElement(tag);
    if (value) element.textContent = value;
    return element;
  };

  async function initialize() {
    try {
      const response = await fetch('data/rosters/osaka-spirits.json', {cache:'no-store'});
      if (!response.ok) throw new Error('Osaka roster unavailable');
      const { players } = await response.json();
      const cards = await Promise.all(players.filter(player => player.card_id).map(async player => {
        const entry = create('div');
        entry.className = 'tpe-card-entry';
        entry.id = 'card-' + player.card_id.toLowerCase();
        entry.append(GLBPlayerCards.createPhysicalCard({...player, teamSlug}));
        entry.append(await TaipeiFieldstock.createClaimPanel(player, {teamSlug, teamName}));
        return entry;
      }));
      if (!cards.length) throw new Error('Osaka collection unavailable');
      host.replaceChildren(...cards);
      if (location.hash.startsWith('#card-')) document.getElementById(location.hash.slice(1))?.scrollIntoView();
    } catch {
      host.replaceChildren(create('p', 'The card collection could not load. Please refresh.'));
    }
  }

  if (host) initialize();
})();
