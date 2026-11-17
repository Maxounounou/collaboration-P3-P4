const CORRECT_PIN = "4841";
const ADMIN_PIN = "2206";
let isAdmin = false;

// 🔑 AIRTABLE
const AIRTABLE_TOKEN = "pat66wglbJCY35pdo.5feecb9e3f5d58623cac64ab730c9c501b5f13996c7b665ed45fe86dcf99e812";
const BASE_ID = "apphUnk8iYi34QlzQ";

// Une SEULE table pour tout le site. La colonne "Type" dit de quoi il s'agit :
// Lien, Evenement, PostIt, Reponse, Urgence, Info
const TABLE_DATA = "Donnees";

// =========================
// 🧊 CACHE — économise les appels Airtable
// (plan gratuit : 1000 appels par mois pour tout le workspace)
// =========================

const MINUTE = 60 * 1000;

// Durée pendant laquelle la copie gardée dans le navigateur reste valable
const CACHE_TTL = 10 * MINUTE;
const CACHE_KEY = "airtable_cache_" + TABLE_DATA;

function readCache() {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function writeCache(records, time) {
    try {
        localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ time: time || Date.now(), records })
        );
    } catch (e) {}
}

function clearCache() {
    try {
        localStorage.removeItem(CACHE_KEY);
    } catch (e) {}
}

// Ménage : supprime les anciennes copies de l'époque où il y avait 6 tables
function removeLegacyCache() {
    try {
        ["Calendrier", "Urgence", "Informations", "Liens", "PostIts", "Reponses"]
            .forEach(t => localStorage.removeItem("airtable_cache_" + t));
    } catch (e) {}
}

// Protège l'affichage : les textes tapés par les collègues sont insérés dans la page
function escapeHtml(str) {
    return String(str == null ? "" : str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// =========================
// 🎨 COULEURS PAR PROF
// =========================

// Détection par PRÉNOM (peu importe le format exact du texte :
// "Maxime", "Monsieur Maxime", "P3 - Maxime" fonctionnent tous)
const TEACHERS = [
    { name: "Carine",   label: "Madame Carine",   color: "#FFD8B1" },
    { name: "Maxime",   label: "Monsieur Maxime", color: "#AEE1F9" },
    { name: "Vanessa",  label: "Madame Vanessa",  color: "#E0BBE4" },
    { name: "Laetitia", label: "Madame Laetitia", color: "#B5EAD7" }
];

function detectTeacher(text) {
    if (!text) return null;
    return TEACHERS.find(t => text.includes(t.name)) || null;
}

function getTeacherColor(text) {
    const t = detectTeacher(text);
    return t ? t.color : "#dddddd";
}

function getTeacherRank(text) {
    const t = detectTeacher(text);
    return t ? TEACHERS.indexOf(t) : 999;
}

function renderLegend() {
    const legend = document.getElementById("teacher-legend");
    if (!legend) return;

    legend.innerHTML = TEACHERS
        .map(t => `
            <span class="legend-item">
                <span class="legend-dot" style="background:${t.color}"></span>
                ${t.label}
            </span>
        `)
        .join("");
}

// Lignes brutes de la table + les listes qu'on en déduit
let dataRecords = [];
let dataTime = 0;     // 0 = aucune lecture réussie pour l'instant

let events = [];
let urgences = [];
let infos = [];
let liens = [];
let postits = [];
let reponses = [];

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

    if (value === CORRECT_PIN || value === ADMIN_PIN) {

        if(value === ADMIN_PIN){
            isAdmin = true;
        }

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

        if(isAdmin){

            const btn = document.getElementById("admin-btn");

            if(btn){
                btn.style.display = "inline-block";
            }

        }

        document.body.classList.remove("locked");

    }, 250);

}

// =========================
// 🚀 INIT APP
// =========================

async function initApp() {
    removeLegacyCache();
    addRefreshButton();
    await loadAll();
}

let lastRefresh = 0;

// Force un rechargement depuis Airtable (1 appel)
async function refreshAll() {
    if (Date.now() - lastRefresh < 30000) return;   // 1 clic / 30 s maximum
    lastRefresh = Date.now();
    clearCache();
    await loadAll();
}

function addRefreshButton() {
    if (document.getElementById("refresh-btn")) return;

    const hero = document.querySelector(".hero");
    if (!hero) return;

    const btn = document.createElement("button");
    btn.id = "refresh-btn";
    btn.textContent = "↻ Actualiser";
    btn.style.cssText = "margin-top:14px;padding:6px 14px;border:1px solid rgba(0,0,0,.1);"
        + "border-radius:999px;background:rgba(255,255,255,.7);color:#6e6e73;"
        + "font:inherit;font-size:13px;cursor:pointer;";
    btn.onclick = refreshAll;

    hero.appendChild(btn);
}

// =========================
// 📦 LOAD ALL
// =========================

async function loadAll() {
    await loadData();
    parseData();

    renderCalendar();
    renderDashboard();
    renderLinks();
    renderPostits();
    renderLegend();
}

// =========================
// 🔌 AIRTABLE — LECTURE (1 appel, 2 si plus de 100 lignes)
// =========================

// Lit la table : depuis la copie du navigateur si elle est récente, sinon depuis
// Airtable. Si Airtable refuse (quota atteint, panne...), on garde la dernière
// copie connue au lieu d'afficher une page vide, et on attend 5 minutes avant
// de réessayer.
async function loadData() {
    const cached = readCache();

    if (cached && Date.now() - cached.time < CACHE_TTL) {
        dataRecords = cached.records;
        dataTime = cached.time;
        return;
    }

    try {
        let records = [];
        let offset = "";

        do {
            const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_DATA}`
                + (offset ? `?offset=${encodeURIComponent(offset)}` : "");

            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
            });

            const data = await res.json();

            if (data.error) throw new Error(JSON.stringify(data.error));

            records = records.concat(data.records || []);
            offset = data.offset || "";
        } while (offset);

        dataRecords = records;
        dataTime = Date.now();
        writeCache(dataRecords, dataTime);

    } catch (err) {
        console.error("❌ Airtable :", err);

        if (cached) {
            dataRecords = cached.records;
            dataTime = Date.now() - CACHE_TTL + 5 * MINUTE;
            writeCache(dataRecords, dataTime);
        } else {
            dataRecords = [];
            dataTime = 0;
        }
    }
}

// Range les lignes de la table dans les bonnes listes, selon la colonne "Type"
function parseData() {
    const ofType = type => dataRecords.filter(r => r.fields.Type === type);

    events = ofType("Evenement").map(r => ({
        title: r.fields.Titre,
        date: r.fields.Date,
        time: r.fields.Heure,
        category: r.fields.Categorie || r.fields["Catégorie"],
        auteur: r.fields.Auteur
    }));

    urgences = ofType("Urgence").map(r => ({
        title: r.fields.Titre,
        active: r.fields.Actif
    }));

    infos = ofType("Info").map(r => ({
        title: r.fields.Titre,
        message: r.fields.Message,
        visible: r.fields.Actif
    }));

    liens = ofType("Lien")
        .map(r => ({
            titre: r.fields.Titre,
            url: r.fields.URL,
            categorie: r.fields.Categorie,
            icone: r.fields.Icone,
            ordre: r.fields.Ordre || 0,
            auteur: r.fields.Auteur
        }))
        .sort((a, b) => {
            const textA = `${a.auteur || ""} ${a.titre || ""}`;
            const textB = `${b.auteur || ""} ${b.titre || ""}`;
            const rankDiff = getTeacherRank(textA) - getTeacherRank(textB);
            if (rankDiff !== 0) return rankDiff;
            return a.ordre - b.ordre;
        });

    postits = ofType("PostIt").map(r => ({
        id: r.id,
        message: r.fields.Message,
        auteur: r.fields.Auteur
    }));

    reponses = ofType("Reponse")
        .map(r => ({
            id: r.id,
            postitId: r.fields.ParentId,
            message: r.fields.Message,
            auteur: r.fields.Auteur,
            created: r.createdTime
        }))
        .sort((a, b) => new Date(a.created) - new Date(b.created));
}

// =========================
// ✏️ AIRTABLE — ÉCRITURE
// (la copie locale est mise à jour directement : aucune relecture nécessaire)
// =========================

async function createRecord(fields) {
    const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_DATA}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${AIRTABLE_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ fields })
    });

    const data = await res.json();

    if (data.error) {
        console.error("❌ AIRTABLE ERROR :", data.error);
        return null;
    }

    dataRecords.push(data);
    if (dataTime) writeCache(dataRecords, dataTime);
    parseData();

    return data;
}

// Airtable accepte jusqu'à 10 suppressions par appel
async function deleteRecords(ids) {
    for (let i = 0; i < ids.length; i += 10) {
        const query = ids
            .slice(i, i + 10)
            .map(id => `records[]=${encodeURIComponent(id)}`)
            .join("&");

        const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_DATA}?${query}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
        });

        const data = await res.json();

        if (data.error) {
            console.error("❌ AIRTABLE ERROR :", data.error);
            return false;
        }
    }

    const gone = new Set(ids);
    dataRecords = dataRecords.filter(r => !gone.has(r.id));
    if (dataTime) writeCache(dataRecords, dataTime);
    parseData();

    return true;
}

// =========================
// 📅 CALENDRIER
// =========================

const monthNames = [
    "Janvier","Février","Mars","Avril","Mai","Juin",
    "Juillet","Août","Septembre","Octobre","Novembre","Décembre"
];

function getEventIcon(category){

    if(!category) return "📅";

    if(category.includes("Réunion")){
        return "👥";
    }

    if(category.includes("Excursion")){
        return "🚌";
    }

    if(category.includes("Divers")){
        return "📌";
    }

    return "📅";
}

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

        // 🎨 Couleur de la case selon le(s) prof(s) de la journée
        if (dayEvents.length > 0) {
            const colors = [...new Set(dayEvents.map(e => getTeacherColor(e.auteur)))];

            if (colors.length === 1) {
                cell.style.background = colors[0];
            } else {
                const step = 100 / colors.length;
                const stops = colors
                    .map((c, i) => `${c} ${i * step}%, ${c} ${(i + 1) * step}%`)
                    .join(", ");
                cell.style.background = `linear-gradient(135deg, ${stops})`;
            }
        }

        cell.innerHTML = `
            <div class="day-number">${day}</div>
            <div class="dots">
                ${dayEvents.map(e => getEventIcon(e.category)).join(" ")}
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
                <div class="event" style="border-left: 6px solid ${getTeacherColor(e.auteur)};">
                    <strong>
                    ${getEventIcon(e.category)}
                    ${escapeHtml(e.time)}
                    </strong>
                    ${escapeHtml(e.title)}

                    <br>

                    <small>${escapeHtml(e.category)}${e.auteur ? " · " + escapeHtml(e.auteur) : ""}</small>
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
        ? activeUrgent.map(u => `• ${escapeHtml(u.title)}`).join("<br>")
        : "Aucune urgence";

    infoBox.innerHTML = visibleInfos.length
        ? visibleInfos.map(i => `• ${escapeHtml(i.title)}<br><small>${escapeHtml(i.message)}</small>`).join("<br><br>")
        : "Aucune information";
}

// =========================
// 🔗 RENDER LIENS
// =========================

function renderLinks() {
    const containers = {
        "Competences": document.getElementById("liens-competences"),
        "Resultats": document.getElementById("liens-resultats"),
        "Bulletins": document.getElementById("liens-bulletins"),
        "Documents": document.getElementById("liens-documents"),
        "Teams": document.getElementById("liens-teams"),
        "PV": document.getElementById("liens-pv")
    };

    Object.values(containers).forEach(c => {
        if (c) c.innerHTML = "";
    });

    Object.keys(containers).forEach(cat => {
        const container = containers[cat];
        if (!container) return;

        const items = liens.filter(l => l.categorie === cat);

        if (items.length === 0) {
            container.innerHTML = `<p>Aucun lien</p>`;
            return;
        }

        items.forEach(l => {
            const a = document.createElement("a");
            a.className = "card";
            a.href = l.url || "#";
            a.target = "_blank";
            a.style.background = getTeacherColor(`${l.auteur || ""} ${l.titre || ""}`);
            a.innerHTML = `${escapeHtml(l.icone || "🔗")} ${escapeHtml(l.titre)}`;
            container.appendChild(a);
        });
    });
}

// =========================
// 🗒️ POST-IT
// =========================

function renderPostits() {
    const board = document.getElementById("postit-board");
    if (!board) return;

    board.innerHTML = "";

    if (postits.length === 0) {
        board.innerHTML = `<p>Aucun post-it pour le moment</p>`;
        return;
    }

    postits.forEach(p => {
        const note = document.createElement("div");
        note.className = "postit";
        note.style.background = getTeacherColor(p.auteur);

        const replies = reponses
            .filter(r => r.postitId === p.id)
            .map(r => `
                <div class="reply" style="border-left-color: ${getTeacherColor(r.auteur)};">
                    <span class="reply-delete" onclick="deleteReponse('${r.id}')">✕</span>
                    <p class="reply-message">${escapeHtml(r.message)}</p>
                    <p class="reply-auteur">${escapeHtml(r.auteur || "Anonyme")}</p>
                </div>
            `)
            .join("");

        note.innerHTML = `
            <span class="postit-delete" onclick="deletePostit('${p.id}')">✕</span>
            <p class="postit-message">${escapeHtml(p.message)}</p>
            <p class="postit-auteur">— ${escapeHtml(p.auteur || "Anonyme")}</p>
            ${replies ? `<div class="postit-replies">${replies}</div>` : ""}
            <button class="reply-btn" onclick="openReplyModal('${p.id}')">💬 Répondre</button>
        `;

        board.appendChild(note);
    });
}

function openPostitModal() {
    const modal = document.createElement("div");
    modal.classList.add("modal");

    modal.innerHTML = `
        <div class="modal-box">
            <h3>🗒️ Nouveau post-it</h3>

            <textarea id="postit-message" placeholder="Ton petit mot..."></textarea>

            <select id="postit-auteur">
                <option>Madame Carine</option>
                <option>Monsieur Maxime</option>
                <option>Madame Vanessa</option>
                <option>Madame Laetitia</option>
            </select>

            <button onclick="savePostit()">Enregistrer</button>
        </div>
    `;

    document.body.appendChild(modal);

    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
}

async function savePostit() {
    const message = document.getElementById("postit-message").value.trim();
    const auteur = document.getElementById("postit-auteur").value;

    if (!message) return;

    const record = await createRecord({
        Type: "PostIt",
        Message: message,
        Auteur: auteur
    });

    if (record) {
        document.querySelector(".modal").remove();
        renderPostits();
    } else {
        alert("Le post-it n'a pas pu être enregistré. Vérifie la table « Donnees » dans Airtable (colonnes Type, Message, Auteur).");
    }
}

async function deletePostit(id) {
    if (!confirm("Supprimer ce post-it (et ses réponses) ?")) return;

    // Le post-it et toutes ses réponses partent en un seul appel
    const ids = [id, ...reponses.filter(r => r.postitId === id).map(r => r.id)];

    if (await deleteRecords(ids)) {
        renderPostits();
    }
}

// =========================
// 💬 RÉPONSES AUX POST-IT
// =========================

function openReplyModal(postitId) {
    const modal = document.createElement("div");
    modal.classList.add("modal");

    modal.innerHTML = `
        <div class="modal-box">
            <h3>💬 Ta réponse</h3>

            <textarea id="reply-message" placeholder="Ta réponse..."></textarea>

            <select id="reply-auteur">
                <option>Madame Carine</option>
                <option>Monsieur Maxime</option>
                <option>Madame Vanessa</option>
                <option>Madame Laetitia</option>
            </select>

            <button onclick="saveReponse('${postitId}')">Envoyer</button>
        </div>
    `;

    document.body.appendChild(modal);

    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
}

async function saveReponse(postitId) {
    const message = document.getElementById("reply-message").value.trim();
    const auteur = document.getElementById("reply-auteur").value;

    if (!message) return;

    const record = await createRecord({
        Type: "Reponse",
        ParentId: postitId,
        Message: message,
        Auteur: auteur
    });

    if (record) {
        document.querySelector(".modal").remove();
        renderPostits();
    } else {
        alert("La réponse n'a pas pu être enregistrée. Vérifie la table « Donnees » dans Airtable (colonnes Type, ParentId, Message, Auteur).");
    }
}

async function deleteReponse(id) {
    if (!confirm("Supprimer cette réponse ?")) return;

    if (await deleteRecords([id])) {
        renderPostits();
    }
}

// =========================
// ➕ MODAL ÉVÉNEMENT
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
                <option>Réunion plénière</option>
                <option>Réunion cellule</option>
                <option>Excursion</option>
                <option>Divers</option>
            </select>

            <select id="ev-author">
                <option>Madame Carine</option>
                <option>Monsieur Maxime</option>
                <option>Madame Vanessa</option>
                <option>Madame Laetitia</option>
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

    const record = await createRecord({
        Type: "Evenement",
        Titre: title,
        Date: selectedDateGlobal,
        Heure: time,
        Categorie: category,
        Auteur: author
    });

    if (record) {
        document.querySelector(".modal").remove();
        renderCalendar();
        selectDay(parseInt(selectedDateGlobal.split("-")[2]));
    } else {
        alert("L'événement n'a pas pu être enregistré. Vérifie la table « Donnees » dans Airtable (colonnes Type, Titre, Date, Heure, Categorie, Auteur).");
    }
}

// =========================
// 🌐 GLOBAL
// =========================

window.saveEvent = saveEvent;
window.openModal = openModal;
window.openPostitModal = openPostitModal;
window.savePostit = savePostit;
window.deletePostit = deletePostit;
window.openReplyModal = openReplyModal;
window.saveReponse = saveReponse;
window.deleteReponse = deleteReponse;

// Changer de mois ne demande aucune donnée de plus : on réaffiche simplement
window.changeMonth = (step) => {
    currentDate.setDate(1);
    currentDate.setMonth(currentDate.getMonth() + step);
    renderCalendar();
};

window.checkPin = checkPin;