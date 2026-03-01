/* ==========================================================
   GLB Home — League Office Live Index Controller
   Data sources (relative):
   data/hero.json
   data/day-YYYY-MM-DD.json (preferred)
   data/schedule.json       (fallback)
   data/standings.json
   data/featured.json
   data/clubs.json
   data/transmissions.json  (From the Stands)
   ========================================================== */

(function () {
  const $ = (sel) => document.querySelector(sel);
  const PATH = "data/";

  const state = {
    hero: [],
    heroIndex: 0,
    heroTimer: null,
    heroPaused: false,
    clubs: []
  };

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
      const res = await fetch(path, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      return null;
    }
  }

  function clampIndex(i, len) {
    if (len <= 0) return 0;
    return (i % len + len) % len;
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  /* Provenance Timestamp (Eastern Time) */
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
     HERO
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
    const link = $("#heroLink");
    if (link) link.href = item.link || "#clubs";
  }

  function renderHero() {
    const stage = $("#heroStage");
    if (!stage) return;

    stage.querySelectorAll(".hero-slide").forEach(n => n.remove());

    if (!state.hero.length) {
      updateHeroCounter();
      return;
    }

    state.hero.forEach((item, idx) => {
      const slide = document.createElement("div");
      slide.className = "hero-slide" + (idx === state.heroIndex ? " is-active" : "");

      const img = document.createElement("img");
      img.className = "hero-img";
      img.src = item.image;
      img.alt = item.alt || item.team || "GLB image";
      img.loading = idx === 0 ? "eager" : "lazy";

      slide.appendChild(img);
      stage.appendChild(slide);
    });

    applyHeroOverlay(state.hero[state.heroIndex]);
    updateHeroCounter();
  }

  function goHero(nextIndex, user = false) {
    state.heroIndex = clampIndex(nextIndex, state.hero.length);

    document.querySelectorAll(".hero-slide").forEach((s, idx) => {
      s.classList.toggle("is-active", idx === state.heroIndex);
    });

    if (state.hero[state.heroIndex]) applyHeroOverlay(state.hero[state.heroIndex]);
    updateHeroCounter();

    if (user) restartHeroTimer();
  }

  function startHeroTimer() {
    stopHeroTimer();
    state.heroTimer = setInterval(() => {
      if (!state.heroPaused) goHero(state.heroIndex + 1);
    }, 12000);
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
    $("#heroPrev")?.addEventListener("click", () => goHero(state.heroIndex - 1, true));
    $("#heroNext")?.addEventListener("click", () => goHero(state.heroIndex + 1, true));
  }

  async function loadHero() {
    const data = await fetchJSON(PATH + "hero.json");
    state.hero = Array.isArray(data?.items) ? data.items : [];
    renderHero();
    wireHeroControls();
    startHeroTimer();
  }

  /* ==========================================================
     TODAY
  ========================================================== */

  function buildGameLink(dateISO, away, home) {
    const key = encodeURIComponent(`${away}@${home}`);
    return `game.html?date=${dateISO}&game=${key}`;
  }

  function renderToday(dateISO, games) {
    safeText($("#todayDateLabel"), formatLocalDateLabel(dateISO));
    const wrap = $("#todayGames");
    if (!wrap) return;

    if (!Array.isArray(games) || games.length === 0) {
      wrap.innerHTML = `<div class="empty">No games today.</div>`;
      return;
    }

    wrap.innerHTML = games.slice(0, 6).map(g => {
      const away = g.away || "Away";
      const home = g.home || "Home";
      const status = (g.status || "upcoming").toLowerCase();

      const score =
        typeof g.awayScore === "number" && typeof g.homeScore === "number"
          ? `${g.awayScore}–${g.homeScore}`
          : "—";

      const timeLabel =
        status === "final" ? "Final" :
        status === "live" ? (g.inning || "In progress") :
        (g.timeLocal || "TBD");

      return `
        <a class="game" href="${buildGameLink(dateISO, away, home)}">
          <div class="game-left">
            <p class="matchup">${away} @ ${home}</p>
            <p class="statusline">${timeLabel}</p>
          </div>
          <div class="game-right">
            <div class="score">${status === "upcoming" ? "—" : score}</div>
            <div class="time">${status === "upcoming" ? timeLabel : "Box Score →"}</div>
          </div>
        </a>
      `;
    }).join("");
  }

  async function loadToday() {
    const params = new URLSearchParams(window.location.search);
    const dateISO = params.get("date") || toISODate(new Date());

    const dayData = await fetchJSON(PATH + `day-${dateISO}.json`);
    if (dayData?.games) {
      renderToday(dateISO, dayData.games);
      return;
    }

    const sched = await fetchJSON(PATH + "schedule.json");
    const games = sched?.dates?.[dateISO] || [];
    renderToday(dateISO, games);
  }

  /* ==========================================================
     STANDINGS
  ========================================================== */

  function renderStandings(data) {
    safeText($("#standingsAsOf"), data?.asOf ? `As of ${formatLocalDateLabel(data.asOf)}` : "—");

    const target = $("#standingsTables");
    if (!target) return;

    const divs = data?.divisions || {};
    const rowsA = Array.isArray(divs.americas) ? divs.americas : [];
    const rowsP = Array.isArray(divs.pacific) ? divs.pacific : [];

    function table(title, rows) {
      return `
        <div style="margin:14px 0 8px;font-family:ui-monospace,Menlo,monospace;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#2c3a44;">
          ${title}
        </div>
        <table>
          <thead>
            <tr><th>Team</th><th class="num">W-L</th><th class="num">GB</th><th class="num">RD</th></tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td><a href="${r.link || "#"}">${r.team || "—"}</a></td>
                <td class="num">${(r.w ?? "—")}-${(r.l ?? "—")}</td>
                <td class="num">${r.gb ?? "—"}</td>
                <td class="num">${(r.rd ?? "—")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    }

    target.innerHTML = table("Americas Division", rowsA) + table("Pacific Division", rowsP);
  }

  async function loadStandings() {
    const data = await fetchJSON(PATH + "standings.json");
    if (data) renderStandings(data);
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
        <img src="${data.club.image}" alt="${data.club.name || "Featured club"}" />
        <div>
          <h3>${data.club.name || "—"}</h3>
          <p>${data.club.copy || ""}</p>
          <a href="${data.club.link || "#clubs"}">View Club Dossier →</a>
        </div>
      </div>
    `;
  }

  async function loadFeatured() {
    const data = await fetchJSON(PATH + "featured.json");
    renderFeatured(data);
  }

  /* ==========================================================
     CLUBS
  ========================================================== */

  function renderClubs() {
    const grid = $("#clubsGrid");
    if (!grid) return;

    if (!Array.isArray(state.clubs) || state.clubs.length === 0) {
      grid.innerHTML = `<div class="empty">No clubs loaded.</div>`;
      return;
    }

    grid.innerHTML = state.clubs.map(c => `
      <a class="club" href="${c.link || "#"}">
        <p class="name">${c.name || "—"}</p>
        <div class="meta2">${(c.division || "—").toUpperCase()}</div>
      </a>
    `).join("");
  }

  async function loadClubs() {
    const data = await fetchJSON(PATH + "clubs.json");
    state.clubs = Array.isArray(data?.clubs) ? data.clubs : [];
    renderClubs();
  }

  /* ==========================================================
     FROM THE STANDS
  ========================================================== */

  function makeId(dateISO, idx) {
    // GLB-TX-YYYYMMDD-##
    const ymd = dateISO.replaceAll("-", "");
    return `GLB-TX-${ymd}-${String(idx + 1).padStart(2, "0")}`;
  }

  async function loadTransmission() {
    const dateISO = toISODate(new Date());
    const data = await fetchJSON(PATH + "transmissions.json");
    const items = Array.isArray(data?.items) ? data.items : [];

    if (!items.length) {
      safeText($("#txQuote"), "No transmission filed.");
      safeText($("#txLocation"), "—");
      safeText($("#txId"), "—");
      safeText($("#txTag"), "FAN TRANSMISSION");
      return;
    }

    // Stable “random”: rotate daily but not every refresh
    const pick = (new Date(dateISO).getDate() + new Date(dateISO).getMonth()) % items.length;
    const item = items[pick];

    safeText($("#txTag"), (item.tag || "FAN TRANSMISSION").toUpperCase());
    safeText($("#txQuote"), `“${item.quote || "—"}”`);
    safeText($("#txLocation"), item.location || "—");
    safeText($("#txId"), makeId(dateISO, pick));
  }

  /* ==========================================================
     INIT
  ========================================================== */

  async function init() {
    setProvenanceTime();

    await Promise.allSettled([
      loadHero(),
      loadToday(),
      loadTransmission(),
      loadStandings(),
      loadFeatured(),
      loadClubs()
    ]);
  }

  init();
})();
