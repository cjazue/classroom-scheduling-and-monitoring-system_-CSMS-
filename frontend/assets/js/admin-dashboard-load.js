document.addEventListener("DOMContentLoaded", async () => {
  requireAuth();
  if (!Auth.isAdmin()) {
      window.location.href = API.getDashboardPath(Auth.getUser()?.role);
      return;
    }
  initLogout();

  try {
    const [pendingReservations, rooms, students] = await Promise.all([
      API.getReservations({ status: "pending", per_page: 1 }),
      API.getRooms({ is_active: true, per_page: 1 }),
      API.getUsers({ role: "student", per_page: 1 }),
    ]);

    setText("permissionRequestCount", students?.data?.pagination?.total ?? 0);
    setText("pendingReservationCount", pendingReservations?.data?.pagination?.total ?? 0);
    setText("totalRoomCount", rooms?.data?.pagination?.total ?? 0);
  } catch (err) {
    console.error("Failed to load admin dashboard stats:", err);
  }
});

function initLogout() {
  document.querySelectorAll(".logout-btn").forEach(btn => {
    btn.addEventListener("click", () => API.logout());
  });
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value);
}

