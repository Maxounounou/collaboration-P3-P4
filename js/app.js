const CORRECT_PIN = "4841";

// 🔑 AIRTABLE
const AIRTABLE_TOKEN = "TON_TOKEN_ICI";
const BASE_ID = "TON_BASE_ID_ICI";
const TABLE = "Calendrier";

let events = [];
let selectedDateGlobal = null;

// =========================
// 🔒 INITIALISATION
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
// 🔑 PIN SYSTEM
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
    renderCalendar();
    loadEvents();
}

// =========================
// 📅 CALENDRIER
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

        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, "0");
        const d = String(day).padStart(2, "0");

        const dateStr = `${year}-${month}-${d}`;

        const dayEvents = events.filter(e => e.date === dateStr);

        cell.classList.add("day");

        cell.innerHTML = `
            <div class="day-number">${day}</div>
            <div class="dots">
                ${dayEvents.map(ev => {
                    if (ev.category === "Réunion") return `<span class="dot red"></span>`;
                    if (ev.category === "Piscine") return `<span class="dot blue"></span>`;
                    if (ev.category === "Sortie") return `<span class="dot green"></span>`;
                    return `<span class="dot orange"></span>`;
                }).join("")}
            </div>
        `;

        cell.onclick = () => selectDay(day);

        grid.appendChild(cell);
    }
}

function changeMonth(step) {
    currentDate.setMonth(currentDate.getMonth() + step);
    renderCalendar();
}

// =========================
// 📌 JOUR SÉLECTIONNÉ
// =========================

function selectDay(day) {
    const panel = document.getElementById("day-events");
    if (!panel) return;

    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");

    selectedDateGlobal = `${year}-${month}-${d}`;

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

        events = data.records.map(r => ({
            title: r.fields.Titre,
            date: r.fields.Date,
            time: r.fields.Heure,
            category: r.fields.Catégorie
        }));

        renderCalendar(); // 🔥 important : refresh calendrier après load

    } catch (err) {
        console.error("❌ Erreur Airtable :", err);
    }
}

// =========================
// ➕ MODAL AJOUT EVENT
// =========================

function openModal() {
    const modal = document.createElement("div");
    modal.classList.add("modal");

    modal.innerHTML = `
        <div class="modal-box">
            <h3>➕ Nouvel événement</h3>

            <input id="ev-title" placeholder="Titre">

            <input id="ev-time" placeholder="Heure (ex: 10h30)">

            <select id="ev-category">
                <option>Réunion</option>
                <option>Piscine</option>
                <option>Sortie</option>
                <option>Évaluation</option>
                <option>Autre</option>
            </select>

            <select id="ev-author">
                <option>Maxime</option>
                <option>Carine</option>
                <option>Vanessa</option>
                <option>Laetitia</option>
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
// 💾 SAVE EVENT TO AIRTABLE
// =========================

async function saveEvent() {
    const title = document.getElementById("ev-title").value;
    const time = document.getElementById("ev-time").value;
    const category = document.getElementById("ev-category").value;
    const author = document.getElementById("ev-author").value;

    const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE}`;

    const body = {
        fields: {
            Titre: title,
            Date: selectedDateGlobal,
            Heure: time,
            Catégorie: category,
            Auteur: author
        }
    };

    await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${AIRTABLE_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    document.querySelector(".modal").remove();

    await loadEvents(); // refresh data

    const day = parseInt(selectedDateGlobal.split("-")[2]);
    selectDay(day);
}