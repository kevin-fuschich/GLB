/* One menu controller for every league and club page. */
(() => {
  const header = document.getElementById('glb-site-header');
  if (!header) return;
  const root = new URL('../', document.currentScript.src);
  fetch(new URL('data/season/status.json',root),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('season');return r.json();}).then(state=>{
    if(state.phase!=='offseason')return;
    const bar=document.createElement('aside');bar.setAttribute('aria-label','League season status');
    bar.style.cssText='background:#102438;color:#fff;padding:11px 20px;text-align:center;font:12px/1.6 Arial,sans-serif;';
    const link=document.createElement('a');link.href=new URL('postseason.html',root);link.style.cssText='color:#ead39a;text-decoration:underline;font-weight:bold';
    link.textContent=state.championName+' · '+state.year+' GLB champions';
    bar.append(document.createTextNode('OFFSEASON · '),link,document.createTextNode(' · 2027 schedule to be announced'));header.insertAdjacentElement('afterend',bar);
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
