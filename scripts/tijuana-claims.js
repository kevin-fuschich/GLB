/* All claims use the shared account-bound submission form. */
(async()=>{
  const host=document.getElementById('mtyClaims');if(!host)return;
  const read=async path=>{const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw Error();return r.json();};
  try{
    const [collection,claims]=await Promise.all([read('data/cards/tijuana-tecnicos.json'),
      fetch('https://uyjncyvlumakuqtfuicc.supabase.co/rest/v1/glb_claims?select=artifact_id,user_id',{headers:{apikey:'sb_publishable_VjJqbpi9zo2143JF1qq91A_0mAfJuUy'},cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();})]);
    host.replaceChildren();
    for(const artifact of collection.cards){
      const id=artifact.card_id.replace(/-CURRENT$/,''),claim=claims.find(c=>c.artifact_id===id);
      const entry=document.createElement('article');entry.className='mty-claim';
      const title=document.createElement('h3');title.textContent=artifact.name;
      const serial=document.createElement('small');serial.textContent=id;
      const status=document.createElement('p');status.textContent=claim?'Claimed by '+claim.user_id:artifact.claimable?'Unclaimed · Open for your contribution':'Opening soon';
      entry.append(title,serial,status);
      if(claim || artifact.claimable){const link=document.createElement('a');link.textContent=claim?'View public record →':'Claim & craft →';link.href=claim?'artifact.html?artifact_id='+encodeURIComponent(id):'contribute.html?'+new URLSearchParams({artifact_id:id,team:'tijuana-tecnicos',type:artifact.type || 'player',artifact:artifact.name})+'#contribute';entry.append(link);
        for(const other of document.querySelectorAll('[data-claim-link]'))if(other.dataset.claimLink===id){other.href=link.href;other.textContent=link.textContent;}
      }
      host.append(entry);
    }
  }catch{host.textContent='Artifact availability could not load. Refresh before requesting a claim.';}
})();
