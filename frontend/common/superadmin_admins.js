/* Super Admin -> Manage Admin page wiring.
 *
 * Binds the static UI in `frontend/superadmin/Super Admin.html` to:
 * - GET /api/superadmin/admins
 * - PATCH /api/superadmin/admins/:id
 * - DELETE /api/superadmin/admins/:id
 */

(function () {
  'use strict';

  const adminsById = new Map();
  let selectedAdminId = null;
  let selectedCard = null;

  function $(sel) {
    return document.querySelector(sel);
  }

  function showPanel(id) {
    ['right-panel-placeholder', 'details-panel', 'delete-panel', 'success-panel'].forEach(function (p) {
      const el = document.getElementById(p);
      if (!el) return;
      el.style.display = p === id ? 'flex' : 'none';
    });
  }

  function splitName(full) {
    const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return { first: '', last: '', mi: '' };
    if (parts.length === 1) return { first: parts[0], last: '', mi: '' };
    if (parts.length === 2) return { first: parts[0], last: parts[1], mi: '' };
    return {
      first: parts[0],
      last: parts[parts.length - 1],
      mi: parts.slice(1, -1).join(' '),
    };
  }

  function combineName(first, mi, last) {
    return [first, mi, last].map((s) => String(s || '').trim()).filter(Boolean).join(' ');
  }

  function totalAdminStrongEl() {
    const cards = document.querySelectorAll('.stats-row .stat-card');
    for (const card of cards) {
      const text = (card.textContent || '').toLowerCase();
      if (text.includes('total admin')) return card.querySelector('strong');
    }
    return null;
  }

  function setTotalAdmins(n) {
    const el = totalAdminStrongEl();
    if (el) el.textContent = String(n);
  }

  function setSuccessInfo(text) {
    const el = document.querySelector('.success-info');
    if (el) el.textContent = text;
  }

  function renderCard(admin) {
    const card = document.createElement('div');
    card.className = 'request-card';
    card.dataset.adminId = admin.id;

    const info = document.createElement('div');
    info.className = 'request-info';

    const name = document.createElement('div');
    name.className = 'request-name';
    name.textContent = admin.name || '—';

    const sub = document.createElement('div');
    sub.className = 'request-sub';
    sub.textContent = admin.id || 'Admin';

    const view = document.createElement('a');
    view.className = 'view-details';
    view.href = '#';
    view.textContent = 'View Details ›››';
    view.addEventListener('click', function (e) {
      e.preventDefault();
      openDetails(card);
    });

    info.appendChild(name);
    info.appendChild(sub);
    info.appendChild(view);

    const actions = document.createElement('div');
    actions.className = 'request-actions';

    const edit = document.createElement('button');
    edit.className = 'btn-edit';
    edit.innerHTML = 'Edit <i class="fa-solid fa-pen-to-square"></i>';
    edit.addEventListener('click', function () {
      openDetails(card);
    });

    const del = document.createElement('button');
    del.className = 'btn-delete';
    del.innerHTML = 'Delete <i class="fa-solid fa-trash"></i>';
    del.addEventListener('click', function () {
      openDelete(card);
    });

    actions.appendChild(edit);
    actions.appendChild(del);

    card.appendChild(info);
    card.appendChild(actions);
    return card;
  }

  function fillDetails(admin) {
    const n = splitName(admin.name || '');

    const adminLabel = document.getElementById('admin-label');
    if (adminLabel) adminLabel.textContent = admin.id || 'Admin';

    const setVal = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.value = v || '';
    };

    setVal('input-fname', n.first);
    setVal('input-lname', n.last);
    setVal('input-mi', n.mi);
    setVal('input-email', admin.email || '');

    // Not stored in the current DB schema; keep visible but disable to avoid false expectations.
    ['input-contact', 'input-id', 'input-address'].forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = '';
      el.disabled = true;
      el.placeholder = 'Not stored';
    });
  }

  function openDetails(card) {
    selectedCard = card || null;
    selectedAdminId = card && card.dataset ? card.dataset.adminId : null;
    const admin = selectedAdminId ? adminsById.get(selectedAdminId) : null;
    if (!admin) return;
    fillDetails(admin);
    showPanel('details-panel');
  }

  function openDelete(card) {
    selectedCard = card || null;
    selectedAdminId = card && card.dataset ? card.dataset.adminId : null;
    const admin = selectedAdminId ? adminsById.get(selectedAdminId) : null;
    if (!admin) return;

    const nameEl = document.getElementById('delete-name');
    if (nameEl) nameEl.textContent = admin.name || '—';
    const labelEl = document.getElementById('delete-admin-label');
    if (labelEl) labelEl.textContent = admin.id || 'Admin';

    showPanel('delete-panel');
  }

  async function loadAdmins() {
    if (!window.CSMS || !window.CSMS.api || typeof window.CSMS.api.request !== 'function') return;

    const list = document.querySelector('.request-panel .request-list');
    if (!list) return;

    list.innerHTML = '';
    adminsById.clear();

    try {
      const resp = await window.CSMS.api.request('/api/superadmin/admins?is_active=true&per_page=100', { method: 'GET' });
      const payload = resp && resp.data ? resp.data : null;
      const items = payload && Array.isArray(payload.items) ? payload.items : [];
      const total =
        payload && payload.pagination && typeof payload.pagination.total === 'number'
          ? payload.pagination.total
          : items.length;

      setTotalAdmins(total);

      items.forEach(function (a) {
        if (!a || !a.id) return;
        adminsById.set(a.id, a);
        list.appendChild(renderCard(a));
      });
    } catch (e) {
      window.alert(e && e.message ? e.message : 'Failed to load admins.');
    }
  }

  async function saveDetails() {
    if (!selectedAdminId) return;
    const admin = adminsById.get(selectedAdminId);
    if (!admin) return;

    const first = document.getElementById('input-fname');
    const last = document.getElementById('input-lname');
    const mi = document.getElementById('input-mi');
    const email = document.getElementById('input-email');

    const nextName = combineName(first && first.value, mi && mi.value, last && last.value);
    const nextEmail = (email && email.value ? email.value : '').trim().toLowerCase();

    const patch = {};
    if (nextName && nextName !== (admin.name || '')) patch.name = nextName;
    if (nextEmail && nextEmail !== (admin.email || '').toLowerCase()) patch.email = nextEmail;

    if (!Object.keys(patch).length) {
      showPanel('right-panel-placeholder');
      return;
    }

    try {
      const resp = await window.CSMS.api.request(`/api/superadmin/admins/${encodeURIComponent(selectedAdminId)}`, {
        method: 'PATCH',
        body: patch,
      });

      const updated = resp && resp.data ? resp.data : null;
      if (updated && updated.id) adminsById.set(updated.id, updated);

      if (selectedCard && updated) {
        const nameEl = selectedCard.querySelector('.request-name');
        if (nameEl) nameEl.textContent = updated.name || '—';
      }

      setSuccessInfo(`Name: ${updated && updated.name ? updated.name : nextName} | ID: ${selectedAdminId}`);
      showPanel('success-panel');
    } catch (e) {
      window.alert(e && e.message ? e.message : 'Failed to update admin.');
    }
  }

  async function confirmDelete() {
    if (!selectedAdminId) return;
    try {
      await window.CSMS.api.request(`/api/superadmin/admins/${encodeURIComponent(selectedAdminId)}`, {
        method: 'DELETE',
      });

      adminsById.delete(selectedAdminId);
      if (selectedCard) selectedCard.remove();
      setTotalAdmins(adminsById.size);
      selectedAdminId = null;
      selectedCard = null;
      showPanel('right-panel-placeholder');
    } catch (e) {
      window.alert(e && e.message ? e.message : 'Failed to delete admin.');
    }
  }

  function wireButtons() {
    window.showPanel = showPanel;
    window.hideDetails = function () {
      showPanel('right-panel-placeholder');
    };
    window.hideDelete = function () {
      showPanel('right-panel-placeholder');
    };
    window.closeSuccess = function () {
      showPanel('right-panel-placeholder');
    };

    window.saveDetails = saveDetails;
    window.confirmDelete = confirmDelete;
  }

  document.addEventListener('DOMContentLoaded', function () {
    // Only run on the Super Admin manage page.
    const p = String(window.location.pathname || '').toLowerCase();
    if (!p.includes('/superadmin/')) return;

    wireButtons();
    showPanel('right-panel-placeholder');
    loadAdmins();
  });
})();
