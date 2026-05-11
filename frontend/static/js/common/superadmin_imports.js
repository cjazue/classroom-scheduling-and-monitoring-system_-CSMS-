/* Super Admin -> Imports page wiring.
 *
 * Binds `frontend/superadmin/Imports.html` to:
 * - POST   /api/superadmin/import/students   (multipart)
 * - POST   /api/superadmin/import/schedules  (multipart)
 * - GET    /api/superadmin/imports
 * - DELETE /api/superadmin/imports/:id
 */

(function () {
  'use strict';

  function $(id) {
    return document.getElementById(id);
  }

  function onImportsPage() {
    const p = String(window.location.pathname || '').toLowerCase();
    return p.includes('/superadmin/') && p.endsWith('/imports.html');
  }

  function escapeText(s) {
    return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function setResult(id, text) {
    const el = $(id);
    if (!el) return;
    el.textContent = text || '';
  }

  function renderHistoryCard(batch) {
    const card = document.createElement('div');
    card.className = 'request-card';
    card.dataset.batchId = batch.id;

    const info = document.createElement('div');
    info.className = 'request-info';

    const name = document.createElement('div');
    name.className = 'request-name';
    const kindLabel = batch.kind === 'schedules' ? 'Schedule Import' : 'Student Import';
    name.textContent = kindLabel;

    const sub = document.createElement('div');
    sub.className = 'request-sub';
    const section = batch.section ? ` | ${batch.section}` : '';
    const count = typeof batch.count === 'number' ? ` (${batch.count})` : '';
    sub.textContent = `${batch.filename || 'upload'}${section}${count}`;

    const view = document.createElement('a');
    view.className = 'view-details';
    view.href = '#';
    view.textContent = 'Delete';
    view.addEventListener('click', function (e) {
      e.preventDefault();
      deleteBatch(batch.id);
    });

    info.appendChild(name);
    info.appendChild(sub);
    info.appendChild(view);

    card.appendChild(info);
    return card;
  }

  async function loadHistory() {
    if (!window.CSMS || !window.CSMS.api || typeof window.CSMS.api.request !== 'function') return;
    const shell = $('importHistory');
    if (!shell) return;
    shell.innerHTML = '';

    try {
      const resp = await window.CSMS.api.request('/api/superadmin/imports?per_page=50', { method: 'GET' });
      const payload = resp && resp.data ? resp.data : null;
      const items = payload && Array.isArray(payload.items) ? payload.items : [];
      const total =
        payload && payload.pagination && typeof payload.pagination.total === 'number'
          ? payload.pagination.total
          : items.length;

      const stat = $('statImportCount');
      if (stat) stat.textContent = String(total);

      items.forEach(function (b) {
        if (!b || !b.id) return;
        shell.appendChild(renderHistoryCard(b));
      });
      if (!items.length) {
        const empty = document.createElement('div');
        empty.style.padding = '12px';
        empty.style.color = '#6b7a99';
        empty.style.fontWeight = '700';
        empty.textContent = 'No imports yet.';
        shell.appendChild(empty);
      }
    } catch (e) {
      window.alert(e && e.message ? e.message : 'Failed to load import history.');
    }
  }

  async function deleteBatch(batchId) {
    if (!batchId) return;
    if (!window.confirm('Delete this import batch? (This may deactivate users or delete schedules.)')) return;
    if (!window.CSMS || !window.CSMS.api || typeof window.CSMS.api.request !== 'function') return;
    try {
      await window.CSMS.api.request(`/api/superadmin/imports/${encodeURIComponent(batchId)}`, { method: 'DELETE' });
      await loadHistory();
    } catch (e) {
      window.alert(e && e.message ? e.message : 'Failed to delete import batch.');
    }
  }

  async function uploadStudents(e) {
    e.preventDefault();
    if (!window.CSMS || !window.CSMS.api || typeof window.CSMS.api.request !== 'function') return;

    const file = $('studentFile') && $('studentFile').files ? $('studentFile').files[0] : null;
    if (!file) return;

    const defaultPassword = String(($('studentDefaultPassword') && $('studentDefaultPassword').value) || '').trim();
    if (!defaultPassword) {
      setResult('studentImportResult', 'Default password is required.');
      window.alert('Please enter a default password for imported students.');
      return;
    }

    const btn = $('btnStudentUpload');
    if (btn) btn.disabled = true;
    setResult('studentImportResult', 'Uploading...');

    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('default_password', defaultPassword);

      const resp = await window.CSMS.api.request('/api/superadmin/import/students', {
        method: 'POST',
        body: fd,
      });

      const d = resp && resp.data ? resp.data : null;
      const msg = d
        ? `Created: ${d.created || 0} | Updated: ${d.updated || 0} | Skipped: ${d.skipped || 0}`
        : 'Upload complete.';
      setResult('studentImportResult', msg);
      await loadHistory();
    } catch (err) {
      setResult('studentImportResult', '');
      window.alert(err && err.message ? err.message : 'Student import failed.');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function uploadSchedules(e) {
    e.preventDefault();
    if (!window.CSMS || !window.CSMS.api || typeof window.CSMS.api.request !== 'function') return;

    const file = $('scheduleFile') && $('scheduleFile').files ? $('scheduleFile').files[0] : null;
    if (!file) return;

    const btn = $('btnScheduleUpload');
    if (btn) btn.disabled = true;
    setResult('scheduleImportResult', 'Uploading...');

    try {
      const fd = new FormData();
      fd.append('file', file);
      const section = String(($('scheduleSection') && $('scheduleSection').value) || '').trim();
      if (section) fd.append('section', section);
      fd.append('replace_existing', $('scheduleReplace') && $('scheduleReplace').checked ? 'true' : 'false');

      const resp = await window.CSMS.api.request('/api/superadmin/import/schedules', {
        method: 'POST',
        body: fd,
      });

      const d = resp && resp.data ? resp.data : null;
      const msg = d
        ? `Section: ${(d.batch && d.batch.section) ? d.batch.section : '—'} | Created: ${d.created || 0} | Skipped: ${d.skipped || 0}`
        : 'Upload complete.';
      setResult('scheduleImportResult', msg);
      await loadHistory();
    } catch (err) {
      setResult('scheduleImportResult', '');
      window.alert(err && err.message ? err.message : 'Schedule import failed.');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!onImportsPage()) return;

    const pw = $('studentDefaultPassword');
    const show = $('studentShowPassword');
    if (pw && show) {
      show.addEventListener('change', function () {
        pw.type = show.checked ? 'text' : 'password';
      });
    }

    const studentForm = $('formStudentImport');
    if (studentForm) studentForm.addEventListener('submit', uploadStudents);

    const schedForm = $('formScheduleImport');
    if (schedForm) schedForm.addEventListener('submit', uploadSchedules);

    loadHistory();
  });

  // Expose for inline use if needed.
  window.__superadminDeleteImport = deleteBatch;
})();

