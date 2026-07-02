const CORRECT_PIN = "4841";

// 🔑 AIRTABLE
const AIRTABLE_TOKEN = "pat66wglbJCY35pdo.5feecb9e3f5d58623cac64ab730c9c501b5f13996c7b665ed45fe86dcf99e812";
const BASE_ID = "apphUnk8iYi34QlzQ";

const TABLE_EVENTS = "Calendrier";
const TABLE_URGENT = "Urgence";
const TABLE_INFO = "Informations";

let events = [];
let urgences = [];
let infos = [];

let selectedDateGlobal = null;

// =========================
// 🔒 INIT
// =========================

window.addEventListener("load", () => {
    const unlocked = sessionStorage.getItem("unlocked");

    if (unlocked === "true") {
        unlock();
        initApp();
    } else {
        document.body.classList.add("locked");
    }
});

// =========================
// 🔑 PIN
// =========================

function checkPin() {
    const value = document.getElementById("pin").value;
    const box = document.getElementById("lock-box");

    if (value === CORRECT_PIN) {
        sessionStorage.setItem("unlocked", "true");
        unlock();
        initApp();
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
// 🚀 INIT APP (FIX IMPORTANT)
// =========================

async function initApp() {
    await loadAll();
}

// =========================
// 📦 LOAD ALL (IMPORTANT)
// =========================

async function loadAll() {
    await Promise.all([
        loadEvents(),
        loadUrgences(),
        loadInfos()
    ]);

    renderCalendar();
    renderDashboard();
}

// =========================
// 📅 CALENDRIER
// =========================

let currentDate = new Date();

const monthNames = [
    "Janvier","Février","Mars","Avril","Mai","Juin",
    "Juillet","Août","Septembre","Octobre","Novembre","Décembre"
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

        const y = currentDate.getFullYear();
        const m = String(currentDate.getMonth() + 1).padStart(2, "0");
        const d = String(day).padStart(2, "0");

        const dateStr = `${y}-${m}-${d}`;
        const dayEvents = events.filter(e => e.date === dateStr);

        cell.classList.add("day");

        cell.innerHTML = `
            <div class="day-number">${day}</div>
            <div class="dots">
                ${dayEvents.length > 0 ? "●" : ""}
            </div>
        `;

        cell.onclick = () => selectDay(day);

        grid.appendChild(cell);
    }
}

// =========================
// 📌 DAY VIEW
// =========================

function selectDay(day) {
    const panel = document.getElementById("day-events");
    if (!panel) return;

    const y = currentDate.getFullYear();
    const m = String(currentDate.getMonth() + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");

    selectedDateGlobal = `${y}-${m}-${d}`;

    const dayEvents = events.filter(e => e.date === selectedDateGlobal);

    let html = `
        <h3>📅 ${day} ${monthNames[currentDate.getMonth()]}</h3>

        <button onclick="openModal()">➕ Ajouter</button>

        <hr>
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
// 📊 DASHBOARD
// =========================

function renderDashboard() {
    const urgentBox = document.querySelector(".dash-card.urgent p");
    const infoBox = document.querySelector(".dash-card.info p");

    if (!urgentBox || !infoBox) return;

    const activeUrgent = urgences.filter(u => u.active);
    const visibleInfos = infos.filter(i => i.visible);

    urgentBox.innerHTML = activeUrgent.length
        ? activeUrgent.map(u => `• ${u.title}`).join("<br>")
        : "Aucune urgence";

    infoBox.innerHTML = visibleInfos.length
        ? visibleInfos.map(i => `• ${i.title}`).join("<br>")
        : "Aucune information";
}

// =========================
// 🔌 LOAD AIRTABLE (SAFE)
// =========================

async function loadEvents() {
    const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_EVENTS}`, {
        headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
    });

    const data = await res.json();
    events = (data.records || []).map(r => ({
        title: r.fields.Titre,
        date: r.fields.Date,
        time: r.fields.Heure,
        category: r.fields.Catégorie
    }));
}

async function loadUrgences() {
    const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_URGENT}`, {
        headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
    });

    const data = await res.json();
    urgences = (data.records || []).map(r => ({
        title: r.fields.Titre,
        active: r.fields.Active
    }));
}

async function loadInfos() {
    const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_INFO}`, {
        headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
    });

    const data = await res.json();
    infos = (data.records || []).map(r => ({
        title: r.fields.Titre,
        visible: r.fields.Visible
    }));
}

// =========================
// GLOBAL
// =========================

window.checkPin = checkPin;
window.changeMonth = () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    loadAll();
};