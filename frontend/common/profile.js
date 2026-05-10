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

  function setupProfilePictureUpload() {
    const editBtn = document.getElementById('edit-btn');
    const profilePic = document.getElementById('profile-pic');

    console.log('Setting up profile picture upload...');
    console.log('Edit button found:', !!editBtn);
    console.log('Profile pic found:', !!profilePic);

    if (!editBtn || !profilePic) {
      console.warn('Could not find required elements for profile picture upload');
      return;
    }

    // Create hidden file input if it doesn't exist
    let pictureInput = document.getElementById('picture-input');
    if (!pictureInput) {
      pictureInput = document.createElement('input');
      pictureInput.type = 'file';
      pictureInput.id = 'picture-input';
      pictureInput.accept = 'image/*';
      pictureInput.style.display = 'none';
      document.body.appendChild(pictureInput);
      console.log('Created hidden file input');
    }

    // When the edit button is clicked, trigger the file input
    editBtn.addEventListener('click', function (e) {
      e.preventDefault();
      console.log('Change Picture button clicked');
      pictureInput.click();
    });

    // When a file is selected, display it as the profile picture
    pictureInput.addEventListener('change', function (e) {
      console.log('File selected');
      const file = e.target.files[0];
      if (!file) {
        console.log('No file selected');
        return;
      }

      // Validate that the file is an image
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file.');
        console.warn('File is not an image:', file.type);
        return;
      }

      console.log('Reading file:', file.name);
      // Create a FileReader to read the file
      const reader = new FileReader();
      reader.onload = function (event) {
        // Update the profile picture src with the selected image
        console.log('File loaded, updating profile picture');
        profilePic.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });

    console.log('Profile picture upload setup complete');
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderProfile();
    setupProfilePictureUpload();
  });
})();
