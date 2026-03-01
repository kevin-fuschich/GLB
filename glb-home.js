(function () {
  const $ = (sel) => document.querySelector(sel);
  const PATH = "data/";

  async function fetchJSON(path) {
    try {
      const res = await fetch(path, { cache: "no-store" });
      if (!res.ok) throw new Error();
      return await res.json();
    } catch {
      return null;
    }
  }

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

  function makeId(dateISO, idx) {
    const ymd = dateISO.replaceAll("-", "");
    return `GLB-TX-${ymd}-${String(idx + 1).padStart(2, "0")}`;
  }

  /* ==========================================================
     TRANSMISSION (WITH IMAGE)
  ========================================================== */

  async function loadTransmission() {
    const dateISO = toISODate(new Date());
    const data = await fetchJSON(PATH + "transmissions.json");
    const items = data?.items || [];

    if (!items.length) return;

    // Rotate based on date (stable per day)
    const pick = new Date().getDate() % items.length;
    const item = items[pick];

    safeText($("#txTag"), (item.tag || "FAN TRANSMISSION").toUpperCase());
    safeText($("#txQuote"), `“${item.quote}”`);
    safeText($("#txLocation"), item.location);
    safeText($("#txId"), makeId(dateISO, pick));

    const img = $("#txImage");

    if (img && item.image) {
      img.src = item.image;
      img.alt = `Transmission — ${item.location}`;
      img.style.display = "block";
    } else if (img) {
      img.style.display = "none";
    }
  }

  /* ==========================================================
     INIT
  ========================================================== */

  async function init() {
    await loadTransmission();
  }

  init();

})();
