/* One menu controller for every league and club page. */
(() => {
  const header = document.getElementById('glb-site-header');
  if (!header) return;
  const root = new URL('../', document.currentScript.src);

  const read=async path=>{const r=await fetch(new URL(path,root),{cache:'no-store'});if(!r.ok)throw Error(path);return r.json();};
  Promise.all([read('data/season/status.json').catch(()=>null),read('data/marquee.json').catch(()=>null)]).then(async([state,feed])=>{
    const now=Date.now(),phase=state?.phase;
    let entries=(feed?.schema==='glb.marquee.v1'?feed.messages:[]).filter(m=>{
      if(m.active===false||typeof m.text!=='string'||!m.text.trim())return false;
      if(m.phases?.length&&!m.phases.includes(phase))return false;
      if(m.startsAt&&(!Number.isFinite(Date.parse(m.startsAt))||Date.parse(m.startsAt)>now))return false;
      if(m.endsAt&&(!Number.isFinite(Date.parse(m.endsAt))||Date.parse(m.endsAt)<=now))return false;
      return true;
    }).sort((a,b)=>(b.priority||0)-(a.priority||0));
    if(state&&phase!=='offseason'){
      try{
        const [regular,post,registry]=await Promise.all([read('data/season/games.json'),read('data/season/postseason-'+state.year+'.json').catch(()=>({games:[]})),read('data/teams/teams.json')]);
        const names=new Map(Object.values(registry.divisions).flat().map(t=>[t.slug,t.team]));
        const games=[...regular,...(post.games||[])].filter(g=>g.status==='final'&&g.date<=new Date().toISOString().slice(0,10)).sort((a,b)=>a.date.localeCompare(b.date));
        const date=games.at(-1)?.date;
        entries.push(...games.filter(g=>g.date===date).map(g=>({text:date+' · '+(names.get(g.away)||g.away)+' '+g.awayScore+' — '+(names.get(g.home)||g.home)+' '+g.homeScore+' · Final',href:'box.html?'+new URLSearchParams({date:g.date,game:g.away+'@'+g.home})})));
      }catch{}
    }
    if(!entries.length)entries=[{text:'GLOBAL LEAGUE BASEBALL · Updates, scores and news · Help build the world.',href:'contribute.html'}];
    const style=document.createElement('style');style.textContent=".scores-strip,.glb-score-strip{display:none!important}.glb-marquee{display:flex;align-items:center;background:#102438;color:#fff;overflow:hidden;font:12px/1.6 Arial,sans-serif}.glb-marquee-window{flex:1;overflow:hidden;min-width:0}.glb-marquee-track{display:flex;width:max-content;animation:glbMarquee var(--glb-duration,42s) linear infinite}.glb-marquee-group{display:flex;align-items:center;gap:38px;padding:12px 19px;min-width:100vw;white-space:nowrap}.glb-marquee a{color:#ead39a;text-decoration:none}.glb-marquee a:hover{text-decoration:underline}.glb-marquee button{flex:none;margin:0 12px;padding:5px 9px;background:transparent;border:1px solid #7d8b98;color:#fff;font:inherit;cursor:pointer}.glb-marquee:hover .glb-marquee-track,.glb-marquee:focus-within .glb-marquee-track,.glb-marquee.is-paused .glb-marquee-track{animation-play-state:paused}@keyframes glbMarquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}@media(prefers-reduced-motion:reduce){.glb-marquee-track{animation:none}.glb-marquee-window{overflow-x:auto}.glb-marquee-group[aria-hidden]{display:none}.glb-marquee button{display:none}}";document.head.append(style);
    const bar=document.createElement('aside');bar.className='glb-marquee';bar.setAttribute('aria-label','GLB updates, scores and news');
    const viewport=document.createElement('div');viewport.className='glb-marquee-window';
    const track=document.createElement('div');track.className='glb-marquee-track';
    track.style.setProperty('--glb-duration',Math.max(35,entries.reduce((n,e)=>n+e.text.length,0)*.15)+'s');
    const group=document.createElement('div');group.className='glb-marquee-group';
    for(const entry of entries){
      let target;try{target=new URL(entry.href||'index.html',root);if(!['http:','https:'].includes(target.protocol))continue;}catch{continue;}
      const link=document.createElement('a');link.textContent=entry.text;link.href=target;group.append(link);
    }
    if(!group.children.length)return;
    const copy=group.cloneNode(true);copy.setAttribute('aria-hidden','true');copy.querySelectorAll('a').forEach(a=>a.tabIndex=-1);
    track.append(group,copy);viewport.append(track);
    const pause=document.createElement('button');pause.type='button';pause.textContent='Pause';pause.setAttribute('aria-label','Pause scrolling league news');pause.setAttribute('aria-pressed','false');
    pause.onclick=()=>{const paused=bar.classList.toggle('is-paused');pause.textContent=paused?'Play':'Pause';pause.setAttribute('aria-pressed',String(paused));pause.setAttribute('aria-label',(paused?'Resume':'Pause')+' scrolling league news');};
    bar.append(viewport,pause);header.insertAdjacentElement('afterend',bar);
  }).catch(()=>{});
  const toggle = header.querySelector('#navToggle');
  const menu = header.querySelector('#mobileMenu');
  const setOpen = open => {
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  toggle.addEventListener('click', () => setOpen(menu.hidden));
  header.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !menu.hidden) {
      setOpen(false);
      toggle.focus();
    }
  });
  menu.addEventListener('click', event => {
    if (event.target.closest('a')) setOpen(false);
  });
  const desktop = matchMedia('(min-width: 1251px)');
  desktop.addEventListener('change', () => setOpen(false));
})();
