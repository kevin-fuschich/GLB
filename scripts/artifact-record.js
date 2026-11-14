(() => {
  const status=document.getElementById('recordStatus'),host=document.getElementById('artifactRecord');
  const id=new URLSearchParams(location.search).get('artifact_id');
  const el=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
  (async()=>{
    if(!id)throw Error('Choose an artifact from Claim & Create to view its record.');
    const [claims,notes]=await Promise.all([GLBRecords.read('glb_claims',{select:'artifact_id,artifact_name,user_id,body,club_slug,artifact_type,collaboration_open,approved_at',artifact_id:'eq.'+id}),GLBRecords.read('glb_notes',{select:'user_id,body,approved_at',artifact_id:'eq.'+id,order:'approved_at.asc'})]);
    const claim=claims[0];if(!claim)throw Error('This artifact does not have an approved claim yet.');
    status.textContent='';document.title=claim.artifact_name+' | GLB record';
    host.append(el('h1',claim.artifact_name));
    if(claim.artifact_type==='sponsor'){
      const response=await fetch('data/sponsors.json',{cache:'no-store'});
      if(response.ok){const sponsor=(await response.json()).sponsors?.find(s=>s.artifact_id===id);if(sponsor){const profile=el('a','Open the complete sponsor profile →','account-action');profile.href='sponsors.html?'+new URLSearchParams({sponsor:sponsor.slug});host.append(profile);}}
    }
    const original=el('article','');original.append(el('p','Original claim · '+claim.user_id,'record-meta'),el('div',claim.body,'record-body'));host.append(original);
    host.append(el('h2','Collaboration notes'));
    if(!notes.length)host.append(el('p','No approved notes yet.'));
    for(const note of notes){const item=el('article','');item.append(el('p','Note by '+note.user_id,'record-meta'),el('div',note.body,'record-body'));host.append(item);}
    if(claim.collaboration_open){const a=el('a','Add a note for Board review →','account-action');a.href='contribute.html?artifact_id='+encodeURIComponent(id)+'&mode=collaboration#contribute';host.append(a);}
    else host.append(el('p','The original claimant has kept collaboration closed.'));
  })().catch(error=>{status.textContent=error.message || 'The record could not load. Please refresh.';});
})();
