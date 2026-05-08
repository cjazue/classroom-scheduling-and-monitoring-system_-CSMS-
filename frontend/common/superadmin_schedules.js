/* Super Admin -> Schedule CRUD page wiring.
 *
 * Binds `frontend/superadmin/Schedules.html` to:
 * - GET    /api/superadmin/schedules
 * - POST   /api/superadmin/schedules
 * - PATCH  /api/superadmin/schedules/:id
 * - DELETE /api/superadmin/schedules/:id
 */

(function () {
  'use strict';

  const schedulesById = new Map();
  let selectedScheduleId = null;

  function $(id) {
    return document.getElementById(id);
  }

  function onSchedulesPage() {
    const p = String(window.location.pathname || '').toLowerCase();
    return p.includes('/superadmin/') && p.endsWith('/schedules.html');
  }

  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value == null ? '—' : String(value);
  }

  function showForm(show) {
    const form = $('scheduleForm');
    const empty = $('schedEmpty');
    if (form) form.style.display = show ? 'grid' : 'none';
    if (empty) empty.style.display = show ? 'none' : 'block';
  }

  function fillForm(s, isCreate) {
    $('scheduleId').value = isCreate ? '' : (s && s.id ? s.id : '');
    $('schedSection').value = s && s.section ? s.section : '';
    $('schedDay').value = s && s.day ? s.day : 'Monday';
    $('schedRoom').value = s && s.room_key ? s.room_key : '';
    $('schedSubjectCode').value = s && s.subject_code ? s.subject_code : '';
    $('schedSubject').value = s && s.subject ? s.subject : '';
    $('schedStart').value = s && s.start_time ? s.start_time : '';
    $('schedEnd').value = s && s.end_time ? s.end_time : '';

    const delBtn = $('btnDeleteSchedule');
    if (delBtn) delBtn.style.display = isCreate ? 'none' : 'inline-block';

    setText('schedPanelTitle', isCreate ? 'Create Schedule' : 'Edit Schedule');
    setText('schedLabel', isCreate ? 'New' : (s && s.id ? s.id : '—'));
  }

  function renderCard(s) {
    const card = document.createElement('div');
    card.className = 'request-card';
    card.dataset.scheduleId = s.id;

    const info = document.createElement('div');
    info.className = 'request-info';

    const name = document.createElement('div');
    name.className = 'request-name';
    const room = s.room_key || 'Room';
    const day = s.day || '';
    const time = (s.start_time && s.end_time) ? `${s.start_time}-${s.end_time}` : '';
    name.textContent = `${room} ${day ? '• ' + day : ''} ${time ? '• ' + time : ''}`.trim();

    const sub = document.createElement('div');
    sub.className = 'request-sub';
    const section = s.section ? s.section : '—';
    const code = s.subject_code ? s.subject_code : (s.subject ? s.subject : '—');
    sub.textContent = `${section} | ${code}`;

    const view = document.createElement('a');
    view.className = 'view-details';
    view.href = '#';
    view.textContent = 'Edit ›››';
    view.addEventListener('click', function (e) {
      e.preventDefault();
      openSchedule(s.id);
    });

    info.appendChild(name);
    info.appendChild(sub);
    info.appendChild(view);

    card.appendChild(info);
    return card;
  }

  function applySearchFilter() {
    const input = $('filterSearch');
    const list = $('scheduleList');
    if (!input || !list) return;
    const value = String(input.value || '').trim().toLowerCase();
    list.querySelectorAll('.request-card').forEach(function (card) {
      const text = (card.textContent || '').toLowerCase();
      card.style.display = !value || text.includes(value) ? 'flex' : 'none';
    });
  }

  async function loadSchedules() {
    if (!window.CSMS || !window.CSMS.api || typeof window.CSMS.api.request !== 'function') return;

    const list = $('scheduleList');
    if (!list) return;
    list.innerHTML = '';
    schedulesById.clear();

    const section = String(($('filterSection') && $('filterSection').value) || '').trim().toUpperCase();
    const day = String(($('filterDay') && $('filterDay').value) || '').trim();

    const qs = [];
    qs.push('per_page=100');
    if (section) qs.push(`section=${encodeURIComponent(section)}`);
    if (day) qs.push(`day=${encodeURIComponent(day)}`);

    try {
      const resp = await window.CSMS.api.request(`/api/superadmin/schedules?${qs.join('&')}`, { method: 'GET' });
      const payload = resp && resp.data ? resp.data : null;
      const items = payload && Array.isArray(payload.items) ? payload.items : [];
      const total =
        payload && payload.pagination && typeof payload.pagination.total === 'number'
          ? payload.pagination.total
          : items.length;

      setText('statScheduleCount', total);

      items.forEach(function (s) {
        if (!s || !s.id) return;
        schedulesById.set(s.id, s);
        list.appendChild(renderCard(s));
      });

      if (!items.length) {
        const empty = document.createElement('div');
        empty.style.padding = '12px';
        empty.style.color = '#fff';
        empty.style.fontWeight = '800';
        empty.textContent = 'No schedules found for this filter.';
        list.appendChild(empty);
      }
    } catch (e) {
      window.alert(e && e.message ? e.message : 'Failed to load schedules.');
    }
  }

  function openSchedule(id) {
    const s = schedulesById.get(id);
    if (!s) return;
    selectedScheduleId = id;
    fillForm(s, false);
    showForm(true);
  }

  function openCreateSchedule() {
    selectedScheduleId = null;
    fillForm(null, true);
    showForm(true);
  }

  function closeScheduleForm() {
    selectedScheduleId = null;
    showForm(false);
    setText('schedPanelTitle', 'Schedule Details');
    setText('schedLabel', '—');
  }

  async function saveSchedule(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!window.CSMS || !window.CSMS.api || typeof window.CSMS.api.request !== 'function') return;

    const section = String($('schedSection').value || '').trim().toUpperCase();
    const day = String($('schedDay').value || '').trim();
    const roomKey = String($('schedRoom').value || '').trim();
    const subjectCode = String($('schedSubjectCode').value || '').trim();
    const subject = String($('schedSubject').value || '').trim();
    const start = String($('schedStart').value || '').trim();
    const end = String($('schedEnd').value || '').trim();

    if (!section || !day || !roomKey || !start || !end) {
      window.alert('Section, day, room, start and end time are required.');
      return;
    }

    const btn = $('btnSaveSchedule');
    if (btn) btn.disabled = true;

    try {
      if (selectedScheduleId) {
        await window.CSMS.api.request(`/api/superadmin/schedules/${encodeURIComponent(selectedScheduleId)}`, {
          method: 'PATCH',
          body: {
            section,
            day,
            room_key: roomKey,
            subject_code: subjectCode,
            subject,
            start_time: start,
            end_time: end,
          },
        });
      } else {
        await window.CSMS.api.request('/api/superadmin/schedules', {
          method: 'POST',
          body: {
            section,
            day,
            room_key: roomKey,
            subject_code: subjectCode,
            subject,
            start_time: start,
            end_time: end,
          },
        });
      }

      closeScheduleForm();
      await loadSchedules();
      applySearchFilter();
    } catch (e2) {
      window.alert(e2 && e2.message ? e2.message : 'Failed to save schedule.');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function deleteSelectedSchedule() {
    if (!selectedScheduleId) return;
    if (!window.confirm('Delete this schedule?')) return;
    if (!window.CSMS || !window.CSMS.api || typeof window.CSMS.api.request !== 'function') return;

    try {
      await window.CSMS.api.request(`/api/superadmin/schedules/${encodeURIComponent(selectedScheduleId)}`, {
        method: 'DELETE',
      });
      closeScheduleForm();
      await loadSchedules();
      applySearchFilter();
    } catch (e) {
      window.alert(e && e.message ? e.message : 'Failed to delete schedule.');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!onSchedulesPage()) return;

    window.openCreateSchedule = openCreateSchedule;
    window.closeScheduleForm = closeScheduleForm;
    window.deleteSelectedSchedule = deleteSelectedSchedule;

    const form = $('scheduleForm');
    if (form) form.addEventListener('submit', saveSchedule);

    const search = $('filterSearch');
    if (search) search.addEventListener('keyup', applySearchFilter);

    const section = $('filterSection');
    if (section) section.addEventListener('change', function () { loadSchedules().then(applySearchFilter); });
    const day = $('filterDay');
    if (day) day.addEventListener('change', function () { loadSchedules().then(applySearchFilter); });

    loadSchedules().then(applySearchFilter);
  });
})();

