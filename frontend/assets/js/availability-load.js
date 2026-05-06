(() => {
  let allRooms = [];

  document.addEventListener("DOMContentLoaded", async () => {
    requireAuth();
    initLogout();

    const view = getView();

    try {
      const res = await API.getRooms({ is_active: true, per_page: 100 });
      allRooms = res?.data?.items || [];

      const occupied = allRooms.filter(r => r.is_occupied);
      const available = allRooms.filter(r => !r.is_occupied);

      setText("occupiedCount", occupied.length);
      setText("availableCount", available.length);
      setText("totalCount", allRooms.length);

      renderTable(view === "occupied" ? occupied : available);
      wireSearch();
    } catch (err) {
      console.error("Failed to load rooms:", err);
      renderError("Failed to load rooms. Is the backend running?");
    }
  });

  function getView() {
    const attr = document.body?.dataset?.roomView;
    if (attr) return attr;
    const path = (window.location.pathname || "").toLowerCase();
    if (path.includes("occupied")) return "occupied";
    return "available";
  }

  function renderTable(rooms) {
    const shell = document.querySelector(".table-shell");
    if (!shell) return;

    shell.querySelectorAll(".table-row").forEach(el => el.remove());

    if (!rooms.length) {
      shell.insertAdjacentHTML(
        "beforeend",
        `<div class="table-row"><span style="grid-column:1/-1;">No rooms found.</span></div>`
      );
      return;
    }

    const rowsHtml = rooms.map(roomToRow).join("");
    shell.insertAdjacentHTML("beforeend", rowsHtml);
    colorRows();
  }

  function roomToRow(r) {
    const building = r.building_code || r.building || "—";
    const floor = r.floor ?? "—";
    const room = r.code || r.name || "—";

    const now = new Date();
    const dateLabel = now.toLocaleDateString(undefined, { year: "numeric", month: "2-digit", day: "2-digit" });

    const timeLabel = r.is_occupied && r.current_reservation
      ? `${to12h(r.current_reservation.start_time)} - ${to12h(r.current_reservation.end_time)}`
      : "—";

    return `
      <div class="table-row">
        <span>${escapeHtml(dateLabel)}</span>
        <span>${escapeHtml(String(building))}</span>
        <span>${escapeHtml(String(floor))}</span>
        <span>${escapeHtml(String(room))}</span>
        <span>${escapeHtml(timeLabel)}</span>
      </div>
    `;
  }

  function renderError(message) {
    const shell = document.querySelector(".table-shell");
    if (!shell) return;
    shell.querySelectorAll(".table-row").forEach(el => el.remove());
    shell.insertAdjacentHTML(
      "beforeend",
      `<div class="table-row"><span style="grid-column:1/-1;color:#b91c1c;">${escapeHtml(message)}</span></div>`
    );
  }

  function wireSearch() {
    const searchInput = document.querySelector(".search-box input");
    if (!searchInput) return;

    searchInput.addEventListener("input", () => {
      const value = (searchInput.value || "").trim().toLowerCase();
      document.querySelectorAll(".table-row").forEach(row => {
        const rowText = row.textContent.toLowerCase();
        row.style.display = !value || rowText.includes(value) ? "grid" : "none";
      });
    });
  }

  function colorRows() {
    document.querySelectorAll(".table-row").forEach(row => {
      const spans = row.querySelectorAll("span");
      const building = (spans[1]?.textContent || "").trim().toUpperCase();
      row.classList.remove("green", "blue");
      if (building === "NB") row.classList.add("green");
      if (building === "CAS") row.classList.add("blue");
    });
  }

  function initLogout() {
    document.querySelectorAll(".logout-btn").forEach(btn => {
      btn.addEventListener("click", () => API.logout());
    });
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function to12h(hhmm) {
    const [hStr, mStr] = String(hhmm || "").split(":");
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return "—";
    const mer = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${String(m).padStart(2, "0")} ${mer}`;
  }
})();

