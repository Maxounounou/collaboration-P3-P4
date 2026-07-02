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

async function initApp() {
    await loadAll();
}

// =========================
// 📦 LOAD ALL
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

    // jours vides
    for (let i = 0; i < offset; i++) {
        const empty = document.createElement("div");
        empty.classList.add("day", "empty");
        grid.appendChild(empty);
    }

    const todayStr = new Date().toISOString().split("T")[0];

    for (let day = 1; day <= daysInMonth; day++) {

        const cell = document.createElement("div");

        const y = currentDate.getFullYear();
        const m = String(currentDate.getMonth() + 1).padStart(2, "0");
        const d = String(day).padStart(2, "0");

        const dateStr = `${y}-${m}-${d}`;

        const dayEvents = events.filter(e => e.date === dateStr);

        cell.classList.add("day");

        // ⭐ HIGHLIGHT TODAY
        if (dateStr === todayStr) {
            cell.classList.add("today");
        }

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

    // ⭐ AJOUT MESSAGE + TITRE
    infoBox.innerHTML = visibleInfos.length
        ? visibleInfos.map(i => `• ${i.title}<br><small>${i.message || ""}</small>`).join("<br><br>")
        : "Aucune information";
}

// =========================
// 🔌 AIRTABLE LOAD
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
        message: r.fields.Message,   // ⭐ AJOUT IMPORTANT
        visible: r.fields.Visible
    }));
}

// =========================
// ➕ MODAL
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
// 💾 SAVE EVENT
// =========================

async function saveEvent() {
    const title = document.getElementById("ev-title").value;
    const time = document.getElementById("ev-time").value;
    const category = document.getElementById("ev-category").value;
    const author = document.getElementById("ev-author").value;

    const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_EVENTS}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${AIRTABLE_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            fields: {
                Titre: title,
                Date: selectedDateGlobal,
                Heure: time,
                Catégorie: category,
                Auteur: author
            }
        })
    });

    const data = await res.json();

    if (!data.error) {
        document.querySelector(".modal").remove();
        await loadAll();
        selectDay(parseInt(selectedDateGlobal.split("-")[2]));
    } else {
        console.error("❌ AIRTABLE ERROR :", data.error);
    }
}

// =========================
// 🌐 GLOBAL
// =========================

window.saveEvent = saveEvent;
window.openModal = openModal;
window.changeMonth = (step) => {
    currentDate.setMonth(currentDate.getMonth() + step);
    loadAll();
};
window.checkPin = checkPin;