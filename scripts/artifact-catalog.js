/* Shared artifact availability for browsing and Board approval. */
((root) => {
  function collectionArtifacts(collection, source, roster = source) {
    const players = new Map((roster.players || []).map(player => [player.slug, player]));
    const rows = source.cards || source.players || [];
    return rows.flatMap(row => {
      const slug = row.player_slug || row.slug;
      const player = players.get(slug);
      const id = (row.card_id || collection.card_ids?.[slug] || '').replace(/-CURRENT$/, '');
      if (!id) return [];
      const type = row.type || 'player';
      // The canonical roster supplies current names for player records.
      const name = player?.name || row.name;
      if (!name) return [];
      const open = collection.open_ids ? collection.open_ids.includes(id)
        : row.claim_open === true || row.claimable === true;
      const href = type === 'player'
        ? 'player.html?team=' + encodeURIComponent(collection.team_slug) + '&player=' + encodeURIComponent(slug) + '#playerCardSection'
        : 'team-' + collection.team_slug + '.html#claims';
      return [{id, name, type, player_slug: slug, team_slug: collection.team_slug,
        team_name: collection.team_name, claim_open: open, href}];
    });
  }
  function creativeArtifacts(source) {
    if (source.schema !== 'glb.creative-artifacts.v1') throw Error('Unknown creative artifact registry.');
    return source.artifacts.map(row => ({...row, id:row.artifact_id,
      record_href:'team-'+row.team_slug+'.html#'+row.section,
      href:'contribute.html?team='+encodeURIComponent(row.team_slug)+'&type='+encodeURIComponent(row.type)+'&artifact='+encodeURIComponent(row.name)+'&artifact_id='+encodeURIComponent(row.artifact_id)+'#contribute'}));
  }
  if (typeof module === 'object' && module.exports) {
    module.exports = {collectionArtifacts, creativeArtifacts};
    return;
  }
  const read = async path => {
    const response = await fetch(path, {cache:'no-store'});
    if (!response.ok) throw Error('Artifact availability could not load.');
    return response.json();
  };
  let request;
  function load() {
    return request ||= Promise.all([read('data/artifacts/collections.json'), read('data/cards/approved-claims.json')])
      .then(async ([manifest, approved]) => {
        if (manifest.schema !== 'glb.artifact-collections.v1' || approved.schema !== 'glb.approved-card-claims.v1') throw Error('Unknown artifact registry.');
        const results = await Promise.allSettled(manifest.collections.map(async collection => {
          const [source, roster] = await Promise.all([read(collection.source), collection.roster ? read(collection.roster) : null]);
          return collectionArtifacts(collection, source, roster || source);
        }));
        const creative = await read(manifest.creative_source).then(creativeArtifacts);
        return {artifacts: [...creative, ...results.flatMap(result => result.status === 'fulfilled' ? result.value : [])],
          claims: approved.claims || {}, incomplete: results.some(result => result.status === 'rejected')};
      });
  }
  root.GLBArtifacts = {collectionArtifacts, creativeArtifacts, load};
})(typeof window === 'object' ? window : globalThis);
