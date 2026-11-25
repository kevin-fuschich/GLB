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
      node.textContent = label;
      node.setAttribute('aria-label',label+' · '+title);
      node.setAttribute('aria-controls',list.id);
      node.onclick = () => move(direction);
      return node;
    }
    const previous = button('Previous',-1), next = button('Next',1);
    controls.append(previous,status,next);
    list.before(controls);
    let first = 0, count = 1;
    function paint() {
      const items = slides();
      count = park ? 1 : Math.min(3, Math.max(1, Math.floor((list.clientWidth+16)/245)));
      first = Math.max(0,Math.min(first,items.length-1));
      first -= first % count;
      list.style.setProperty('--club-columns',String(count));
      items.forEach((item,i) => {
        item.hidden = false;
        const off = i < first || i >= first+count;
        if (off && !item.hasAttribute('data-slide-away')) {
          item.querySelectorAll('video,audio').forEach(media => media.pause());
        }
        item.toggleAttribute('data-slide-away',off);
      });
      const last = Math.min(first+count,items.length);
      const range = (count===1 || first+1===last ? String(first+1) : (first+1)+'–'+last)+' of '+items.length;
      if(status.textContent !== range) status.textContent = range;
      previous.disabled = first === 0;
      next.disabled = last === items.length;
    }
    function move(direction) {
      const index = first + direction*count;
      if (index < 0 || index >= list.children.length) return;
      first = index;
      paint();
    }
    let touch;
    list.addEventListener('touchstart',event=>{
      touch = event.touches.length===1 && !event.target.closest('video, audio, input, textarea, select') ? event.touches[0] : null;
    },{passive:true});
    list.addEventListener('touchcancel',()=>{touch=null;});
    list.addEventListener('touchend',event=>{
      if (!touch) return;
      const dx = event.changedTouches[0].clientX-touch.clientX, dy = event.changedTouches[0].clientY-touch.clientY;
      touch=null;
      if (Math.abs(dx)>65 && Math.abs(dx)>2*Math.abs(dy)) move(dx<0?1:-1);
    },{passive:true});
    function reveal() {
      let id;
      try { id=decodeURIComponent(location.hash.slice(1)); } catch { return; }
      const target=document.getElementById(id);
      const index=target ? slides().findIndex(item=>item===target || item.contains(target)) : -1;
      if(index<0) return;
      first=index;
      paint();
      for(let node=target;node && node!==list;node=node.parentElement) if(node.tagName==='DETAILS') node.open=true;
      requestAnimationFrame(()=>target.scrollIntoView({block:'nearest'}));
    }
    collections.set(list,true);
    new MutationObserver(()=>{paint();reveal();}).observe(list,{childList:true});
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
  scan();
  const observer=new MutationObserver(scan);
  observer.observe(document.querySelector('main') || document.body,{childList:true,subtree:true});
})();