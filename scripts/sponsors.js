
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
  data.sponsors.sort((a,b)=>a.name.localeCompare(b.name,'en',{sensitivity:'base'}));
  const owners=new Map(claims.map(c=>[c.artifact_id,c])),slug=new URLSearchParams(location.search).get('sponsor');
  if(!slug){
   host.append(el('p','GLOBAL LEAGUE BASEBALL','sponsor-kicker'),el('h1','About Our Sponsors'),el('p','Meet the brands in GLB. Explore their profiles and claim an available sponsor to help shape its story.','sponsor-deck'));
   const grid=el('div',undefined,'sponsor-grid');
   for(const s of data.sponsors){
     const card=el('article',undefined,'sponsor-tile'),a=el('a',s.name);a.href=href(s);a.className='sponsor-name';
     const mark=el('a',undefined,'sponsor-logo');mark.href=href(s);mark.setAttribute('aria-label',s.name+' sponsor profile');
     if(s.logo_crop){
       const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),title=document.createElementNS(ns,'title'),defs=document.createElementNS(ns,'defs'),clip=document.createElementNS(ns,'clipPath'),rect=document.createElementNS(ns,s.logo_shape==='circle'?'circle':'rect'),group=document.createElementNS(ns,'g'),image=document.createElementNS(ns,'image');
       svg.setAttribute('viewBox',s.logo_crop.join(' '));svg.setAttribute('role','img');svg.setAttribute('aria-label',s.name+' logo');title.textContent=s.name+' logo';clip.id='brand-clip-'+s.slug;
       if(s.logo_shape==='circle'){rect.setAttribute('cx',String(s.logo_crop[0]+s.logo_crop[2]/2));rect.setAttribute('cy',String(s.logo_crop[1]+s.logo_crop[3]/2));rect.setAttribute('r',String(Math.min(s.logo_crop[2],s.logo_crop[3])/2));}else for(const [i,key]of ['x','y','width','height'].entries())rect.setAttribute(key,String(s.logo_crop[i]));
       clip.append(rect);defs.append(clip);group.setAttribute('clip-path','url(#'+clip.id+')');
       image.setAttribute('href',s.logo);image.setAttribute('width',String(s.logo_source_size[0]));image.setAttribute('height',String(s.logo_source_size[1]));group.append(image);svg.append(title,defs,group);mark.append(svg);
     }else{
       const image=el('img');image.src=s.logo;image.alt=s.name+' logo';image.width=360;image.height=160;image.loading='lazy';image.decoding='async';mark.append(image);
     }
     const description=el('p',s.description,'sponsor-description');card.append(mark,el('p','SPONSOR ENTITY','sponsor-kicker'),a,description);ownership(card,s,owners.get(s.artifact_id));grid.append(card);
   }host.append(grid);
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
