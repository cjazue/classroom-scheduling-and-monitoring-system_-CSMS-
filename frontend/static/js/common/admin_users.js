/* Admin -> User Management page wiring.
 *
 * Binds `frontend/admin/Users.html` to:
 * - GET    /api/admin/users
 * - POST   /api/admin/users
 * - PATCH  /api/admin/users/:id
 * - DELETE /api/admin/users/:id
 * - PATCH  /api/admin/users/:id/role (quick authorize)
 */

(function () {
  'use strict';

  const usersById = new Map();
  let selectedUserId = null;

  function $(id) {
    return document.getElementById(id);
  }

  function onUsersPage() {
    const p = String(window.location.pathname || '').toLowerCase();
    return p.includes('/admin/') && p.endsWith('/users.html');
  }

  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value == null ? '—' : String(value);
  }

  function formatDisplayName(full) {
    if (window.CSMS && window.CSMS.format && typeof window.CSMS.format.displayName === 'function') {
      return window.CSMS.format.displayName(full);
    }

    const s = String(full || '').trim().replace(/\s+/g, ' ');
    if (!s) return '';

    // Support "LAST, FIRST MIDDLE"
    if (s.includes(',')) {
      const parts = s.split(',').map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const last = parts[0];
        const rest = parts.slice(1).join(' ');
        return formatDisplayName(`${rest} ${last}`);
      }
    }

    const parts = s.split(' ').filter(Boolean);
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return `${parts[0]} ${parts[1]}`;

    const first = parts[0];
    const last = parts[parts.length - 1];
    const middle = parts[1] || '';
    const mi = middle ? String(middle).replace(/[^a-zA-Z]/g, '').slice(0, 1).toUpperCase() : '';
    return mi ? `${first} ${mi}. ${last}` : `${first} ${last}`;
  }

  function showForm(show) {
    const form = $('userForm');
    const empty = $('userEmpty');
    if (form) form.style.display = show ? 'grid' : 'none';
    if (empty) empty.style.display = show ? 'none' : 'block';
  }

  function fillForm(u, isCreate) {
    $('userId').value = isCreate ? '' : (u && u.id ? u.id : '');
    $('userName').value = u && u.name ? u.name : '';
    $('userEmail').value = u && u.email ? u.email : '';
    $('userStudentId').value = u && u.student_id ? u.student_id : '';
    $('userCourseSection').value = u && u.course_section ? u.course_section : '';
    $('userRole').value = u && u.role ? u.role : 'student';
    $('userIsActive').checked = isCreate ? true : !!(u && u.is_active);
    $('userPassword').value = '';

    const delBtn = $('btnDeleteUser');
    if (delBtn) delBtn.style.display = isCreate ? 'none' : 'inline-block';

    setText('userPanelTitle', isCreate ? 'Create User' : 'Edit User');
    setText('userLabel', isCreate ? 'New' : (u && u.id ? u.id : '—'));
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
    name.textContent = u.name || '—';

    name.textContent = formatDisplayName(u.name) || name.textContent;

    const sub = document.createElement('div');
    sub.className = 'request-sub';
    const role = u.role ? u.role.replace('_', ' ') : 'user';
    const cs = u.course_section ? u.course_section : '—';
    sub.textContent = `${role} | ${cs}`;

    const view = document.createElement('a');
    view.className = 'view-details';
    view.href = '#';
    view.textContent = 'View Details ›››';
    view.addEventListener('click', function (e) {
      e.preventDefault();
      openUser(u.id);
    });

    info.appendChild(name);
    info.appendChild(sub);
    info.appendChild(view);

    const actions = document.createElement('div');
    actions.className = 'request-actions';

    if (u.role === 'student') {
      const authBtn = document.createElement('button');
      authBtn.className = 'btn-approve';
      authBtn.textContent = 'Authorize';
      authBtn.addEventListener('click', function () {
        quickAuthorize(u.id);
      });
      actions.appendChild(authBtn);
    }

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-decline';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', function () {
      openUser(u.id);
    });
    actions.appendChild(editBtn);

    card.appendChild(info);
    card.appendChild(actions);
    return card;
  }

  function groupKeyFor(u) {
    const cs = u && u.course_section ? String(u.course_section).trim().toUpperCase() : '';
    return cs || 'UNASSIGNED';
  }

  function groupLabel(key) {
    if (!key || key === 'UNASSIGNED') return 'Unassigned';
    return key;
  }

  function renderGroup(sectionKey, users) {
    const group = document.createElement('div');
    group.className = 'user-group';
    group.dataset.section = sectionKey;

    const header = document.createElement('button');
    header.type = 'button';
    header.className = 'user-group-header';

    const title = document.createElement('span');
    title.textContent = groupLabel(sectionKey);

    const count = document.createElement('span');
    count.className = 'user-group-count';
    count.textContent = String(users.length);

    header.appendChild(title);
    header.appendChild(count);
    header.addEventListener('click', function () {
      group.classList.toggle('collapsed');
    });

    const items = document.createElement('div');
    items.className = 'user-group-items';
    users.forEach(function (u) {
      items.appendChild(renderCard(u));
    });

    group.appendChild(header);
    group.appendChild(items);
    return group;
  }

  function applySearchFilter() {
    const input = $('userSearch');
    const list = $('userList');
    if (!input || !list) return;
    const value = String(input.value || '').trim().toLowerCase();

    // When searching, expand groups so matches are visible.
    if (value) {
      list.querySelectorAll('.user-group').forEach(function (g) {
        g.classList.remove('collapsed');
      });
    }

    list.querySelectorAll('.request-card').forEach(function (card) {
      const hay = String(card.dataset.searchText || '').toLowerCase();
      const match = !value || hay.includes(value);
      card.style.display = match ? 'flex' : 'none';
    });

    list.querySelectorAll('.user-group').forEach(function (g) {
      const anyVisible = Array.from(g.querySelectorAll('.request-card')).some(function (c) {
        return c.style.display !== 'none';
      });
      g.style.display = anyVisible ? 'flex' : 'none';
    });
  }

  async function loadStats() {
    if (!window.CSMS || !window.CSMS.api || typeof window.CSMS.api.request !== 'function') return;
    try {
      const metricsResp = await window.CSMS.api.request('/api/admin/metrics', { method: 'GET' });
      const m = metricsResp && metricsResp.data ? metricsResp.data : null;
      if (m) {
        if (typeof m.users_total === 'number') setText('statTotalUsers', m.users_total);
        if (typeof m.rooms_total === 'number') setText('statTotalRooms', m.rooms_total);
        if (typeof m.reservations_pending === 'number') setText('statPendingReservations', m.reservations_pending);
        return;
      }
    } catch {
      // Fall back to lightweight pagination totals.
      try {
        const [usersResp, roomsResp, pendingResp] = await Promise.all([
          window.CSMS.api.request('/api/admin/users?per_page=1', { method: 'GET' }),
          window.CSMS.api.request('/api/rooms?is_active=true&per_page=1', { method: 'GET' }),
          window.CSMS.api.request('/api/reservations?status=pending&per_page=1', { method: 'GET' }),
        ]);

        const usersTotal =
          usersResp && usersResp.data && usersResp.data.pagination ? usersResp.data.pagination.total : null;
        const totalRooms =
          roomsResp && roomsResp.data && roomsResp.data.pagination ? roomsResp.data.pagination.total : null;
        const pending =
          pendingResp && pendingResp.data && pendingResp.data.pagination ? pendingResp.data.pagination.total : null;

        if (typeof usersTotal === 'number') setText('statTotalUsers', usersTotal);
        if (typeof totalRooms === 'number') setText('statTotalRooms', totalRooms);
        if (typeof pending === 'number') setText('statPendingReservations', pending);
      } catch {
        // Non-fatal.
      }
    }
  }

  async function fetchAllUsers() {
    const all = [];
    let page = 1;

    // Guard against unexpected pagination loops.
    for (let i = 0; i < 200; i++) {
      const resp = await window.CSMS.api.request(`/api/admin/users?per_page=100&page=${page}`, { method: 'GET' });
      const payload = resp && resp.data ? resp.data : null;
      const items = payload && Array.isArray(payload.items) ? payload.items : [];
      all.push.apply(all, items);

      const hasNext = !!(payload && payload.pagination && payload.pagination.has_next);
      if (!hasNext) break;
      page += 1;
    }

    return all;
  }

  async function loadUsers() {
    if (!window.CSMS || !window.CSMS.api || typeof window.CSMS.api.request !== 'function') return;

    const list = $('userList');
    if (!list) return;

    list.innerHTML = '';
    usersById.clear();

    try {
      const items = await fetchAllUsers();
      const safeItems = (items || []).filter(function (u) {
        if (!u || !u.id) return false;
        if (u.role === 'admin' || u.role === 'superadmin') return false;
        return true;
      });

      setText('statTotalUsers', safeItems.length);

      safeItems.forEach(function (u) {
        usersById.set(u.id, u);
      });

      const groups = new Map();
      safeItems.forEach(function (u) {
        const k = groupKeyFor(u);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(u);
      });

      groups.forEach(function (arr) {
        arr.sort(function (a, b) {
          return String(a.name || '').localeCompare(String(b.name || ''));
        });
      });

      const keys = Array.from(groups.keys()).sort(function (a, b) {
        if (a === 'UNASSIGNED' && b !== 'UNASSIGNED') return 1;
        if (b === 'UNASSIGNED' && a !== 'UNASSIGNED') return -1;
        return String(a).localeCompare(String(b));
      });

      keys.forEach(function (k) {
        list.appendChild(renderGroup(k, groups.get(k) || []));
      });
    } catch (e) {
      window.alert(e && e.message ? e.message : 'Failed to load users.');
    }
  }

  function openUser(userId) {
    const u = usersById.get(userId);
    if (!u) return;
    selectedUserId = userId;
    fillForm(u, false);
    showForm(true);
  }

  async function quickAuthorize(userId) {
    if (!window.CSMS || !window.CSMS.api || typeof window.CSMS.api.request !== 'function') return;
    try {
      await window.CSMS.api.request(`/api/admin/users/${encodeURIComponent(userId)}/role`, {
        method: 'PATCH',
        body: { role: 'authorized_user' },
      });
      await loadUsers();
      applySearchFilter();
    } catch (e) {
      window.alert(e && e.message ? e.message : 'Failed to authorize user.');
    }
  }

  function openCreateUser() {
    selectedUserId = null;
    fillForm(null, true);
    showForm(true);
  }

  function closeUserForm() {
    selectedUserId = null;
    showForm(false);
    setText('userPanelTitle', 'User Details');
    setText('userLabel', '—');
  }

  async function saveUser(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!window.CSMS || !window.CSMS.api || typeof window.CSMS.api.request !== 'function') return;

    const name = String($('userName').value || '').trim();
    const email = String($('userEmail').value || '').trim().toLowerCase();
    const studentId = String($('userStudentId').value || '').trim();
    const courseSection = String($('userCourseSection').value || '').trim().toUpperCase();
    const role = String($('userRole').value || 'student').trim();
    const isActive = !!$('userIsActive').checked;
    const password = String($('userPassword').value || '');

    if (!name || !email) {
      window.alert('Name and email are required.');
      return;
    }

    const btn = $('btnSaveUser');
    if (btn) btn.disabled = true;

    try {
      if (selectedUserId) {
        const patch = {
          name,
          email,
          role,
          is_active: isActive,
          student_id: studentId,
          course_section: courseSection,
        };
        if (password && password.trim()) patch.password = password;

        await window.CSMS.api.request(`/api/admin/users/${encodeURIComponent(selectedUserId)}`, {
          method: 'PATCH',
          body: patch,
        });
      } else {
        if (!password || !password.trim()) {
          window.alert('Password is required for new users.');
          return;
        }
        await window.CSMS.api.request('/api/admin/users', {
          method: 'POST',
          body: {
            name,
            email,
            password,
            role,
            student_id: studentId,
            course_section: courseSection,
          },
        });
      }

      closeUserForm();
      await loadUsers();
      applySearchFilter();
      await loadStats();
    } catch (e2) {
      window.alert(e2 && e2.message ? e2.message : 'Failed to save user.');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function deleteSelectedUser() {
    if (!selectedUserId) return;
    if (!window.confirm('Delete (deactivate) this user?')) return;
    if (!window.CSMS || !window.CSMS.api || typeof window.CSMS.api.request !== 'function') return;
    try {
      await window.CSMS.api.request(`/api/admin/users/${encodeURIComponent(selectedUserId)}`, {
        method: 'DELETE',
      });
      closeUserForm();
      await loadUsers();
      applySearchFilter();
      await loadStats();
    } catch (e) {
      window.alert(e && e.message ? e.message : 'Failed to delete user.');
    }
  }

  async function uploadImportFile(file) {
    window.alert('Student import via .xlsx is Super Admin-only.');
    return;
    if (!file) return;
    if (!window.CSMS || !window.CSMS.api || typeof window.CSMS.api.request !== 'function') return;

    setImportResult('Uploading .xlsx…');

    try {
      const fd = new FormData();
      fd.append('file', file);

      const resp = await window.CSMS.api.request('/api/admin/import/students', {
        method: 'POST',
        body: fd,
      });

      const d = resp && resp.data ? resp.data : null;
      const msg = d
        ? `Import complete — Created: ${d.created || 0} | Updated: ${d.updated || 0} | Skipped: ${d.skipped || 0}`
        : 'Import complete.';
      setImportResult(msg);

      closeUserForm();
      await loadUsers();
      applySearchFilter();
      await loadStats();
    } catch (err) {
      setImportResult('');
      window.alert(err && err.message ? err.message : 'Import failed.');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!onUsersPage()) return;

    window.openCreateUser = openCreateUser;
    window.closeUserForm = closeUserForm;
    window.deleteSelectedUser = deleteSelectedUser;

    const search = $('userSearch');
    if (search) search.addEventListener('keyup', applySearchFilter);

    const form = $('userForm');
    if (form) form.addEventListener('submit', saveUser);

    loadUsers().then(applySearchFilter);
    loadStats();
  });
})();
