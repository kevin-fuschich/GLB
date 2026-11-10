(() => {
  const host=document.getElementById('openArtifacts');
  const status=document.getElementById('artifactStatus');
  const teamFilter=document.getElementById('artifactClub');
  const typeFilter=document.getElementById('artifactKind');
  const el=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
  const labels={broadcaster:'Play-by-play broadcaster',announcer:'In-game announcer',brand:'Brand & business',player:'Player card',mascot:'Mascot',entertainer:'Entertainer',donk_driver:'DONK driver',donk_vehicle:'DONK vehicle',ballpark:'Ballpark',tradition:'Fan tradition',giveaway:'Giveaway'};
  const catalogRequest=GLBArtifacts.load();
  Promise.all([catalogRequest,fetch('data/artifacts/artwork.json').then(r=>r.ok?r.json():{}).catch(()=>({}))]).then(([{artifacts,claims,incomplete},artwork])=>{
    const open=artifacts.filter(artifact=>artifact.claim_open && !claims[artifact.id]);
    const clubs=[...new Map(open.map(artifact=>[artifact.team_slug,artifact.team_name])).entries()];
    for(const [slug,name] of clubs){const option=el('option',name);option.value=slug;teamFilter.append(option);}
    const featured=['TRI-HONEY-BOOKER','TPE-01','OSA-POTARI','TRI-FAIRMONT','MAY-SPIN-CYCLE','SPD-MASCOT','TPE-BENNY','LOU-LANDING','OSA-OKEO'];
    const ordered=[...open].sort((a,b)=>{
      const rank=a=>featured.includes(a.id)?featured.indexOf(a.id):100+(artwork[a.id]?0:1);
      return rank(a)-rank(b);
    });
    let limit=9;
    const more=el('button','Explore more artifacts');more.type='button';more.className='artifact-more';host.after(more);
    more.addEventListener('click',()=>{limit+=9;render();});
    function render(){
      const matches=ordered.filter(artifact=>(!teamFilter.value||artifact.team_slug===teamFilter.value)&&(!typeFilter.value||artifact.type===typeFilter.value));
      const visible=matches.slice(0,limit);
      more.hidden=visible.length>=matches.length;
      status.textContent='Showing '+visible.length+' of '+matches.length+' open artifacts'+(incomplete?' · Some collections could not load. Refresh to check the rest.':' · Find something that sparks an idea.');
      host.replaceChildren(...visible.map(artifact=>{
        const card=el('article');card.className='artifact-tile';
        const art=artwork[artifact.id];
        const media=el('div');media.className='artifact-art'+(artifact.type==='player'?' artifact-art-player':'');
        if(art){const img=el('img');img.src=art.src;img.alt=art.alt;img.loading='lazy';img.width=640;img.height=400;img.addEventListener('error',()=>{img.remove();media.classList.add('artifact-art-fallback');media.textContent=labels[artifact.type]||'GLB';},{once:true});media.append(img);}
        else {media.classList.add('artifact-art-fallback');media.textContent=labels[artifact.type]||'GLB';}
        card.append(media);
        card.append(el('small',artifact.team_name+' · '+artifact.id),el('h3',artifact.name),el('p',labels[artifact.type] || 'Creative artifact'));
        const link=el('a','Claim & craft →');link.href=artifact.href;link.setAttribute('aria-label','Claim and craft '+artifact.name);
        const prompt=el('div');prompt.className='artifact-prompt';prompt.append(el('small','What could you add?'),el('p',artifact.prompt || 'A defining moment, a personal detail or a story from beyond the game. Build on the existing record.'));card.append(prompt);
        card.append(link);
        if(artifact.record_href){const record=el('a','View the existing record');record.href=artifact.record_href;record.className='artifact-record-link';card.append(record);}
        return card;
      }));
      if(!visible.length)host.append(el('p','No open artifacts match these filters. Try another club or artifact type.'));
    }
    const reset=()=>{limit=9;render();};teamFilter.addEventListener('change',reset);typeFilter.addEventListener('change',reset);render();
  }).catch(()=>{status.textContent='Open artifacts could not load. Please refresh, or visit a club’s cards to check availability.';});
  const clubs=['Albuquerque Aeros','Birmingham Vulcans','Triangle Gold','Fresno Yield','Louisville Naturals','Mayagüez Sultans','Monterrey Cementeros','Osaka Spirits','San Pedro Cocolos','Santiago Caballeros','Spokane Alloys','St. Paul Frost','Taipei Neon','Tijuana Técnicos','Toledo Assembly','Vancouver Current'];
  const select=document.getElementById('club');
  for(const name of clubs){const option=el('option',name);option.value=name==='Triangle Gold'?'durham-gold':name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');select.append(option);}
  const params=new URLSearchParams(location.search);
  for(const [key,id] of [['team','club'],['club','club'],['type','type'],['artifact','artifact']])if(params.has(key))document.getElementById(id).value=params.get(key)==='triangle-gold'?'durham-gold':params.get(key);
  const form=document.getElementById('contributionForm');
  const artifactId=params.get('artifact_id');
  const selection=document.getElementById('selectedArtifact');
  if(artifactId)catalogRequest.then(({artifacts,claims})=>{
    const artifact=artifacts.find(row=>row.id===artifactId);
    if(!artifact || !artifact.claim_open || claims[artifactId]){
      selection.textContent='This artifact is no longer open for a claim. You can still send a contribution for Board review.';
      return;
    }
    form.elements.artifact_id.value=artifact.id;form.elements.submission_type.value='artifact_claim';
    document.getElementById('club').value=artifact.team_slug;document.getElementById('type').value=artifact.type;
    document.getElementById('artifact').value=artifact.name;
    document.getElementById('contribution-title').textContent='Claim & craft: '+artifact.name;
    selection.textContent=artifact.id+' · '+artifact.prompt;
    form.elements.contribution.placeholder=artifact.prompt;
  }).catch(()=>{selection.textContent='Availability could not be verified. Refresh or submit your idea for Board review.';});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!form.reportValidity())return;
    const button=form.querySelector('button[type="submit"]'),response=document.getElementById('contributionResponse');
    button.disabled=true;button.textContent='Submitting…';response.textContent='';
    try{
      const result=await fetch(form.action,{method:'POST',body:new FormData(form),headers:{Accept:'application/json'}});
      if(!result.ok)throw Error('Submission failed');
      form.dispatchEvent(new Event('glb:contribution-sent'));
      response.textContent='Submission received for GLB Board review. Watch your email for a decision. A claim code is issued only after acceptance.';
      if(form.elements.artifact_id.value){try{localStorage.setItem('glb-fieldstock-pending-'+form.elements.artifact_id.value,'1');}catch{}}
      button.textContent='Submitted for Board review';
    }catch{button.disabled=false;button.textContent='Submit to the GLB Board';response.textContent='Your submission could not be sent. Please try again.';}
  });
})();
