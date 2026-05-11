/* Super Admin -> Overall Users page wiring.
 *
 * Binds `frontend/templates/superadmin/Users.html` to:
 * - GET /api/superadmin/users
 * - GET /api/superadmin/metrics
 */

(function () {
  'use strict';

  const usersById = new Map();
  let allUsers = [];

  function $(id) {
    return document.getElementById(id);
  }

  function onOverallUsersPage() {
    const p = String(window.location.pathname || '').toLowerCase();
    return p.includes('/superadmin/') && p.endsWith('/users.html');
  }

  function displayName(full) {
    if (window.CSMS && window.CSMS.format && typeof window.CSMS.format.displayName === 'function') {
      return window.CSMS.format.displayName(full);
    }
    return String(full || '').trim();
  }

  function roleLabel(role) {
    const r = String(role || '').toLowerCase();
    if (r === 'superadmin') return 'Super Admin';
    if (r === 'admin') return 'Admin';
    if (r === 'authorized_user') return 'Authorized User';
    if (r === 'student') return 'Student';
    return role ? String(role) : 'User';
  }

  function roleOrderIndex(role) {
    const r = String(role || '').toLowerCase();
    const order = ['superadmin', 'admin', 'authorized_user', 'student'];
    const idx = order.indexOf(r);
    return idx === -1 ? 999 : idx;
  }

  function sectionKeyFor(u) {
    const cs = u && u.course_section ? String(u.course_section).trim().toUpperCase() : '';
    return cs || 'UNASSIGNED';
  }

  function sectionLabel(key) {
    return key === 'UNASSIGNED' ? 'Unassigned / No Section' : key;
  }

  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value == null ? '—' : String(value);
  }

  function groupTitle(text) {
    const t = document.createElement('div');
    t.className = 'group-title';
    t.textContent = text;
    return t;
  }

  function subgroupTitle(text) {
    const t = document.createElement('div');
    t.className = 'subgroup-title';
    t.textContent = text;
    return t;
  }

  function renderCard(u) {
    const card = document.createElement('div');
    card.className = 'request-card';
    card.dataset.userId = u.id;

    card.dataset.searchText = `${u.name || ''} ${u.email || ''} ${u.role || ''} ${u.course_section || ''} ${u.student_id || ''}`.toLowerCase();

    const info = document.createElement('div');
    info.className = 'request-info';

    const name = document.createElement('div');
    name.className = 'request-name';
    name.textContent = displayName(u.name) || (u.name || '—');

    const sub = document.createElement('div');
    sub.className = 'request-sub';
    const role = roleLabel(u.role);
    const cs = u.course_section ? String(u.course_section).trim().toUpperCase() : '—';
    const active = (u.is_active === 0 || u.is_active === false) ? ' (inactive)' : '';
    sub.textContent = `${role} | ${cs}${active}`;

    const view = document.createElement('a');
    view.className = 'view-details';
    view.href = '#';
    view.textContent = 'View Details ›››';
    view.addEventListener('click', function (e) {
      e.preventDefault();
      openDetails(u.id);
    });

    info.appendChild(name);
    info.appendChild(sub);
    info.appendChild(view);

    card.appendChild(info);

    card.addEventListener('click', function (e) {
      // Avoid double-handling when clicking the link.
      if (e && e.target && e.target.closest && e.target.closest('a')) return;
      openDetails(u.id);
    });

    return card;
  }

  function openDetails(userId) {
    const u = usersById.get(userId);
    if (!u) return;

    const empty = $('userDetailsEmpty');
    const shell = $('userDetails');
    if (!shell) return;

    if (empty) empty.style.display = 'none';
    shell.style.display = 'grid';
    shell.innerHTML = '';

    function addRow(k, v) {
      const row = document.createElement('div');
      row.className = 'row';

      const kk = document.createElement('div');
      kk.className = 'k';
      kk.textContent = k;

      const vv = document.createElement('div');
      vv.className = 'v';
      vv.textContent = v || '—';

      row.appendChild(kk);
      row.appendChild(vv);
      shell.appendChild(row);
    }

    addRow('Name', displayName(u.name) || u.name);
    addRow('Email', u.email);
    addRow('Role', roleLabel(u.role));
    addRow('Student ID', u.student_id);
    addRow('Course/Section', u.course_section ? String(u.course_section).trim().toUpperCase() : '');
    addRow('Status', (u.is_active === 0 || u.is_active === false) ? 'Inactive' : 'Active');
    addRow('User ID', u.id);
  }

  function renderGroups(users) {
    const list = $('overallUserList');
    if (!list) return;

    list.innerHTML = '';

    if (!users || !users.length) {
      const empty = document.createElement('div');
      empty.style.padding = '12px';
      empty.style.color = '#ffffff';
      empty.style.opacity = '0.9';
      empty.style.fontWeight = '800';
      empty.textContent = 'No users found.';
      list.appendChild(empty);
      return;
    }

    // Group by role then by section.
    const byRole = new Map();
    users.forEach((u) => {
      const role = String(u.role || '').toLowerCase() || 'unknown';
      if (!byRole.has(role)) byRole.set(role, []);
      byRole.get(role).push(u);
    });

    const roles = Array.from(byRole.keys()).sort((a, b) => roleOrderIndex(a) - roleOrderIndex(b));

    roles.forEach((role) => {
      const roleUsers = byRole.get(role) || [];

      // Role header.
      list.appendChild(groupTitle(`${roleLabel(role)} (${roleUsers.length})`));

      const bySection = new Map();
      roleUsers.forEach((u) => {
        const key = sectionKeyFor(u);
        if (!bySection.has(key)) bySection.set(key, []);
        bySection.get(key).push(u);
      });

      const sections = Array.from(bySection.keys()).sort((a, b) => {
        if (a === 'UNASSIGNED') return 1;
        if (b === 'UNASSIGNED') return -1;
        return a.localeCompare(b);
      });

      sections.forEach((sectionKey) => {
        const sectionUsers = bySection.get(sectionKey) || [];
        sectionUsers.sort((x, y) => displayName(x.name).localeCompare(displayName(y.name)));

        list.appendChild(subgroupTitle(`${sectionLabel(sectionKey)} (${sectionUsers.length})`));
        sectionUsers.forEach((u) => list.appendChild(renderCard(u)));
      });
    });
  }

  function applyFilter() {
    const q = String(($('userSearch') && $('userSearch').value) || '').trim().toLowerCase();
    if (!q) {
      renderGroups(allUsers);
      return;
    }

    const filtered = allUsers.filter((u) => {
      const hay = `${u.name || ''} ${u.email || ''} ${u.role || ''} ${u.course_section || ''} ${u.student_id || ''}`.toLowerCase();
      return hay.includes(q);
    });
    renderGroups(filtered);
  }

  async function fetchAllUsers() {
    if (!window.CSMS || !window.CSMS.api || typeof window.CSMS.api.request !== 'function') return [];

    const out = [];
    for (let page = 1; page <= 200; page++) {
      const resp = await window.CSMS.api.request(`/api/superadmin/users?per_page=100&page=${page}`, { method: 'GET' });
      const payload = resp && resp.data ? resp.data : null;
      const items = payload && Array.isArray(payload.items) ? payload.items : [];
      out.push(...items);

      const hasNext = payload && payload.pagination ? !!payload.pagination.has_next : false;
      if (!hasNext) break;
    }
    return out;
  }

  async function loadMetrics() {
    if (!window.CSMS || !window.CSMS.api || typeof window.CSMS.api.request !== 'function') return;
    try {
      const resp = await window.CSMS.api.request('/api/superadmin/metrics', { method: 'GET' });
      const data = resp && resp.data ? resp.data : null;
      if (!data) return;
      setText('statOverallUsers', data.users_total);
    } catch {
      // Non-fatal.
    }
  }

  async function loadUsers() {
    if (!window.CSMS || !window.CSMS.api || typeof window.CSMS.api.request !== 'function') return;

    const list = $('overallUserList');
    if (list) {
      list.innerHTML = '';
      const loading = document.createElement('div');
      loading.style.padding = '12px';
      loading.style.color = '#ffffff';
      loading.style.opacity = '0.9';
      loading.style.fontWeight = '800';
      loading.textContent = 'Loading users...';
      list.appendChild(loading);
    }

    try {
      const users = await fetchAllUsers();
      allUsers = Array.isArray(users) ? users : [];
      usersById.clear();
      allUsers.forEach((u) => {
        if (u && u.id) usersById.set(u.id, u);
      });

      applyFilter();
    } catch (e) {
      if (list) list.innerHTML = '';
      window.alert(e && e.message ? e.message : 'Failed to load users.');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!onOverallUsersPage()) return;

    const search = $('userSearch');
    if (search) search.addEventListener('keyup', applyFilter);

    loadMetrics();
    loadUsers();
  });
})();
