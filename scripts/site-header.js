/* One menu + quick-action bar controller for every league and club page on globalleaguebaseball.com. */
(() => {
  const header = document.getElementById('glb-site-header');
  if (!header) return;
  const root = new URL('../', document.currentScript.src);
  const SUPABASE_URL = 'https://uyjncyvlumakuqtfuicc.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_VjJqbpi9zo2143JF1qq91A_0mAfJuUy';

  if (!document.getElementById('glb-controls-style')) {
    const controls = document.createElement('link');
    controls.id = 'glb-controls-style';
    controls.rel = 'stylesheet';
    controls.href = new URL('site-controls.css?v=20261121-claims', root);
    document.head.append(controls);
  }

  /* Inject the Top Collector Readout & Quick Action Bar inside #glb-site-header */
  if (!document.getElementById('glb-quick-bar')) {
    const qStyle = document.createElement('style');
    qStyle.id = 'glb-quick-bar-style';
    qStyle.textContent = [
      '#glb-quick-bar{background:#102843;border-top:1px solid rgba(255,255,255,.12);color:#c7d8ea;font:12px/1.4 Arial,Helvetica,sans-serif}',
      '#glb-quick-bar-inner{max-width:1440px;margin:0 auto;padding:7px 24px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px}',
      '#glb-quick-bar-meta{display:flex;flex-wrap:wrap;align-items:center;gap:10px}',
      '#glb-quick-bar-meta a{color:#b7efda;font-weight:700;text-decoration:none;font-variant-numeric:tabular-nums}',
      '#glb-quick-bar-meta a:hover{color:#fff;text-decoration:underline}',
      '#glb-quick-bar-meta .glb-qb-muted{color:#c7d8ea;font-weight:500}',
      '#glb-quick-bar-actions{display:flex;align-items:center;gap:8px;overflow-x:auto}',
      '#glb-quick-bar-actions a{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:4px;font:700 12px/1.2 Arial,Helvetica,sans-serif;text-decoration:none;white-space:nowrap;flex-shrink:0}',
      '#glb-quick-bar-actions a.glb-qb-packs{background:#b7efda;color:#0b1e33;font-weight:800}',
      '#glb-quick-bar-actions a.glb-qb-packs:hover{background:#d3f8e9}',
      '#glb-quick-bar-actions a.glb-qb-sec{background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.26)}',
      '#glb-quick-bar-actions a.glb-qb-sec:hover{background:rgba(255,255,255,.2)}',
      '@media(max-width:480px){#glb-quick-bar-inner{padding:7px 18px}}',
    ].join('');
    document.head.append(qStyle);

    const bar = document.createElement('div');
    bar.id = 'glb-quick-bar';
    const inner = document.createElement('div');
    inner.id = 'glb-quick-bar-inner';

    const meta = document.createElement('div');
    meta.id = 'glb-quick-bar-meta';
    const collectedLink = document.createElement('a');
    collectedLink.href = new URL('book.html', root);
    collectedLink.textContent = 'Collector’s book';
    const dot = document.createElement('span');
    dot.textContent = '·';
    dot.setAttribute('aria-hidden', 'true');
    const claimsLink = document.createElement('a');
    claimsLink.className = 'glb-qb-muted';
    claimsLink.href = new URL('artifacts.html', root);
    claimsLink.textContent = '391 artifacts';
    meta.append(collectedLink, dot, claimsLink);

    const actions = document.createElement('div');
    actions.id = 'glb-quick-bar-actions';

    const openPacksBtn = document.createElement('a');
    openPacksBtn.className = 'glb-qb-packs';
    openPacksBtn.href = new URL('book.html#open-packs', root);
    openPacksBtn.textContent = 'Open Packs';

    const claimArtifactsBtn = document.createElement('a');
    claimArtifactsBtn.className = 'glb-qb-sec';
    claimArtifactsBtn.href = new URL('contribute.html', root);
    claimArtifactsBtn.textContent = 'Claim Artifacts';

    const buildLineupBtn = document.createElement('a');
    buildLineupBtn.className = 'glb-qb-sec';
    buildLineupBtn.href = new URL('fantasy.html', root);
    buildLineupBtn.textContent = 'Build Lineup';

    actions.append(openPacksBtn, claimArtifactsBtn, buildLineupBtn);
    inner.append(meta, actions);
    bar.append(inner);

    const mobileMenu = header.querySelector('#mobileMenu');
    if (mobileMenu) {
      header.insertBefore(bar, mobileMenu);
    } else {
      header.append(bar);
    }

    /* Live read-only sync for X/264 collected & claimed artifact count */
    fetch(SUPABASE_URL + '/rest/v1/glb_claims?select=artifact_id', {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((rows) => {
        if (Array.isArray(rows)) {
          claimsLink.textContent = rows.length + '/391 artifacts claimed';
        }
      })
      .catch(() => {});

    try {
      const rawSession = localStorage.getItem('sb-uyjncyvlumakuqtfuicc-auth-token');
      const token = rawSession ? JSON.parse(rawSession)?.access_token : null;
      if (token) {
        fetch(SUPABASE_URL + '/rest/v1/rpc/glb_my_album', {
          method: 'POST',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json',
          },
          body: '{}',
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((rows) => {
            if (Array.isArray(rows)) {
              const unique = new Set(rows.map((c) => c.edition_id || c.card_id)).size;
              collectedLink.textContent = unique + (unique === 1 ? ' edition collected' : ' editions collected');
            }
          })
          .catch(() => {});
      }
    } catch {}
  }

  const footer = document.querySelector('body > footer');
  if (footer && !footer.querySelector('[data-glb-sponsors-link]')) {
    const p = document.createElement('p');
    const link = document.createElement('a');
    link.href = new URL('sponsors.html', root);
    link.textContent = 'About Our Sponsors';
    link.setAttribute('data-glb-sponsors-link', '');
    link.style.cssText = 'color:inherit;text-decoration:underline;font:inherit';
    p.style.margin = '8px 0';
    p.append(link);
    footer.append(p);
  }

  const read = async (path) => {
    const r = await fetch(new URL(path, root), { cache: 'no-store' });
    if (!r.ok) throw Error(path);
    return r.json();
  };

  Promise.all([
    read('data/season/status.json').catch(() => null),
    read('data/marquee.json').catch(() => null),
  ])
    .then(async ([state, feed]) => {
      const now = Date.now();
      const phase = state?.phase;
      let entries = (feed?.schema === 'glb.marquee.v1' ? feed.messages : [])
        .filter((m) => {
          if (m.active === false || typeof m.text !== 'string' || !m.text.trim()) return false;
          if (m.phases?.length && !m.phases.includes(phase)) return false;
          if (m.startsAt && (!Number.isFinite(Date.parse(m.startsAt)) || Date.parse(m.startsAt) > now))
            return false;
          if (m.endsAt && (!Number.isFinite(Date.parse(m.endsAt)) || Date.parse(m.endsAt) <= now))
            return false;
          return true;
        })
        .sort((a, b) => (b.priority || 0) - (a.priority || 0));

      if (state && phase !== 'offseason') {
        try {
          const [regular, post, registry] = await Promise.all([
            read('data/season/games.json'),
            read('data/season/postseason-' + state.year + '.json').catch(() => ({ games: [] })),
            read('data/teams/teams.json'),
          ]);
          const names = new Map(Object.values(registry.divisions).flat().map((t) => [t.slug, t.team]));
          const games = [...regular, ...(post.games || [])]
            .filter((g) => g.status === 'final' && g.date <= new Date().toISOString().slice(0, 10))
            .sort((a, b) => a.date.localeCompare(b.date));
          const date = games.at(-1)?.date;
          entries.push(
            ...games
              .filter((g) => g.date === date)
              .map((g) => ({
                text:
                  date +
                  ' · ' +
                  (names.get(g.away) || g.away) +
                  ' ' +
                  g.awayScore +
                  ' — ' +
                  (names.get(g.home) || g.home) +
                  ' ' +
                  g.homeScore +
                  ' · Final',
                href: 'box.html?' + new URLSearchParams({ date: g.date, game: g.away + '@' + g.home }),
              }))
          );
        } catch {}
      }

      if (!entries.length) {
        entries = [
          {
            text: 'GLOBAL LEAGUE BASEBALL · Updates, scores and news · Help build the world.',
            href: 'contribute.html',
          },
        ];
      }

      const style = document.createElement('style');
      style.textContent =
        '.scores-strip,.glb-score-strip{display:none!important}.glb-marquee{display:flex;align-items:center;background:#102438;color:#fff;overflow:hidden;font:12px/1.6 Arial,sans-serif}.glb-marquee-window{flex:1;overflow:hidden;min-width:0}.glb-marquee-track{display:flex;width:max-content;animation:glbMarquee var(--glb-duration,42s) linear infinite}.glb-marquee-group{display:flex;align-items:center;gap:38px;padding:12px 19px;min-width:100vw;white-space:nowrap}.glb-marquee a{color:#ead39a;text-decoration:none}.glb-marquee a:hover{text-decoration:underline}.glb-marquee a.glb-marquee-requests{flex:none;display:inline-flex;align-items:center;min-height:32px;margin:4px 6px;padding:0 12px;border-radius:4px;background:#ead39a;color:#102438;font-weight:750}.glb-marquee-requests:focus-visible{outline:2px solid white;outline-offset:2px}.glb-marquee button{flex:none;margin:0 12px;padding:5px 9px;background:transparent;border:1px solid #7d8b98;color:#fff;font:inherit;cursor:pointer}.glb-marquee:hover .glb-marquee-track,.glb-marquee:focus-within .glb-marquee-track,.glb-marquee.is-paused .glb-marquee-track{animation-play-state:paused}@keyframes glbMarquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}@media(prefers-reduced-motion:reduce){.glb-marquee-track{animation:none}.glb-marquee-window{overflow-x:auto}.glb-marquee-group[aria-hidden]{display:none}.glb-marquee button{display:none}}';
      document.head.append(style);

      const bar = document.createElement('aside');
      bar.className = 'glb-marquee';
      bar.setAttribute('aria-label', 'GLB updates, scores and news');
      const viewport = document.createElement('div');
      viewport.className = 'glb-marquee-window';
      const track = document.createElement('div');
      track.className = 'glb-marquee-track';
      track.style.setProperty(
        '--glb-duration',
        Math.max(35, entries.reduce((n, e) => n + e.text.length, 0) * 0.15) + 's'
      );
      const group = document.createElement('div');
      group.className = 'glb-marquee-group';

      for (const entry of entries) {
        let target;
        try {
          target = new URL(entry.href || 'index.html', root);
          if (!['http:', 'https:'].includes(target.protocol)) continue;
        } catch {
          continue;
        }
        const link = document.createElement('a');
        link.textContent = entry.text;
        link.href = target;
        group.append(link);
      }
      if (!group.children.length) return;

      const copy = group.cloneNode(true);
      copy.setAttribute('aria-hidden', 'true');
      copy.querySelectorAll('a').forEach((a) => (a.tabIndex = -1));
      track.append(group, copy);
      viewport.append(track);

      const pause = document.createElement('button');
      pause.type = 'button';
      pause.textContent = 'Pause';
      pause.setAttribute('aria-label', 'Pause scrolling league news');
      pause.setAttribute('aria-pressed', 'false');
      pause.onclick = () => {
        const paused = bar.classList.toggle('is-paused');
        pause.textContent = paused ? 'Play' : 'Pause';
        pause.setAttribute('aria-pressed', String(paused));
        pause.setAttribute(
          'aria-label',
          (paused ? 'Resume' : 'Pause') + ' scrolling league news'
        );
      };
      bar.append(viewport);
      const invitation = entries.find(entry => entry.id === 'offseason-claims');
      if (invitation) {
        const requests = document.createElement('a');
        requests.href = new URL('contribute.html#open-artifacts', root);
        requests.className = 'glb-marquee-requests';
        requests.textContent = 'Open requests';
        bar.append(requests);
      }
      bar.append(pause);
      header.insertAdjacentElement('afterend', bar);
    })
    .catch(() => {});

  const toggle = header.querySelector('#navToggle');
  const menu = header.querySelector('#mobileMenu');
  if (toggle && menu) {
    const setOpen = (open) => {
      menu.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };
    toggle.addEventListener('click', () => setOpen(menu.hidden));
    header.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !menu.hidden) {
        setOpen(false);
        toggle.focus();
      }
    });
    menu.addEventListener('click', (event) => {
      if (event.target.closest('a')) setOpen(false);
    });
    const desktop = matchMedia('(min-width: 1251px)');
    desktop.addEventListener('change', () => setOpen(false));
  }
})();
