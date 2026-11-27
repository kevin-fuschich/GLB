(() => {
  // Dates are the days these requests were posted on the public homepage board (UTC).
  const posts = {
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
  window.GLBRequests = {title, age, available: row => ['open','newcomers'].includes(row.state)};
})();