async function loadRoster(teamSlug) {
  const rosterPath = `data/rosters/${teamSlug}.json`;
  const imageBase = `assets/images/players/${teamSlug}/`;

  try {
    const response = await fetch(rosterPath);
    if (!response.ok) {
      throw new Error(`Could not load roster: ${rosterPath}`);
    }

    const data = await response.json();
    const rosterEl = document.getElementById("roster");
    const teamNameEl = document.getElementById("team-name");

    if (teamNameEl) {
      teamNameEl.textContent = data.team;
    }

    rosterEl.innerHTML = "";

    data.players.forEach((player) => {
      const card = document.createElement("article");
      card.className = "player-card";

      card.innerHTML = `
        <img
          class="player-headshot"
          src="${imageBase}${player.photo}"
          alt="${player.name}"
          loading="lazy"
        />
        <div class="player-info">
          <h3>${player.name}</h3>
          <p>${player.position}</p>
          <p>${player.bats}/${player.throws} • Age ${player.age}</p>
        </div>
      `;

      rosterEl.appendChild(card);
    });
  } catch (error) {
    console.error(error);
    const rosterEl = document.getElementById("roster");
    if (rosterEl) {
      rosterEl.innerHTML = `<p>Roster unavailable.</p>`;
    }
  }
}
