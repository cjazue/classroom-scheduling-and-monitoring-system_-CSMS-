/* Profile page wiring for static HTML views.
 *
 * - Loads the current user via /api/auth/me
 * - Replaces placeholder profile text with real DB values
 * - Optional: allows quick edits via prompts (name, course/section, password)
 */

(function () {
  'use strict';

  function roleLabel(role) {
    switch ((role || '').toLowerCase()) {
      case 'superadmin':
        return 'Super Admin';
      case 'admin':
        return 'Admin';
      case 'authorized_user':
        return 'Authorized User';
      case 'student':
        return 'Student';
      default:
        return role || 'User';
    }
  }

  function firstName(full) {
    const s = (full || '').trim();
    if (!s) return '';
    return s.split(/\s+/)[0] || s;
  }

  function setInfoRowValue(row, value) {
    const label = row ? row.querySelector('.label') : null;
    if (!row || !label) return;
    while (label.nextSibling) row.removeChild(label.nextSibling);
    row.appendChild(document.createTextNode(' ' + (value || '—')));
  }

  async function ensureUser() {
    if (!window.CSMS || !window.CSMS.auth || typeof window.CSMS.auth.ensureUser !== 'function') return null;
    try {
      return await window.CSMS.auth.ensureUser();
    } catch {
      return window.CSMS.auth.getUser ? window.CSMS.auth.getUser() : null;
    }
  }

  function looksLikeProfilePage() {
    return !!document.querySelector('.profile-card .info-block .info-row');
  }

  async function renderProfile() {
    if (!looksLikeProfilePage()) return;

    const user = await ensureUser();
    if (!user) return;

    const hello = document.querySelector('.profile-card .card-header h1');
    if (hello) {
      const name = firstName(user.name) || 'there';
      hello.textContent = `Hello, ${name}!`;
    }

    const rows = Array.from(document.querySelectorAll('.profile-card .info-block .info-row'));
    rows.forEach(function (row) {
      const labelEl = row.querySelector('.label');
      const key = (labelEl && labelEl.textContent ? labelEl.textContent : '')
        .replace(':', '')
        .trim()
        .toLowerCase();

      if (key === 'name') setInfoRowValue(row, user.name || '—');
      else if (key === 'position') setInfoRowValue(row, roleLabel(user.role));
      else if (key === 'subject') {
        const v =
          user.role === 'authorized_user' || user.role === 'student'
            ? user.course_section || user.email || '—'
            : user.email || user.course_section || '—';
        setInfoRowValue(row, v);
      } else if (key === 'id') {
        const v =
          user.role === 'student'
            ? user.student_id || user.id || '—'
            : user.id || '—';
        setInfoRowValue(row, v);
      }
    });

    const profileBtn = document.querySelector('.profile-card .profile-btn');
    if (!profileBtn) return;

    if (profileBtn.dataset && profileBtn.dataset.csmsWired === '1') return;
    if (profileBtn.dataset) profileBtn.dataset.csmsWired = '1';

    profileBtn.addEventListener('click', async function (e) {
      e.preventDefault();

      const current = (window.CSMS && window.CSMS.auth && window.CSMS.auth.getUser)
        ? window.CSMS.auth.getUser()
        : user;

      const nextName = window.prompt('Update name:', current && current.name ? current.name : '');
      if (nextName === null) return;

      const patch = { name: String(nextName || '').trim() };

      if (current && (current.role === 'authorized_user' || current.role === 'student')) {
        const nextCS = window.prompt(
          'Update course/section (e.g. BSIT 1-1):',
          current && current.course_section ? current.course_section : ''
        );
        if (nextCS === null) return;
        patch.course_section = String(nextCS || '').trim().toUpperCase();
      }

      const nextPw = window.prompt('New password (leave blank to keep):', '');
      if (nextPw === null) return;
      if (String(nextPw || '').trim()) patch.password = String(nextPw);

      try {
        const updated = await window.CSMS.auth.updateMe(patch);
        if (updated) await renderProfile();
        window.alert('Profile updated.');
      } catch (err) {
        window.alert(err && err.message ? err.message : 'Failed to update profile.');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', renderProfile);
})();
