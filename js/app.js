const CORRECT_PIN = "4841";

// 🔑 AIRTABLE
const AIRTABLE_TOKEN = "TON_TOKEN_ICI";
const BASE_ID = "apphUnk8iYi34QlzQ";

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
// 🚀 INIT
// =========================

function initApp() {
    loadAll();
}

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

function formatDate(day) {
    const y = currentDate.getFullYear();
    const m = String(currentDate.getMonth() + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

const monthNames = [
    "Janvier","Février","Mars","Avril","Mai","Juin",
    "Juillet","Août","Septembre","Octobre","Novembre","Décembre"
];

function renderCalendar() {
    const grid = document.getElementById("calendar-grid");
    const title = document.getElementById("month-title");
    if (!grid || !title) return;

    grid.innerHTML = "";

    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();

    title.innerText = `${monthNames[m]} ${y}`;

    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const offset = firstDay === 0 ? 6 : firstDay - 1;

    for (let i = 0; i < offset; i++) {
        const empty = document.createElement("div");
        empty.classList.add("day","empty");
        grid.appendChild(empty);
    }

    const todayStr = new Date().toISOString().split("T")[0];

    for (let day = 1; day <= daysInMonth; day++) {
        const cell = document.createElement("div");
        cell.classList.add("day");

        const dateStr = formatDate(day);
        const dayEvents = events.filter(e => e.date === dateStr);

        if (dateStr === todayStr) {
            cell.classList.add("today");
        }

        cell.innerHTML = `
            <div class="day-number">${day}</div>

            <div class="event-preview">
                ${dayEvents.slice(0,2).map(ev => `
                    <div class="event-pill">${ev.title}</div>
                `).join("")}
            </div>

            <div style="font-size:10px; margin-top:4px;">
                ${dayEvents.length ? "📌" : ""}
            </div>
        `;

        cell.onclick = () => selectDay(day);

        grid.appendChild(cell);
    }
}

function changeMonth(step) {
    currentDate.setMonth(currentDate.getMonth() + step);
    loadCalendar();
}

// =========================
// 📌 DAY
// =========================

function selectDay(day) {
    const panel = document.getElementById("day-events");
    if (!panel) return;

    selectedDateGlobal = formatDate(day);

    const dayEvents = events.filter(e => e.date === selectedDateGlobal);

    let html = `
        <h3>📅 ${day} ${monthNames[currentDate.getMonth()]}</h3>

        <button onclick="openModal()" style="
            margin-top:10px;
            padding:6px 10px;
            background: var(--primary);
            color:white;
            border:none;
            border-radius:6px;
            cursor:pointer;
        ">➕ Ajouter</button>

        <hr>
    `;

    if (!dayEvents.length) {
        html += "<p>Aucun événement</p>";
    } else {
        dayEvents.forEach(e => {
            html += `
                <div class="event">
                    <strong>${e.time || ""}</strong><br>
                    ${e.title}<br>
                    <small>${e.category || ""}</small>
                </div>
            `;
        });
    }

    panel.innerHTML = html;
}

// =========================
// 📢 URGENCES (FIX IMPORTANT)
// =========================

async function loadUrgences() {
    const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_URGENCE}`;

    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
    });

    const data = await res.json();

    console.log("🚨 URGENCES RAW :", data);

    urgences = (data.records || []).map(r => ({
        title: r.fields.Titre || "",
        message: r.fields.Message || "",
        priority: r.fields.Priorité || ""
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
        title: r.fields.Titre || "",
        message: r.fields.Message || ""
    }));
}

// =========================
// 📊 DASHBOARD
// =========================

function renderDashboard() {
    const urgent = document.getElementById("urgent-panel");
    const info = document.getElementById("info-panel");

    if (urgent) {
        urgent.innerHTML = `
            <h3>⭐ Urgences</h3>
            ${urgences.length ? urgences.map(u => `
                <div class="event urgent">
                    <strong>${u.title}</strong><br>
                    ${u.message}
                </div>
            `).join("") : "<p>Aucune urgence</p>"}
        `;
    }

    if (info) {
        info.innerHTML = `
            <h3>📢 Informations</h3>
            ${infos.length ? infos.map(i => `
                <div class="event info">
                    <strong>${i.title}</strong><br>
                    ${i.message}
                </div>
            `).join("") : "<p>Aucune info</p>"}
        `;
    }
}

// =========================
// ➕ MODAL (REMISE + FIX)
// =========================

function openModal() {
    const modal = document.createElement("div");
    modal.classList.add("modal");

    modal.innerHTML = `
        <div class="modal-box">
            <h3>➕ Nouvel événement</h3>

            <input id="ev-title" placeholder="Titre">
            <input id="ev-time" placeholder="Heure">

            <select id="ev-category">
                <option>Réunion</option>
                <option>Piscine</option>
                <option>Sortie</option>
                <option>Evaluation</option>
                <option>Autre</option>
            </select>

            <button onclick="saveEvent()">Enregistrer</button>
        </div>
    `;

    document.body.appendChild(modal);

    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
}

// =========================
// 💾 SAVE
// =========================

async function saveEvent() {
    const title = document.getElementById("ev-title").value;
    const time = document.getElementById("ev-time").value;
    const category = document.getElementById("ev-category").value;

    const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_CALENDAR}`;

    const body = {
        fields: {
            Titre: title,
            Date: selectedDateGlobal,
            Heure: time,
            Catégorie: category
        }
    };

    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${AIRTABLE_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    const data = await res.json();

    if (!data.error) {
        document.querySelector(".modal").remove();
        loadAll();
    } else {
        console.error("❌ SAVE ERROR :", data.error);
    }
}

// =========================
// GLOBAL
// =========================

window.checkPin = checkPin;
window.changeMonth = changeMonth;
window.openModal = openModal;
window.saveEvent = saveEvent;