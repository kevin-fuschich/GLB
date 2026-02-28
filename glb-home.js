/* ==========================================================
   GLB Home — League Office Live Index Controller
   ----------------------------------------------------------
   Data sources:
   /data/hero.json
   /data/day-YYYY-MM-DD.json  (preferred)
   /data/schedule.json        (fallback)
   /data/standings.json
   /data/featured.json
   /data/clubs.json
   ========================================================== */

(function () {
  const $ = (sel) => document.querySelector(sel);

  const state = {
    hero: [],
    heroIndex: 0,
    heroTimer: null,
    heroPaused: false,
    clubs: [],
    clubFilter: "all",
    standingsFilter: "all"
  };

  /* ----------------------------------------------------------
     Utilities
  ---------------------------------------------------------- */

  function safeText(el, text) {
    if (!el) return;
    el.textContent = (text == null || text === "") ? "—" : String(text);
  }

  function toISODate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function formatLocalDateLabel(iso) {
    try {
      const [y, m, d] = iso.split("-").map(Number);
      const dt = new Date(y, m - 1, d);
      return dt.toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      });
    } catch {
      return iso;
    }
  }

  async function fetchJSON(path) {
    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error();
      return await res.json();
    } catch {
      return null;
    }
  }

  function setPressed(btn, pressed) {
    if (!btn) return;
    btn.setAttribute("aria-pressed", pressed ? "true" : "false");
  }

  function clampIndex(i, len) {
    if (len <= 0) return 0;
    return (i % len + len) % len;
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  /* ----------------------------------------------------------
     Provenance Timestamp (Eastern Time)
  ---------------------------------------------------------- */

  function setProvenanceTime() {
    const el = $("#provTime");
    if (!el) return;

    const now = new Date();
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });

    const parts = fmt.formatToParts(now).reduce((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});

    el.textContent = `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
  }

  /* ==========================================================
     HERO SYSTEM
  ========================================================== */

  function updateHeroCounter() {
    const el = $("#heroCounter");
    if (!el) return;
    const total = state.hero.length;
    const cur = total ? state.heroIndex + 1 : 0;
    el.textContent = total ? `${pad2(cur)} / ${pad2(total)}` : "—";
  }

  function applyHeroOverlay(item) {
    safeText($("#heroTitle"), item.team || "—");
    safeText($("#heroCaption"), item.caption || "");
    safeText($("#heroDivisionPill"), (item.division || "GLB").toUpperCase());

    const link = $("#heroLink");
    const target = item.link || "#clubs";
    if (link) {
      link.href = target;
      link.textContent =
        target && target !== "#clubs"
          ? "View Club Dossier →"
          : "Explore Clubs →";
    }
  }

  function renderHero() {
    const stage = $("#heroStage");
    const status = $("#heroStatus");
    if (!stage) return;

    stage.querySelectorAll(".hero-slide").forEach(n => n.remove());

    if (!state.hero.length) {
      safeText(status, "No images");
      safeText($("#heroCounter"), "—");
      return;
    }

    safeText(status, `${state.hero.length} frames`);

    state.hero.forEach((item, idx) => {
      const slide = document.createElement("div");
      slide.className =
        "hero-slide" + (idx === state.heroIndex ? " is-active" : "");

      const img = document.createElement("img");
      img.className = "hero-img";
      img.src = item.image;
      img.alt = item.alt || item.team || "GLB image";
      img.loading = idx === 0 ? "eager" : "lazy";

      slide.appendChild(img);
      stage.insertBefore(slide, $("#heroCounter"));
    });

    applyHeroOverlay(state.hero[state.heroIndex]);
    updateHeroCounter();
  }

  function goHero(nextIndex, user = false) {
    state.heroIndex = clampIndex(nextIndex, state.hero.length);

    document.querySelectorAll(".hero-slide").forEach((s, idx) => {
      s.classList.toggle("is-active", idx === state.heroIndex);
    });

    applyHeroOverlay(state.hero[state.heroIndex]);
    updateHeroCounter();

    if (user) restartHeroTimer();
  }

  function startHeroTimer() {
    stopHeroTimer();
    state.heroTimer = setInterval(() => {
      if (!state.heroPaused) goHero(state.heroIndex + 1);
    }, 12000); // slower for archival feel
  }

  function stopHeroTimer() {
    if (state.heroTimer) {
      clearInterval(state.heroTimer);
      state.heroTimer = null;
    }
  }

  function restartHeroTimer() {
    stopHeroTimer();
    startHeroTimer();
  }

  function wireHeroControls() {
    $("#heroPrev")?.addEventListener("click", () =>
      goHero(state.heroIndex - 1, true)
    );
    $("#heroNext")?.addEventListener("click", () =>
      goHero(state.heroIndex + 1, true)
    );

    const hero = $("#hero");
    hero?.addEventListener("mouseenter", () => (state.heroPaused = true));
    hero?.addEventListener("mouseleave", () => (state.heroPaused = false));
  }

  async function loadHero() {
    const data = await fetchJSON("/data/hero.json");
    state.hero = Array.isArray(data?.items) ? data.items : [];
    renderHero();
    wireHeroControls();
    startHeroTimer();
  }

  /* ==========================================================
     TODAY SYSTEM
  ========================================================== */

  function badge(status) {
    if (status === "live")
      return `<span class="badge"><span class="dotlive"></span>LIVE</span>`;
    if (status === "final")
      return `<span class="badge">FINAL</span>`;
    return `<span class="badge">UPCOMING</span>`;
  }

  function buildGameLink(dateISO, away, home) {
    const key = encodeURIComponent(`${away}@${home}`);
    return `game.html?date=${dateISO}&game=${key}`;
  }

  function renderToday(dateISO, games) {
    safeText($("#todayDateLabel"), formatLocalDateLabel(dateISO));
    const wrap = $("#todayGames");
    if (!wrap) return;

    if (!games.length) {
      wrap.innerHTML = `<div class="empty">No games today.</div>`;
      return;
    }

    wrap.innerHTML = games.map(g => {
      const away = g.away || "Away";
      const home = g.home || "Home";
      const status = (g.status || "upcoming").toLowerCase();

      const score =
        typeof g.awayScore === "number" &&
        typeof g.homeScore === "number"
          ? `${g.awayScore}–${g.homeScore}`
          : "—";

      const timeLabel =
        status === "final"
          ? "Final"
          : status === "live"
          ? g.inning || "In progress"
          : g.timeLocal || "TBD";

      return `
        <a class="game" href="${buildGameLink(dateISO, away, home)}">
          <div class="game-left">
            <p class="matchup">${away} @ ${home}</p>
            <p class="statusline">
              ${badge(status)}
              <span>${timeLabel}</span>
            </p>
          </div>
          <div class="game-right">
            <div class="score">${
              status === "upcoming" ? "—" : score
            }</div>
            <div class="time">${
              status === "upcoming" ? timeLabel : "Box Score →"
            }</div>
          </div>
        </a>
      `;
    }).join("");
  }

  async function loadToday() {
    const params = new URLSearchParams(window.location.search);
    const dateISO = params.get("date") || toISODate(new Date());

    const dayData = await fetchJSON(`/data/day-${dateISO}.json`);
    if (dayData?.games) {
      renderToday(dateISO, dayData.games);
      return;
    }

    const sched = await fetchJSON("/data/schedule.json");
    const games = sched?.dates?.[dateISO] || [];
    renderToday(dateISO, games);
  }

  /* ==========================================================
     STANDINGS
  ========================================================== */

  function renderStandings(data) {
    safeText(
      $("#standingsAsOf"),
      data?.asOf ? `As of ${formatLocalDateLabel(data.asOf)}` : "—"
    );

    const target = $("#standingsTables");
    if (!target) return;

    const divisions = data?.divisions || {};
    const want = state.standingsFilter;

    function table(title, rows) {
      return `
        <div class="division-title">${title}</div>
        <table>
          <thead>
            <tr>
              <th>Team</th>
              <th class="num">W-L</th>
              <th class="num">GB</th>
              <th class="num">RD</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                r => `
              <tr>
                <td class="team"><a href="${r.link || "#"}">${
                  r.team
                }</a></td>
                <td class="num">${r.w}-${r.l}</td>
                <td class="num">${r.gb}</td>
                <td class="num">${
                  r.rd > 0 ? "+" + r.rd : r.rd
                }</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      `;
    }

    let html = "";
    if (want === "all" || want === "americas")
      html += table("Americas Division", divisions.americas || []);
    if (want === "all" || want === "pacific")
      html += table("Pacific Division", divisions.pacific || []);

    target.innerHTML = html || `<div class="empty">No standings available.</div>`;
  }

  async function loadStandings() {
    const data = await fetchJSON("/data/standings.json");
    if (data) renderStandings(data);
  }

  function wireStandingsToggles() {
    const all = $("#stAll");
    const am = $("#stAmericas");
    const pa = $("#stPacific");

    function set(mode) {
      state.standingsFilter = mode;
      setPressed(all, mode === "all");
      setPressed(am, mode === "americas");
      setPressed(pa, mode === "pacific");
      loadStandings();
    }

    all?.addEventListener("click", () => set("all"));
    am?.addEventListener("click", () => set("americas"));
    pa?.addEventListener("click", () => set("pacific"));
  }

  /* ==========================================================
     FEATURED
  ========================================================== */

  function renderFeatured(data) {
    const body = $("#featuredBody");
    if (!body) return;

    if (!data?.club) {
      body.innerHTML = `<div class="empty">No memo filed.</div>`;
      return;
    }

    body.innerHTML = `
      <div class="featured">
        <img src="${data.club.image}" alt="${data.club.name}" />
        <div>
          <h3>${data.club.name}</h3>
          <p>${data.club.copy || ""}</p>
          <a href="${data.club.link || "#clubs"}">View Club Dossier →</a>
        </div>
      </div>
    `;
  }

  async function loadFeatured() {
    const data = await fetchJSON("/data/featured.json");
    renderFeatured(data);
  }

  /* ==========================================================
     CLUBS
  ========================================================== */

  function renderClubs() {
    const grid = $("#clubsGrid");
    if (!grid) return;

    const filtered = state.clubs.filter(c =>
      state.clubFilter === "all"
        ? true
        : c.division.toLowerCase() === state.clubFilter
    );

    safeText($("#clubsCount"), `${filtered.length} clubs`);

    grid.innerHTML = filtered
      .map(
        c => `
        <a class="club" href="${c.link}">
          <p class="name">${c.name}</p>
          <div class="meta2">
            <span class="mark"></span>
            <span>${c.division.toUpperCase()}</span>
          </div>
        </a>
      `
      )
      .join("");
  }

  async function loadClubs() {
    const data = await fetchJSON("/data/clubs.json");
    state.clubs = Array.isArray(data?.clubs) ? data.clubs : [];
    renderClubs();
  }

  function wireClubToggles() {
    const all = $("#clAll");
    const am = $("#clAmericas");
    const pa = $("#clPacific");

    function set(mode) {
      state.clubFilter = mode;
      setPressed(all, mode === "all");
      setPressed(am, mode === "americas");
      setPressed(pa, mode === "pacific");
      renderClubs();
    }

    all?.addEventListener("click", () => set("all"));
    am?.addEventListener("click", () => set("americas"));
    pa?.addEventListener("click", () => set("pacific"));
  }

  /* ==========================================================
     INIT
  ========================================================== */

  async function init() {
    setProvenanceTime();
    wireStandingsToggles();
    wireClubToggles();

    await Promise.allSettled([
      loadHero(),
      loadToday(),
      loadStandings(),
      loadFeatured(),
      loadClubs()
    ]);
  }

  init();
})();
