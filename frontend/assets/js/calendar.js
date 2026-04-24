document.addEventListener('DOMContentLoaded', function () {

  const monthYear = document.getElementById('month-year');
  const daysContainer = document.getElementById('days');
  const prevButton = document.getElementById('prev');
  const nextButton = document.getElementById('next');
  const toggleBtn = document.getElementById("toggleCalendar");
  const calendarContainer = document.getElementById("calendarContainer");

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  let currentDate = new Date();
  let today = new Date();

  function renderCalendar(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();

    monthYear.textContent = `${months[month]} ${year}`;
    daysContainer.innerHTML = '';

    const prevMonthLastDay = new Date(year, month, 0).getDate();

    // Previous month days
    for (let i = firstDay; i > 0; i--) {
      const dayDiv = document.createElement('div');
      dayDiv.textContent = prevMonthLastDay - i + 1;
      dayDiv.classList.add('fade');
      daysContainer.appendChild(dayDiv);
    }

    // Current month days
    for (let i = 1; i <= lastDay; i++) {
      const dayDiv = document.createElement('div');
      dayDiv.textContent = i;

      // highlight today
      if (
        i === today.getDate() &&
        month === today.getMonth() &&
        year === today.getFullYear()
      ) {
        dayDiv.classList.add('today');
      }

      // ✅ click to select
      dayDiv.addEventListener("click", () => {
        const selectedDate = new Date(year, month, i);

        const formatted = selectedDate.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric"
        });

        toggleBtn.textContent = formatted;
        calendarContainer.style.display = "none";
      });

      daysContainer.appendChild(dayDiv);
    }

    // Next month days (FIXED position)
    const nextMonthStartDay = 7 - new Date(year, month + 1, 0).getDay() - 1;

    for (let i = 1; i <= nextMonthStartDay; i++) {
      const dayDiv = document.createElement('div');
      dayDiv.textContent = i;
      dayDiv.classList.add('fade');
      daysContainer.appendChild(dayDiv);
    }
  }

  prevButton.addEventListener('click', function () {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar(currentDate);
  });

  nextButton.addEventListener('click', function () {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar(currentDate);
  });

  // Toggle dropdown
  toggleBtn.addEventListener("click", () => {
    calendarContainer.style.display =
      calendarContainer.style.display === "none" ? "block" : "none";
  });

  // ✅ FIX: move outside click INSIDE here
  document.addEventListener("click", function (e) {
    if (!toggleBtn.contains(e.target) && !calendarContainer.contains(e.target)) {
      calendarContainer.style.display = "none";
    }
  });

  renderCalendar(currentDate);
});