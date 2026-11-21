/* Fixed demonstration. Never calls account, credit, inventory or ownership APIs. */
(() => {
 const $=id=>document.getElementById(id),key='glb.pack-preview.v1';let sample=[],opened=false;
 const remember=()=>{try{sessionStorage.setItem(key,'opened');}catch{}};
 function preload(data){
  return Promise.all(data.map(copy=>new Promise((resolve,reject)=>{
   const img=new Image(),timer=setTimeout(()=>reject(Error('Artwork timed out')),20000);
   img.onload=()=>{clearTimeout(timer);resolve();};img.onerror=()=>{clearTimeout(timer);reject(Error('Artwork unavailable'));};
   img.src=copy.facts?.physical_copies?.[String(copy.serial)]?.front||copy.facts?.photographic_master?.front||copy.front_image;
  }))).then(()=>data);
 }
 function show(){
  GLBPackTable.mount($('sampleCards'),sample,{renderCard:c=>c.subset ? FieldstockSubsets.card(c) : GLBPackReveal.card(c,c),savedMessage:'Sample only · no cards issued.',onComplete:()=>{$('previewComplete').hidden=false;}});
  $('previewReveal').hidden=false;
 }
 function open(){
  opened=true;remember();$('previewComplete').hidden=true;
  $('openSample').disabled=false;$('openSample').textContent='View cards again';
  $('sampleTitle').textContent='Your sample is ready.';$('sampleStatus').textContent='Five fixed sample cards. Reveal them below.';
  show();$('revealHeading').focus({preventScroll:true});$('previewReveal').scrollIntoView({block:'start',behavior:'instant'});
 }
 $('openSample').onclick=open;$('replaySample').onclick=open;
 fetch('data/pack-preview.json?v=20261115-photo2').then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>FieldstockSubsets.mixedSample(data)).then(preload).then(data=>{
  if(data.length!==5)throw Error();sample=data;$('openSample').disabled=false;$('openSample').textContent='Open sample pack';$('sampleStatus').textContent='Ready. No sign-in required.';
  let restore=false;try{restore=sessionStorage.getItem(key)==='opened';}catch{}
  if(restore){open();$('sampleStatus').textContent='Your sample was restored. These are the same five cards.';}
 }).catch(()=>{$('sampleStatus').textContent='The sample could not load. Refresh to try again.';$('openSample').textContent='Sample unavailable';});
})();
