/* Shared progressive enhancement; records and their anchors remain in the page. */
(() => {
  if(document.querySelector('.santiago-page'))return; // The approved reference already has these controls.
  document.body.classList.add('glb-compact');
  const make=(tag,cls,value)=>{const e=document.createElement(tag);e.className=cls;if(value)e.textContent=value;return e;};
  const root=document.querySelector('main')||document.querySelector('.club-sheet')||document.querySelector('.sheet')||document.querySelector('.page')||document.querySelector('body > .container')||document.querySelector('body > .wrap')||document.body;
  if(!root)return;
  const sections=[...root.querySelectorAll('section')].filter(e=>!e.parentElement.closest('section'));
  const gallery=make('section','glb-park-gallery');gallery.id='around-park';
  gallery.append(make('h2','','Around the park'),make('p','glb-gallery-intro','Open a place, person or artifact to explore its record and contribute.'));
  const grid=make('div','glb-park-grid');gallery.append(grid);
  for(const section of sections){
    const heading=section.querySelector('h2');if(!heading||section.matches('.team-hero,.team-closer'))continue;
    const title=heading.textContent.trim();
    if(/season|snapshot|latest result|recent result|upcoming/i.test(title))continue;
    if(section.querySelector('.tpe-card-grid,.player-card-grid,.tij-card-grid,#mtyCards,.fs-card')||/player cards|player records/i.test(title))continue;
    if(/roster|leader|official record|club file|club notes|artifact desk|contribut/i.test(title)){
      const details=make('details','glb-record-fold');details.append(make('summary','',title));
      const body=make('div','glb-fold-body');body.append(...section.childNodes);details.append(body);section.append(details);section.classList.add('glb-fold-section');continue;
    }
    const tile=make('details','glb-park-tile');tile.name='glb-park';
    const summary=make('summary','');
    const photo=[...section.querySelectorAll('img')].find(e=>!/logo|wordmark|symbol/i.test((e.className||'')+' '+e.getAttribute('src')));
    if(photo){const preview=photo.cloneNode();preview.removeAttribute('id');preview.loading='lazy';preview.className='glb-tile-image';summary.append(preview);}
    const copy=make('span','glb-tile-copy');copy.append(make('strong','',title),make('span','glb-explore','Explore ↗'));summary.append(copy);
    tile.append(summary,section);grid.append(tile);
  }
  if(grid.children.length)(root.querySelector(':scope > .container')||root).append(gallery);
  // Shorten older stand-alone roster tables without losing any rows or IDs.
  for(const table of root.querySelectorAll('table')){
    if(table.closest('details,.fs-card')||table.getAttribute('aria-hidden')==='true'||table.querySelectorAll('tbody tr').length<9)continue;
    const fold=make('details','glb-table-fold');fold.append(make('summary','','View full roster'));
    table.before(fold);fold.append(table);
  }
  let scheduled=false;
  function enhanceLists(){
    scheduled=false;
    for(const list of root.querySelectorAll('.tpe-card-grid,.player-card-grid,.tij-card-grid,#mtyCards,.mty-roster,div.roster')){
      if(list.closest('.glb-park-gallery')||list.children.length<=4)continue;
      let entries=[...list.children].filter(e=>e.matches('.tpe-card-entry,.fs-card,.mty-player,.player,article'));
      if(entries.length<=4)continue;
      if(list.dataset.compactReady){list._glbRefresh(entries);continue;}
      list.dataset.compactReady='true';list.classList.add('glb-four-cards');
      let expanded=false;
      const button=make('button','glb-view-all',`View all ${entries.length} ${list.matches('div.roster,.mty-roster')?'players':'cards'}`);button.type='button';button.setAttribute('aria-expanded','false');
      if(!list.id)list.id='glb-player-collection';button.setAttribute('aria-controls',list.id);
      const paint=all=>{expanded=all;entries.forEach((e,i)=>e.hidden=!all&&i>=4);button.setAttribute('aria-expanded',String(all));button.textContent=all?'Show fewer':`View all ${entries.length} ${list.matches('div.roster,.mty-roster')?'players':'cards'}`;};
      list.after(button);paint(false);
      button.addEventListener('click',()=>{paint(!expanded);if(!expanded)list.scrollIntoView({block:'start'});});
      list._glbExpand=()=>paint(true);
      list._glbRefresh=next=>{if(next.length===entries.length&&next.every((e,i)=>e===entries[i]))return;entries=next;paint(expanded);};
    }
    reveal();
  }
  let revealedHash='';
  function reveal(){
    if(location.hash===revealedHash)return;
    let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}
    if(!id)return;const target=document.getElementById(id);if(!target)return;revealedHash=location.hash;
    let node=target;
    while(node){if(node.tagName==='DETAILS')node.open=true;if(node._glbExpand)node._glbExpand();node=node.parentElement;}
    const fold=target.querySelector(':scope > details');if(fold)fold.open=true;
    requestAnimationFrame(()=>target.scrollIntoView({block:'start'}));
  }
  const observer=new MutationObserver(()=>{if(!scheduled){scheduled=true;requestAnimationFrame(enhanceLists);}});
  observer.observe(root,{childList:true,subtree:true});
  window.addEventListener('hashchange',reveal);enhanceLists();
  // Remove legacy Spokane labels from the shared team route.
  if(location.pathname.endsWith('/team.html')){
    const roster=document.getElementById('roster');const heading=roster?.closest('section')?.querySelector('h2');if(heading)heading.textContent='Player records';
    const slug=new URLSearchParams(location.search).get('team');
    const closer=document.querySelector('.team-closer');if(closer&&slug){closer.querySelector('h2').textContent='Explore the club';closer.querySelector('p').textContent='People, places and artifacts from around the park.';closer.querySelector('a').href=`club-${slug}.html`;}
  }
})();
