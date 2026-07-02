const CORRECT_PIN = "4841";

// 🔑 AIRTABLE
const AIRTABLE_TOKEN = "TON_TOKEN_ICI";
const BASE_ID = "apphUnk8iYi34QlzQ";

// 📊 TABLES
const TABLE_CALENDAR = "Calendrier";
const TABLE_URGENCE = "Urgence";
const TABLE_INFO = "Informations";

let events = [];
let urgences = [];
let infos = [];

let selectedDateGlobal = null;
let currentDate = new Date();

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
// 🚀 INIT APP
// =========================

function initApp() {
    loadAll();
}

// =========================
// 📡 LOAD ALL DATA
// =========================

async function loadAll() {
    await Promise.all([
        loadCalendar(),
        loadUrgences(),
        loadInfos()
    ]);

    renderCalendar();
    renderDashboard();
}

// =========================
// 📅 CALENDRIER
// =========================

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

    // cases vides
    for (let i = 0; i < offset; i++) {
        const empty = document.createElement("div");
        empty.classList.add("day", "empty");
        grid.appendChild(empty);
    }

    const todayStr = new Date().toISOString().split("T")[0];

    for (let day = 1; day <= daysInMonth; day++) {
        const cell = document.createElement("div");
        cell.classList.add("day");

        const dateStr = formatDate(day);

        const dayEvents = events.filter(e => e.date === dateStr);

        // ⭐ highlight aujourd'hui
        if (dateStr === todayStr) {
            cell.classList.add("today");
        }

        cell.innerHTML = `
            <div class="day-number">${day}</div>

            <div class="event-preview">
                ${dayEvents.slice(0, 2).map(ev => `
                    <div class="event-pill ${ev.category || ""}">
                        ${ev.title}
                    </div>
                `).join("")}
            </div>
        `;

        cell.onclick = () => selectDay(day);

        grid.appendChild(cell);
    }
}

function formatDate(day) {
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${year}-${month}-${d}`;
}

function changeMonth(step) {
    currentDate.setMonth(currentDate.getMonth() + step);
    renderCalendar();
}

// =========================
// 📌 JOUR
// =========================

function selectDay(day) {
    const panel = document.getElementById("day-events");
    if (!panel) return;

    selectedDateGlobal = formatDate(day);

    const dayEvents = events.filter(e => e.date === selectedDateGlobal);

    let html = `<h3>📅 ${day} ${monthNames[currentDate.getMonth()]}</h3>`;

    if (dayEvents.length === 0) {
        html += "<p>Aucun événement</p>";
    } else {
        dayEvents.forEach(e => {
            html += `
                <div class="event">
                    <strong>${e.time || ""}</strong>
                    <br>${e.title}
                    <br><small>${e.category || ""}</small>
                </div>
            `;
        });
    }

    panel.innerHTML = html;
}

// =========================
// 📢 URGENCES
// =========================

async function loadUrgences() {
    const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_URGENCE}`;

    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
    });

    const data = await res.json();

    urgences = (data.records || []).map(r => ({
        title: r.fields.Titre,
        message: r.fields.Message,
        priority: r.fields.Priorité
    }));
}

// =========================
// 📢 INFOS
// =========================

async function loadInfos() {
    const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_INFO}`;

    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
    });

    const data = await res.json();

    infos = (data.records || []).map(r => ({
        title: r.fields.Titre,
        message: r.fields.Message,
        visible: r.fields.Visible,
        endDate: r.fields["Date de fin"]
    }));
}

// =========================
// 📊 DASHBOARD
// =========================

function renderDashboard() {
    renderUrgences();
    renderToday();
    renderInfos();
}

function renderUrgences() {
    const el = document.getElementById("urgent-panel");
    if (!el) return;

    el.innerHTML = `
        <h3>⭐ Urgences</h3>
        ${urgences.length === 0
            ? "<p>Aucune urgence</p>"
            : urgences.map(u => `
                <div class="event urgent">
                    <strong>${u.title}</strong><br>
                    ${u.message || ""}
                </div>
            `).join("")
        }
    `;
}

function renderToday() {
    const el = document.getElementById("today-panel");
    if (!el) return;

    const today = new Date().toISOString().split("T")[0];
    const todayEvents = events.filter(e => e.date === today);

    el.innerHTML = `
        <h3>📅 Aujourd’hui</h3>
        ${todayEvents.length === 0
            ? "<p>Aucun événement</p>"
            : todayEvents.map(e => `
                <div class="event">
                    <strong>${e.time || ""}</strong> ${e.title}
                </div>
            `).join("")
        }
    `;
}

function renderInfos() {
    const el = document.getElementById("info-panel");
    if (!el) return;

    el.innerHTML = `
        <h3>📢 Informations</h3>
        ${infos.length === 0
            ? "<p>Aucune info</p>"
            : infos.map(i => `
                <div class="event info">
                    <strong>${i.title}</strong><br>
                    ${i.message || ""}
                </div>
            `).join("")
        }
    `;
}

// =========================
// 🔌 CALENDAR LOAD
// =========================

async function loadCalendar() {
    const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_CALENDAR}`;

    const res = await fetch(url, {
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

// =========================
// GLOBAL
// =========================

window.checkPin = checkPin;
window.changeMonth = changeMonth;