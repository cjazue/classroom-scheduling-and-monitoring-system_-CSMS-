document.addEventListener("DOMContentLoaded", async () => {
  requireAuth();
  initLogout();

  const grid        = document.getElementById("buildingGrid");
  const campusTitle = document.getElementById("campusTitle");


  const campusId   = getParam("campus_id")   || getPageContext("selectedCampus")?.id;
  const campusName = getParam("campus_name")
    ? decodeURIComponent(getParam("campus_name"))
    : (getPageContext("selectedCampus")?.name || "Campus");

  if (!campusId) {
    grid.innerHTML = `<p class="loading-text">No campus selected. <a href="/campus.html">Go back</a></p>`;
    return;
  }

  if (campusTitle) campusTitle.textContent = campusName;


  const campusLink = document.getElementById("campusLink");
  if (campusLink) campusLink.textContent = campusName;

  const BUILDING_IMAGES = {
    CEIT:      "assets/img/ceit.png",
    CABA:      "assets/img/caba.png",
    COED:      "assets/img/coed.png",
    SA:        "assets/img/admin.png",
    NB:        "assets/img/nb.png",
    CAS:       "assets/img/cas.png",
    "CPAG-BLDG": "assets/img/cpag.jpg",
  };

  grid.innerHTML = `<p class="loading-text">Loading buildings…</p>`;

  try {
    const res = await API.getBuildings(campusId);
    const buildings = res.data;

    if (!buildings.length) {
      grid.innerHTML = `<p class="loading-text">No buildings found for this campus.</p>`;
      return;
    }

    grid.innerHTML = buildings.map(b => `
      <article class="campus-card">
        <div class="campus-image-holder">
          <img class="campus-image"
               src="${BUILDING_IMAGES[b.code] || "assets/img/nb.png"}"
               alt="${b.name}"
               onerror="this.src='assets/img/nb.png'">
        </div>
        <h2>${b.name}</h2>
        <button
          class="card-action-btn"
          onclick="goToRooms('${b.id}', '${escapeJs(b.name)}', '${escapeJs(campusName)}')">
          View Rooms
        </button>
      </article>
    `).join("");

  } catch (err) {
    grid.innerHTML = `<p class="loading-text" style="color:red;">Failed to load buildings.</p>`;
    console.error(err);
  }
});

function goToRooms(buildingId, buildingName, campusName) {
  setPageContext("selectedBuilding", { id: buildingId, name: buildingName, campusName });
  window.location.href = `room.html?building_id=${buildingId}&building_name=${encodeURIComponent(buildingName)}&campus_name=${encodeURIComponent(campusName)}`;
}

function escapeJs(str) {
  return str.replace(/'/g, "\\'");
}

function initLogout() {
  document.querySelectorAll(".logout-btn").forEach(btn => {
    btn.addEventListener("click", () => API.logout());
  });
}
