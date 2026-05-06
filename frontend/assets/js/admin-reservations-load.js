(() => {
  let reservationsById = new Map();

  document.addEventListener("DOMContentLoaded", async () => {
    requireAuth();
    if (!Auth.isAdmin()) {
      window.location.href = API.getDashboardPath(Auth.getUser()?.role);
      return;
    }

    initLogout();
    wireModal();

    await loadPendingReservations();
  });

  async function loadPendingReservations() {
    const list = document.querySelector(".request-list");
    if (!list) return;

    list.innerHTML = `<p style="padding:12px;color:#6b7280;">Loading pending reservationsâ€¦</p>`;

    try {
      const [res, studentsRes, roomsRes] = await Promise.all([
        API.getReservations({ status: "pending", per_page: 100 }),
        API.getUsers({ role: "student", per_page: 1 }),
        API.getRooms({ is_active: true, per_page: 1 }),
      ]);
      const items = res?.data?.items || [];
      reservationsById = new Map(items.map(r => [r.id, r]));

      setText("permissionRequestCount", studentsRes?.data?.pagination?.total ?? 0);
      setText("pendingReservationCount", res?.data?.pagination?.total ?? items.length);
      setText("totalRoomCount", roomsRes?.data?.pagination?.total ?? 0);

      if (!items.length) {
        list.innerHTML = `<p style="padding:12px;color:#6b7280;">No pending reservations.</p>`;
        return;
      }

      list.innerHTML = items.map(renderCard).join("");

      list.addEventListener("click", onListClick);
    } catch (err) {
      console.error("Failed to load reservations:", err);
      list.innerHTML = `<p style="padding:12px;color:#b91c1c;">Failed to load reservations.</p>`;
    }
  }

  function renderCard(r) {
    const roomCode = r.room?.code || r.room?.name || `Room #${r.room_id || "â€”"}`;
    const sub = `${roomCode} | ${r.course_section || "â€”"} | ${formatIsoDateShort(r.date)} | ${formatTimeRange(r.start_time, r.end_time)}`;

    return `
      <div class="request-card">
        <div class="request-info">
          <div class="request-name">${escapeHtml(r.requestor_name || "â€”")}</div>
          <div class="request-sub">${escapeHtml(sub)}</div>
          <a class="view-details" href="#" data-action="view" data-id="${r.id}">View Details Â»Â»Â»</a>
        </div>
        <div class="request-actions">
          <button class="btn-approve" type="button" data-action="approve" data-id="${r.id}">Accept</button>
          <button class="btn-decline" type="button" data-action="reject" data-id="${r.id}">Decline</button>
        </div>
      </div>
    `;
  }

  async function onListClick(e) {
    const el = e.target?.closest?.("[data-action]");
    if (!el) return;
    e.preventDefault();

    const id = (el.dataset.id || "").trim();
    if (!id) return;

    const action = el.dataset.action;
    if (action === "view") {
      openDetails(id);
      return;
    }

    el.disabled = true;
    try {
      if (action === "approve") {
        await API.approveReservation(id);
        removeCard(el);
        decrement("pendingReservationCount");
      } else if (action === "reject") {
        const note = prompt("Decline note (optional):", "") || "";
        await API.rejectReservation(id, note);
        removeCard(el);
        decrement("pendingReservationCount");
      }
    } catch (err) {
      alert(err?.error || "Action failed.");
      console.error(err);
    } finally {
      el.disabled = false;
    }
  }

  function removeCard(actionEl) {
    const card = actionEl.closest(".request-card");
    if (card) card.remove();
  }

  function openDetails(id) {
    const r = reservationsById.get(id);
    if (!r) return;

    setText("successStudentName", r.requestor_name || "â€”");
    setText("successSubject", r.course_section || "â€”");

    document.querySelectorAll(".campus-name").forEach(el => (el.textContent = r.room?.campus || "â€”"));
    document.querySelectorAll(".campus-building").forEach(el => (el.textContent = r.room?.building || "â€”"));

    setText("successDateBadge", formatIsoDateLong(r.date) || "â€”");
    setText("successTimeBadge", formatTimeRange(r.start_time, r.end_time) || "â€”");
    setText("successRoomBadge", r.room?.code || r.room?.name || "â€”");
    setText("successReasonBadge", r.purpose || "â€”");

    const modal = document.getElementById("successModal");
    if (modal) modal.classList.add("active");
  }

  function wireModal() {
    const modal = document.getElementById("successModal");
    if (!modal) return;

    modal.addEventListener("click", (e) => {
      if (e.target?.id === "successModal") closeModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });

    const closeBtn = modal.querySelector("[data-action='close-modal'], .btn-home");
    if (closeBtn) {
      closeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        closeModal();
      });
    }
  }

  function closeModal() {
    const modal = document.getElementById("successModal");
    if (modal) modal.classList.remove("active");
  }

  function initLogout() {
    document.querySelectorAll(".logout-btn").forEach(btn => {
      btn.addEventListener("click", () => API.logout());
    });
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function decrement(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const current = parseInt(el.textContent, 10);
    if (Number.isFinite(current) && current > 0) el.textContent = String(current - 1);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatIsoDateShort(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const yy = String(d.getFullYear());
    return `${mm}/${dd}/${yy}`;
  }

  function formatIsoDateLong(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  }

  function formatTimeRange(start24, end24) {
    if (!start24 || !end24) return "";
    return `${to12h(start24)} - ${to12h(end24)}`;
  }

  function to12h(hhmm) {
    const [hStr, mStr] = String(hhmm).split(":");
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return String(hhmm);
    const mer = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${String(m).padStart(2, "0")} ${mer}`;
  }
})();
