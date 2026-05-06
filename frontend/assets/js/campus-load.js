document.addEventListener("DOMContentLoaded", async () => {
  requireAuth();
  initLogout();

  const grid = document.getElementById("campusGrid");

  const CAMPUS_IMAGES = {
    MAIN:  "assets/img/maysan.jpg",
    ANNEX: "assets/img/annex.jpg",
    CPAG:  "assets/img/cpag.jpg",
  };

  grid.innerHTML = `<p class="loading-text">Loading campuses…</p>`;

  try {
    const res = await API.getCampuses();
    const campuses = res.data;

    if (!campuses.length) {
      grid.innerHTML = `<p class="loading-text">No campuses found.</p>`;
      return;
    }

    grid.innerHTML = campuses.map(campus => `
      <article class="campus-card">
        <div class="campus-image-holder">
          <img class="campus-image"
               src="${CAMPUS_IMAGES[campus.code] || "assets/img/maysan.jpg"}"
               alt="${campus.name}"
               onerror="this.src='assets/img/maysan.jpg'">
        </div>
        <h2>${campus.name}</h2>
        <button
          class="card-action-btn"
          onclick="goToBuildings('${campus.id}', '${escapeHtml(campus.name)}')">
          View Buildings
        </button>
      </article>
    `).join("");

  } catch (err) {
    grid.innerHTML = `<p class="loading-text" style="color:red;">Failed to load campuses. Is the backend running?</p>`;
    console.error(err);
  }
});

function goToBuildings(campusId, campusName) {
  setPageContext("selectedCampus", { id: campusId, name: campusName });
  window.location.href = `building.html?campus_id=${campusId}&campus_name=${encodeURIComponent(campusName)}`;
}

function escapeHtml(str) {
  return str.replace(/'/g, "\\'").replace(/"/g, "&quot;");
}

function initLogout() {
  document.querySelectorAll(".logout-btn").forEach(btn => {
    btn.addEventListener("click", () => API.logout());
  });
}
