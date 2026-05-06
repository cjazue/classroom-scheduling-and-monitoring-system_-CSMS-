function resolveApiBase() {
  // Allow overriding API base in multiple ways:
  // 1) <meta name="api-base" content="http://.../api">
  // 2) window.API_BASE (set by an inline script before this file loads)
  // 3) localStorage.API_BASE (manual override for dev)
  // 4) same-origin /api when served by Flask
  const meta = document.querySelector('meta[name="api-base"]')?.getAttribute("content");
  const override = (meta || window.API_BASE || localStorage.getItem("API_BASE") || "").trim();
  if (override) return override.replace(/\/+$/, "");

  // When opened via file://, origin becomes "null". Default to local Flask.
  if (!window.location.origin || window.location.origin === "null") {
    return "http://localhost:5000/api";
  }

  return `${window.location.origin}/api`;
}

const API_BASE = resolveApiBase();

const Auth = {
  getToken()  { return localStorage.getItem("plv_token"); },
  setToken(t) { localStorage.setItem("plv_token", t); },
  getUser()   {
    try { return JSON.parse(localStorage.getItem("plv_user")); }
    catch { return null; }
  },
  setUser(u)  { localStorage.setItem("plv_user", JSON.stringify(u)); },
  clear() {
    localStorage.removeItem("plv_token");
    localStorage.removeItem("plv_refresh_token");
    localStorage.removeItem("plv_user");
  },
  isLoggedIn() { return !!this.getToken(); },
  isAdmin()          { const u = this.getUser(); return u && (u.role === "admin" || u.role === "superadmin"); },
  isAuthorizedUser() { const u = this.getUser(); return u && (u.role === "authorized_user" || u.role === "admin" || u.role === "superadmin"); },
  isSuperadmin()     { const u = this.getUser(); return u && u.role === "superadmin"; },
  canReserve()       { const u = this.getUser(); return u && ["authorized_user", "admin", "superadmin"].includes(u.role); },
};


async function apiFetch(path, options = {}) {
  const token = Auth.getToken();
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });


  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers["Authorization"] = `Bearer ${Auth.getToken()}`;
      const retry = await fetch(`${API_BASE}${path}`, { ...options, headers });
      if (!retry.ok) throw await retry.json();
      return retry.json();
    }
    Auth.clear();
    window.location.href = "loginpage.html";
    return;
  }

  const text = await res.text();
  // If server returns HTML (e.g., dev error page / missing route), surface a readable message.
  if (text && text.trim().startsWith("<!DOCTYPE")) {
    // Backend returned HTML (404/500 page). For login UI, treat this as an invalid email.
    throw { error: "Invalid email" };
  }

  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw data;
  return data;


}

async function tryRefresh() {
  const refresh = localStorage.getItem("plv_refresh_token");
  if (!refresh) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${refresh}`,
      },
    });
    if (!res.ok) return false;
    const data = await res.json();
    Auth.setToken(data.data.access_token);
    return true;
  } catch {
    return false;
  }
}

function requireAuth() {
  if (!Auth.isLoggedIn()) {
    window.location.href = "loginpage.html";
  }
}

// Meth

const API = {

  // Auth
  async login(email, password) {
    return apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  async logout() {
    try { await apiFetch("/auth/logout", { method: "POST" }); } catch {}
    Auth.clear();
    window.location.href = "homepage.html";
  },

  async getMe() {
    return apiFetch("/auth/me");
  },

  async updateMe(payload) {
    return apiFetch("/auth/me", { method: "PATCH", body: JSON.stringify(payload) });
  },

  // Campuses
  async getCampuses() {
    return apiFetch("/campuses");
  },

  // Buildings
  async getBuildings(campusId) {
    const qs = campusId ? `?campus_id=${campusId}` : "";
    return apiFetch(`/buildings${qs}`);
  },

  // Rooms
  async getRooms(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/rooms${qs ? "?" + qs : ""}`);
  },

  async getRoomSchedule(roomId, date) {
    const qs = date ? `?date=${date}` : "";
    return apiFetch(`/rooms/${roomId}/schedule${qs}`);
  },

  // Reservations
  async getReservations(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/reservations${qs ? "?" + qs : ""}`);
  },

  async createReservation(payload) {
    return apiFetch("/reservations", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async cancelReservation(id) {
    return apiFetch(`/reservations/${id}/cancel`, { method: "PATCH" });
  },

  async approveReservation(id) {
    return apiFetch(`/reservations/${id}/approve`, { method: "PATCH" });
  },

  async rejectReservation(id, review_note = "") {
    return apiFetch(`/reservations/${id}/reject`, {
      method: "PATCH",
      body: JSON.stringify({ review_note }),
    });
  },

  // Admin
  async getUsers(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/admin/users${qs ? "?" + qs : ""}`);
  },

  async updateUserRole(userId, role) {
    return apiFetch(`/admin/users/${userId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
  },
};


function getParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

function setPageContext(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getPageContext(key) {
  try { return JSON.parse(localStorage.getItem(key)); }
  catch { return null; }
}
