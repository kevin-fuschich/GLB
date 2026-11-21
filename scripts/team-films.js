/* Bind after the team gallery has built its native disclosure tiles. */
for (const video of document.querySelectorAll('video[data-glb-film]')) {
  const tile = video.closest('details');
  if (!tile) continue;
  const summary = tile.querySelector(':scope > summary');
  const preview = summary.querySelector('img');
  if (preview) preview.hidden = false;
  tile.classList.add('glb-film-tile');
  const cue = summary.querySelector('[data-film-cue], .glb-explore');
  const updateCue = () => { if (cue) cue.textContent = tile.open ? 'Close' : 'Play · ' + video.dataset.glbFilm; };
  let startedByClick = false;
  function start() {
    video.currentTime = 0;
    video.play().catch(() => {}); // The inline player offers manual playback if needed.
  }
  summary.addEventListener('click', event => {
    if (tile.open || event.defaultPrevented) return;
    event.preventDefault();
    tile.open = true;
    startedByClick = true;
    updateCue();
    start();
  });
  tile.addEventListener('toggle', () => {
    updateCue();
    if (!tile.open) video.pause();
    else if (!startedByClick) { video.muted = true; start(); }
    startedByClick = false;
  });
  updateCue();
}
