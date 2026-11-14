/* No local ownership or browser-generated rewards. Every mutation is a server RPC. */
(() => {
 const client=window.GLBAuth?.client,$=id=>document.getElementById(id);
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
 let editions=new Map(),sets=new Map(),copies=[],page=0,revision=0;
 const message=t=>{$('collectionStatus').textContent=t;};
 async function rpc(name,args){const r=await client.rpc(name,args);if(r.error)throw r.error;return r.data;}
 function imageFor(e){const image=el('img');const url=new URL(e.front_image,location.href);if(url.origin!==location.origin)throw Error('Unrecognized artwork source');image.src=url.href;image.alt=e.name+' · '+e.variant+' physical FIELDSTOCK card';image.loading='lazy';return image;}
 function miniature(copy){const e=editions.get(copy.edition_id);if(!e)return el('p','Card record unavailable');const wrap=el('div');wrap.append(imageFor(e),el('p',e.name+' · '+e.variant+' · '+copy.serial+'/'+e.quantity));return wrap;}
 function renderAlbum(){
  const filtered=copies.filter(c=>!$('setFilter').value||editions.get(c.edition_id)?.set_id===$('setFilter').value);
  const max=Math.max(1,Math.ceil(filtered.length/9));page=Math.min(page,max-1);$('pageLabel').textContent=`${page+1} / ${max}`;$('previous').disabled=!page;$('next').disabled=page+1>=max;
  $('albumSummary').textContent=`${filtered.length} individual copies · ${new Set(filtered.map(c=>c.edition_id)).size} editions collected`;
  $('pockets').replaceChildren();
  for(let i=0;i<9;i++){const copy=filtered[page*9+i],pocket=el('div',null,'pocket');
   if(copy){const e=editions.get(copy.edition_id);if(!e)continue;const button=el('button');button.type='button';button.setAttribute('aria-label',`Inspect ${e.name}, ${e.variant}, copy ${copy.serial} of ${e.quantity}`);button.append(imageFor(e));button.addEventListener('click',()=>detail(copy));const doubles=filtered.filter(c=>c.edition_id===copy.edition_id).length;pocket.append(button,el('div',`${copy.serial}/${e.quantity} · ${e.variant}${doubles>1?' · '+doubles+' copies':''}`,'card-caption'));
   }else{pocket.classList.add('empty-pocket');pocket.textContent='An open pocket';}$('pockets').append(pocket);
  }
 }
 function detail(copy){
  const e=editions.get(copy.edition_id),root=$('cardDetail');root.replaceChildren(el('h2',e.name),imageFor(e),el('p',`${sets.get(e.set_id)?.title||e.set_id} · ${e.variant} · Copy ${copy.serial}/${e.quantity}`));
  const facts=el('dl');for(const [key,value]of Object.entries(e.facts||{})){facts.append(el('dt',key),el('dd',String(value)));}root.append(facts);
  const flip=el('button','Read the back');flip.type='button';let back=false;flip.onclick=()=>{back=!back;facts.hidden=!back;flip.textContent=back?'Show front':'Read the back';};facts.hidden=true;root.append(flip);
  const reveal=el('button','Show private ownership code'),secret=el('p',null,'secret');reveal.type='button';reveal.onclick=async()=>{reveal.disabled=true;try{secret.textContent=await rpc('glb_card_secret',{p_copy:copy.copy_id})||'You no longer own this copy.';}catch{secret.textContent='Code could not be retrieved.';}finally{reveal.disabled=false;}};root.append(el('p','Keep this code private. A transfer replaces it.'),reveal,secret);
  const form=el('form',null,'transfer-form'),recipient=el('input'),code=el('input'),submit=el('button','Request transfer'),feedback=el('p');recipient.placeholder='Recipient’s exact User ID';recipient.setAttribute('aria-label','Recipient User ID');recipient.required=true;recipient.pattern='[a-z0-9_]{3,24}';code.placeholder='Your 16-digit ownership code';code.setAttribute('aria-label','Private ownership code');code.type='password';code.inputMode='numeric';code.pattern='[0-9]{16}';code.required=true;submit.type='submit';form.append(el('h3','Transfer this copy'),recipient,code,submit,feedback);feedback.setAttribute('role','status');form.onsubmit=async event=>{event.preventDefault();submit.disabled=true;try{const id=await rpc('glb_request_transfer',{p_copy:copy.copy_id,p_recipient:recipient.value,p_code:code.value});code.value='';secret.textContent='';feedback.textContent=id?'Transfer requested. The recipient must accept within 48 hours.':'Transfer not requested. Check the recipient, code and pending requests, or try later.';await load();}catch{code.value='';feedback.textContent='Transfer unavailable. Sign in again, then retry.';}finally{submit.disabled=false;}};root.append(form);$('cardDialog').showModal();
 }
 async function load(){const ticket=++revision;
  try{const {data:{user},error}=await client.auth.getUser();if(error && error.name!=='AuthSessionMissingError')throw error;if(ticket!==revision)return;
   $('collection').hidden=true;if(!user){copies=[];$('pockets').replaceChildren();message('Sign in to earn packs, open them and access your album.');return;}
   await rpc('glb_collecting_ready');const profile=await client.from('glb_profiles').select('user_id').eq('id',user.id).maybeSingle();if(profile.error)throw profile.error;if(!profile.data){message('Choose your public User ID on your account page to start collecting.');return;}await rpc('glb_collect_visit');
   const [setResult,editionResult,packResult,album,ledger,transfers]=await Promise.all([client.from('glb_sets').select('*'),client.from('glb_editions').select('*'),client.from('glb_packs').select('*').order('earned_at'),rpc('glb_my_album'),rpc('glb_discovery'),rpc('glb_my_transfers')]);
   if(ticket!==revision)return;for(const result of [setResult,editionResult,packResult])if(result.error)throw result.error;
   sets=new Map(setResult.data.map(s=>[s.id,s]));editions=new Map(editionResult.data.map(e=>[e.id,e]));copies=album.sort((a,b)=>a.edition_id.localeCompare(b.edition_id)||a.serial-b.serial);
   const selected=$('setFilter').value;$('setFilter').replaceChildren(new Option('All sets',''),...setResult.data.map(s=>new Option(`${s.title} · ${s.season}`,s.id)));$('setFilter').value=selected;
   $('packs').replaceChildren();for(const pack of packResult.data.filter(p=>!p.opened_at)){const tile=el('article',null,'pack'),open=el('button','Open pack');open.type='button';tile.append(el('strong','FIELDSTOCK'),el('p',sets.get(pack.set_id)?.title||pack.set_id),el('small',pack.earned_for),open);open.onclick=async()=>{open.disabled=true;try{const result=await rpc('glb_open_pack',{p_pack:pack.id});await load();$('revealedCards').replaceChildren(...result.map(miniature));$('reveal').hidden=false;message('Pack opened. Your cards are in your album.');}catch{message('This pack could not open. It remains available; refresh and try again.');open.disabled=false;}};$('packs').append(tile);}
   if(!$('packs').children.length)$('packs').append(el('p','No unopened packs. Earn them through verified claims, approved collaborations and return visits.'));
   $('discovery').replaceChildren(...ledger.map(row=>{const e=editions.get(row.edition_id),line=el('div',null,'edition-row');line.append(el('strong',(e?.name||row.edition_id)+' · '+(e?.variant||'')),el('span',`${row.discovered} discovered / ${row.quantity}`));return line;}));
   $('transfers').replaceChildren(...transfers.map(t=>{const line=el('div',null,'transfer');line.append(el('span',`${t.sender} → ${t.recipient} · ${t.status} · expires ${new Date(t.expires_at).toLocaleString()}`));if(t.status==='pending'&&new Date(t.expires_at)>new Date()){const button=el('button',t.incoming?'Accept transfer':'Cancel transfer');button.type='button';button.onclick=async()=>{button.disabled=true;try{const ok=await rpc(t.incoming?'glb_accept_transfer':'glb_cancel_transfer',{p_transfer:t.id});message(ok?'Transfer updated.':'Transfer no longer available.');await load();}catch{message('Sign in again before accepting a transfer.');button.disabled=false;}};line.append(button);}return line;}));
   renderAlbum();$('collection').hidden=false;message(sets.size?'Your collection is up to date.':'The first set is being prepared. No cards have been released yet. Your earned rewards are retained.');
  }catch{if(ticket===revision){$('collection').hidden=true;message('The collection system is not available yet. Your existing account and creative claims are unchanged.');}}
 }
 $('previous').onclick=()=>{page--;renderAlbum();};$('next').onclick=()=>{page++;renderAlbum();};$('setFilter').onchange=()=>{page=0;renderAlbum();};$('closeCard').onclick=()=>{$('cardDetail').replaceChildren();$('cardDialog').close();};
 if(!client){message('Sign-in could not load. Please refresh.');return;}
 client.auth.onAuthStateChange(()=>{copies=[];$('collection').hidden=true;$('cardDetail').replaceChildren();$('cardDialog').close();setTimeout(load,0);});load();
})();
