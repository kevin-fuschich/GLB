/* Fixed demonstration. Never calls account, credit, inventory or ownership APIs. */
(() => {
 const $=id=>document.getElementById(id),key='glb.pack-preview.v1';let sample=[],opened=false,opening=false,openingTimer=null;
 const remember=()=>{try{sessionStorage.setItem(key,'opened');}catch{}};
 function show(){
  GLBPackTable.mount($('sampleCards'),sample,{renderCard:c=>GLBPackReveal.card(c,c),savedMessage:'Sample only · no cards issued.',onComplete:()=>{$('previewComplete').hidden=false;}});
  $('previewReveal').hidden=false;
 }
 function open(){
  if(opened)return;opened=true;remember();
  $('openSample').disabled=false;$('openSample').textContent='Open wrapper again';$('sampleBalance').textContent='0';
  $('sampleTitle').textContent='Your sample is ready.';$('sampleStatus').textContent='Five fixed sample cards. Reveal them below.';
  show();$('revealHeading').focus({preventScroll:true});$('previewReveal').scrollIntoView({block:'start',behavior:'instant'});
 }
 function finishWrapper(){
  clearTimeout(openingTimer);openingTimer=null;opening=false;$('wrapperDialog').close();
  if(!opened)open();else{show();$('previewComplete').hidden=true;$('revealHeading').focus({preventScroll:true});$('previewReveal').scrollIntoView({block:'start',behavior:'instant'});}
 }
 function wrapper(){
  opening=false;clearTimeout(openingTimer);$('wrapperScene').classList.remove('is-torn');
  $('tearWrapper').disabled=false;$('wrapperContinue').hidden=true;$('wrapperSkip').hidden=false;
  $('wrapperTitle').textContent='A fresh pack.';$('wrapperHint').textContent='Tap the pack to open it.';
  $('wrapperStatus').textContent='Sealed · five sample cards inside';$('wrapperDialog').showModal();$('tearWrapper').focus();
 }
 function tear(){

  if(opening)return;opening=true;$('tearWrapper').disabled=true;$('wrapperSkip').hidden=true;$('wrapperScene').classList.add('is-torn');
  $('wrapperTitle').textContent='Breaking the seal.';$('wrapperHint').textContent='Your five cards are inside.';$('wrapperStatus').textContent='Opening the wrapper…';
  openingTimer=setTimeout(()=>{openingTimer=null;$('wrapperTitle').textContent='The pack is open.';$('wrapperStatus').textContent='Five cards, ready to reveal.';$('wrapperContinue').hidden=false;finishWrapper();},matchMedia('(prefers-reduced-motion: reduce)').matches?0:1450);
 }
 $('tearWrapper').onclick=tear;
 $('wrapperContinue').onclick=finishWrapper;$('wrapperSkip').onclick=finishWrapper;
 $('wrapperDialog').addEventListener('cancel',event=>{event.preventDefault();finishWrapper();});
 $('openSample').onclick=wrapper;$('replaySample').onclick=wrapper;
 fetch('data/pack-preview.json?v=20261115a').then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{
  if(data.length!==5)throw Error();sample=data;$('openSample').disabled=false;$('openSample').textContent='Open sample pack · 100 credits';$('sampleStatus').textContent='Ready. No sign-in required.';
  let restore=false;try{restore=sessionStorage.getItem(key)==='opened';}catch{}
  if(restore){open();$('sampleStatus').textContent='Your sample was restored. These are the same five cards.';}
 }).catch(()=>{$('sampleStatus').textContent='The sample could not load. Refresh to try again.';$('openSample').textContent='Sample unavailable';});
})();
