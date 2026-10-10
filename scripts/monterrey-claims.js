// Requests create a review item only. Ownership is read from the published registry.
(async()=>{
  const host=document.getElementById('mtyClaims');
  if(!host)return;
  const fetchJSON=async path=>{const response=await fetch(path,{cache:'no-store'});if(!response.ok)throw Error(path);return response.json();};
  try{
    const [artifacts,approved]=await Promise.all([fetchJSON('data/cards/monterrey-cementeros.json'),fetchJSON('data/cards/approved-claims.json')]);
    if(approved.schema!=='glb.approved-card-claims.v1')throw Error('Unexpected claim registry');
    host.replaceChildren();
    for(const artifact of artifacts.cards){
      const id=artifact.card_id.replace(/-CURRENT$/,'');
      const entry=document.createElement('article');entry.className='mty-claim';
      const title=document.createElement('h3');title.textContent=artifact.name;
      const serial=document.createElement('small');serial.textContent=id+' · '+(artifact.type==='mascot'?'Mascot artifact':'Player card');
      const status=document.createElement('p');status.className='mty-claim-status';status.setAttribute('role','status');
      entry.append(title,serial,status);
      const links=[...document.querySelectorAll('[data-claim-link]')].filter(link=>link.dataset.claimLink===id);
      const updateLinks=text=>{for(const link of links)link.textContent=text;};
      const owner=approved.claims?.[id]?.user_id;
      if(owner){updateLinks('Claimed by '+owner);status.textContent='Claimed by '+owner;host.append(entry);continue;}
      if(!artifact.claimable){status.textContent='Opening Soon';host.append(entry);continue;}
      const button=document.createElement('button');button.type='button';button.textContent='Request claim';
      const form=document.createElement('form');form.hidden=true;form.action='https://formspree.io/f/mzezpeap';form.method='POST';
      form.innerHTML='<label>USER ID<input name="user_id" required minlength="3" maxlength="24" pattern="[A-Za-z0-9_-]{3,24}" title="3–24 letters, numbers, underscores, or hyphens"></label><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Proposed contribution<textarea name="proposed_card_bio" required maxlength="180"></textarea></label><small>A request is not acceptance. Your private 16-digit code is issued only after approval.</small><button type="submit">Submit request</button>';
      for(const [name,value]of Object.entries({_subject:'Monterrey artifact claim + contribution',submission_type:artifact.type==='mascot'?'mascot_artifact':'player_card',artifact_type:artifact.type,card_id:id,artifact_id:id,player_name:artifact.type==='player'?artifact.name:'',artifact_name:artifact.name,team_slug:'monterrey-cementeros'})){
        const input=document.createElement('input');input.type='hidden';input.name=name;input.value=value;form.append(input);
      }
      const key='glb-fieldstock-pending-'+id;
      const setPending=()=>{updateLinks('Pending Review');form.hidden=true;button.disabled=true;button.textContent='Pending Review';status.textContent='Request received. Watch your email for the review decision.';};
      try{if(localStorage.getItem(key)==='1')setPending();}catch{}
      button.addEventListener('click',()=>{form.hidden=!form.hidden;if(!form.hidden)form.elements.user_id.focus();});
      form.addEventListener('submit',async event=>{
        event.preventDefault();if(!form.reportValidity())return;
        const submit=form.querySelector('[type="submit"]');submit.disabled=true;status.textContent='Submitting request…';
        try{
          const response=await fetch(form.action,{method:'POST',body:new FormData(form),headers:{Accept:'application/json'}});
          if(!response.ok)throw Error('Submission failed');
          try{localStorage.setItem(key,'1');}catch{}
          setPending();
        }catch{submit.disabled=false;status.textContent='The request could not be submitted. Please try again.';}
      });
      entry.append(button,form);host.append(entry);
    }
  }catch{host.textContent='Artifact availability could not load. Please refresh before requesting a claim.';}
})();
