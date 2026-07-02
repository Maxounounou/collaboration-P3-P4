const CORRECT_PIN = "4841";

window.onload = function () {
    const unlocked = sessionStorage.getItem("unlocked");

    if (unlocked === "true") {
        unlock();
    } else {
        document.body.classList.add("locked");
    }
};

function checkPin() {
    const value = document.getElementById("pin").value;
    const box = document.getElementById("lock-box");

    if (value === CORRECT_PIN) {
        sessionStorage.setItem("unlocked", "true");
        unlock();
    } else {
        document.getElementById("error").innerText = "❌ Code incorrect";

        box.classList.add("shake");
        setTimeout(() => box.classList.remove("shake"), 300);
    }
}

function unlock() {
    const lock = document.getElementById("lock-screen");

    lock.style.opacity = "0";

    setTimeout(() => {
        lock.style.display = "none";
        document.body.classList.remove("locked");
    }, 250);
}

// =========================
// 📅 CALENDRIER HYBRIDE (V1)
// =========================

let currentDate = new Date();

const monthNames = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

function renderCalendar() {
    const grid = document.getElementById("calendar-grid");
    const title = document.getElementById("month-title");

    if (!grid || !title) return;

    grid.innerHTML = "";

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    title.innerText = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // ajustement (lundi = début)
    const offset = firstDay === 0 ? 6 : firstDay - 1;

    // cases vides avant début du mois
    for (let i = 0; i < offset; i++) {
        const empty = document.createElement("div");
        empty.classList.add("day", "empty");
        grid.appendChild(empty);
    }

    // jours du mois
    for (let day = 1; day <= daysInMonth; day++) {
        const cell = document.createElement("div");
        cell.classList.add("day");
        cell.innerText = day;

        cell.onclick = () => selectDay(day);

        grid.appendChild(cell);
    }
}

function changeMonth(step) {
    currentDate.setMonth(currentDate.getMonth() + step);
    renderCalendar();
}

function selectDay(day) {
    const panel = document.getElementById("day-events");

    if (!panel) return;

    panel.innerHTML = `
        <h3>📅 Jour sélectionné</h3>
        <p><strong>${day} ${monthNames[currentDate.getMonth()]}</strong></p>

        <div class="event">
            <span>📌 Exemple : Réunion équipe</span>
        </div>

        <div class="event">
            <span>🏊 Exemple : Piscine</span>
        </div>
    `;
}

// lancer calendrier après chargement
window.addEventListener("load", renderCalendar);