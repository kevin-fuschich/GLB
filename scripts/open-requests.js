(() => {
  // Dates are the days these requests were posted on the public homepage board (UTC).
  const posts = {
    'board-position':['Board position','2026-11-27'],
    'MYS-1-st-paul-frost-donk-driver':['Design a DONK driver and car','2026-11-24'],
    'MYS-1-toledo-assembly-donk-driver':['Design a DONK driver and car','2026-11-24'],
    'MYS-1-vancouver-current-player':['Create a player','2026-11-22'],
    'SPD-MASCOT':['Write Bolo’s mascot bio','2026-11-22'],
    'LOU-FLO':['Write Flo Troup’s driver bio','2026-11-22'],
    'TOL-FAN-EXPERIENCE':['Invent a ballpark attraction','2026-11-27']
  };
  function title(row) {
    if (posts[row.id]) return posts[row.id][0];
    if (row.round_no) return 'Create a ' + ({donk:'DONK entry',donk_driver:'DONK driver and car',tradition:'fan tradition'}[row.type] || row.type);
    if (['player','mascot','broadcaster','announcer','entertainer','donk_driver'].includes(row.type)) return 'Write a bio for ' + row.name;
    if (row.id === 'TPE-RING-WALK') return 'Invent a VELLO Ring Walk ritual';
    return 'Add a detail to ' + row.name;
  }
  function age(id) {
    const date = posts[id]?.[1];
    if (!date) return '';
    const days = Math.floor(Date.now()/86400000) - Math.floor(Date.parse(date+'T00:00:00Z')/86400000);
    return days <= 0 ? 'Listed today' : days + (days === 1 ? ' day listed' : ' days listed');
  }
  function isNew(id, now = Date.now()) {
    const date = posts[id]?.[1];
    if (!date) return false;
    const elapsed = now - Date.parse(date+'T00:00:00Z');
    return elapsed >= 0 && elapsed < 3 * 86400000;
  }
  function badge(id) {
    const mark = document.createElement('span');
    mark.className = 'request-new';
    mark.textContent = 'NEW!';
    mark.dataset.requestDateId = id;
    mark.hidden = !isNew(id);
    return mark;
  }
  function updateBadges() {
    for (const mark of document.querySelectorAll('.request-new[data-request-date-id]')) {
      mark.hidden = !isNew(mark.dataset.requestDateId);
    }
  }
  updateBadges();
  window.setInterval(updateBadges, 60000);
  document.addEventListener('visibilitychange',updateBadges);
  window.GLBRequests = {title, age, badge, isNew, available: row => ['open','newcomers'].includes(row.state)};
})();