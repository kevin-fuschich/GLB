/* Board-only editorial catalog. No release or minting actions are offered here. */
(() => {
 const client=window.GLBAuth?.client,$=id=>document.getElementById(id),el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined&&text!==null)n.textContent=text;if(cls)n.className=cls;return n;};
 let cards=[],variants=[],sets=[],page=0,generation=0,authorized=false;
 const status=t=>{$('checklistStatus').textContent=t;};
 async function rpc(name,args){const r=await client.rpc(name,args);if(r.error)throw r.error;return r.data;}
 async function all(query){let rows=[];for(let offset=0;;offset+=500){const r=await query().range(offset,offset+499);if(r.error)throw r.error;rows.push(...r.data);if(r.data.length<500)return rows;}}
 const options=(items,first)=>[new Option(first,''),...items.map(([value,label])=>new Option(label,value))];
 const cardVariants=c=>variants.filter(v=>v.card_id===c.id);
 const ready=c=>c.content_status==='approved'&&cardVariants(c).length>0&&cardVariants(c).every(v=>v.print_quantity&&v.artwork_status==='approved'&&v.front_image&&v.back_image);
 function missing(c,key){const vs=cardVariants(c);if(key==='bio')return !c.bio.trim();if(key==='statistics')return c.subject_type==='player'&&!Object.keys(c.statistics).length;if(key==='front')return !vs.length||vs.some(v=>!v.front_image);if(key==='back')return !vs.length||vs.some(v=>!v.back_image);if(key==='quantity')return !vs.length||vs.some(v=>!v.print_quantity);if(key==='ready')return ready(c);return true;}
 function draw(){
  const q=$('search').value.toLocaleLowerCase().trim(),filtered=cards.filter(c=>(!q||`${c.id} ${c.card_number} ${c.subject_name} ${c.team_name||''}`.toLocaleLowerCase().includes(q))&&(!$('team').value||c.team_slug===$('team').value)&&(!$('type').value||c.subject_type===$('type').value)&&($('scope').value?c.inclusion===$('scope').value:c.inclusion!=='excluded')&&missing(c,$('work').value));
  const metrics=[['Catalog subjects',cards.length],['Planned',cards.filter(c=>c.inclusion==='planned').length],['Candidate subjects',cards.filter(c=>c.inclusion==='candidate').length],['Missing bios',cards.filter(c=>!c.bio.trim()).length],['Approved & quantified',cards.filter(ready).length],['Copies planned',variants.reduce((sum,v)=>sum+(cards.find(c=>c.id===v.card_id)?.inclusion==='planned'?(v.print_quantity||0):0),0)]];
  $('summary').replaceChildren(...metrics.map(([label,n])=>{const box=el('div');box.append(el('strong',n.toLocaleString()),el('span',label));return box;}));
  const max=Math.max(1,Math.ceil(filtered.length/40));page=Math.min(page,max-1);$('pageLabel').textContent=`${filtered.length} matches · Page ${page+1} of ${max}`;$('prev').disabled=page===0;$('next').disabled=page+1>=max;
  $('rows').replaceChildren(...filtered.slice(page*40,page*40+40).map(c=>{
   const row=el('tr'),number=el('td',c.id),subject=el('td'),club=el('td'),content=el('td'),art=el('td'),print=el('td'),scope=el('td'),action=el('td'),vs=cardVariants(c);subject.append(el('strong',c.subject_name));club.append(el('span',c.team_name||'League-wide'),el('small',c.subject_type.replaceAll('_',' ')));
   content.append(el('span',c.content_status.replaceAll('_',' '),'badge'),el('small',c.bio?'Bio available':'Bio missing',c.bio?'good':'missing'));if(c.subject_type==='player')content.append(el('small',Object.keys(c.statistics).length?'2026 stats available':'Stats missing',Object.keys(c.statistics).length?'good':'missing'));
   art.append(el('span',`${vs.filter(v=>v.front_image).length}/${vs.length} fronts`),el('small',`${vs.filter(v=>v.back_image).length}/${vs.length} backs`));print.append(el('span',`${vs.length} variant${vs.length===1?'':'s'}`),el('small',vs.map(v=>v.variant+': '+(v.print_quantity===null?'undecided':v.print_quantity)).join(' · ')));
   scope.append(el('span',c.inclusion,'badge'));const button=el('button','Review');button.type='button';button.setAttribute('aria-label','Review '+c.subject_name);button.onclick=()=>openEditor(c.id);action.append(button);row.append(number,subject,club,content,art,print,scope,action);return row;
  }));
 }
 function label(text,input){const l=el('label',text);l.append(input);return l;}
 function select(values,value){const n=el('select');n.append(...values.map(v=>new Option(v.replaceAll('_',' '),v)));n.value=value;return n;}
 function pathImage(path,alt){const img=el('img');if(path&&!path.includes('..')&&/^[A-Za-z0-9][A-Za-z0-9_./-]*$/.test(path)){img.src=path;img.alt=alt;img.loading='lazy';return img;}return el('p','No mapped source photograph.','fine');}
 function profileSource(card){
  if(!card.source_image)return el('p','No mapped source photograph.','fine');
  const frame=el('div',null,'catalog-source-photo');
  if(window.GLBPlayerCards){frame.append(GLBPlayerCards.photograph({name:card.subject_name,teamSlug:card.team_slug,slug:card.source_details.player_slug,photo_source:card.source_image,photo_crop:card.source_details.photo_crop}));}
  else frame.append(pathImage(card.source_image,card.subject_name));return frame;
 }
 function openEditor(id,notice=''){
  const card=cards.find(c=>c.id===id);if(!card)return;const root=$('editorContent');root.replaceChildren(el('p',card.id+' · '+card.subject_type,'eyebrow'),el('h2',card.subject_name));if(notice)root.append(el('p',notice,'note'));
  const grid=el('div',null,'editor-grid'),source=el('div'),form=el('form');source.append(profileSource(card),el('p','Working source image; it is not approved card artwork.','fine'));
  const facts=el('details'),summary=el('summary','Facts, statistics and provenance');facts.append(summary,el('pre',JSON.stringify({facts:card.facts,statistics:card.statistics,source:card.source_details,claim_artifact_id:card.claim_artifact_id},null,2)));source.append(facts);
  const bio=el('textarea');bio.value=card.bio;bio.maxLength=12000;const inclusion=select(['planned','candidate','excluded'],card.inclusion),approval=select(['missing','needs_review','approved'],card.content_status),notes=el('textarea');notes.value=card.notes;notes.maxLength=5000;
  const save=el('button','Save draft record'),feedback=el('p',null,'feedback');save.type='submit';feedback.setAttribute('role','status');form.append(label('Biography / card copy',bio),label('Set scope',inclusion),label('Content review',approval),label('Editorial notes',notes),save,feedback);
  form.onsubmit=async event=>{event.preventDefault();save.disabled=true;try{await rpc('glb_update_checklist_card',{p_id:card.id,p_revision:card.revision,p_bio:bio.value,p_inclusion:inclusion.value,p_content_status:approval.value,p_notes:notes.value});await refresh();if(authorized)openEditor(id,'Draft saved. No released card or player record was changed.');}catch(error){feedback.textContent=error.message||'Save failed. Reload before retrying.';save.disabled=false;}};
  grid.append(source,form);root.append(grid);
  const section=el('section',null,'variants');section.append(el('h3','Card variants & print plan'),el('p','Each variant needs its own artwork review and fixed print quantity. A blank quantity is undecided. No copies are created here.','fine'));
  for(const v of cardVariants(card))section.append(variantForm(card,v));
  const add=el('details'),addSummary=el('summary','Add a parallel');add.append(addSummary,variantForm(card,null));section.append(add);root.append(section);
  const frozen=sets.find(s=>s.id===card.set_id)?.release_at;if(frozen){root.append(el('p','This set is frozen.','note'));root.querySelectorAll('input,textarea,select,button').forEach(n=>n.disabled=true);}
  if(!$('editor').open)$('editor').showModal();
 }
 function variantForm(card,variant){
  const form=el('form',null,'variant-form'),name=el('input'),quantity=el('input'),front=el('input'),back=el('input'),notes=el('input');name.value=variant?.variant||'';name.required=true;name.maxLength=60;name.disabled=!!variant;quantity.type='number';quantity.min='1';quantity.max='1000';quantity.step='1';quantity.value=variant?.print_quantity??'';quantity.placeholder='Undecided';front.value=variant?.front_image||'';back.value=variant?.back_image||'';front.placeholder=back.placeholder='assets/…/card.webp';notes.value=variant?.notes||'';notes.maxLength=5000;
  const approval=select(['missing','in_progress','needs_review','approved'],variant?.artwork_status||'missing'),save=el('button',variant?'Save '+variant.variant:'Add parallel'),feedback=el('p',null,'feedback wide');save.type='submit';feedback.setAttribute('role','status');form.append(label('Variant',name),label('Print quantity',quantity),label('Physical front image',front),label('Physical back image',back),label('Artwork review',approval),label('Notes',notes),save,feedback);
  form.onsubmit=async event=>{event.preventDefault();save.disabled=true;try{await rpc('glb_save_checklist_variant',{p_card_id:card.id,p_variant:name.value.trim(),p_revision:variant?.revision||0,p_quantity:quantity.value===''?null:Number(quantity.value),p_front:front.value.trim(),p_back:back.value.trim(),p_status:approval.value,p_notes:notes.value});await refresh();if(authorized)openEditor(card.id,'Variant saved. Inventory has not been created.');}catch(error){feedback.textContent=error.message||'Could not save the variant.';save.disabled=false;}};return form;
 }
 async function refresh(){const ticket=++generation,selected=$('setSelect').value;
  const [loadedCards,loadedVariants]=await Promise.all([all(()=>client.from('glb_checklist_cards').select('*').eq('set_id',selected).order('card_number')),all(()=>client.from('glb_checklist_variants').select('*,glb_checklist_cards!inner(set_id)').eq('glb_checklist_cards.set_id',selected).order('id'))]);if(ticket!==generation||!authorized)return;
  cards=loadedCards;variants=loadedVariants;
  const oldTeam=$('team').value,oldType=$('type').value;
  $('team').replaceChildren(...options([...new Map(cards.filter(c=>c.team_slug).map(c=>[c.team_slug,c.team_name||c.team_slug])).entries()].sort((a,b)=>a[1].localeCompare(b[1])),'All clubs'));$('team').value=oldTeam;
  $('type').replaceChildren(...options([...new Set(cards.map(c=>c.subject_type))].sort().map(v=>[v,v.replaceAll('_',' ')]),'All subjects'));$('type').value=oldType;
  const set=sets.find(s=>s.id===selected);$('setState').textContent=set?.release_at?'Frozen set · Checklist edits are locked.':'Draft set · Quantities and artwork are editorial plans. Nothing on this screen releases cards or mints inventory.';draw();
 }
 async function load(){authorized=false;$('catalog').hidden=true;$('editor').close();cards=[];variants=[];
  if(!client){status('Account access could not load. Please refresh.');return;}
  try{const r=await client.auth.getSession();if(r.error)throw r.error;if(!r.data.session){status('Sign in to your GLB Board account to manage the checklist.');return;}
   if(!await rpc('glb_is_board')){status('This checklist is private to the GLB Board. Your album is available from your account.');return;}
   sets=await rpc('glb_checklist_sets');authorized=true;$('setSelect').replaceChildren(...sets.map(s=>new Option(`${s.title} · ${s.season}`,s.id)));if(!sets.length){status('No draft sets have been created yet.');return;}
   await refresh();if(!authorized)return;$('catalog').hidden=false;status('The master catalog is up to date. Review an entry to edit its draft.');
  }catch{status('The checklist could not load. Sign in again, then refresh.');}
 }
 for(const id of ['search','team','type','scope','work'])$(id).addEventListener(id==='search'?'input':'change',()=>{page=0;draw();});$('setSelect').onchange=()=>{page=0;refresh().catch(()=>status('Could not load this set.'));};$('prev').onclick=()=>{page--;draw();};$('next').onclick=()=>{page++;draw();};$('closeEditor').onclick=()=>{$('editorContent').replaceChildren();$('editor').close();};
 client?.auth.onAuthStateChange(event=>{if(event==='SIGNED_IN'||event==='SIGNED_OUT'){generation++;authorized=false;$('catalog').hidden=true;$('editorContent').replaceChildren();setTimeout(load,0);}});load();
})();
