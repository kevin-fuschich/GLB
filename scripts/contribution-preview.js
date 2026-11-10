/* A local draft preview; nothing is sent until the contribution is submitted. */
(() => {
  const form=document.getElementById('contributionForm');
  const panel=document.getElementById('contributionPreview');
  const trigger=document.getElementById('previewContribution');
  if(!form||!panel||!trigger)return;
  const node=(tag,text,className)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(className)n.className=className;return n;};
  let artwork={},artifacts=[];
  Promise.all([fetch('data/artifacts/artwork.json').then(r=>r.ok?r.json():{}).catch(()=>({})),GLBArtifacts.load().catch(()=>({artifacts:[]}))]).then(([art,data])=>{artwork=art;artifacts=data.artifacts;if(!panel.hidden)render(false);});
  function render(focus){
    const title=form.elements.artifact.value.trim();
    const text=form.elements.contribution.value.trim();
    const user=form.elements.user_id.value.trim();
    if(focus){
      for(const field of [form.elements.artifact,form.elements.user_id,form.elements.contribution])if(!field.reportValidity())return;
    }
    const club=form.elements.club;
    const kind=form.elements.artifact_type;
    const canonical=artifacts.find(a=>a.id===form.elements.artifact_id.value && a.name===title && a.team_slug===club.value && a.type===kind.value);
    const art=canonical&&artwork[canonical.id];
    const record=node('article',null,'draft-record');
    if(art){const img=node('img');img.src=art.src;img.alt=art.alt;img.className='draft-art';if(canonical.type==='player')img.classList.add('draft-art-player');img.addEventListener('error',()=>img.remove(),{once:true});record.append(img);}
    const copy=node('div',null,'draft-copy');
    copy.append(node('div','Draft · Pending Board review','draft-status'),node('p',[(club.value?club.selectedOptions[0].textContent:'GLB universe'),(kind.value?kind.selectedOptions[0].textContent:'New idea')].join(' · '),'draft-meta'));
    const h=node('h3',title||'Your GLB idea');h.id='preview-title';copy.append(h,node('p','Contribution by '+(user||'your User ID'),'draft-credit'),node('div',text||'Your story will appear here.','draft-writing'));
    record.append(copy);
    const edit=node('button','Keep writing');edit.type='button';edit.className='draft-edit';edit.addEventListener('click',()=>form.elements.contribution.focus());
    panel.replaceChildren(record,node('p','Preview only. Your contribution becomes part of GLB after Board acceptance. Your email stays private.','draft-notice'),edit);
    panel.hidden=false;
    if(focus)panel.focus();
  }
  trigger.addEventListener('click',()=>render(true));
  form.addEventListener('input',()=>{if(!panel.hidden)render(false);});
  form.addEventListener('change',()=>{if(!panel.hidden)render(false);});
})();
