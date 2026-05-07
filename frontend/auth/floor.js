(function () {

  var FLOORS   = [2, 3, 4, 5];
  var ORDINALS = { 2: '2ND', 3: '3RD', 4: '4TH', 5: '5TH' };
  var currentIndex = 0;

  var FLOOR_CONFIG = {
    2: (function () {
      var r = [];
      for (var i = 1; i <= 11; i++) r.push({ num: 200 + i, label: 'CAS<br>' + (200 + i) });
      return r;
    })(),
    3: (function () {
      var r = [];
      for (var i = 1; i <= 10; i++) r.push({ num: 300 + i, label: 'CAS<br>' + (300 + i) });
      r.push({ num: 'CLAB-A', label: 'COM<br>LAB A' });
      r.push({ num: 'CLAB-B', label: 'COM<br>LAB B' });
      r.push({ num: 'CLAB-C', label: 'COM<br>LAB C' });
      return r;
    })(),
    4: (function () {
      var r = [];
      for (var i = 1; i <= 11; i++) r.push({ num: 400 + i, label: 'CAS<br>' + (400 + i) });
      return r;
    })(),
    5: (function () {
      var r = [];
      for (var i = 1; i <= 6; i++) r.push({ num: 500 + i, label: 'CAS<br>' + (500 + i) });
      return r;
    })()
  };

  window.__FLOOR_CONFIG = FLOOR_CONFIG;

  function makeRoomDiv(room) {
    var div = document.createElement('div');
    div.className = 'container2';
    div.innerHTML = room.label;
    div.setAttribute('data-room', room.num);

    div.addEventListener('click', function () {
      if (div.classList.contains('reserved')) return;
      document.querySelectorAll('.container2').forEach(function (r) {
        r.classList.remove('selected');
      });
      div.classList.add('selected');
      if (typeof openReservation === 'function') openReservation(room.num);
    });

    return div;
  }

  function chunkArray(arr, size) {
    var chunks = [];
    for (var i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }

  function renderRooms(floorNum) {
    var container = document.querySelector('.Rooms');
    if (!container) return;
    container.innerHTML = '';

    var rooms  = FLOOR_CONFIG[floorNum];
    var chunks = chunkArray(rooms, 5);

    chunks.forEach(function (chunk, idx) {
      var isLast = idx === chunks.length - 1;
      var row = document.createElement('div');
      row.className = 'row';
      chunk.forEach(function (room) { row.appendChild(makeRoomDiv(room)); });
      container.appendChild(row);
    });

    if (typeof window.__res_applyBookedStates === 'function') {
      window.__res_applyBookedStates();
    }
  }

  function goToFloor(index) {
    if (index < 0)              index = 0;
    if (index >= FLOORS.length) index = FLOORS.length - 1;
    currentIndex = index;

    var floorNum = FLOORS[currentIndex];
    window.__CURRENT_FLOOR = floorNum;

    var label = document.getElementById('floorTitle');
    if (label) label.textContent = ORDINALS[floorNum] + ' FLOOR';

    document.querySelectorAll('.floor-num').forEach(function (btn) {
      btn.classList.toggle('floor-num--active', parseInt(btn.getAttribute('data-floor'), 10) === floorNum);
    });

    document.querySelectorAll('.dot').forEach(function (dot, i) {
      dot.classList.toggle('dot--active', i === currentIndex);
    });

    renderRooms(floorNum);

    var arrowUp   = document.getElementById('floorUp');
    var arrowDown = document.getElementById('floorDown');
    if (arrowUp)   arrowUp.style.opacity   = currentIndex === 0                 ? '0.35' : '1';
    if (arrowDown) arrowDown.style.opacity = currentIndex === FLOORS.length - 1 ? '0.35' : '1';
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.floor-num').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = FLOORS.indexOf(parseInt(btn.getAttribute('data-floor'), 10));
        if (idx !== -1) goToFloor(idx);
      });
    });

    var arrowUp   = document.getElementById('floorUp');
    var arrowDown = document.getElementById('floorDown');
    if (arrowUp)   arrowUp.addEventListener('click',   function () { goToFloor(currentIndex - 1); });
    if (arrowDown) arrowDown.addEventListener('click', function () { goToFloor(currentIndex + 1); });

    window.__CURRENT_FLOOR = FLOORS[0];
    goToFloor(0);
  });

})();