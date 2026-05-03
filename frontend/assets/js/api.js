const API_BASE = "http://localhost:5000/api";

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

  const data = await res.json();
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

  async register(payload) {
    return apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
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