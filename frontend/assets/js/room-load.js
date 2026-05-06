(() => {
  let buildingId = null;
  let buildingName = "";
  let campusName = "";

  let rooms = [];
  let floors = [];
  let currentFloorIndex = 0;

  let selectedRoom = null; // { id, code, name, room_type, floor }
  let selectedIsoDate = null; // YYYY-MM-DD
  let selectedDisplayDate = null; // e.g. May 10, 2026

  let scrollPosition = 0;

  document.addEventListener("DOMContentLoaded", async () => {
    requireAuth();
    initLogout();

    buildingId = getParam("building_id") || getPageContext("selectedBuilding")?.id;
    buildingName = getParam("building_name")
      ? decodeURIComponent(getParam("building_name"))
      : (getPageContext("selectedBuilding")?.name || "Building");
    campusName = getParam("campus_name")
      ? decodeURIComponent(getParam("campus_name"))
      : (getPageContext("selectedBuilding")?.campusName || "Campus");

    const buildingLabel = document.getElementById("buildingLabel");
    if (buildingLabel) buildingLabel.textContent = `${campusName} – ${buildingName}`;

    // Keep these in sync for the success/receipt-style modal.
    document.querySelectorAll(".campus-name").forEach(el => (el.textContent = campusName));
    document.querySelectorAll(".campus-building").forEach(el => (el.textContent = `${buildingName} Building`));

    if (!buildingId) {
      const container = document.getElementById("roomsContainer");
      if (container) {
        container.innerHTML = `<p style="padding:20px;color:#b91c1c;">No building selected. <a href="campus.html">Go back</a></p>`;
      }
      return;
    }

    wireModalInputs();
    await loadRooms(buildingId);
  });

  async function loadRooms(id) {
    const container = document.getElementById("roomsContainer");
    if (!container) return;

    container.innerHTML = `<p style="padding:20px;color:#6b7280;">Loading rooms…</p>`;

    try {
      const res = await API.getRooms({ building_id: id, is_active: true, per_page: 200 });
      rooms = (res.data?.items || []).slice();

      if (!rooms.length) {
        container.innerHTML = `<p style="padding:20px;color:#6b7280;">No rooms found in this building.</p>`;
        floors = [];
        renderFloorNav();
        return;
      }

      floors = Array.from(
        new Set(rooms.map(r => (r.floor ?? 1)).filter(n => Number.isFinite(n)))
      ).sort((a, b) => a - b);

      // Fallback if floors were null/undefined everywhere.
      if (!floors.length) floors = [1];

      renderFloorNav();
      setFloorIndex(0);
    } catch (err) {
      console.error("Failed to load rooms:", err);
      container.innerHTML = `<p style="padding:20px;color:#b91c1c;">Failed to load rooms. Is the backend running?</p>`;
    }
  }

  function renderFloorNav() {
    const dots = document.getElementById("floorDots");
    const pagination = document.getElementById("floorPagination");

    if (dots) {
      dots.innerHTML = floors
        .map((_, i) => `<span class="dot ${i === currentFloorIndex ? "dot--active" : ""}"></span>`)
        .join("");
    }

    if (pagination) {
      if (!floors.length) {
        pagination.innerHTML = "";
        return;
      }

      pagination.innerHTML = [
        `<button class="floor-nav-arrow" id="floorUp" type="button" aria-label="Previous floor">&lsaquo;</button>`,
        ...floors.map((f, i) => (
          `<button class="floor-btn floor-num ${i === currentFloorIndex ? "floor-num--active" : ""}" type="button" data-floor-index="${i}">${f}</button>`
        )),
        `<button class="floor-nav-arrow" id="floorDown" type="button" aria-label="Next floor">&rsaquo;</button>`,
      ].join("\n");

      const up = document.getElementById("floorUp");
      const down = document.getElementById("floorDown");
      if (up) up.addEventListener("click", () => setFloorIndex(currentFloorIndex - 1));
      if (down) down.addEventListener("click", () => setFloorIndex(currentFloorIndex + 1));

      pagination.querySelectorAll("[data-floor-index]").forEach(btn => {
        btn.addEventListener("click", () => setFloorIndex(parseInt(btn.dataset.floorIndex, 10)));
      });
    }
  }

  function setFloorIndex(index) {
    if (!floors.length) return;
    const next = Math.max(0, Math.min(index, floors.length - 1));
    currentFloorIndex = next;

    const floor = floors[currentFloorIndex];
    const title = document.getElementById("floorTitle");
    if (title) title.textContent = `${ordinal(floor)} FLOOR`;

    renderFloorNav();
    renderRoomsForFloor(floor);
  }

  function renderRoomsForFloor(floor) {
    const container = document.getElementById("roomsContainer");
    if (!container) return;

    const roomsOnFloor = rooms
      .filter(r => (r.floor ?? 1) === floor)
      .sort((a, b) => String(a.code).localeCompare(String(b.code)));

    if (!roomsOnFloor.length) {
      container.innerHTML = `<p style="padding:20px;color:#6b7280;">No rooms on this floor.</p>`;
      return;
    }

    container.innerHTML = roomsOnFloor
      .map(r => {
        const reserved = r.is_occupied ? "reserved" : "";
        const title = escapeHtml(r.name || r.code || "Room");
        const label = escapeHtml(r.code || r.name || "Room");
        return `<div class="container2 ${reserved}" data-room-id="${r.id}" title="${title}">${label}</div>`;
      })
      .join("");

    container.querySelectorAll(".container2").forEach(el => {
      el.addEventListener("click", () => {
        if (el.classList.contains("reserved")) return;
        container.querySelectorAll(".container2").forEach(x => x.classList.remove("selected"));
        el.classList.add("selected");

        const roomId = (el.dataset.roomId || "").trim();
        const room = rooms.find(r => String(r.id) === roomId);
        if (!room) return;
        openReservationModal(room);
      });
    });
  }

  function openReservationModal(room) {
    selectedRoom = {
      id: room.id,
      code: room.code || room.name || "Room",
      name: room.name || room.code || "Room",
      room_type: room.room_type,
      floor: room.floor ?? 1,
    };

    const user = Auth.getUser();
    setText("modalStudentName", user?.name || "—");
    setText("modalSubject", user?.course_section || "—");

    setText("modalRoomBadge", selectedRoom.code);

    // Reset schedule inputs and badges.
    selectedIsoDate = null;
    selectedDisplayDate = null;
    const calBtn = document.getElementById("toggleCalendar");
    if (calBtn) {
      const textEl = calBtn.querySelector(".date-text");
      if (textEl) textEl.textContent = "Select Date ▼";
      else calBtn.textContent = "Select Date ▼";
    }
    const timeInput = document.getElementById("startTimeInput");
    if (timeInput) timeInput.value = "";
    const reason = document.getElementById("reasonInput");
    if (reason) reason.value = "";

    setText("modalDateBadge", "No date selected");
    setText("modalTimeBadge", "No time selected");
    setText("modalReasonBadge", "No reason provided");

    const proceed = document.getElementById("proceedBtn");
    if (proceed) {
      const canReserve = Auth.canReserve();
      proceed.disabled = !canReserve;
      proceed.textContent = canReserve ? "Proceed" : "Not allowed";

      let hint = document.getElementById("reserveRoleHint");
      if (!hint) {
        hint = document.createElement("p");
        hint.id = "reserveRoleHint";
        hint.style.cssText = "margin-top:10px;color:#6b7280;font-size:12px;text-align:center;";
        const row = proceed.closest(".btn-row");
        if (row && row.parentNode) {
          row.parentNode.insertBefore(hint, row.nextSibling);
        }
      }
      hint.textContent = canReserve
        ? ""
        : "Only authorized users (professors/student officers) can reserve rooms.";
    }

    const overlay = document.getElementById("reservationModal");
    if (overlay) overlay.style.display = "flex";
    lockScroll();
  }

  function closeReservation() {
    const overlay = document.getElementById("reservationModal");
    if (overlay) overlay.style.display = "none";
    unlockScroll();
  }

  async function submitReservation() {
    if (!selectedRoom) {
      alert("Please select a room first.");
      return;
    }

    const timeInput = document.getElementById("startTimeInput");
    const durationSelect = document.getElementById("durationSelect");
    const reasonEl = document.getElementById("reasonInput");

    const startTime12 = (timeInput?.value || "").trim();
    const durationHours = parseInt(durationSelect?.value || "1", 10);
    const purpose = (reasonEl?.value || "").trim();

    if (!selectedIsoDate) {
      alert("Please select a date.");
      return;
    }
    if (!startTime12) {
      alert("Please select a start time.");
      return;
    }
    if (!Number.isFinite(durationHours) || durationHours <= 0) {
      alert("Invalid duration.");
      return;
    }

    const startMinutes = parseTime12ToMinutes(startTime12);
    if (startMinutes == null) {
      alert("Invalid start time format.");
      return;
    }

    const endMinutes = startMinutes + durationHours * 60;
    if (endMinutes > 24 * 60) {
      alert("End time cannot pass midnight. Please choose an earlier time.");
      return;
    }

    const startTime24 = minutesTo24(startMinutes);
    const endTime24 = minutesTo24(endMinutes);

    const timeRange = `${minutesTo12(startMinutes)} - ${minutesTo12(endMinutes)}`;

    const user = Auth.getUser();
    const payload = {
      room_id: selectedRoom.id,
      requestor_name: user?.name || "",
      course_section: user?.course_section || "",
      date: selectedIsoDate,
      start_time: startTime24,
      end_time: endTime24,
      purpose,
    };

    const proceed = document.getElementById("proceedBtn");
    if (proceed) {
      proceed.disabled = true;
      proceed.textContent = "Submitting…";
    }

    try {
      await API.createReservation(payload);

      // Update success modal details.
      setText("successStudentName", user?.name || "—");
      setText("successSubject", user?.course_section || "—");
      setText("successRoomBadge", selectedRoom.code);
      setText("successDateBadge", selectedDisplayDate || selectedIsoDate);
      setText("successTimeBadge", timeRange);
      setText("successReasonBadge", purpose || "—");

      // Mirror badges in the reservation modal.
      setText("modalDateBadge", selectedDisplayDate || selectedIsoDate);
      setText("modalTimeBadge", timeRange);
      setText("modalReasonBadge", purpose || "No reason provided");

      closeReservation();

      const success = document.getElementById("successModal");
      if (success) success.classList.add("active");
    } catch (err) {
      alert(err?.error || "Reservation failed. The time slot may already be taken.");
    } finally {
      if (proceed) {
        proceed.disabled = false;
        proceed.textContent = "Proceed";
      }
    }
  }

  function closeSuccess() {
    const success = document.getElementById("successModal");
    if (success) success.classList.remove("active");
    unlockScroll();
  }

  function goHome() {
    window.location.href = "dashboard.html";
  }

  function wireModalInputs() {
    // Hook calendar.js output via its callback.
    window.onDateSelected = (formatted, iso) => {
      selectedIsoDate = iso;
      selectedDisplayDate = formatted;
      setText("modalDateBadge", formatted);
    };

    const timeInput = document.getElementById("startTimeInput");
    if (timeInput) {
      timeInput.addEventListener("input", () => {
        if (!timeInput.value) return;
        // Just reflect chosen start time for now; range is computed on submit.
        setText("modalTimeBadge", timeInput.value);
      });
    }

    const reason = document.getElementById("reasonInput");
    if (reason) {
      reason.addEventListener("input", () => {
        setText("modalReasonBadge", reason.value.trim() || "No reason provided");
      });
    }

    // Close overlays on click outside + Escape.
    document.addEventListener("click", e => {
      if (e.target?.id === "reservationModal") closeReservation();
      if (e.target?.id === "successModal") closeSuccess();
    });
    document.addEventListener("keydown", e => {
      if (e.key !== "Escape") return;
      const res = document.getElementById("reservationModal");
      if (res?.style.display === "flex") closeReservation();
      const success = document.getElementById("successModal");
      if (success?.classList.contains("active")) closeSuccess();
    });

    // Expose functions for existing inline onclick handlers.
    window.closeReservation = closeReservation;
    window.showSuccess = submitReservation;
    window.closeSuccess = closeSuccess;
    window.goHome = goHome;
  }

  function initLogout() {
    document.querySelectorAll(".logout-btn").forEach(btn => {
      btn.addEventListener("click", () => API.logout());
    });
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function lockScroll() {
    scrollPosition = window.pageYOffset || document.documentElement.scrollTop || 0;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollPosition}px`;
    document.body.style.width = "100%";
  }

  function unlockScroll() {
    document.body.style.position = "";
    document.body.style.top = "";
    window.scrollTo(0, scrollPosition);
  }

  function ordinal(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return String(n);
    const s = ["TH", "ST", "ND", "RD"];
    const v = num % 100;
    return `${num}${s[(v - 20) % 10] || s[v] || s[0]}`;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function parseTime12ToMinutes(value) {
    // Accept "HH:MM AM" / "H:MM PM" (time.js output), with flexible spacing.
    const match = String(value).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return null;
    let hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    const meridiem = match[3].toUpperCase();

    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
    if (meridiem === "PM" && hour !== 12) hour += 12;
    if (meridiem === "AM" && hour === 12) hour = 0;
    return hour * 60 + minute;
  }

  function minutesTo24(totalMinutes) {
    const mins = totalMinutes % (24 * 60);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function minutesTo12(totalMinutes) {
    const mins = totalMinutes % (24 * 60);
    let h24 = Math.floor(mins / 60);
    const m = mins % 60;
    const meridiem = h24 >= 12 ? "PM" : "AM";
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${meridiem}`;
  }
})();
