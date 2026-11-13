/* One menu controller for every league and club page. */
(() => {
  const header = document.getElementById('glb-site-header');
  if (!header) return;
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
