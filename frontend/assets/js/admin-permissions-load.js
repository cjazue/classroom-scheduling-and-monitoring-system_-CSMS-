(() => {
  let usersById = new Map();

  document.addEventListener("DOMContentLoaded", async () => {
    requireAuth();
    if (!Auth.isAdmin()) {
      window.location.href = "dashboard.html";
      return;
    }

    initLogout();
    wireModal();
    await loadStudents();
  });

  async function loadStudents() {
    const list = document.querySelector(".request-list");
    if (!list) return;

    list.innerHTML = `<p style="padding:12px;color:#6b7280;">Loading requestsâ€¦</p>`;

    try {
      const [usersRes, pendingRes, roomsRes] = await Promise.all([
        API.getUsers({ role: "student", per_page: 100 }),
        API.getReservations({ status: "pending", per_page: 1 }),
        API.getRooms({ is_active: true, per_page: 1 }),
      ]);

      const users = usersRes?.data?.items || [];
      usersById = new Map(users.map(u => [u.id, u]));

      setText("permissionRequestCount", usersRes?.data?.pagination?.total ?? users.length);
      setText("pendingReservationCount", pendingRes?.data?.pagination?.total ?? 0);
      setText("totalRoomCount", roomsRes?.data?.pagination?.total ?? 0);

      if (!users.length) {
        list.innerHTML = `<p style="padding:12px;color:#6b7280;">No permission requests.</p>`;
        return;
      }

      list.innerHTML = users.map(renderCard).join("");
      list.addEventListener("click", onListClick);
    } catch (err) {
      console.error("Failed to load users:", err);
      list.innerHTML = `<p style="padding:12px;color:#b91c1c;">Failed to load permission requests.</p>`;
    }
  }

  function renderCard(u) {
    const sub = `Student â€¢ ${u.course_section || "â€”"}`;

    return `
      <div class="request-card">
        <div class="request-info">
          <div class="request-name">${escapeHtml(u.name || "â€”")}</div>
          <div class="request-sub">${escapeHtml(sub)}</div>
          <a class="view-details" href="#" data-action="view" data-id="${u.id}">View Details Â»Â»Â»</a>
        </div>
        <div class="request-actions">
          <button class="btn-approve" type="button" data-action="approve" data-id="${u.id}">Approve</button>
          <button class="btn-decline" type="button" data-action="decline" data-id="${u.id}">Decline</button>
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
        await API.updateUserRole(id, "authorized_user");
        removeCard(el);
        decrement("permissionRequestCount");
      } else if (action === "decline") {
        removeCard(el);
        decrement("permissionRequestCount");
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
    const u = usersById.get(id);
    if (!u) return;

    setText("successStudentName", u.name || "â€”");
    setText("successSection", u.course_section || "â€”");
    setText("successId", u.student_id || "â€”");
    setText("successEmail", u.email || "â€”");

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
})();
