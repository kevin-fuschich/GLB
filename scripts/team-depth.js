
(() => {
  const heroes = document.querySelectorAll('[data-team-depth]');
  if (!heroes.length) return;
  const motion = window.matchMedia('(prefers-reduced-motion: no-preference)');
  let frame = 0;
  function paint() {
    frame = 0;
    if (!motion.matches) return;
    heroes.forEach(hero => {
      if (hero.querySelector('details[open]')) return;
      const rect = hero.getBoundingClientRect();
      if (!rect.height || rect.bottom <= 0 || rect.top >= window.innerHeight) return;
      const progress = Math.min(1, Math.max(0, (180 - rect.top) / (rect.height + 120)));
      const offset = (progress - .5) * rect.height * .48;
      hero.style.setProperty('--team-depth-offset', offset.toFixed(2) + 'px');
    });
  }
  function schedule() {
    if (!frame && motion.matches) frame = requestAnimationFrame(paint);
  }
  window.addEventListener('scroll', schedule, {passive:true});
  window.addEventListener('resize', schedule);
  heroes.forEach(hero => hero.querySelector('details')?.addEventListener('toggle', schedule));
  motion.addEventListener('change', schedule);
  schedule();
})();
