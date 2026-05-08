/* Profile page wiring for static HTML views.
 *
 * - Loads the current user via /api/auth/me
 * - Replaces placeholder profile text with real DB values
 * - View-only profile rendering (no edits)
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

  function displayName(full) {
    if (window.CSMS && window.CSMS.format && typeof window.CSMS.format.displayName === 'function') {
      return window.CSMS.format.displayName(full);
    }
    return String(full || '').trim();
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
      const name = displayName(user.name) || 'there';
      hello.textContent = `Hello, ${name}!`;
    }

    const rows = Array.from(document.querySelectorAll('.profile-card .info-block .info-row'));
    rows.forEach(function (row) {
      const labelEl = row.querySelector('.label');
      const key = (labelEl && labelEl.textContent ? labelEl.textContent : '')
        .replace(':', '')
        .trim()
        .toLowerCase();

      if (key === 'name') setInfoRowValue(row, displayName(user.name) || '—');
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
    if (profileBtn) profileBtn.style.display = 'none';

    const changePicture = document.querySelector('.profile-card .change-picture');
    if (changePicture) changePicture.style.display = 'none';
    const uploadInput = document.getElementById('upload');
    if (uploadInput) uploadInput.style.display = 'none';
  }

  document.addEventListener('DOMContentLoaded', renderProfile);
})();
