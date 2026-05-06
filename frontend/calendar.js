document.addEventListener('DOMContentLoaded', function () {

  const monthYear = document.getElementById('month-year');
  const daysContainer = document.getElementById('days');
  const prevButton = document.getElementById('prev');
  const nextButton = document.getElementById('next');
  const toggleBtn = document.getElementById("toggleCalendar");
  const calendarContainer = document.getElementById("calendarContainer");
  const tableRows = document.querySelectorAll('.table-row');

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  let currentDate = new Date();
  let today = new Date();

  function filterByDate(selectedDate) {
    // Format selected date as MM/DD/YYYY to match table date column
    const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const dd = String(selectedDate.getDate()).padStart(2, '0');
    const yyyy = selectedDate.getFullYear();
    const formatted = `${mm}/${dd}/${yyyy}`;

    tableRows.forEach(function (row) {
      const dateCell = row.querySelectorAll('span')[2]; // 3rd column = Date
      if (!dateCell) return;
      if (dateCell.textContent.trim() === formatted) {
        row.style.display = "grid";
      } else {
        row.style.display = "none";
      }
    });
  }

  function renderCalendar(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();

    monthYear.textContent = `${months[month]} ${year}`;
    daysContainer.innerHTML = '';

    const prevMonthLastDay = new Date(year, month, 0).getDate();

    for (let i = firstDay; i > 0; i--) {
      const dayDiv = document.createElement('div');
      dayDiv.textContent = prevMonthLastDay - i + 1;
      dayDiv.classList.add('fade');
      daysContainer.appendChild(dayDiv);
    }

    for (let i = 1; i <= lastDay; i++) {
      const dayDiv = document.createElement('div');
      dayDiv.textContent = i;

      if (
        i === today.getDate() &&
        month === today.getMonth() &&
        year === today.getFullYear()
      ) {
        dayDiv.classList.add('today');
      }

      dayDiv.addEventListener("click", () => {
        const selectedDate = new Date(year, month, i);

        const formatted = selectedDate.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric"
        });

        toggleBtn.textContent = formatted;
        calendarContainer.style.display = "none";

        // Filter table rows by selected date
        filterByDate(selectedDate);
      });

      daysContainer.appendChild(dayDiv);
    }

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

  toggleBtn.addEventListener("click", () => {
    calendarContainer.style.display =
      calendarContainer.style.display === "none" ? "block" : "none";
  });

  document.addEventListener("click", function (e) {
    if (!toggleBtn.contains(e.target) && !calendarContainer.contains(e.target)) {
      calendarContainer.style.display = "none";
    }
  });

  toggleBtn.textContent = today.toLocaleDateString("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric"
  });

  renderCalendar(currentDate);
});