/* ═══════════════════════════════════════════════════
   reservation.js  –  PLV Reservation System
   ═══════════════════════════════════════════════════ */

(function () {

  /* ════════════════════════════════════════════════
     SHARED BOOKING STORE
     bookings[roomNum][dateKey] = [startHour, ...]
  ════════════════════════════════════════════════ */
  const bookings = {};

  // Frontend room keys (from floor.js) -> backend Room.id
  // DB sample: RM201..RM510, CL1..CL3
  const _ROOM_ID_MAP = {
    'CLAB-A': 'CL1',
    'CLAB-B': 'CL2',
    'CLAB-C': 'CL3',
  };

  // cacheKey = `${roomId}|${dateKey}` -> Promise<hours[]>
  const _schedulePromises = {};

  function roomIdFor(roomNum) {
    if (roomNum === null || roomNum === undefined) return null;
    if (Object.prototype.hasOwnProperty.call(_ROOM_ID_MAP, roomNum)) return _ROOM_ID_MAP[roomNum];
    if (typeof roomNum === 'number') return `RM${roomNum}`;
    const s = String(roomNum).trim();
    if (!s) return null;
    if (/^RM\\d+$/i.test(s)) return s.toUpperCase();
    if (/^CL\\d+$/i.test(s)) return s.toUpperCase();
    if (/^\\d+$/.test(s)) return `RM${s}`;
    return s;
  }

  function hoursFromSchedule(schedule) {
    const hours = new Set();
    (schedule || []).forEach(function (r) {
      const start = parseInt(String(r.start_time || '').slice(0, 2), 10);
      const end = parseInt(String(r.end_time || '').slice(0, 2), 10);
      if (!Number.isFinite(start) || !Number.isFinite(end)) return;
      for (let h = start; h < end; h++) hours.add(h);
    });
    return Array.from(hours);
  }

  async function ensureServerBookings(roomNum, dateKey) {
    const roomId = roomIdFor(roomNum);
    if (!roomId || !dateKey) return [];

    const cacheKey = `${roomId}|${dateKey}`;
    if (!_schedulePromises[cacheKey]) {
      _schedulePromises[cacheKey] = (async function () {
        if (!window.CSMS || !window.CSMS.api || typeof window.CSMS.api.request !== 'function') return [];
        const resp = await window.CSMS.api.request(
          `/api/rooms/${encodeURIComponent(roomId)}/schedule?date=${encodeURIComponent(dateKey)}`,
          { method: 'GET' }
        );
        const schedule = resp && resp.data && Array.isArray(resp.data.schedule) ? resp.data.schedule : [];
        return hoursFromSchedule(schedule);
      })();
    }

    const hours = await _schedulePromises[cacheKey];
    if (!bookings[roomNum]) bookings[roomNum] = {};
    bookings[roomNum][dateKey] = hours;
    return hours;
  }

  /* ════════════════════════════════════════════════
     CONSTANTS / HELPERS
  ════════════════════════════════════════════════ */
  const HOUR_SLOTS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  const MONTHS     = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];
  const WEEKDAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  function fmt2(n)  { return String(n).padStart(2, '0'); }
  function toKey(d) { return `${d.getFullYear()}-${fmt2(d.getMonth()+1)}-${fmt2(d.getDate())}`; }
  function to12h(h) { const ap = h < 12 ? 'AM' : 'PM'; return `${h % 12 || 12}:00 ${ap}`; }

  /* ─────────────────────────────────────────────────
     isRoomFullyBooked(roomNum, dateKey, duration)
     [CHANGED] Now checks time-slot occupancy for ALL room types,
     including ComLabs (string keys). Only returns true when
     EVERY valid start hour is occupied.
  ───────────────────────────────────────────────── */
  function isRoomFullyBooked(roomNum, dateKey, duration) {
    // [CHANGED] Now check time-slot occupancy for both numeric and string rooms
    for (const h of HOUR_SLOTS) {
      if (h + duration > 21) continue;
      const hrs = (bookings[roomNum] || {})[dateKey] || [];
      let blocked = false;
      for (let i = h; i < h + duration; i++) {
        if (hrs.includes(i)) { blocked = true; break; }
      }
      if (!blocked) return false; // at least one slot free → not fully booked
    }
    return true; // every slot is occupied
  }

  /* Returns true if a specific window is occupied */
  function isRoomBooked(roomNum, dateKey, startHour, duration) {
    const hrs = (bookings[roomNum] || {})[dateKey] || [];
    for (let h = startHour; h < startHour + duration; h++) {
      if (hrs.includes(h)) return true;
    }
    return false;
  }

  /* ════════════════════════════════════════════════
     APPLY ROOM STATES
     Rules (checked in order):
       1. Permanently disabled → BOOKED_ROOMS set
       2. No date selected     → all rooms enabled
       3. Date selected        → disable only rooms
          where ALL slots for the chosen duration
          are occupied on that date
  ════════════════════════════════════════════════ */
  function applyBookedStates() {
    // Server-backed schedules can change; don't "lock" rooms based on stale client-only data.
    document.querySelectorAll('.container2').forEach(function (div) {
      div.classList.remove('reserved');
    });
  }

  /* ════════════════════════════════════════════════
     AVAILABILITY PANEL STATE
  ════════════════════════════════════════════════ */
  let panelDate     = null;
  let panelHour     = null;
  let panelDuration = 1;
  let panelCalOpen  = false;
  let panelCalDate  = new Date();

  function refreshPanel() {
    renderPanelGrid();
    applyBookedStates();
  }

  /* ─── Panel availability grid ──────────────────── */
  function renderPanelGrid() {
    const grid = document.getElementById('avail-grid');
    if (!grid) return;

    if (!panelDate || panelHour === null) {
      grid.innerHTML = '<div class="avail-empty">Select a date and time slot above to see room availability.</div>';
      return;
    }

    const key = toKey(panelDate);
    const floor = window.__CURRENT_FLOOR || 2;
    const config = window.__FLOOR_CONFIG || {};
    const floorRooms = config[floor] || [];

    const from = `${fmt2(panelHour)}:00`;
    const until = `${fmt2(panelHour + panelDuration)}:00`;
    const reqId = `${key}|${from}|${until}|${floor}`;
    renderPanelGrid._lastReqId = reqId;

    grid.innerHTML = '<div class="avail-empty">Loading availability...</div>';

    (async function () {
      try {
        if (!window.CSMS || !window.CSMS.api || typeof window.CSMS.api.request !== 'function') {
          throw new Error('API client not initialized');
        }

        // Current UI is Annex/CAS; keep same building id unless the page supports selection.
        const resp = await window.CSMS.api.request(
          `/api/rooms?building_id=BLDGNX001&available_on=${encodeURIComponent(key)}` +
            `&available_from=${encodeURIComponent(from)}&available_until=${encodeURIComponent(until)}` +
            `&per_page=100`,
          { method: 'GET' }
        );

        if (renderPanelGrid._lastReqId !== reqId) return;

        const items = resp && resp.data && resp.data.items ? resp.data.items : [];
        const availableIds = new Set(items.map((r) => r.id));

        let html = '';
        floorRooms.forEach(function (room) {
          const roomId = roomIdFor(room.num);
          const occupied = roomId ? !availableIds.has(roomId) : true;
          const cls = occupied ? 'avail-room avail-room--occupied' : 'avail-room avail-room--free';
          const status = occupied ? 'Occupied' : 'Available';
          const plain = room.label.replace(/<br>/gi, ' ');

          html += `<div class="${cls}">
            <span class="avail-room-num">${plain}</span>
            <span class="avail-room-status">${status}</span>
          </div>`;
        });

        grid.innerHTML = html || '<div class="avail-empty">No rooms configured for this floor.</div>';
      } catch (e) {
        if (renderPanelGrid._lastReqId !== reqId) return;
        grid.innerHTML = '<div class="avail-empty">Failed to load availability.</div>';
      }
    })();
  }

  /* ─── Panel calendar ───────────────────────────── */
  function renderPanelCal() {
    const drop = document.getElementById('panel-cal-drop');
    if (!drop) return;

    const year     = panelCalDate.getFullYear();
    const month    = panelCalDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDay  = new Date(year, month + 1, 0).getDate();
    const prevLast = new Date(year, month, 0).getDate();
    const today    = new Date();

    let html = `<div class="cal-header">
      <button class="cal-nav" onclick="__panel_shiftCal(-1)">&#8249;</button>
      <span>${MONTHS[month]} ${year}</span>
      <button class="cal-nav" onclick="__panel_shiftCal(1)">&#8250;</button>
    </div>
    <div class="cal-weekdays">${WEEKDAYS.map(d => `<div>${d}</div>`).join('')}</div>
    <div class="cal-days">`;

    for (let i = firstDay; i > 0; i--) html += `<div class="day fade">${prevLast - i + 1}</div>`;
    for (let i = 1; i <= lastDay; i++) {
      const d      = new Date(year, month, i);
      const isPast = d < new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const isSel  = panelDate && toKey(d) === toKey(panelDate);
      const isTod  = i === today.getDate() && month === today.getMonth() && year === today.getFullYear();
      let cls = 'day';
      if (isPast) cls += ' past';
      else if (isSel) cls += ' selected';
      else if (isTod) cls += ' today';
      const click = isPast ? '' : `onclick="__panel_pickDate(${year},${month},${i})"`;
      html += `<div class="${cls}" ${click}>${i}</div>`;
    }
    const used = firstDay + lastDay;
    const rem  = Math.ceil(used / 7) * 7 - used;
    for (let i = 1; i <= rem; i++) html += `<div class="day fade">${i}</div>`;
    html += '</div>';
    drop.innerHTML = html;
  }

  window.__panel_shiftCal = function (dir) {
    panelCalDate.setMonth(panelCalDate.getMonth() + dir);
    renderPanelCal();
  };

  window.__panel_pickDate = function (y, m, d) {
    panelDate    = new Date(y, m, d);
    panelHour    = null;
    panelCalOpen = false;

    const drop    = document.getElementById('panel-cal-drop');
    const trigger = document.getElementById('panel-date-btn');
    if (drop)    drop.style.display = 'none';
    if (trigger) trigger.classList.remove('open');

    const label = panelDate.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
    const span  = document.getElementById('panel-date-text');
    if (span) span.textContent = label;

    renderPanelSlots();
    renderPanelGrid();
    applyBookedStates();
  };

  window.__panel_toggleCal = function () {
    const drop    = document.getElementById('panel-cal-drop');
    const trigger = document.getElementById('panel-date-btn');
    if (!drop) return;
    panelCalOpen = !panelCalOpen;
    drop.style.display = panelCalOpen ? 'block' : 'none';
    if (trigger) trigger.classList.toggle('open', panelCalOpen);
    if (panelCalOpen) renderPanelCal();
  };

  /* ─── Panel time slots ─────────────────────────── */
  function renderPanelSlots() {
    const wrap = document.getElementById('panel-slots');
    if (!wrap) return;

    if (!panelDate) {
      wrap.innerHTML = '<span class="panel-slot-hint">Pick a date first</span>';
      return;
    }

    let html = '';
    HOUR_SLOTS.forEach(function (h) {
      if (h + panelDuration > 21) return;
      const isSel = panelHour === h;
      html += `<button class="panel-slot${isSel ? ' panel-slot--active' : ''}"
                        onclick="__panel_pickSlot(${h})">${to12h(h)}</button>`;
    });
    wrap.innerHTML = html;
  }

  window.__panel_pickSlot = function (h) {
    panelHour = h;
    renderPanelSlots();
    renderPanelGrid();
    /* Re-evaluate room colours when a slot is picked */
    applyBookedStates();
  };

  window.__panel_changeDuration = function (val) {
    panelDuration = parseInt(val, 10);
    panelHour     = null;
    renderPanelSlots();
    renderPanelGrid();
    applyBookedStates();
  };

  /* Close panel calendar on outside click */
  document.addEventListener('click', function (e) {
    if (!panelCalOpen) return;
    const trigger = document.getElementById('panel-date-btn');
    const drop    = document.getElementById('panel-cal-drop');
    if (trigger && !trigger.contains(e.target) && drop && !drop.contains(e.target)) {
      panelCalOpen = false;
      drop.style.display = 'none';
      if (trigger) trigger.classList.remove('open');
    }
  });

  /* ════════════════════════════════════════════════
     MODAL STATE
  ════════════════════════════════════════════════ */
  let selectedRoom  = null;
  let selectedDate  = null;
  let selectedSlot  = null;
  let calDate       = new Date();
  let calOpen       = false;

  function getDuration() {
    const sel = document.getElementById('durationSelect');
    return sel ? parseInt(sel.value, 10) : 2;
  }

  function getReason() {
    const inp = document.getElementById('reasonInput');
    return inp ? inp.value.trim() : '';
  }

  /* ─── Modal calendar ───────────────────────────── */
  function renderCal() {
    const drop = document.getElementById('calDropdown');
    if (!drop) return;

    const year     = calDate.getFullYear();
    const month    = calDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDay  = new Date(year, month + 1, 0).getDate();
    const prevLast = new Date(year, month, 0).getDate();
    const today    = new Date();

    let html = `<div class="cal-header">
      <button class="cal-nav" onclick="__res_shiftCal(-1)">&#8249;</button>
      <span>${MONTHS[month]} ${year}</span>
      <button class="cal-nav" onclick="__res_shiftCal(1)">&#8250;</button>
    </div>
    <div class="cal-weekdays">${WEEKDAYS.map(d => `<div>${d}</div>`).join('')}</div>
    <div class="cal-days">`;

    for (let i = firstDay; i > 0; i--) html += `<div class="day fade">${prevLast - i + 1}</div>`;
    for (let i = 1; i <= lastDay; i++) {
      const d      = new Date(year, month, i);
      const isPast = d < new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const isSel  = selectedDate && toKey(d) === toKey(selectedDate);
      const isTod  = i === today.getDate() && month === today.getMonth() && year === today.getFullYear();
      let cls = 'day';
      if (isPast) cls += ' past';
      else if (isSel) cls += ' selected';
      else if (isTod) cls += ' today';
      const click = isPast ? '' : `onclick="__res_pickDate(${year},${month},${i})"`;
      html += `<div class="${cls}" ${click}>${i}</div>`;
    }
    const used = firstDay + lastDay;
    const rem  = Math.ceil(used / 7) * 7 - used;
    for (let i = 1; i <= rem; i++) html += `<div class="day fade">${i}</div>`;
    html += '</div>';
    drop.innerHTML = html;
  }

  window.__res_shiftCal = function (dir) {
    calDate.setMonth(calDate.getMonth() + dir);
    renderCal();
  };

  window.__res_pickDate = async function (y, m, d) {
    selectedDate = new Date(y, m, d);
    selectedSlot = null;

    calOpen = false;
    const drop    = document.getElementById('calDropdown');
    const trigger = document.getElementById('dateTrigger');
    if (drop)    drop.style.display = 'none';
    if (trigger) trigger.classList.remove('open');

    const label = selectedDate.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
    const trigText = document.getElementById('dateTriggerText');
    if (trigText) trigText.textContent = label;

    setBadge('modalDateBadge', label);
    const timeB = document.getElementById('modalTimeBadge');
    if (timeB) { timeB.textContent = 'No time selected'; timeB.classList.add('badge--empty'); }

    // Hydrate reserved hours from the backend before rendering slots.
    if (selectedRoom) {
      const key = toKey(selectedDate);
      const grid = document.getElementById('slotsGrid');
      if (grid) {
        grid.innerHTML = `<div style="grid-column:1/-1;font-size:12px;color:#9aa0b8;
          font-family:'Poppins',sans-serif;padding:8px 0;">Loading schedule...</div>`;
      }
      try {
        await ensureServerBookings(selectedRoom, key);
      } catch {
        // Keep UI usable; server will still validate on submit.
      }
    }

    updateProceedBtn();
    renderSlots();
  };

  window.__res_toggleCal = function () {
    const drop    = document.getElementById('calDropdown');
    const trigger = document.getElementById('dateTrigger');
    if (!drop) return;
    calOpen = !calOpen;
    drop.style.display = calOpen ? 'block' : 'none';
    if (trigger) trigger.classList.toggle('open', calOpen);
    if (calOpen) renderCal();
  };

  document.addEventListener('click', function (e) {
    if (!calOpen) return;
    const trigger = document.getElementById('dateTrigger');
    const drop    = document.getElementById('calDropdown');
    if (trigger && !trigger.contains(e.target) && drop && !drop.contains(e.target)) {
      calOpen = false;
      drop.style.display = 'none';
      trigger.classList.remove('open');
    }
  });

  /* ─── Modal time slots ─────────────────────────── */
  function renderSlots() {
    const grid = document.getElementById('slotsGrid');
    if (!grid) return;

    if (!selectedDate) {
      grid.innerHTML = `<div style="grid-column:1/-1;font-size:12px;color:#9aa0b8;
        font-family:'Poppins',sans-serif;padding:8px 0;">
        Select a date first to see available slots.</div>`;
      return;
    }

    const duration = getDuration();
    const key      = toKey(selectedDate);
    let html       = '';
    let hasAnyFree = false;

    HOUR_SLOTS.forEach(function (h) {
      if (h + duration > 21) return;
      const occupied   = isRoomBooked(selectedRoom, key, h, duration);
      const isSelected = selectedSlot === h;
      if (!occupied) hasAnyFree = true;
      let cls = 'slot';
      if (occupied)        cls += ' slot--reserved';
      else if (isSelected) cls += ' slot--selected';
      const click = occupied ? '' : `onclick="__res_pickSlot(${h})"`;
      html += `<div class="${cls}" ${click}>${to12h(h)}<br>– ${to12h(h + duration)}</div>`;
    });

    grid.innerHTML = html || `<div style="grid-column:1/-1;font-size:12px;color:#9aa0b8;
      font-family:'Poppins',sans-serif;padding:8px 0;">
      No available slots for this duration on the selected date.</div>`;

    /* ── Disable Proceed if no free slot exists for this room+date+duration ── */
    updateProceedBtn(hasAnyFree);
  }

  window.__res_pickSlot = function (h) {
    selectedSlot = h;
    renderSlots();
    const duration = getDuration();
    setBadge('modalTimeBadge', `${to12h(h)} – ${to12h(h + duration)}`);
    updateProceedBtn();
  };

  /* ════════════════════════════════════════════════
     PROCEED BUTTON
     Enabled only when:
       • a date is chosen
       • a time slot is chosen
       • that slot is not occupied
       • there is at least one free slot for the room
         on that date with the selected duration
         (hasAnyFree guard passed from renderSlots)
  ════════════════════════════════════════════════ */
  function updateProceedBtn(hasAnyFree) {
    const btn = document.getElementById('proceedBtn');
    if (!btn) return;

    /* If caller passes hasAnyFree explicitly, respect it */
    if (hasAnyFree === false) {
      btn.disabled = true;
      return;
    }

    /* Otherwise: need a picked date AND a picked (non-occupied) slot */
    if (!selectedDate || selectedSlot === null) {
      btn.disabled = true;
      return;
    }

    /* Double-check the chosen slot wasn't somehow already booked */
    const key      = toKey(selectedDate);
    const duration = getDuration();
    const stillFree = !isRoomBooked(selectedRoom, key, selectedSlot, duration);
    btn.disabled = !stillFree;
  }

  /* ─── Badge helpers ────────────────────────────── */
  function setBadge(id, text) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.classList.remove('badge--empty');
  }

  /* ════════════════════════════════════════════════
     PUBLIC API
  ════════════════════════════════════════════════ */
  window.openReservation = function (roomNum) {
    selectedRoom = roomNum;
    selectedDate = null;
    selectedSlot = null;

    const trigText = document.getElementById('dateTriggerText');
    if (trigText) trigText.textContent = 'Select date';

    const dateBadge = document.getElementById('modalDateBadge');
    const timeBadge = document.getElementById('modalTimeBadge');
    if (dateBadge) { dateBadge.textContent = 'No date selected'; dateBadge.classList.add('badge--empty'); }
    if (timeBadge) { timeBadge.textContent = 'No time selected'; timeBadge.classList.add('badge--empty'); }

    const reasonInput = document.getElementById('reasonInput');
    if (reasonInput) reasonInput.value = '';
    const reasonBadge = document.getElementById('modalReasonBadge');
    if (reasonBadge) { reasonBadge.textContent = 'No reason provided'; reasonBadge.classList.add('badge--empty'); }

    const roomLabel = typeof roomNum === 'string'
      ? roomNum.replace('CLAB-', 'COM LAB ')
      : `CAS – ROOM ${roomNum}`;
    setBadge('modalRoomBadge', roomLabel);

    renderSlots();
    updateProceedBtn();

    const overlay = document.getElementById('reservationModal');
    if (overlay) overlay.style.display = 'flex';
  };

  window.selectFloor = function () { /* handled by floor.js */ };

  window.closeReservation = function () {
    const overlay = document.getElementById('reservationModal');
    if (overlay) overlay.style.display = 'none';
  };

  window.showSuccess = async function () {
    if (!selectedDate || selectedSlot === null) return;

    const duration = getDuration();
    const key = toKey(selectedDate);

    /* Final guard — slot must still be free (based on the latest loaded schedule) */
    if (isRoomBooked(selectedRoom, key, selectedSlot, duration)) return;

    const dateLabel = selectedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const timeLabel = `${to12h(selectedSlot)} – ${to12h(selectedSlot + duration)}`;
    const reason = getReason() || '—';

    const roomId = roomIdFor(selectedRoom);
    if (!roomId) {
      alert('Invalid room selection.');
      return;
    }

    if (!window.CSMS || !window.CSMS.api || !window.CSMS.auth) {
      alert('App not initialized. Please refresh the page.');
      return;
    }

    const user = window.CSMS.auth.getUser && window.CSMS.auth.getUser();
    const requestorName = user && user.name ? user.name : null;
    const courseSection = user && user.course_section ? user.course_section : null;

    if (!requestorName || !courseSection) {
      alert('Please update your profile (name and course/section) before reserving.');
      window.location.href = 'profile2.html';
      return;
    }

    const startTime = `${fmt2(selectedSlot)}:00`;
    const endTime = `${fmt2(selectedSlot + duration)}:00`;

    const proceedBtn = document.getElementById('proceedBtn');
    if (proceedBtn) proceedBtn.disabled = true;

    try {
      await window.CSMS.api.request('/api/reservations', {
        method: 'POST',
        body: {
          room_id: roomId,
          requestor_name: requestorName,
          course_section: courseSection,
          date: key,
          start_time: startTime,
          end_time: endTime,
          purpose: reason && reason !== '—' ? reason : '',
        },
      });

      // Refresh schedule cache for this room/date so the UI updates immediately.
      const cacheKey = `${roomId}|${key}`;
      delete _schedulePromises[cacheKey];
      await ensureServerBookings(selectedRoom, key);

      refreshPanel();

      const roomLabel = typeof selectedRoom === 'string'
        ? selectedRoom.replace('CLAB-', 'COM LAB ')
        : `CAS – ROOM ${selectedRoom}`;

      setBadge('successDateBadge', dateLabel);
      setBadge('successTimeBadge', timeLabel);
      setBadge('successRoomBadge', roomLabel);
      setBadge('successReasonBadge', reason);

      const overlay = document.getElementById('reservationModal');
      const success = document.getElementById('successModal');
      if (overlay) overlay.style.display = 'none';
      if (success) success.classList.add('active');
    } catch (e) {
      alert((e && e.message) ? e.message : 'Failed to create reservation.');
    } finally {
      if (proceedBtn) proceedBtn.disabled = false;
    }
  };

  window.closeSuccess = function () {
    const success = document.getElementById('successModal');
    const overlay = document.getElementById('reservationModal');
    if (success) success.classList.remove('active');
    if (overlay) overlay.style.display = 'flex';
  };

  window.goHome = function () {
    const success = document.getElementById('successModal');
    if (success) success.classList.remove('active');
    window.location.href = 'dashboard.html';
  };

  /* ─── Live listeners ───────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {

    const reasonInput = document.getElementById('reasonInput');
    if (reasonInput) {
      reasonInput.addEventListener('input', function () {
        const badge = document.getElementById('modalReasonBadge');
        if (!badge) return;
        const val = reasonInput.value.trim();
        if (val) {
          badge.textContent = val;
          badge.classList.remove('badge--empty');
        } else {
          badge.textContent = 'No reason provided';
          badge.classList.add('badge--empty');
        }
      });
    }

    const dur = document.getElementById('durationSelect');
    if (dur) dur.addEventListener('change', function () {
      selectedSlot = null;
      const timeBadge = document.getElementById('modalTimeBadge');
      if (timeBadge) { timeBadge.textContent = 'No time selected'; timeBadge.classList.add('badge--empty'); }
      /* Re-render slots; updateProceedBtn is called inside renderSlots */
      renderSlots();
    });

    renderPanelSlots();
    renderPanelGrid();
  });

  /* ─── Expose for floor.js ──────────────────────── */
  window.__res_applyBookedStates = applyBookedStates;

})();
