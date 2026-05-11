/* Profile page wiring for static HTML views.
 *
 * - Loads the current user via /api/auth/me
 * - Replaces placeholder profile text with real DB values
 * - View-only profile rendering (no edits)
 */

(function () {
  'use strict';

  function profilePictureKey(userId) {
    return userId ? `csms.profile_picture.${userId}` : null;
  }

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

    const profilePic = document.getElementById('profile-pic');
    if (profilePic && user.id) {
      const defaultSrc = profilePic.getAttribute('data-default-src') || profilePic.getAttribute('src') || '';
      if (!profilePic.getAttribute('data-default-src') && defaultSrc) {
        profilePic.setAttribute('data-default-src', defaultSrc);
      }
      const key = profilePictureKey(user.id);
      const saved = key ? localStorage.getItem(key) : null;
      if (saved) profilePic.src = saved;
      else if (defaultSrc) profilePic.src = defaultSrc;
    }

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
      else if (key === 'email') setInfoRowValue(row, user.email || '—');
      else if (key === 'section' || key === 'course/section' || key === 'course_section') setInfoRowValue(row, user.course_section || '—');
      else if (key === 'subject') {
        // Back-compat for older HTML templates using "Subject" label.
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

  function setupProfilePictureUpload() {
    const editBtn = document.getElementById('edit-btn');
    const profilePic = document.getElementById('profile-pic');
    if (!editBtn || !profilePic) return;

    // Create hidden file input if it doesn't exist
    let pictureInput = document.getElementById('picture-input');
    if (!pictureInput) {
      pictureInput = document.createElement('input');
      pictureInput.type = 'file';
      pictureInput.id = 'picture-input';
      pictureInput.accept = 'image/*';
      pictureInput.style.display = 'none';
      document.body.appendChild(pictureInput);
    }

    // When the edit button is clicked, trigger the file input
    editBtn.addEventListener('click', function (e) {
      e.preventDefault();
      pictureInput.click();
    });

    // When a file is selected, display it as the profile picture
    pictureInput.addEventListener('change', function (e) {
      const file = e.target.files[0];
      if (!file) {
        return;
      }

      // Validate that the file is an image
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file.');
        return;
      }

      // Create a FileReader to read the file
      const reader = new FileReader();
      reader.onload = function (event) {
        const dataUrl = event && event.target ? event.target.result : null;
        if (!dataUrl) return;

        profilePic.src = dataUrl;

        const user =
          window.CSMS && window.CSMS.auth && typeof window.CSMS.auth.getUser === 'function'
            ? window.CSMS.auth.getUser()
            : null;
        const key = user && user.id ? profilePictureKey(user.id) : null;
        if (key) {
          try {
            localStorage.setItem(key, String(dataUrl));
          } catch {
            // Ignore quota errors.
          }
        }
      };
      reader.readAsDataURL(file);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderProfile();
    setupProfilePictureUpload();
  });
})();
