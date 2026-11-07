(() => {
  const host=document.getElementById('openArtifacts');
  const status=document.getElementById('artifactStatus');
  const teamFilter=document.getElementById('artifactClub');
  const typeFilter=document.getElementById('artifactKind');
  const el=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
  const labels={player:'Player card',mascot:'Mascot',entertainer:'Entertainer',donk_driver:'DONK driver',donk_vehicle:'DONK vehicle',ballpark:'Ballpark',tradition:'Fan tradition',giveaway:'Giveaway'};
  const catalogRequest=GLBArtifacts.load();
  catalogRequest.then(({artifacts,claims,incomplete})=>{
    const open=artifacts.filter(artifact=>artifact.claim_open && !claims[artifact.id]);
    const clubs=[...new Map(open.map(artifact=>[artifact.team_slug,artifact.team_name])).entries()];
    for(const [slug,name] of clubs){const option=el('option',name);option.value=slug;teamFilter.append(option);}
    function render(){
      const visible=open.filter(artifact=>(!teamFilter.value||artifact.team_slug===teamFilter.value)&&(!typeFilter.value||artifact.type===typeFilter.value));
      status.textContent=visible.length+' open artifact'+(visible.length===1?'':'s')+(incomplete?' · Some collections could not load. Refresh to check the rest.':' · Select one to start crafting your claim.');
      host.replaceChildren(...visible.map(artifact=>{
        const card=el('article');card.className='artifact-tile';
        card.append(el('small',artifact.team_name+' · '+artifact.id),el('h3',artifact.name),el('p',labels[artifact.type] || 'Creative artifact'));
        const link=el('a','Claim & craft →');link.href=artifact.href;link.setAttribute('aria-label','Claim and craft '+artifact.name);
        if(artifact.prompt)card.append(el('p',artifact.prompt));
        card.append(link);
        if(artifact.record_href){const record=el('a','View the existing record');record.href=artifact.record_href;record.className='artifact-record-link';card.append(record);}
        return card;
      }));
      if(!visible.length)host.append(el('p','No open artifacts match these filters. Try another club or artifact type.'));
    }
    teamFilter.addEventListener('change',render);typeFilter.addEventListener('change',render);render();
  }).catch(()=>{status.textContent='Open artifacts could not load. Please refresh, or visit a club’s cards to check availability.';});
  const clubs=['Albuquerque Aeros','Birmingham Vulcans','Durham Gold','Fresno Yield','Louisville Naturals','Mayagüez Sultans','Monterrey Cementeros','Osaka Spirits','San Pedro Cocolos','Santiago Caballeros','Spokane Alloys','St. Paul Frost','Taipei Neon','Tijuana Técnicos','Toledo Assembly','Vancouver Current'];
  const select=document.getElementById('club');
  for(const name of clubs){const option=el('option',name);option.value=name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');select.append(option);}
  const params=new URLSearchParams(location.search);
  for(const [key,id] of [['team','club'],['club','club'],['type','type'],['artifact','artifact']])if(params.has(key))document.getElementById(id).value=params.get(key);
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
      response.textContent='Submission received for GLB Board review. Watch your email for a decision. A claim code is issued only after acceptance.';
      if(form.elements.artifact_id.value){try{localStorage.setItem('glb-fieldstock-pending-'+form.elements.artifact_id.value,'1');}catch{}}
      button.textContent='Submitted for Board review';
    }catch{button.disabled=false;button.textContent='Submit to the GLB Board';response.textContent='Your submission could not be sent. Please try again.';}
  });
})();
