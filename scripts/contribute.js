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
  const client=window.GLBAuth?.client;
  let identity=null,accountRevision=0,selectionReady=!artifactId,selected=null;
  const noteMode=params.get('mode')==='collaboration';
  const accountStatus=document.getElementById('contributionAccount');
  const signIn=document.getElementById('contributionSignIn');
  const response=document.getElementById('contributionResponse');
  const button=form.querySelector('button[type="submit"]');
  const resumePath=location.pathname+location.search+'#contribute';
  signIn.addEventListener('click',()=>{try{sessionStorage.setItem('glb-contribution-return',resumePath);}catch{}});
  async function syncIdentity(user){
    const ticket=++accountRevision;identity=null;form.elements.user_id.value='';form.elements.email.value='';
    if(!user){accountStatus.textContent='You can browse and draft now. Sign in before submitting.';signIn.hidden=false;return;}
    accountStatus.textContent='Loading your public User ID…';
    try{
      const {data,error}=await client.from('glb_profiles').select('user_id').eq('id',user.id).maybeSingle();
      if(ticket!==accountRevision)return;
      if(error)throw error;
      if(!data){accountStatus.textContent='Choose your public User ID in your account before submitting.';signIn.textContent='Finish setting up your account →';signIn.hidden=false;return;}
      identity={id:user.id,user_id:data.user_id,email:user.email};
      form.elements.user_id.value=data.user_id;form.elements.email.value=user.email || '';
      accountStatus.textContent='Submitting as '+data.user_id+'. Your email stays private.';signIn.hidden=true;
    }catch{accountStatus.textContent='Your account could not be verified. Refresh to try again.';signIn.hidden=false;}
  }
  if(client){
    client.auth.onAuthStateChange((event,session)=>{if(['SIGNED_IN','SIGNED_OUT','USER_UPDATED'].includes(event))setTimeout(()=>syncIdentity(session?.user || null),0);});
    client.auth.getSession().then(({data,error})=>{if(error)throw error;return syncIdentity(data.session?.user || null);}).catch(()=>{accountStatus.textContent='Sign-in could not load. Refresh to try again.';});
  }else accountStatus.textContent='Sign-in could not load. Refresh to try again.';
  document.getElementById('collaborationChoice').hidden=!artifactId || noteMode;
  if(artifactId)Promise.all([catalogRequest,GLBRecords.claims()]).then(([{artifacts,claims},live])=>{
    const approved=live.find(row=>row.artifact_id===artifactId);
    const artifact=artifacts.find(row=>row.id===artifactId);
    if(noteMode){
      if(!approved?.collaboration_open)throw Error('This artifact is closed to collaboration.');
      selected={id:approved.artifact_id,name:approved.artifact_name,team_slug:approved.club_slug,type:approved.artifact_type};
    }else{
      if(!artifact?.claim_open || claims[artifactId] || approved)throw Error('This artifact is no longer open for a claim.');
      selected=artifact;
    }
    form.elements.artifact_id.value=selected.id;
    form.elements.submission_type.value=noteMode?'collaboration_note':'artifact_claim';
    const club=document.getElementById('club');
    if(![...club.options].some(option=>option.value===selected.team_slug)){const option=el('option',selected.team_name || 'DONK circuit');option.value=selected.team_slug;club.append(option);}
    club.value=selected.team_slug;document.getElementById('type').value=selected.type;
    document.getElementById('artifact').value=selected.name;
    document.getElementById('artifact').readOnly=true;document.getElementById('club').disabled=true;document.getElementById('type').disabled=true;
    document.getElementById('ideaPitchText').hidden=true;document.getElementById('pitchTips').hidden=true;
    document.getElementById('contribution-title').textContent=(noteMode?'Add a note: ':'Claim & craft: ')+selected.name;
    selection.textContent=noteMode?'The original claim stays credited to '+approved.user_id+'. Your note needs its own Board approval.':selected.id+' · '+(selected.prompt || 'Add something of your own.');
    if(selected.prompt)form.elements.contribution.placeholder=selected.prompt;
    selectionReady=true;
  }).catch(error=>{selection.textContent=error.message || 'Availability could not be verified. Refresh to try again.';button.disabled=true;});
  // Approved originals and their notes have a public record, separate from private receipts.
  GLBRecords.claims().then(rows=>{
    const open=rows.filter(row=>row.collaboration_open);if(!open.length)return;
    const section=el('section');section.id='collaborate';section.append(el('h2','Open for collaboration'),el('p','Add a separate note to an approved claim. The original stays credited to its creator.'));
    for(const row of open){const p=el('p'),a=el('a',row.artifact_name+' · original by '+row.user_id+' →');a.href=GLBRecords.href(row.artifact_id);p.append(a);section.append(p);}
    document.getElementById('open-artifacts').after(section);
  }).catch(()=>{});
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!identity){response.textContent='Sign in and choose your public User ID before submitting. Your draft stays on this device.';signIn.hidden=false;signIn.focus();return;}
    if(!selectionReady){response.textContent='Artifact availability could not be verified. Please refresh.';return;}
    if(!form.reportValidity())return;
    const submitter={...identity};
    button.disabled=true;button.textContent='Submitting…';response.textContent='';
    try{
      const {data:sessionData,error:sessionError}=await client.auth.getSession();
      if(sessionError || sessionData.session?.user.id!==submitter.id)throw Error('Your sign-in has changed. Refresh before submitting.');
      const {data,error}=await client.rpc('glb_submit',{
        p_kind:noteMode?'note':selected?'claim':'pitch',p_artifact_id:selected?.id || '',
        p_artifact_name:selected?.name || form.elements.artifact.value.trim(),
        p_club_slug:selected?.team_slug || form.elements.club.value,
        p_artifact_type:selected?.type || form.elements.artifact_type.value,
        p_body:form.elements.contribution.value.trim(),p_supporting_link:form.elements.supporting_link.value.trim(),
        p_collaboration:!!selected && !noteMode && form.elements.collaboration.checked
      });
      if(error)throw error;
      if(!data)throw Error('No submission receipt was returned.');
      form.dispatchEvent(new Event('glb:contribution-sent'));
      response.replaceChildren(el('span','Saved for GLB Board review. '));
      const accountLink=el('a','Track it in My submissions →');accountLink.href='account.html';response.append(accountLink);
      button.textContent='Submitted for Board review';
      // Notification is best-effort; the database receipt above is authoritative.
      const notification=new FormData(form);notification.set('user_id',submitter.user_id);notification.set('email',submitter.email || '');notification.set('club',selected?.team_slug || form.elements.club.value);notification.set('artifact_type',selected?.type || form.elements.artifact_type.value);notification.set('artifact',selected?.name || form.elements.artifact.value);notification.set('glb_submission_id',data);
      fetch(form.action,{method:'POST',body:notification,headers:{Accept:'application/json'}}).catch(()=>{});
    }catch(error){
      button.disabled=false;button.textContent='Submit to the GLB Board';
      const message=String(error.message || '');
      response.textContent=error.code==='23505'?'You already have a pending claim for this artifact. Check My submissions.':/already claimed|closed to collaboration|Please wait|Daily contribution limit|sign-in has changed/.test(message)?message:'Your submission could not be saved. Your draft is still here. Please try again.';
    }
  });
})();
