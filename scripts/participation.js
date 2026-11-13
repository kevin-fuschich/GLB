/* Keep the invitation to build GLB visible across league pages. */
(() => {
  const style = document.createElement('link');
  style.rel = 'stylesheet'; style.href = 'participation.css?v=20261107-claim-create';
  document.head.append(style);
  const header = document.querySelector('body > header');
  const navs = header ? [...header.querySelectorAll('nav')].filter(nav => !nav.classList.contains('jump-nav')) : [];
  for (const nav of navs) {
    const existing = nav.querySelector('a[href="contribute.html"]');
    const link = existing || document.createElement('a');
    link.href = 'contribute.html'; link.textContent = 'Claim & Create'; link.classList.add('glb-create-link');
    if (!existing) nav.append(link);
  }
  if (header && !navs.length) {
    const nav = document.createElement('nav'); nav.setAttribute('aria-label','Contribute to GLB');
    const link = document.createElement('a'); link.href='contribute.html'; link.textContent='Claim & Create';
    link.className='glb-create-link'; nav.append(link); header.append(nav);
  }
  const footer = document.querySelector('body > footer');
  if (footer && !footer.querySelector('a[href="how-it-works.html"]')) {
    const p=document.createElement('p');
    const a=document.createElement('a');a.href='how-it-works.html';a.textContent='Help build the universe! Here’s how GLB claim works →';
    p.append(a);footer.append(p);
  }

  if (footer && !footer.querySelector('a[href="contribute.html"]')) {
    const invitation = document.createElement('div'); invitation.className='glb-footer-create';
    invitation.append('Help build this world. ');
    const link=document.createElement('a');link.href='contribute.html';link.textContent='Claim an artifact. Make it your own.';
    invitation.append(link);footer.prepend(invitation);
  }
})();

/* Put claims beside the people, places and objects they belong to. */
(async () => {
  const match=location.pathname.match(/(?:team|club)-([a-z0-9-]+)\.html$/);
  if(!match)return;
  try {
    const read=async path=>{const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw Error(path);return r.json();};
    const [creative,approved,live]=await Promise.all([read('data/artifacts/creative-artifacts.json'),read('data/cards/approved-claims.json'),
      fetch('https://uyjncyvlumakuqtfuicc.supabase.co/rest/v1/glb_claims?select=artifact_id,user_id',{headers:{apikey:'sb_publishable_VjJqbpi9zo2143JF1qq91A_0mAfJuUy'},cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();})]);
    approved.claims={...(approved.claims || {}),...Object.fromEntries(live.map(row=>[row.artifact_id,row]))};
    if(creative.schema!=='glb.creative-artifacts.v1'||approved.schema!=='glb.approved-card-claims.v1')return;
    for(const artifact of creative.artifacts.filter(row=>row.team_slug===(document.body.dataset.team||match[1])&&row.claim_open)) {
      const section=document.getElementById(artifact.section);if(!section)continue;
      const owner=approved.claims?.[artifact.artifact_id]?.user_id;
      const p=document.createElement('p');p.className='glb-artifact-invitation';
      if(owner){const link=document.createElement('a');link.href='artifact.html?artifact_id='+encodeURIComponent(artifact.artifact_id);link.textContent=artifact.name+' · Claimed by '+owner+' · View record →';p.append(link);}
      else {
        const link=document.createElement('a');
        link.href='contribute.html?team='+encodeURIComponent(artifact.team_slug)+'&type='+encodeURIComponent(artifact.type)+'&artifact='+encodeURIComponent(artifact.name)+'&artifact_id='+encodeURIComponent(artifact.artifact_id)+'#contribute';
        link.textContent='Claim & craft '+artifact.name+' →';p.append(link);
      }
      const body=section.querySelector('.card-body')||section;
      if(section.classList.contains('glb-voice-claim')) section.replaceChildren(p);
      else body.append(p);
    }
  } catch { /* Keep the existing club record and contribution links available. */ }
})();
