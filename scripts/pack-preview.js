/* Fixed demonstration. Never calls account, credit, inventory or ownership APIs. */
(() => {
 const $=id=>document.getElementById(id),key='glb.pack-preview.v1';let sample=[],opened=false;
 const remember=()=>{try{sessionStorage.setItem(key,'opened');}catch{}};
 function show(){
  GLBPackReveal.mount($('sampleCards'),sample,{renderCard:c=>GLBPackReveal.card(c,c),savedMessage:'Sample only · no cards issued.',onComplete:()=>{$('previewComplete').hidden=false;}});
  $('previewReveal').hidden=false;
 }
 function open(){
  if(opened)return;opened=true;remember();
  $('openSample').disabled=true;$('openSample').textContent='Sample opened';$('sampleBalance').textContent='0';
  $('sampleTitle').textContent='Your sample is ready.';$('sampleStatus').textContent='Five fixed sample cards. Reveal them below.';
  $('sampleWrapper').classList.add('is-opening');show();$('revealHeading').focus({preventScroll:true});$('previewReveal').scrollIntoView({block:'start',behavior:'instant'});
 }
 $('openSample').onclick=open;
 $('replaySample').onclick=()=>{show();$('previewComplete').hidden=true;$('revealHeading').focus({preventScroll:true});$('previewReveal').scrollIntoView({block:'start',behavior:'instant'});};
 fetch('data/pack-preview.json?v=20261115a').then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{
  if(data.length!==5)throw Error();sample=data;$('openSample').disabled=false;$('openSample').textContent='Open sample pack · 100 credits';$('sampleStatus').textContent='Ready. No sign-in required.';
  let restore=false;try{restore=sessionStorage.getItem(key)==='opened';}catch{}
  if(restore){open();$('sampleStatus').textContent='Your sample was restored. These are the same five cards.';}
 }).catch(()=>{$('sampleStatus').textContent='The sample could not load. Refresh to try again.';$('openSample').textContent='Sample unavailable';});
})();
