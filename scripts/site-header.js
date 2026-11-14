/* One menu controller for every league and club page. */
(() => {
  const header = document.getElementById('glb-site-header');
  if (!header) return;
  const root = new URL('../', document.currentScript.src);
  fetch(new URL('data/season/status.json',root),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('season');return r.json();}).then(state=>{
    if(state.phase!=='offseason')return;

    const style=document.createElement('style');
    style.textContent='.scores-strip,.glb-score-strip{display:none!important}.glb-offseason{display:flex;align-items:center;background:#102438;color:#fff;overflow:hidden;font:12px/1.6 Arial,sans-serif}.glb-offseason-window{flex:1;overflow:hidden;min-width:0}.glb-offseason-track{display:flex;width:max-content;animation:glbOffseason 42s linear infinite}.glb-offseason-group{display:flex;align-items:center;gap:38px;padding:12px 19px;min-width:100vw;white-space:nowrap}.glb-offseason a{color:#ead39a;text-decoration:none}.glb-offseason a:hover{text-decoration:underline}.glb-offseason button{flex:none;margin:0 12px;padding:5px 9px;background:transparent;border:1px solid #7d8b98;color:#fff;font:inherit;cursor:pointer}.glb-offseason:hover .glb-offseason-track,.glb-offseason:focus-within .glb-offseason-track,.glb-offseason.is-paused .glb-offseason-track{animation-play-state:paused}@keyframes glbOffseason{from{transform:translateX(0)}to{transform:translateX(-50%)}}@media(prefers-reduced-motion:reduce){.glb-offseason-track{animation:none}.glb-offseason-window{overflow-x:auto}.glb-offseason-group[aria-hidden]{display:none}.glb-offseason button{display:none}}';
    document.head.append(style);
    const bar=document.createElement('aside');bar.className='glb-offseason';bar.setAttribute('aria-label','GLB offseason news');
    const viewport=document.createElement('div');viewport.className='glb-offseason-window';
    const track=document.createElement('div');track.className='glb-offseason-track';
    const group=document.createElement('div');group.className='glb-offseason-group';
    const entries=[
      ['2026 GLB CHAMPIONS: Osaka Spirits (Osaka Spirits defeated Triangle Gold, 4-3)','postseason.html'],
      ['CLAIM ARTIFACTS DURING THE OFFSEASON: Claim a player, mascot, entertainer and more.','contribute.html']
    ];
    for(const [text,path]of entries){const link=document.createElement('a');link.textContent=text;link.href=new URL(path,root);group.append(link);}
    const copy=group.cloneNode(true);copy.setAttribute('aria-hidden','true');copy.querySelectorAll('a').forEach(a=>a.tabIndex=-1);
    track.append(group,copy);viewport.append(track);
    const pause=document.createElement('button');pause.type='button';pause.textContent='Pause';pause.setAttribute('aria-label','Pause scrolling offseason news');pause.setAttribute('aria-pressed','false');
    pause.onclick=()=>{const paused=bar.classList.toggle('is-paused');pause.textContent=paused?'Play':'Pause';pause.setAttribute('aria-pressed',String(paused));pause.setAttribute('aria-label',(paused?'Resume':'Pause')+' scrolling offseason news');};
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
