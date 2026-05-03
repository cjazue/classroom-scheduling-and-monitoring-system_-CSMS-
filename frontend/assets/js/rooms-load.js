let roomsData = [];
let selectedRoomId = null;
let selectedRoomName = null;

document.addEventListener("DOMContentLoaded", async () => {
  requireAuth();
  initLogout();
  prefillUserInfo();

  const buildingId   = getParam("building_id")   || getPageContext("selectedBuilding")?.id;
  const buildingName = getParam("building_name")
    ? decodeURIComponent(getParam("building_name"))
    : (getPageContext("selectedBuilding")?.name || "Building");
  const campusName   = getParam("campus_name")
    ? decodeURIComponent(getParam("campus_name"))
    : (getPageContext("selectedBuilding")?.campusName || "");

  const buildingLabel = document.getElementById("buildingLabel");
  if (buildingLabel) buildingLabel.textContent = `${campusName} - ${buildingName}`;


  const campusNameEl = document.querySelectorAll(".campus-name");
  campusNameEl.forEach(el => el.textContent = campusName);
  const campusBuildingEl = document.querySelectorAll(".campus-building");
  campusBuildingEl.forEach(el => el.textContent = `${buildingName} Building`);

  if (!buildingId) {
    document.getElementById("roomsContainer").innerHTML =
      `<p style="color:red;padding:20px;">No building selected. <a href="campus.html">Go back</a></p>`;
    return;
  }

  await loadRooms(buildingId);

  
  const user = Auth.getUser();
  if (user && !Auth.canReserve()) {
    document.querySelectorAll(".btn-proceed").forEach(btn => {
      btn.style.display = "none";
    });
    const hint = document.createElement("p");
    hint.style.cssText = "text-align:center;color:#888;font-size:13px;margin-top:8px;";
    hint.textContent = "Only authorized users (professors/student officers) can reserve rooms.";
    document.querySelector(".btn-row")?.appendChild(hint);
  }
});

async function loadRooms(buildingId) {
  const container = document.getElementById("roomsContainer");
  container.innerHTML = `<p class="loading-text">Loading rooms…</p>`;

  try {
    const res = await API.getRooms({ building_id: buildingId, is_active: true, per_page: 50 });
    roomsData = res.data.items;

    if (!roomsData.length) {
      container.innerHTML = `<p class="loading-text">No rooms found in this building.</p>`;
      return;
    }

    const floors = {};
    roomsData.forEach(room => {
      const floor = room.floor ?? 1;
      if (!floors[floor]) floors[floor] = [];
      floors[floor].push(room);
    });

    container.innerHTML = Object.entries(floors)
      .sort(([a], [b]) => a - b)
      .map(([floor, rooms]) => `
        <div class="floor-section">
          <h4 class="floor-label">Floor ${floor}</h4>
          <div class="row">
            ${rooms.map(room => `
              <div class="container2 ${room.is_occupied ? "reserved" : ""}"
                   data-room-id="${room.id}"
                   data-room-name="${room.code}"
                   data-occupied="${room.is_occupied}">
                ${room.code}
                <span class="room-type-badge">${room.room_type}</span>
              </div>
            `).join("")}
          </div>
        </div>
      `).join("");

    document.querySelectorAll(".container2").forEach(el => {
      el.addEventListener("click", function () {
        if (this.dataset.occupied === "true") return; 

        const roomId   = parseInt(this.dataset.roomId);
        const roomName = this.dataset.roomName;

        document.querySelectorAll(".container2").forEach(r => r.classList.remove("selected"));
        this.classList.add("selected");

        openReservationModal(roomId, roomName);
      });
    });

  } catch (err) {
    container.innerHTML = `<p class="loading-text" style="color:red;">Failed to load rooms.</p>`;
    console.error(err);
  }
}


function openReservationModal(roomId, roomName) {
  selectedRoomId   = roomId;
  selectedRoomName = roomName;

  const timeInput = document.querySelector(".time-pickable");
  const dateBtn   = document.getElementById("toggleCalendar");

  document.getElementById("modalRoomBadge").textContent   = roomName;
  document.getElementById("successRoomBadge").textContent = roomName;

  const selectedTime = (timeInput && timeInput.value) ? timeInput.value : "No time selected";
  const selectedDate = (dateBtn && dateBtn.textContent !== "Select Date ▼")
    ? dateBtn.textContent : "No date selected";

  document.getElementById("modalTimeBadge").textContent = selectedTime;
  document.getElementById("modalDateBadge").textContent = selectedDate;

  document.getElementById("reservationModal").style.display = "flex";
  lockScroll();
}

function closeReservation() {
  document.getElementById("reservationModal").style.display = "none";
  document.querySelectorAll(".container2").forEach(r => r.classList.remove("selected"));
  selectedRoomId = null;
  unlockScroll();
}

async function showSuccess() {
  const user        = Auth.getUser();
  const timeInput   = document.querySelector(".time-pickable");
  const dateBtn     = document.getElementById("toggleCalendar");
  const purposeEl   = document.getElementById("reservationPurpose");

  const selectedDate = (dateBtn && dateBtn.textContent !== "Select Date ▼")
    ? dateBtn.textContent : null;
  const selectedTime = (timeInput && timeInput.value) ? timeInput.value : null;

  if (!selectedDate || selectedDate === "No date selected") {
    alert("Please select a date first.");
    return;
  }
  if (!selectedTime || selectedTime === "No time selected") {
    alert("Please select a time first.");
    return;
  }

  const { isoDate, startTime, endTime } = parseSchedule(selectedDate, selectedTime);

  if (!isoDate) {
    alert("Invalid date format. Please re-select a date.");
    return;
  }

  const payload = {
    room_id:        selectedRoomId,
    requestor_name: user?.name || "",
    course_section: user?.course_section || "",
    date:           isoDate,
    start_time:     startTime,
    end_time:       endTime,
    purpose:        purposeEl ? purposeEl.value.trim() : "",
  };

  const proceedBtn = document.getElementById("proceedBtn");
  if (proceedBtn) { proceedBtn.disabled = true; proceedBtn.textContent = "Submitting…"; }

  try {
    await API.createReservation(payload);

    document.querySelectorAll(".container2").forEach(el => {
      if (parseInt(el.dataset.roomId) === selectedRoomId) {
        el.classList.remove("selected");
        el.classList.add("reserved");
        el.dataset.occupied = "true";
      }
    });

    document.getElementById("successTimeBadge").textContent = selectedTime;
    document.getElementById("successDateBadge").textContent = selectedDate;
    document.getElementById("successRoomBadge").textContent = selectedRoomName;
    document.getElementById("reservationModal").style.display = "none";
    document.getElementById("successModal").classList.add("active");

  } catch (err) {
    alert(err.error || "Reservation failed. The time slot may already be taken.");
  } finally {
    if (proceedBtn) { proceedBtn.disabled = false; proceedBtn.textContent = "Proceed"; }
  }
}

function goHome() {
  document.getElementById("successModal").classList.remove("active");
  unlockScroll();
}

function closeSuccess() {
  document.getElementById("successModal").classList.remove("active");
  unlockScroll();
}


function parseSchedule(displayDate, timeStr) {
 
  try {
    const dateObj  = new Date(displayDate);
    const isoDate  = dateObj.toISOString().split("T")[0];

    const [timePart, meridiem] = timeStr.split(" ");
    let [h, m] = timePart.split(":").map(Number);
    if (meridiem === "PM" && h !== 12) h += 12;
    if (meridiem === "AM" && h === 12) h = 0;

    const pad = n => String(n).padStart(2, "0");
    const startTime = `${pad(h)}:${pad(m)}`;
    const endH      = (h + 1) % 24;
    const endTime   = `${pad(endH)}:${pad(m)}`;

    return { isoDate, startTime, endTime };
  } catch {
    return { isoDate: null, startTime: null, endTime: null };
  }
}

function prefillUserInfo() {
  const user = Auth.getUser();
  if (!user) return;

  const nameEls = document.querySelectorAll(".modal-student-name");
  const subjEls = document.querySelectorAll(".modal-subject");
  nameEls.forEach(el => el.textContent = user.name || "");
  subjEls.forEach(el => el.textContent = user.course_section || "");
}

let _scrollPos = 0;
function lockScroll() {
  _scrollPos = window.pageYOffset;
  document.body.style.position = "fixed";
  document.body.style.top      = `-${_scrollPos}px`;
  document.body.style.width    = "100%";
}
function unlockScroll() {
  document.body.style.position = "";
  document.body.style.top      = "";
  window.scrollTo(0, _scrollPos);
}

function initLogout() {
  document.querySelectorAll(".logout-btn").forEach(btn => {
    btn.addEventListener("click", () => API.logout());
  });
}


document.addEventListener("click", e => {
  if (e.target.id === "reservationModal") closeReservation();
  if (e.target.id === "successModal")     goHome();
});
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (document.getElementById("reservationModal")?.style.display === "flex") closeReservation();
  if (document.getElementById("successModal")?.classList.contains("active"))  goHome();
});