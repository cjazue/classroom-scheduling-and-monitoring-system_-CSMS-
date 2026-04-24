let currentRoomNumber = 1;
let scrollPosition = 0;
let selectedRoom = null;
let selectedElement = null;

function openReservation(roomNumber) {
  const safeRoomNumber = Number(roomNumber);

  if (!safeRoomNumber || isNaN(safeRoomNumber)) {
    console.warn("Invalid room number:", roomNumber);
    return;
  }

  currentRoomNumber = safeRoomNumber;
  scrollPosition = window.pageYOffset || document.documentElement.scrollTop;

  document.querySelectorAll('.container2').forEach(room => {
    const num = parseInt(room.textContent.replace(/\D/g, ''));
    if (num === safeRoomNumber) {
      selectedElement = room;
    }
  });

  document.getElementById('modalRoomBadge').textContent = `CAS – Room ${safeRoomNumber}`;
document.getElementById('successRoomBadge').textContent = `CAS – Room ${safeRoomNumber}`;

const timeInput = document.querySelector('.time-pickable');
const dateBtn = document.getElementById('toggleCalendar');

const selectedTime = (timeInput && timeInput.value) ? timeInput.value : 'No time selected';
const selectedDate = (dateBtn && dateBtn.textContent !== 'Select Date ▼') ? dateBtn.textContent : 'No date selected';

document.getElementById('modalTimeBadge').textContent = selectedTime;
document.getElementById('modalDateBadge').textContent = selectedDate;
document.getElementById('successTimeBadge').textContent = selectedTime;
document.getElementById('successDateBadge').textContent = selectedDate;

document.getElementById('reservationModal').style.display = 'flex';
lockScroll();
}

function closeReservation() {
  document.getElementById('reservationModal').style.display = 'none';

  if (selectedElement) {
    selectedElement.classList.remove('selected');
    selectedElement = null;
  }

  unlockScroll();
}
function showSuccess() {
  document.getElementById('successTimeBadge').textContent =
    document.getElementById('modalTimeBadge').textContent;
    
  if (selectedElement) {
    selectedElement.classList.remove('selected');
    selectedElement.classList.add('reserved');
  }

  document.getElementById('reservationModal').style.display = 'none';
  document.getElementById('successModal').classList.add('active');
}

function closeSuccess() {
  document.getElementById('successModal').classList.remove('active');
  openReservation(currentRoomNumber);
}

function goHome() {
  document.getElementById('successModal').classList.remove('active');
  unlockScroll();
}

function lockScroll() {
  document.body.style.position = "fixed";
  document.body.style.top = `-${scrollPosition}px`;
  document.body.style.width = "100%";
}

function unlockScroll() {
  document.body.style.position = "";
  document.body.style.top = "";
  window.scrollTo(0, scrollPosition);
}

document.addEventListener('DOMContentLoaded', function () {

  document.querySelectorAll('.container2').forEach(room => {

    room.addEventListener('click', function () {
      if (this.classList.contains('reserved')) return;

      document.querySelectorAll('.container2').forEach(r => {
        r.classList.remove('selected');
      });

      this.classList.add('selected');
      selectedElement = this;
      const roomText = this.textContent.trim();
      const roomNumber = parseInt(roomText.replace(/\D/g, ''));
      selectedRoom = roomNumber;

      openReservation(roomNumber);
    });

  });

});

document.addEventListener('click', function (event) {
  const reservationModal = document.getElementById('reservationModal');
  const successModal = document.getElementById('successModal');

  if (event.target === reservationModal) {
    closeReservation();
  }

  if (event.target === successModal) {
    goHome();
  }
});

document.addEventListener('keydown', function (event) {
  if (event.key === 'Escape') {
    const reservationModal = document.getElementById('reservationModal');
    const successModal = document.getElementById('successModal');

    if (reservationModal.style.display === 'flex') {
      closeReservation();
    }

    if (successModal.classList.contains('active')) {
      goHome();
    }
  }
});