
(() => {
 const host=document.getElementById('sponsorContent'),status=document.getElementById('sponsorStatus');
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const href=s=>'sponsors.html?'+new URLSearchParams({sponsor:s.slug});
 function claimLink(s){return 'contribute.html?'+new URLSearchParams({team:'league-wide',type:'sponsor',artifact:s.name,artifact_id:s.artifact_id})+'#contribute';}
 function ownership(root,s,claim){
   if(claim){const p=el('p',undefined,'sponsor-owner'),member=el('a',claim.user_id);member.href='profile.html?'+new URLSearchParams({user:claim.user_id});p.append(document.createTextNode('Claimed by '),member);root.append(p);}
   else {const a=el('a','Claim the entire '+s.name+' entity →','sponsor-button');a.href=claimLink(s);root.append(a);}
 }
 (async()=>{
  const [response,claims]=await Promise.all([fetch('data/sponsors.json',{cache:'no-store'}),GLBRecords.read('glb_claims',{select:'artifact_id,user_id,body',artifact_type:'eq.sponsor'})]);
  if(!response.ok)throw Error();const data=await response.json();if(data.schema!=='glb.sponsors.v1')throw Error();
  const owners=new Map(claims.map(c=>[c.artifact_id,c])),slug=new URLSearchParams(location.search).get('sponsor');
  if(!slug){
   host.append(el('p','BRANDS IN THE GLB WORLD','sponsor-kicker'),el('h1','Claim the whole idea.'),el('p','Sponsor entities have their own profiles and claims. One claim covers the brand’s GLB story across its products, campaigns and sponsorship placements.','sponsor-deck'));
   const grid=el('div',undefined,'sponsor-grid');
   for(const s of data.sponsors){const card=el('article',undefined,'sponsor-tile'),a=el('a',s.name);a.href=href(s);card.append(el('p','SPONSOR ENTITY','sponsor-kicker'),a,el('p',s.description));ownership(card,s,owners.get(s.artifact_id));grid.append(card);}host.append(grid);
  }else{
   const s=data.sponsors.find(s=>s.slug===slug);if(!s){status.textContent='That sponsor profile is unavailable.';return;}
   const claim=owners.get(s.artifact_id);document.title=s.name+' | GLB sponsor profile';
   const hero=el('section',undefined,'sponsor-hero'),copy=el('div');
   copy.append(el('p','GLB SPONSOR ENTITY','sponsor-kicker'),el('h1',s.name),el('p',s.description,'sponsor-deck'));ownership(copy,s,claim);hero.append(copy);
   if(s.image){const image=el('img');image.src=s.image;image.alt=s.name+' brand advertisement';hero.append(image);}host.append(hero);
   const scope=el('section');scope.id='sponsor-profile';scope.append(el('h2','One entity. One claim.'),el('p','This claim covers '+s.name+' as a complete sponsor entity: its brand profile, products, campaigns, advertising and sponsorship identity across GLB. Every placement points back to this same record.'));host.append(scope);
   if(s.website){const website=new URL(s.website);if(website.protocol==='https:'){const a=el('a','Visit '+s.name+' →','sponsor-button');a.href=website.href;a.rel='sponsored noopener';host.append(a);}}
   if(claim){const record=el('section'),facts=el('ul'),owner=el('li'),member=el('a',claim.user_id);member.href='profile.html?'+new URLSearchParams({user:claim.user_id});owner.append(document.createTextNode('Claimed by (User ID): '),member);facts.append(el('li','Sponsors are claimed as one complete entity across GLB.'),owner);record.append(el('h2',s.name),facts);host.append(record);}
   else host.append(el('p','Claim requests go to the GLB Board for review. Accepted claims carry your permanent User ID.','sponsor-fine'));
  }
  status.textContent='';
 })().catch(()=>{status.textContent='Sponsor profiles or claim availability could not load. Refresh to try again.';});
})();
