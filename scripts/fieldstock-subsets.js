/* The event archive owns the artwork and printed records for both 2026 subsets. */
(() => {
  const archive = 'events/donk_championship.html';
  let pending;
  async function readArchive() {
    const response = await fetch(archive);
    if (!response.ok) throw Error('The DONK archive is unavailable.');
    const template = document.createElement('template');
    template.innerHTML = await response.text();
    return Array.from(template.content.querySelectorAll('article.fieldstock-driver'), entry => {
      const print = entry.querySelector('.fs-card');
      const driver = entry.id.startsWith('base-');
      const id = print.querySelector('.fs-back-header > span:last-child').textContent.trim();
      const name = print.querySelector('.fs-back-name').textContent.trim();
      const photo = print.querySelector('.fs-photo-image, .driver-card-photograph');
      for (const img of print.querySelectorAll('img[src]')) {
        img.src = new URL(img.getAttribute('src'), response.url).href;
        img.removeAttribute('loading');
      }
      return {id, name, subset:driver ? 'DONK Drivers' : 'Road to Tijuana', variant:'Base',
        set_id:'fieldstock-2026', front_image:photo.src, archiveLink:archive + '#' + entry.id, print};
    });
  }
  function catalog() {
    return pending ||= readArchive().catch(error => { pending = null; throw error; });
  }
  function card(entry) {
    const wrap = document.createElement('div');
    wrap.className = 'page fieldstock-driver subset-print';
    const print = entry.print.cloneNode(true);
    const button = print.querySelector('button');
    button.onclick = () => {
      const back = button.classList.toggle('is-flipped');
      button.setAttribute('aria-pressed', String(back));
      button.setAttribute('aria-label', entry.name + ' · ' + entry.subset + (back ? ' back.' : ' front.') + ' Activate to flip.');
      print.querySelector('.fs-front').setAttribute('aria-hidden', String(back));
      print.querySelector('.fs-back').setAttribute('aria-hidden', String(!back));
    };
    wrap.append(print);
    return wrap;
  }
  async function mixedSample(baseball) {
    const entries = await catalog();
    const driver = entries.find(e => e.id === 'DB-002');
    const event = entries.find(e => e.id === 'D26-009');
    if (!driver || !event) throw Error('Sample subset cards are unavailable.');
    return [driver, event, ...baseball.slice(2)];
  }
  window.FieldstockSubsets = {catalog, card, mixedSample};
})();
