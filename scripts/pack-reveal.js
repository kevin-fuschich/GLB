/* Reveal only: copies must already be assigned by the server before mounting. */
(() => {
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
 function mount(root,copies,{renderCard,onInspect,onComplete=()=>{},savedMessage='Your cards are saved in your collection.'}={}) {
  const revealed=new Set(),buttons=[],tiles=[];
  const toolbar=node('div',null,'pack-reveal-toolbar'),status=node('p',null,'pack-reveal-status'),all=node('button','Reveal all'),grid=node('div',null,'pack-reveal-grid');
  status.setAttribute('role','status');status.setAttribute('aria-live','polite');all.type='button';toolbar.append(status,all);
  const sync=()=>{status.textContent=`${revealed.size} of ${copies.length} revealed. ${savedMessage}`;all.disabled=revealed.size===copies.length;};
  const reveal=i=>{
   if(revealed.has(i))return;
   const copy=copies[i],tile=tiles[i],card=renderCard(copy);
   tile.replaceChildren(card);
   if(onInspect){const inspect=node('button','Inspect copy');inspect.type='button';inspect.onclick=()=>onInspect(copy);tile.append(inspect);}
   tile.dataset.revealed='true';revealed.add(i);sync();
   if(revealed.size===copies.length)onComplete();
   return tile;
  };
  copies.forEach((copy,i)=>{
   const tile=node('div',null,'pack-reveal-slot'),button=node('button',null,'pack-card-back');button.type='button';
   button.setAttribute('aria-label',`Reveal card ${i+1} of ${copies.length}`);
   button.append(node('span','FIELDSTOCK','pack-back-brand'),node('span','GLB · 2026'),node('strong',String(i+1).padStart(2,'0')),node('span','Reveal card'));
   button.onclick=()=>{reveal(i);const target=tile.querySelector('button');target?.focus({preventScroll:true});};
   buttons.push(button);tiles.push(tile);tile.append(button);grid.append(tile);
  });
  all.onclick=()=>{copies.forEach((_,i)=>reveal(i));tiles[0]?.querySelector('button')?.focus({preventScroll:true});};
  root.replaceChildren(toolbar,grid);sync();
  return {revealAll:()=>copies.forEach((_,i)=>reveal(i)),get revealedCount(){return revealed.size;}};
 }
 function refractorLight(wrap){
  const surface=wrap.querySelector('.fs-flipper');
  if(!surface)return;
  function light(event){
   const bounds=surface.getBoundingClientRect();
   if(!bounds.width||!bounds.height)return;
   const x=Math.max(0,Math.min(1,(event.clientX-bounds.left)/bounds.width));
   const y=Math.max(0,Math.min(1,(event.clientY-bounds.top)/bounds.height));
   wrap.style.setProperty('--foil-x',`${x*100}%`);
   wrap.style.setProperty('--foil-y',`${y*100}%`);
   wrap.dataset.foilActive='true';
  }
  function release(){delete wrap.dataset.foilActive;}
  surface.addEventListener('pointermove',light);
  surface.addEventListener('pointerdown',light);
  surface.addEventListener('pointerleave',release);
  surface.addEventListener('pointerup',event=>{if(event.pointerType!=='mouse')release();});
  surface.addEventListener('pointercancel',release);
 }
 function card(edition,copy){
  const wrap=node('div',null,'pack-owned-card');wrap.dataset.variant=edition.variant.toLowerCase();
  const player={...edition.facts.player,frozen_artwork:true};
  wrap.append(GLBPlayerCards.createCard(player,edition.facts.record,{link:false,physical:true,frozen:true}));
  if(wrap.dataset.variant==='refractor')refractorLight(wrap);
  const label=node('p',`${edition.variant} · ${copy.serial}/${edition.quantity}`,'pack-edition-label');
  wrap.append(label);return wrap;
 }
 window.GLBPackReveal={mount,card};
})();
