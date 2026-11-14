
(() => {
 const client=window.GLBAuth?.client,$=id=>document.getElementById(id),make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 let user=null,handle='',epoch=0;
 const themes=['navy','forest','oxblood','sand'];
 const status=t=>{$('profileStatus').textContent=t;};
 const urlFor=(id,preview=false)=>'profile.html?'+new URLSearchParams({user:id,...(preview?{preview:'1'}:{})});
 const chosen=id=>[...$(id).querySelectorAll('input:checked')].map(n=>n.value);
 function safeImage(path){const u=new URL(path,location.href);if(u.origin!==location.origin)throw Error('Artwork unavailable');return u.href;}
 function avatar(root,data){if(/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(data.avatar||'')){const img=make('img');img.src=data.avatar;img.alt='';root.append(img);}else root.append(make('span',(data.display_name||data.user_id||'?').slice(0,2).toUpperCase()));}
 function renderShowcase(data){
  const root=$('showcase');root.replaceChildren();root.dataset.theme=data.theme;
  const hero=make('header',undefined,'member-hero'),picture=make('div',undefined,'member-avatar');avatar(picture,data);
  const identity=make('div');identity.append(make('p','GLB · MEMBER SHOWCASE','member-kicker'),make('h1',data.display_name||data.user_id),make('p','@'+data.user_id,'member-handle'));
  if(data.favorite_club){const club=make('a',teams.get(data.favorite_club)||data.favorite_club);club.href='team.html?team='+encodeURIComponent(data.favorite_club);identity.append(club);}
  hero.append(picture,identity);root.append(hero);
  if(data.bio)root.append(make('p',data.bio,'member-bio'));
  const cards=make('section');cards.append(make('h2','Between the covers'),make('p','Selected cards from this collection.'));
  const grid=make('div',undefined,'showcase-cards');
  for(const c of data.cards){const tile=make('article'),img=make('img');try{img.src=safeImage(c.front_image);}catch{continue;}img.alt=c.name+' · '+c.variant;img.loading='lazy';tile.append(img,make('h3',c.name),make('p',c.variant+' · '+c.serial+'/'+c.quantity));grid.append(tile);}
  cards.append(grid);if(!data.cards.length)cards.append(make('p','No cards featured yet.'));root.append(cards);
  const work=make('section');work.append(make('h2','Added to the record'));
  for(const c of data.claims){const item=make('article',undefined,'showcase-work'),a=make('a',c.artifact_name);a.href='artifact.html?artifact_id='+encodeURIComponent(c.artifact_id);item.append(make('p','ACCEPTED CLAIM','member-kicker'),a,make('p',c.body));work.append(item);}
  for(const n of data.notes){const item=make('article',undefined,'showcase-work'),a=make('a','Read the artifact →');a.href='artifact.html?artifact_id='+encodeURIComponent(n.artifact_id);item.append(make('p','ACCEPTED COLLABORATION','member-kicker'),make('p',n.body),a);work.append(item);}
  if(!data.claims.length&&!data.notes.length)work.append(make('p','No accepted work featured yet.'));root.append(work);root.hidden=false;
 }
 const teams=new Map();
 async function rpc(name,args){const r=await client.rpc(name,args);if(r.error)throw r.error;return r.data;}
 function checklist(id,items,selected,label){const root=$(id);root.replaceChildren();for(const item of items){const wrap=make('label',undefined,'feature-option'),check=make('input');check.type='checkbox';check.value=item.key;check.checked=selected.includes(item.key);wrap.append(check,make('span',item.label));root.append(wrap);}if(!items.length)root.append(make('p',label,'profile-help'));}
 async function load(){
  const ticket=++epoch;user=null;$('editor').hidden=true;$('showcase').hidden=true;$('privatePreview').hidden=true;status('Loading profile…');
  try{
   if(!client)throw Error('Sign-in unavailable');
   if(!teams.size){const r=await fetch('data/teams/teams.json');if(!r.ok)throw Error();const data=await r.json();for(const t of Object.values(data.divisions).flat())teams.set(t.slug,t.team);}
   const params=new URLSearchParams(location.search),publicUser=params.get('user');
   if(publicUser){
    if(!/^[a-z0-9_]{3,24}$/.test(publicUser)){status('This showcase is unavailable.');return;}
    const data=await rpc('glb_public_showcase',{p_user:publicUser,p_preview:params.get('preview')==='1'});
    if(ticket!==epoch)return;if(!data){status('This showcase is private or hasn’t been published.');return;}
    renderShowcase(data);status('');$('privatePreview').hidden=data.published;$('privatePreview').textContent='Private preview · Only you can view this until you publish.';
    return;
   }
   const auth=await client.auth.getUser();if(ticket!==epoch)return;
   if(!auth.data?.user){status('Sign in to personalize your profile and choose what to share.');$('signInLink').hidden=false;return;}if(auth.error)throw auth.error;
   user=auth.data.user;const own=user.id;
   const results=await Promise.all([client.from('glb_profiles').select('user_id').eq('id',own).maybeSingle(),client.from('glb_showcases').select('*').eq('owner_id',own).maybeSingle(),rpc('glb_my_album'),client.from('glb_editions').select('id,name,variant'),client.from('glb_claims').select('artifact_id,artifact_name').eq('owner_id',own),client.from('glb_notes').select('id,artifact_id,body').eq('contributor_id',own)]);
   if(ticket!==epoch)return;for(const r of [results[0],results[1],results[3],results[4],results[5]])if(r.error)throw r.error;
   const profile=results[0].data;if(!profile){status('Choose your permanent User ID on the account page first.');$('signInLink').hidden=false;return;}
   handle=profile.user_id;const s=results[1].data||{};
   $('displayName').value=s.display_name||'';$('bio').value=s.bio||'';$('theme').value=s.theme||'navy';$('editor').dataset.theme=s.theme||'navy';$('publish').checked=!!s.published;
   $('club').replaceChildren(new Option('No favorite club',''),...[...teams].sort((a,b)=>a[1].localeCompare(b[1])).map(([id,name])=>new Option(name,id)));$('club').value=s.favorite_club||'';
   $('avatarData').value=s.avatar||'';refreshAvatar();
   const editions=new Map(results[3].data.map(e=>[e.id,e]));
   checklist('featureCards',results[2].filter(c=>editions.has(c.edition_id)).map(c=>({key:c.copy_id,label:editions.get(c.edition_id).name+' · '+editions.get(c.edition_id).variant+' · Copy '+c.serial})),s.featured_copies||[],'Your collected cards will appear here after you open a pack.');
   checklist('featureClaims',results[4].data.map(c=>({key:c.artifact_id,label:c.artifact_name})),s.featured_claims||[],'Accepted claims will appear here.');
   checklist('featureNotes',results[5].data.map(n=>({key:n.id,label:n.body.slice(0,110)})),s.featured_notes||[],'Accepted collaboration notes will appear here.');
   $('memberId').textContent='@'+handle+' · Your permanent User ID';
   $('previewLink').href=urlFor(handle,true);$('publicLink').href=urlFor(handle);$('publicLink').hidden=!s.published;
   $('shareURL').value=s.published?new URL(urlFor(handle),location.href).href:'Save with “Publish my showcase” checked to activate your public link.';
   $('editor').hidden=false;$('signInLink').hidden=true;status('');
  }catch{if(ticket===epoch)status('Your profile could not load. Refresh to try again.');}
 }
 function refreshAvatar(){const root=$('avatarPreview');root.replaceChildren();avatar(root,{avatar:$('avatarData').value,display_name:$('displayName').value,user_id:handle});}
 $('avatarFile').onchange=async event=>{
  const file=event.target.files[0];if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024){status('Choose a JPG, PNG or WebP image under 8 MB.');return;}
  const owner=user?.id,ticket=epoch,objectURL=URL.createObjectURL(file);try{
   const image=new Image();image.src=objectURL;await image.decode();if(image.width*image.height>40000000)throw Error();
   const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const size=Math.min(image.width,image.height);canvas.getContext('2d').drawImage(image,(image.width-size)/2,(image.height-size)/2,size,size,0,0,256,256);
   const avatar=canvas.toDataURL('image/webp',.82);if(!avatar.startsWith('data:image/webp;base64,')||avatar.length>180000)throw Error();
   if(ticket!==epoch||owner!==user?.id)return;$('avatarData').value=avatar;refreshAvatar();status('Photo prepared. Save your profile to keep it.');
  }catch{status('That image could not be prepared. Try another photo.');}finally{URL.revokeObjectURL(objectURL);event.target.value='';}
 };
 $('removeAvatar').onclick=()=>{$('avatarData').value='';refreshAvatar();};$('displayName').oninput=refreshAvatar;
 $('theme').onchange=()=>{$('editor').dataset.theme=$('theme').value;};
 $('customizeForm').onsubmit=async event=>{
  event.preventDefault();if(!user)return;const owner=user.id,ticket=epoch;
  const cards=chosen('featureCards'),claims=chosen('featureClaims'),notes=chosen('featureNotes');
  if([cards,claims,notes].some(a=>a.length>9)){status('Choose up to nine items in each section.');return;}
  const button=$('saveProfile');button.disabled=true;status('Saving…');
  try{
   const row={owner_id:owner,display_name:$('displayName').value.trim(),bio:$('bio').value.trim(),favorite_club:$('club').value,theme:$('theme').value,avatar:$('avatarData').value,published:$('publish').checked,featured_copies:cards,featured_claims:claims,featured_notes:notes};
   if(!themes.includes(row.theme))throw Error();const result=await client.from('glb_showcases').upsert(row,{onConflict:'owner_id'});if(result.error)throw result.error;
   if(ticket!==epoch||user?.id!==owner)return;
   $('publicLink').hidden=!row.published;$('shareURL').value=row.published?new URL(urlFor(handle),location.href).href:'Your showcase is private.';$('editor').dataset.theme=row.theme;
   status(row.published?'Saved. Your selected showcase is public.':'Saved privately. Preview your showcase whenever you like.');
  }catch{if(ticket===epoch)status('Your changes could not be saved. Try again.');}finally{button.disabled=false;}
 };
 if(client)client.auth.onAuthStateChange((event)=>{if(['SIGNED_IN','SIGNED_OUT'].includes(event)){epoch++;user=null;$('editor').hidden=true;$('showcase').hidden=true;setTimeout(load,0);}});
 load();
})();
