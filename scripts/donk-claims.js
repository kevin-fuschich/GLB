/* Driver cards use the shared approved-record and Board-review workflow. */
(() => {
  const hosts=[...document.querySelectorAll('[data-driver-id]')];
  const make=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
  const claimHref=id=>'../contribute.html?artifact_id='+encodeURIComponent(id)+'#contribute';
  async function load(){
    try{
      const response=await fetch('../data/artifacts/creative-artifacts.json',{cache:'no-store'});
      if(!response.ok)throw Error('Registry unavailable');
      const registry=await response.json();
      const [claims,notes]=await Promise.all([GLBRecords.claims(),GLBRecords.read('glb_notes',{select:'artifact_id,user_id,body,approved_at',order:'approved_at.asc'})]);
      for(const host of hosts){
        const id=host.dataset.driverId,status=host.querySelector('.claim-status'),action=host.querySelector('.driver-action'),record=host.querySelector('.driver-record');
        const artifact=registry.artifacts.find(r=>r.artifact_id===id),claim=claims.find(r=>r.artifact_id===id);
        if(claim){
          status.textContent='Claimed by '+claim.user_id+(claim.collaboration_open?' · Open to collaboration':' · Collaboration closed');
          const original=make('details',''),summary=make('summary','Read the approved record');original.append(summary,make('p',claim.body));
          const additions=notes.filter(n=>n.artifact_id===id);
          for(const note of additions)original.append(make('h4','Collaboration note · '+note.user_id),make('p',note.body));
          record.append(original);
          action.textContent=claim.collaboration_open?'Add a collaboration note →':'View driver record →';
          action.href=claim.collaboration_open?'../contribute.html?artifact_id='+encodeURIComponent(id)+'&mode=collaboration#contribute':'../artifact.html?artifact_id='+encodeURIComponent(id);
        }else if(artifact?.claim_open){
          status.textContent='Open for a claim · Board review required';action.textContent='Claim & craft '+artifact.name+' →';action.href=claimHref(id);
        }else{status.textContent='This driver is not open for a claim.';action.textContent='Explore Claim & Create →';action.href='../contribute.html';}
      }
    }catch{
      for(const host of hosts){host.querySelector('.claim-status').textContent='Availability could not load. Check it on Claim & Create.';}
    }
  }
  load();
})();
