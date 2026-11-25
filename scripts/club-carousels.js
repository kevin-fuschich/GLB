/* Manual club collections. Keep the original nodes so flips, links and media still work. */
(() => {
  const cardSelector = '.tpe-card-grid,.player-card-grid,.tij-card-grid,#mtyCards,.tol-players';
  const parkSelector = '.glb-park-grid,.santiago-park-grid,.tol-places';
  const collections = new Map();
  function enhance(list, park) {
    const slides = () => Array.from(list.children);
    if (slides().length < 2) return;
    const title = park ? 'Around the park' : 'Player cards';
    const heading = list.closest('section')?.querySelector('h2');
    if (heading) heading.textContent = title;
    if (!list.id) list.id = park ? 'club-park-features' : 'club-player-cards';
    list.classList.add('club-carousel');
    list.setAttribute('role','region');
    list.setAttribute('aria-roledescription','carousel');
    list.setAttribute('aria-label',title);
    const controls = document.createElement('div');
    controls.className = 'club-carousel-controls';
    const status = document.createElement('span');
    status.setAttribute('aria-live','polite');
    function button(label, direction) {
      const node = document.createElement('button');
      node.type = 'button';
      node.textContent = direction < 0 ? '‹' : '›';
      node.setAttribute('aria-label',label+' · '+title);
      node.setAttribute('aria-controls',list.id);
      node.onclick = () => move(direction);
      return node;
    }
    const previous = button('Previous',-1), next = button('Next',1);
    controls.append(previous,status,next);
    const frame = document.createElement('div');
    frame.className = 'club-carousel-frame';
    list.before(frame);
    frame.append(controls,list);
    list.classList.add('club-scroll-track');
    list.tabIndex = 0;
    let count = 1;
    function update() {
      const items = slides();
      if (!items.length) return;
      const edge = list.getBoundingClientRect().left + list.clientLeft;
      const visible = items.filter(item=>{
        const rect=item.getBoundingClientRect();
        return rect.left+rect.width/2 >= edge && rect.left+rect.width/2 <= edge+list.clientWidth;
      });
      if (visible.length) {
        const start=items.indexOf(visible[0])+1, end=items.indexOf(visible.at(-1))+1;
        const range=(start===end ? start : start+'–'+end)+' of '+items.length;
        if(status.textContent!==range) status.textContent=range;
      }
      previous.disabled=list.scrollLeft<=2;
      next.disabled=list.scrollLeft+list.clientWidth>=list.scrollWidth-2;
    }
    function paint() {
      const items=slides();
      count=park ? 1 : Math.min(3,Math.max(1,Math.floor((list.clientWidth-40)/225)));
      list.style.setProperty('--club-columns',String(count));
      items.forEach(item=>{item.hidden=false;});
      update();
    }
    function move(direction) {
      const items=slides();
      if (!items.length) return;
      const step=items.length>1 ? items[1].getBoundingClientRect().left-items[0].getBoundingClientRect().left : list.clientWidth;
      list.scrollBy({left:direction*count*step,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    }
    list.addEventListener('scroll',update,{passive:true});
    list.addEventListener('keydown',event=>{
      if(event.target!==list || !['ArrowLeft','ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      move(event.key==='ArrowLeft'?-1:1);
    });
    const videos=new IntersectionObserver(entries=>{
      for(const entry of entries) if(!entry.isIntersecting) entry.target.pause();
    },{root:list});
    function watchMedia(){list.querySelectorAll('video,audio').forEach(media=>videos.observe(media));}
    watchMedia();
    function reveal() {
      let id;
      try { id=decodeURIComponent(location.hash.slice(1)); } catch { return; }
      const target=document.getElementById(id);
      const index=target ? slides().findIndex(item=>item===target || item.contains(target)) : -1;
      if(index<0) return;

      for(let node=target;node && node!==list;node=node.parentElement) if(node.tagName==='DETAILS') node.open=true;
      requestAnimationFrame(()=>target.scrollIntoView({block:'nearest',inline:'nearest'}));
    }
    collections.set(list,true);
    new MutationObserver(()=>{paint();watchMedia();reveal();}).observe(list,{childList:true});
    let width=list.clientWidth;
    new ResizeObserver(()=>{if(list.clientWidth!==width){width=list.clientWidth;paint();}}).observe(list);
    window.addEventListener('hashchange',reveal);
    paint();
    reveal();
  }
  function scan() {
    document.querySelectorAll(cardSelector+','+parkSelector).forEach(list=>{
      if(!collections.has(list)) enhance(list,list.matches(parkSelector));
    });
  }
  // Keep season tables available as one disclosure after the club features.
  const main = document.querySelector('main');
  const records = [...main.querySelectorAll('section, details.santiago-record')].filter(section=>{
    if(section.closest('#around-park') || section.querySelector(cardSelector)) return false;
    const heading = section.querySelector('h2, summary')?.textContent.trim();
    return /^(?:season snapshot|2026 season|team leaders|active roster|recent results|latest result)$/i.test(heading);
  }).filter((section,_,all)=>!all.some(other=>other!==section && other.contains(section)));
  if(records.length){
    const record=document.createElement('details');
    record.className='club-season-record';
    record.id='season-record';
    const summary=document.createElement('summary');
    summary.textContent='Season record';
    record.append(summary,...records);
    const park=document.getElementById('around-park');
    if(park) park.after(record); else main.append(record);
    function revealRecord() {
      let target;
      try { target=document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch { return; }
      if(target && record.contains(target)){
        record.open=true;
        for(let node=target;node!==record;node=node.parentElement) if(node.tagName==='DETAILS') node.open=true;
        requestAnimationFrame(()=>target.scrollIntoView({block:'start'}));
      }
    }
    revealRecord();
    window.addEventListener('hashchange',revealRecord);
  }
  scan();
  const observer=new MutationObserver(scan);
  observer.observe(document.querySelector('main') || document.body,{childList:true,subtree:true});
})();