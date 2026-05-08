/* Authorized User dashboard -> Reservation status + details.
 *
 * Renders "My Reservations" on `frontend/auth/dashboard.html` using:
 * - GET /api/reservations  (role-filtered to current authorized user)
 *
 * Polls periodically so status updates (pending -> approved/rejected) appear.
 */

(function () {
  'use strict';

  function onDashboard() {
    const p = String(window.location.pathname || '').toLowerCase();
    return p.includes('/auth/') && p.endsWith('/dashboard.html');
  }

  function fmt2(n) {
    return String(n).padStart(2, '0');
  }

  function to12h(hhmm) {
    if (!hhmm) return '—';
    const h = parseInt(String(hhmm).slice(0, 2), 10);
    const m = parseInt(String(hhmm).slice(3, 5), 10) || 0;
    if (!Number.isFinite(h)) return String(hhmm);
    const ap = h < 12 ? 'AM' : 'PM';
    const hr = h % 12 || 12;
    return `${hr}:${fmt2(m)} ${ap}`;
  }

  function prettyDate(iso) {
    if (!iso) return '—';
    const d = new Date(String(iso) + 'T00:00:00');
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function roomLabel(room, fallbackId) {
    const code = room && room.code ? room.code : (fallbackId || 'Room');
    const building = room && room.building_code ? room.building_code : (room && room.building ? room.building : '');
    return building ? `${building} - ${code}` : code;
  }

  function statusClass(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'approved') return 'res-status res-status--approved';
    if (s === 'pending') return 'res-status res-status--pending';
    if (s === 'rejected') return 'res-status res-status--rejected';
    if (s === 'cancelled') return 'res-status res-status--cancelled';
    return 'res-status';
  }

  function parseLocalDateTime(dateIso, hhmm) {
    if (!dateIso || !hhmm) return null;
    const dt = new Date(String(dateIso) + 'T' + String(hhmm) + ':00');
    if (Number.isNaN(dt.getTime())) return null;
    return dt;
  }

  function isReservationPast(r) {
    const end = parseLocalDateTime(r && r.date, r && r.end_time);
    if (end) return end.getTime() <= Date.now();

    // Fallback: date-only comparison.
    const d = new Date(String(r && r.date) + 'T00:00:00');
    if (Number.isNaN(d.getTime())) return false;
    const today = new Date();
    const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const tt = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    return dd < tt;
  }

  function reservationStartMs(r) {
    const start = parseLocalDateTime(r && r.date, r && r.start_time);
    return start ? start.getTime() : Number.POSITIVE_INFINITY;
  }

  function renderCampusStatuses(items) {
    const cards = Array.from(document.querySelectorAll('.campus-card[data-campus-code]'));
    if (!cards.length) return;

    const upcomingByCampus = new Map();
    (items || []).forEach(function (r) {
      if (!r || !r.id) return;
      if (isReservationPast(r)) return;
      const stKey = String(r.status || '').toLowerCase();
      if (stKey === 'rejected' || stKey === 'cancelled') return;
      const code = r.room && r.room.campus_code ? String(r.room.campus_code).toUpperCase() : '';
      if (!code) return;
      if (!upcomingByCampus.has(code)) upcomingByCampus.set(code, []);
      upcomingByCampus.get(code).push(r);
    });

    upcomingByCampus.forEach(function (arr) {
      arr.sort(function (a, b) {
        return reservationStartMs(a) - reservationStartMs(b);
      });
    });

    cards.forEach(function (card) {
      const code = String(card.dataset.campusCode || '').toUpperCase();
      const statusEl = card.querySelector('[data-campus-status]');
      if (!statusEl) return;

      const list = upcomingByCampus.get(code) || [];
      if (!list.length) {
        statusEl.textContent = 'No reservation';
        return;
      }

      const r = list[0];
      const st = String(r.status || '—').toUpperCase();
      const dateLabel = prettyDate(r.date);
      statusEl.textContent = `${st} • ${dateLabel}`;
    });
  }

  function renderCard(r) {
    const room = r.room || null;

    const card = document.createElement('div');
    card.className = 'res-card';

    const top = document.createElement('div');
    top.className = 'res-top';

    const title = document.createElement('div');
    title.className = 'res-room';
    title.textContent = roomLabel(room, r.room_id);

    const st = document.createElement('div');
    st.className = statusClass(r.status);
    st.textContent = (r.status || '—').toUpperCase();

    top.appendChild(title);
    top.appendChild(st);

    const meta = document.createElement('div');
    meta.className = 'res-meta';

    const date = document.createElement('div');
    date.innerHTML = `Date: <span>${prettyDate(r.date)}</span>`;

    const time = document.createElement('div');
    time.innerHTML = `Time: <span>${to12h(r.start_time)} - ${to12h(r.end_time)}</span>`;

    const cs = document.createElement('div');
    cs.innerHTML = `Course/Section: <span>${r.course_section || '—'}</span>`;

    const purpose = document.createElement('div');
    purpose.innerHTML = `Purpose: <span>${r.purpose || '—'}</span>`;

    meta.appendChild(date);
    meta.appendChild(time);
    meta.appendChild(cs);
    meta.appendChild(purpose);

    card.appendChild(top);
    card.appendChild(meta);

    return card;
  }

  async function loadMyReservations() {
    if (!window.CSMS || !window.CSMS.api || typeof window.CSMS.api.request !== 'function') return;

    const empty = document.getElementById('myReservationsEmpty');
    const list = document.getElementById('myReservationsList');
    if (!list) return;

    list.innerHTML = '';

    try {
      const resp = await window.CSMS.api.request('/api/reservations?per_page=50', { method: 'GET' });
      const payload = resp && resp.data ? resp.data : null;
      const items = payload && Array.isArray(payload.items) ? payload.items : [];

      renderCampusStatuses(items);

      if (!items.length) {
        if (empty) empty.style.display = 'block';
        return;
      }

      if (empty) empty.style.display = 'none';
      items.forEach(function (r) {
        if (!r || !r.id) return;
        list.appendChild(renderCard(r));
      });
    } catch {
      // Keep dashboard usable even if reservations fail.
      renderCampusStatuses([]);
      if (empty) empty.style.display = 'block';
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!onDashboard()) return;
    loadMyReservations();
    setInterval(loadMyReservations, 15000);
  });
})();
