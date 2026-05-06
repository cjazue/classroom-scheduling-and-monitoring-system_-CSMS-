document.addEventListener("DOMContentLoaded", async () => {
  requireAuth();
  initLogout();

  const user = Auth.getUser();
  if (user) {
    const greet = document.getElementById("dashGreeting");
    if (greet) greet.textContent = `Hello, ${user.name.split(" ")[0]}!`;
  }

  await loadReservations();
});

async function loadReservations(filterDate = null) {
  const params = {};

  if (filterDate) {
    params.date = filterDate; // YYYY-MM-DD
  }

  const user = Auth.getUser();
  if (user && user.role === "student") {
    params.status = "approved";
  }

  try {
    const res = await API.getReservations({ ...params, per_page: 50 });
    const reservations = res.data.items;
    renderReservations(reservations);
  } catch (err) {
    console.error("Failed to load reservations:", err);
  }
}

function renderReservations(reservations) {

  const byCampus = {};
  reservations.forEach(r => {
    const campus = r.room?.campus || "Unknown Campus";
    if (!byCampus[campus]) byCampus[campus] = [];
    byCampus[campus].push(r);
  });

  const campusCards = document.querySelectorAll(".campus-card[data-campus]");

  campusCards.forEach(card => {
    const list = card.querySelector(".reservation-list");
    if (list) {
      list.innerHTML = `<p class="no-schedule">No Schedule</p>`;
    }
  });

  if (!reservations.length) return;

  campusCards.forEach(card => {
    const campusKey = card.dataset.campus;  // "Main Campus", "Annex Campus", "CPAG Campus"
    const list      = card.querySelector(".reservation-list");
    if (!list) return;


    const matches = reservations.filter(r =>
      r.room?.campus?.toLowerCase().includes(campusKey.toLowerCase())
    );

    if (!matches.length) return;

    list.innerHTML = matches.map(r => `
      <div class="room">
        <span>
          <strong>${r.room?.code || "Room"}</strong><br>
          <small>${r.course_section}</small>
        </span>
        <span>
          ${r.start_time} – ${r.end_time}<br>
          <small class="status-badge status-${r.status}">${r.status}</small>
        </span>
        ${canCancel(r) ? `<button class="cancel-btn" onclick="cancelReservation('${r.id}')">✕</button>` : ""}
      </div>
    `).join("");
  });
}

function canCancel(reservation) {
  const user = Auth.getUser();
  if (!user) return false;
  if (user.role === "authorized_user") {
    return reservation.user_id === user.id &&
      (reservation.status === "pending" || reservation.status === "approved");
  }
  return (user.role === "admin" || user.role === "superadmin") &&
    (reservation.status === "pending" || reservation.status === "approved");
}

async function cancelReservation(id) {
  if (!confirm("Cancel this reservation?")) return;
  try {
    await API.cancelReservation(id);
    await loadReservations();
  } catch (err) {
    alert(err.error || "Could not cancel reservation.");
  }
}

function onDateSelected(formattedDate, isoDate) {
  loadReservations(isoDate);
}

function initLogout() {
  document.querySelectorAll(".logout-btn").forEach(btn => {
    btn.addEventListener("click", () => API.logout());
  });
}
