/* Drafts stay in this browser. Email, acknowledgment and private codes are excluded. */
(() => {
  const form=document.getElementById('contributionForm');
  const controls=document.getElementById('draftControls');
  if(!form||!controls)return;
  const id=new URLSearchParams(location.search).get('artifact_id')||'new-idea';
  const key='glb-contribution-draft-v1:'+id+(new URLSearchParams(location.search).get('mode')==='collaboration'?':note':'');
  const fields=id==='new-idea'?['club','artifact_type','artifact','contribution','supporting_link']:['contribution','supporting_link'];
  const make=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
  const message=make('p','Drafts save on this device. Email is not saved.');message.setAttribute('role','status');message.setAttribute('aria-live','polite');
  const actions=document.createElement('div');actions.className='draft-controls-actions';
  const resume=make('button','Resume your draft');resume.type='button';
  const discard=make('button','Discard draft');discard.type='button';
  controls.append(message,actions);
  let saved=null,waiting=false,ready=false,sent=false,enabled=true,timer;
  const defaults={};
  function paint(){actions.replaceChildren();if(waiting)actions.append(resume);if(saved)actions.append(discard);}
  function collect(){return Object.fromEntries(fields.map(name=>[name,form.elements[name].value]));}
  function persist(){
    if(!ready||!enabled||sent||waiting)return;
    const values=collect();
    if(!values.contribution.trim()){if(saved){try{localStorage.removeItem(key);saved=null;paint();message.textContent='Draft cleared. Start writing to save a new draft on this device.';}catch{message.textContent='This browser could not update the saved draft.';}}return;}
    saved={version:1,artifact_id:id,updated_at:new Date().toISOString(),values};
    try{localStorage.setItem(key,JSON.stringify(saved));message.textContent='Draft saved on this device. Email is not saved.';paint();}
    catch{enabled=false;message.textContent='This browser could not save your draft. Keep this page open or copy your writing before leaving.';}
  }
  resume.addEventListener('click',()=>{
    if(!saved)return;
    for(const name of fields)if(typeof saved.values[name]==='string')form.elements[name].value=saved.values[name];
    waiting=false;paint();message.textContent='Draft resumed. Changes save on this device. Your signed-in account supplies your public credit.';
    form.dispatchEvent(new Event('input',{bubbles:true}));form.elements.contribution.focus();
  });
  discard.addEventListener('click',()=>{
    clearTimeout(timer);
    try{localStorage.removeItem(key);}catch{message.textContent='This browser could not discard the saved draft.';return;}
    saved=null;waiting=false;
    for(const name of fields)form.elements[name].value=defaults[name]||'';
    form.dispatchEvent(new Event('input',{bubbles:true}));paint();message.textContent='Draft discarded. Start writing to save a new draft on this device.';
  });
  form.addEventListener('input',()=>{if(waiting){message.textContent='A saved draft is waiting. Resume it, or discard it to save a new draft.';return;}clearTimeout(timer);timer=setTimeout(persist,300);});
  form.addEventListener('change',()=>{clearTimeout(timer);timer=setTimeout(persist,300);});
  window.addEventListener('pagehide',()=>{clearTimeout(timer);persist();});
  form.addEventListener('glb:contribution-sent',()=>{
    sent=true;clearTimeout(timer);saved=null;waiting=false;paint();
    try{localStorage.removeItem(key);}catch{}
    message.textContent='Submitted for review. The saved draft has been cleared from this device.';
  });
  GLBArtifacts.load().catch(()=>null).then(()=>{
    Object.assign(defaults,collect());ready=true;
    try{
      const value=localStorage.getItem(key);
      if(value){const parsed=JSON.parse(value);if(parsed.version===1&&parsed.artifact_id===id&&parsed.values&&typeof parsed.values.contribution==='string'){saved=parsed;waiting=true;message.textContent='You have a saved draft for this contribution on this device.';}}
      else {const probe=key+':check';localStorage.setItem(probe,'1');localStorage.removeItem(probe);}
    }catch{enabled=false;message.textContent='Draft saving is unavailable in this browser. Copy your writing before leaving.';}
    paint();if(!waiting)persist();
  });
})();
