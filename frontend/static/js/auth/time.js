
function activate() {
    document.querySelectorAll(".time-pickable").forEach(timePickable => {
        let activePicker = null;

        timePickable.addEventListener("focus", () => {
            if (activePicker) return;

            activePicker = show(timePickable);

            const onClickAway = ({ target }) => {
                if (
                    target === activePicker ||
                    target === timePickable ||
                    activePicker.contains(target)
                ) return;

                document.removeEventListener("mousedown", onClickAway);
                document.body.removeChild(activePicker);
                activePicker = null;
            };

            document.addEventListener("mousedown", onClickAway);
        });
    });
}

function show(timePickable) {
    const picker = buildPicker(timePickable);
    const rect = timePickable.getBoundingClientRect();

    picker.style.top = `${rect.bottom + window.scrollY}px`;
    picker.style.left = `${rect.left + window.scrollX}px`;

    document.body.appendChild(picker);
    return picker;
}

function buildPicker(timePickable) {
    const picker = document.createElement("div");

    const hourOptions = Array.from({ length: 12 }, (_, i) => i + 1)
        .map(numberToOption);

    const minuteOptions = Array.from({ length: 12 }, (_, i) => i * 5)
        .map(numberToOption);

    picker.classList.add("time-picker");

    picker.innerHTML = `
        <select class="time-picker__select">
            ${hourOptions.join("")}
        </select>
        :
        <select class="time-picker__select">
            ${minuteOptions.join("")}
        </select>
        <select class="time-picker__select">
            <option value="AM">AM</option>
            <option value="PM">PM</option>
        </select>
    `;

    const selects = picker.querySelectorAll("select");

    selects.forEach(sel => {
        sel.addEventListener("change", () => {
            timePickable.value = getTimeString(picker);
        });
    });

    return picker;
}

function getTimeString(picker) {
    const [hour, minute, meridiem] = picker.querySelectorAll("select");
    return `${hour.value}:${minute.value} ${meridiem.value}`;
}   


function numberToOption(num) {
    const padded = num.toString().padStart(2, "0");
    return `<option value="${padded}">${padded}</option>`;
}

activate();