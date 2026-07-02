const CORRECT_PIN = "4841";

// 🔑 AIRTABLE
const AIRTABLE_TOKEN = "TON_TOKEN_ICI";
const BASE_ID = "TON_BASE_ID_ICI";
const TABLE = "Calendrier";

let events = [];

// =========================
// 🔒 INITIALISATION LOCK
// =========================

window.addEventListener("load", () => {
    const unlocked = sessionStorage.getItem("unlocked");

    if (unlocked === "true") {
        unlock();
        initApp(); // 👉 on démarre Airtable + calendrier
    } else {
        document.body.classList.add("locked");
    }
});

// =========================
// 🔑 PIN SYSTEM
// =========================

function checkPin() {
    const value = document.getElementById("pin").value;
    const box = document.getElementById("lock-box");

    if (value === CORRECT_PIN) {
        sessionStorage.setItem("unlocked", "true");
        unlock();
        initApp(); // 👉 IMPORTANT : lance le système après login
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
// 🚀 INIT APP
// =========================

function initApp() {
    renderCalendar();
    loadEvents();
}

// =========================
// 📅 CALENDRIER HYBRIDE
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

    const offset = firstDay === 0 ? 6 : firstDay - 1;

    for (let i = 0; i < offset; i++) {
        const empty = document.createElement("div");
        empty.classList.add("day", "empty");
        grid.appendChild(empty);
    }

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

// =========================
// 📌 JOUR + EVENTS
// =========================

function selectDay(day) {
    const panel = document.getElementById("day-events");
    if (!panel) return;

    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");

    const selectedDate = `${year}-${month}-${d}`;

    const dayEvents = events.filter(e => e.date === selectedDate);

    let html = `
        <h3>📅 ${day} ${monthNames[currentDate.getMonth()]}</h3>
    `;

    if (dayEvents.length === 0) {
        html += `<p>Aucun événement</p>`;
    } else {
        dayEvents.forEach(e => {
            html += `
                <div class="event">
                    <strong>${e.time || ""}</strong> ${e.title}
                    <br><small>${e.category || ""}</small>
                </div>
            `;
        });
    }

    panel.innerHTML = html;
}

// =========================
// 🔌 AIRTABLE LOAD
// =========================

async function loadEvents() {
    const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE}`;

    try {
        const res = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${AIRTABLE_TOKEN}`
            }
        });

        const data = await res.json();

        console.log("📡 Airtable data :", data);

        events = data.records.map(r => ({
            title: r.fields.Titre,
            date: r.fields.Date,
            time: r.fields.Heure,
            category: r.fields.Catégorie
        }));

        console.log("📅 Events formatés :", events);

    } catch (err) {
        console.error("❌ Erreur Airtable :", err);
    }
}