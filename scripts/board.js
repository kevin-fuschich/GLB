(() => {
  const client=window.GLBAuth?.client,status=document.getElementById('boardStatus'),host=document.getElementById('boardQueue');
  const el=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
  let revision=0;
  async function load(){
    const ticket=++revision;host.replaceChildren();status.textContent='Checking Board access…';
    if(!client){status.textContent='Account access could not load. Refresh to try again.';return;}
    try{
      const {data:session,error:sessionError}=await client.auth.getSession();if(sessionError)throw sessionError;
      if(ticket!==revision)return;
      if(!session.session){status.textContent='Sign in to your Board account to review submissions.';return;}
      const {data:board,error:roleError}=await client.rpc('glb_is_board');
      if(ticket!==revision)return;
      if(roleError){status.textContent='Board setup is required. The project owner must run the Board SQL setup in Supabase.';const a=el('a','Open Board setup →');a.href='board-setup.html';host.append(a);return;}
      if(!board){status.textContent='This account does not have GLB Board access.';return;}
      const {data,error}=await client.from('glb_submissions').select('id,user_id,kind,artifact_id,artifact_name,club_slug,artifact_type,body,supporting_link,collaboration_requested,created_at').eq('status','pending').order('created_at',{ascending:true});
      if(ticket!==revision)return;if(error)throw error;
      status.textContent=data.length?data.length+' pending submission'+(data.length===1?'':'s')+'. Read each submission before deciding.':'No submissions waiting for review.';
      for(const row of data){
        const item=el('article',''),feedback=el('p','');feedback.setAttribute('role','status');
        item.append(el('p',row.kind+' · '+row.user_id+' · '+new Date(row.created_at).toLocaleString(),'record-meta'),el('h2',row.artifact_name),el('p',(row.artifact_id || 'New idea')+' · '+row.club_slug+' · '+row.artifact_type,'record-meta'),el('div',row.body,'record-body'));
        if(row.supporting_link){try{const url=new URL(row.supporting_link);if(['http:','https:'].includes(url.protocol)){const link=el('a','Open supporting material ↗');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';item.append(link);}}catch{}}
        if(row.kind==='claim')item.append(el('p',row.collaboration_requested?'Creator requests open collaboration.':'Creator requests closed collaboration.'));
        if(row.kind==='pitch')item.append(el('p','Accepting an idea records Board approval. Creating its new artifact remains an editorial step.'));
        const actions=el('div','','review-actions'),accept=el('button','Accept'),decline=el('button','Decline');actions.append(accept,decline);item.append(actions,feedback);host.append(item);
        for(const [button,decision] of [[accept,true],[decline,false]])button.addEventListener('click',async()=>{
          accept.disabled=decline.disabled=true;feedback.textContent='Saving decision…';
          try{const {error}=await client.rpc('glb_review_submission',{p_id:row.id,p_accept:decision});if(error)throw error;await load();}
          catch(error){accept.disabled=decline.disabled=false;feedback.textContent=error.code==='23505'?'Another claim for this artifact was already accepted. Decline this submission or review the existing record.':/Collaboration is closed|not pending|Board access required/.test(error.message || '')?error.message:'The decision could not be saved. Refresh to check the current status before trying again.';}
        });
      }
    }catch{if(ticket===revision)status.textContent='The review queue could not load. Refresh to try again.';}
  }
  client?.auth.onAuthStateChange((event)=>{if(['SIGNED_IN','SIGNED_OUT'].includes(event))setTimeout(load,0);});load();
})();
