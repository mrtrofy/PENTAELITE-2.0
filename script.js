// ============================================================
// PENTATLÓN MODERNO – script.js (versión mejorada y sin errores)
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot, collection, deleteDoc, addDoc, query, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// ─── Firebase Config ─────────────────────────────────────────
const firebaseConfig = {
    apiKey: "AIzaSyAtWCkDlZuv11AueTW6WEPNwAn97Vf-3yQ",
    authDomain: "pentatlon-scores.firebaseapp.com",
    projectId: "pentatlon-scores",
    storageBucket: "pentatlon-scores.firebasestorage.app",
    messagingSenderId: "650229123946",
    appId: "1:650229123946:web:a3769c31f8ce1a23edb313"
};
const appId = 'penta-tourney-v2';

// ─── Tabla UIPM ───────────────────────────────────────────────
const UipmPoints = {
    1: 250, 2: 244, 3: 238, 4: 236, 5: 230, 6: 228, 7: 226, 8: 224, 9: 218, 10: 216,
    11: 214, 12: 212, 13: 210, 14: 208, 15: 206, 16: 204, 17: 198, 18: 196,
    19: 194, 20: 192, 21: 190, 22: 188, 23: 186, 24: 184, 25: 182, 26: 180,
    27: 178, 28: 176, 29: 174, 30: 172, 31: 170, 32: 168, 33: 166, 34: 164,
    35: 162, 36: 160, 37: 158, 38: 156, 39: 154, 40: 152
};

// ─── PDF Config ───────────────────────────────────────────────
const PDF_CONFIG = {
    logoPath: 'deeee.jpeg',
    colors: {
        primary: [15, 23, 42],
        secondary: [71, 85, 105],
        accent: [22, 163, 74],
        border: [203, 213, 225]
    }
};

// ─── Variables Globales ───────────────────────────────────────
let firebaseApp, auth, db;
let players = [];
let events = [];
let discData = [];
let isAdmin = false;
let currentEventTitle = "";
let currentFiltersInfo = "";
let currentRenderParams = null; // Guarda los parámetros del último renderResults

// NOTA: La contraseña de administrador está en texto claro por
// compatibilidad con el diseño original del sistema.
// En producción debería gestionarse mediante variables de entorno
// o un sistema de auth más robusto.
const ADMIN_PASSWORD = "Newman.999";

// ─── Bracket State ────────────────────────────────────────────
if (!window.bracketWinners) {
    window.bracketWinners = {
        round32: Array(32).fill(""),
        round16: Array(16).fill(""),
        round8: Array(8).fill(""),
        semi: Array(4).fill(""),
        campeon: null
    };
}
if (!window.bracketData) {
    window.bracketData = {
        round32: Array(32).fill(""),
        round16: Array(16).fill(""),
        round8: Array(8).fill(""),
        semi: Array(4).fill(""),
        final: Array(2).fill("")
    };
}

// ─── Advance Manager State ────────────────────────────────────
let selectedAdvanceName = null;
let selectedAdvanceBtn = null;

// ============================================================
// INICIO: start()
// ============================================================
async function start() {
    // Fallback: mostrar el body siempre en máximo 3 segundos
    // (evita pantalla en blanco si Firebase tarda o falla)
    const showBodyFallback = setTimeout(() => {
        document.body.style.display = 'block';
    }, 3000);

    try {
        firebaseApp = initializeApp(firebaseConfig);
        db = getFirestore(firebaseApp);
        auth = getAuth(firebaseApp);

        onAuthStateChanged(auth, (user) => {
            clearTimeout(showBodyFallback); // Firebase respondió, cancelar fallback
            document.body.style.display = 'block'; // Mostrar body siempre
            if (user) {
                // Ocultar login, mostrar app
                const authSection = document.getElementById('authSection');
                const appEl = document.getElementById('app');
                if (authSection) authSection.style.display = 'none';
                if (appEl) {
                    appEl.style.display = 'block';
                    appEl.classList.remove('opacity-0');
                }
                document.body.style.display = 'block';
                const overlay = document.getElementById('loadingOverlay');
                if (overlay) overlay.style.display = 'none';
                setupListeners();
            } else {
                // Redirigir a login si no está en index.html
                const authSection = document.getElementById('authSection');
                const appEl = document.getElementById('app');
                if (authSection) {
                    document.body.style.display = 'block';
                    authSection.style.display = 'flex';
                    if (appEl) appEl.style.display = 'none';
                } else {
                    // Estamos en Penta.html sin usuario → redirigir
                    window.location.href = 'index.html';
                }
            }
        });

        // Auth de Google en index.html
        const googleBtn = document.getElementById('googleBtn');
        if (googleBtn) {
            googleBtn.addEventListener('click', async () => {
                try {
                    const provider = new GoogleAuthProvider();
                    await signInWithPopup(auth, provider);
                } catch (err) {
                    alert('Error con Google Sign-In: ' + err.message);
                }
            });
        }

        // Auth con email/password en index.html
        const authForm = document.getElementById('authForm');
        if (authForm) {
            authForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('email').value.trim();
                const password = document.getElementById('password').value;
                // Leer modo desde variable global (seteada por switchTab en index.html)
                const isRegister = window.authMode === 'register';
                const submitBtn = document.getElementById('submitBtn');
                if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Cargando...'; }
                try {
                    if (isRegister) {
                        await createUserWithEmailAndPassword(auth, email, password);
                    } else {
                        await signInWithEmailAndPassword(auth, email, password);
                    }
                } catch (err) {
                    // Traducir mensajes de error comunes de Firebase
                    const msgs = {
                        'auth/user-not-found':      '❌ No existe una cuenta con ese correo.',
                        'auth/wrong-password':      '❌ Contraseña incorrecta.',
                        'auth/invalid-credential':  '❌ Correo o contraseña incorrectos.',
                        'auth/email-already-in-use':'❌ Ese correo ya está registrado.',
                        'auth/weak-password':       '❌ La contraseña debe tener al menos 6 caracteres.',
                        'auth/invalid-email':       '❌ El formato del correo no es válido.',
                        'auth/too-many-requests':   '❌ Demasiados intentos. Espera unos minutos.',
                        'auth/network-request-failed': '❌ Sin conexión a internet.',
                        'auth/popup-closed-by-user':'❌ Ventana de Google cerrada antes de completar.',
                        'auth/unauthorized-domain': '❌ Dominio no autorizado en Firebase.\nVe a Firebase Console → Authentication → Settings → Authorized domains\ny agrega "localhost".',
                        'auth/operation-not-allowed': '❌ Método de inicio de sesión no habilitado en Firebase Console.',
                    };
                    const code = err.code || '';
                    alert(msgs[code] || ('Error: ' + err.message));
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = isRegister ? 'Crear Cuenta' : 'Iniciar Sesión';
                    }
                }
            });
        }

    } catch (err) {
        console.error('Error en start():', err);
        clearTimeout(showBodyFallback);
        document.body.style.display = 'block'; // Mostrar aunque haya error
        const errMsg = document.createElement('div');
        errMsg.style.cssText = 'position:fixed;top:1rem;left:50%;transform:translateX(-50%);background:#7f1d1d;color:white;padding:1rem 2rem;border-radius:8px;font-size:13px;z-index:9999;max-width:90vw;text-align:center;';
        errMsg.textContent = '⚠️ Error de conexión con Firebase. Verifica tu internet y recarga la página.';
        document.body.appendChild(errMsg);
    }
}

// ============================================================
// LISTENERS: Firestore onSnapshot
// ============================================================
function setupListeners() {
    if (!db) return;

    // Atletas
    onSnapshot(collection(db, `artifacts/${appId}/public/data/athletes`), (snap) => {
        players = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderAdminAtletas();
        updateEventSelect();
        loadAtletasToSelector();
        renderEventsList();
    });

    // Eventos
    onSnapshot(collection(db, `artifacts/${appId}/public/data/events`), (snap) => {
        events = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderAdminEvents();
        renderEventsList();
        updateEventSelect();
    });

    // Disciplinas
    onSnapshot(collection(db, `artifacts/${appId}/public/data/disciplinas`), (snap) => {
        discData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Re-renderizar si hay params guardados
        if (currentRenderParams) {
            const { eventName, sex, phase, category, discipline, group } = currentRenderParams;
            renderResults(eventName, sex, phase, category, discipline, group);
        }
    });
}

// ============================================================
// RENDER: renderResults
// ============================================================
function renderResults(eventName, sex, phase, category, discipline, group) {
    // Guardar parámetros para re-renderizado posterior
    currentRenderParams = { eventName, sex, phase, category, discipline, group };

    try {
        currentEventTitle = eventName || "Resultados";

        let filtered = players.filter(p => {
            if (eventName && p.event !== eventName) return false;
            if (sex && sex !== 'TODOS' && p.sex !== sex) return false;
            if (phase && phase !== 'TODOS' && p.phase !== phase) return false;
            if (category && category !== 'TODOS' && p.category !== category) return false;
            if (group && group !== 'TODOS' && p.group !== group) return false;
            return true;
        });

        currentFiltersInfo = [sex, phase, category, group].filter(Boolean).join(' | ');

        // ── Ranking ──
        const scored = filtered.map(p => {
            const esg = parseInt(p.esgrimaTotal) || 0;
            const obs = parseInt(p.obstaculos) || 0;
            const nat = parseInt(p.natacion) || 0;
            const las = parseInt(p.laser) || 0;
            const total = esg + obs + nat + las;
            return { ...p, esg, obs, nat, las, total };
        }).sort((a, b) => b.total - a.total);

        const tbody = document.getElementById('scoreboardBody');
        if (tbody) {
            tbody.innerHTML = scored.map((p, i) => `
                <tr class="${i % 2 === 0 ? 'bg-slate-800' : 'bg-slate-750'}">
                    <td class="p-2 text-center font-bold text-yellow-400">${i + 1}</td>
                    <td class="p-2">${p.name || ''}</td>
                    <td class="p-2 text-center">${p.esg}</td>
                    <td class="p-2 text-center">${p.obs}</td>
                    <td class="p-2 text-center">${p.nat}</td>
                    <td class="p-2 text-center">${p.las}</td>
                    <td class="p-2 text-center font-bold text-green-400">${p.total}</td>
                </tr>
            `).join('');
        }

        // ── Status / Esgrima ──
        const statusGrid = document.getElementById('statusGrid');
        if (statusGrid) {
            statusGrid.innerHTML = filtered.map(p => `
                <div class="bg-slate-800 rounded p-3 text-sm">
                    <div class="font-bold text-white">${p.name || ''}</div>
                    <div class="text-green-400">V: ${p.esgrimaV || 0}</div>
                    <div class="text-red-400">D: ${p.esgrimaD || 0}</div>
                    <div class="text-yellow-300">Total: ${p.esgrimaTotal || 0}</div>
                </div>
            `).join('');
        }

        // ── Handicap ──
        const handicapBody = document.getElementById('handicapBody');
        if (handicapBody) {
            const sortedHandicap = [...scored].sort((a, b) => b.total - a.total);
            const leader = sortedHandicap[0];
            handicapBody.innerHTML = sortedHandicap.map((p, i) => {
                const diff = leader ? leader.total - p.total : 0;
                const salida = formatHandicapTime(diff * 0); // placeholder: según reglas UIPM
                return `
                    <tr class="${i % 2 === 0 ? 'bg-slate-800' : 'bg-slate-750'}">
                        <td class="p-2">${p.name || ''}</td>
                        <td class="p-2 text-center">${p.total}</td>
                        <td class="p-2 text-center">${salida}</td>
                    </tr>
                `;
            }).join('');
        }

        // Mostrar contenedor de resultados
        const resultsContainer = document.getElementById('resultsContainer');
        const publicEventsList = document.getElementById('publicEventsList');
        if (resultsContainer) resultsContainer.classList.remove('hidden');
        if (publicEventsList) publicEventsList.classList.add('hidden');

        const viewTitle = document.getElementById('viewTitle');
        if (viewTitle) viewTitle.textContent = `${eventName} — ${currentFiltersInfo}`;

        showSubView('ranking');

    } catch (err) {
        console.error('Error en renderResults:', err);
    }
}

// ============================================================
// RENDER: renderDisciplinas
// ============================================================
function renderDisciplinas(filterName) {
    try {
        const discipline = document.getElementById('adminDisciplina')?.value || '';
        const isOCR = discipline.startsWith('OCR');

        let filtered = discData.filter(d => {
            if (filterName && d.event !== filterName) return false;
            if (discipline && d.discipline !== discipline) return false;
            return true;
        });

        // Separar eliminados y no eliminados; ordenar por tiempo final (ELIMINADO va al fondo)
        filtered.sort((a, b) => {
            const aElim = (a.estado === 'ELIMINADO');
            const bElim = (b.estado === 'ELIMINADO');
            if (aElim !== bElim) return aElim ? 1 : -1;
            const tA = parseTime(a.tiempoFinal || a.tiempoInicial || 0);
            const tB = parseTime(b.tiempoFinal || b.tiempoInicial || 0);
            return tA - tB;
        });

        const container = document.getElementById('disciplinasContainer') || document.getElementById('scoreboardBody');
        if (!container) return;

        // Construir encabezados dinámicamente
        let headers = `<tr class="bg-slate-700 text-white text-xs uppercase">
            <th class="p-2">#</th>
            <th class="p-2">Atleta</th>
            <th class="p-2">Disciplina</th>
            <th class="p-2">T. Inicial</th>`;

        if (!isOCR) {
            headers += `<th class="p-2">Penalidad</th>`;
        }

        headers += `<th class="p-2">T. Final</th>
            <th class="p-2">Puntos</th>
        </tr>`;

        const rows = filtered.map((d, i) => {
            const isElim = d.estado === 'ELIMINADO';
            let penCol = '';
            if (!isOCR) {
                penCol = `<td class="p-2 text-center">${d.penalidad || 0}</td>`;
            }

            return `
                <tr class="${isElim ? 'bg-red-950/60 opacity-60' : (i % 2 === 0 ? 'bg-slate-800' : 'bg-slate-800/60')} text-white text-sm">
                    <td class="p-2 text-center font-bold">${isElim ? '—' : (i + 1)}</td>
                    <td class="p-2 font-bold ${isElim ? 'line-through text-red-400' : ''}">${d.atleta || ''}
                        ${isElim ? '<span class="ml-1 text-[9px] bg-red-700 text-white px-1 py-0.5 rounded font-black uppercase">ELIMINADO</span>' : ''}
                    </td>
                    <td class="p-2 text-slate-300">${d.discipline || ''}</td>
                    <td class="p-2 text-center font-mono">${d.tiempoInicial || '--'}</td>
                    ${penCol}
                    <td class="p-2 text-center font-mono font-bold">${d.tiempoFinal || '--'}</td>
                    <td class="p-2 text-center ${isElim ? 'text-red-400' : 'text-green-400'} font-bold">${isElim ? '0' : (d.puntos || 0)}</td>
                </tr>
            `;
        }).join('');

        container.innerHTML = headers + rows;

        // También actualizar la lista admin de registros
        renderAdminDiscList(filtered);

    } catch (err) {
        console.error('Error en renderDisciplinas:', err);
    }
}

// ============================================================
// RENDER: Lista admin de registros de disciplinas (con editar/eliminar/marcar)
// ============================================================
function renderAdminDiscList(filtered) {
    const list = document.getElementById('adminDiscList');
    if (!list) return;

    if (!filtered || !filtered.length) {
        list.innerHTML = `<p class="text-slate-500 text-xs py-2 text-center">No hay registros guardados.</p>`;
        return;
    }

    list.innerHTML = filtered.map(d => {
        const isElim = d.estado === 'ELIMINADO';
        const sinPuntos = !d.tiempoFinal && !d.tiempoInicial;

        return `
        <div class="flex items-center justify-between rounded-lg px-3 py-2 mb-1 border
            ${isElim ? 'bg-red-950/50 border-red-800/50' : 'bg-slate-800 border-slate-700'}">
            <div class="flex-1 min-w-0 mr-2">
                <p class="text-xs font-bold uppercase text-white truncate ${isElim ? 'line-through text-red-400' : ''}">
                    ${d.atleta || '—'}
                    ${isElim ? '<span class="ml-1 text-[8px] bg-red-700 text-white px-1 rounded">ELIMINADO</span>' : ''}
                </p>
                <p class="text-[10px] text-slate-400">${d.discipline || ''} · ${d.tiempoFinal || '--'} · ${d.puntos || 0} pts</p>
            </div>
            <div class="flex gap-1 shrink-0">
                <button onclick="editDisc('${d.id}')"
                    class="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded font-bold uppercase">
                    ✏️ Editar
                </button>
                ${sinPuntos && !isElim ? `
                <button onclick="marcarEliminado('${d.id}')"
                    class="text-[10px] bg-orange-600 hover:bg-orange-500 text-white px-2 py-1 rounded font-bold uppercase">
                    ⛔ Eliminar
                </button>` : ''}
                ${isElim ? `
                <button onclick="restaurarDisc('${d.id}')"
                    class="text-[10px] bg-slate-600 hover:bg-slate-500 text-white px-2 py-1 rounded font-bold uppercase">
                    ↩ Restaurar
                </button>` : ''}
                <button onclick="deleteDisc('${d.id}')"
                    class="text-[10px] bg-red-700 hover:bg-red-600 text-white px-2 py-1 rounded font-bold uppercase">
                    🗑
                </button>
            </div>
        </div>`;
    }).join('');
}

// ============================================================
// RENDER: renderEventsList
// ============================================================
function renderEventsList() {
    const container = document.getElementById('publicEventsList');
    if (!container) return;

    if (!events.length) {
        container.innerHTML = `<p class="text-slate-400 text-center py-8">No hay eventos disponibles.</p>`;
        return;
    }

    container.innerHTML = events.map(ev => `
        <div class="bg-slate-800 rounded-xl shadow-lg mb-4 overflow-hidden">
            <div class="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-700 transition"
                 onclick="toggleAccordion('acc-${ev.id}')">
                <div>
                    <h3 class="text-white font-bold text-lg">${ev.name || 'Sin nombre'}</h3>
                    <p class="text-slate-400 text-sm">${ev.date || ''}</p>
                </div>
                <svg id="ico-acc-${ev.id}" class="w-5 h-5 text-slate-400 transform transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                </svg>
            </div>
            <div id="acc-${ev.id}" class="hidden p-4 border-t border-slate-700">
                <p class="text-slate-300 mb-3">${ev.desc || ''}</p>
                <div class="flex flex-wrap gap-2">
                    ${['M','F','TODOS'].map(sex =>
                        ['Clasificación','Semifinal','Final'].map(phase =>
                            ['U09','U11','U13','U15','U17','U19','Junior','Senior','JDN 2026'].map(cat =>
                                ['A','B','C','TODOS'].map(grp => `
                                    <button onclick="applyFilters('${ev.name}','${ev.id}','${sex}','${phase}','${cat}','${grp}')"
                                        class="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded transition">
                                        ${sex} · ${phase} · ${cat} · ${grp}
                                    </button>
                                `).join('')
                            ).join('')
                        ).join('')
                    ).join('')}
                    <button onclick="applyFilters('${ev.name}','${ev.id}','TODOS','TODOS','TODOS','TODOS')"
                        class="text-xs bg-green-600 hover:bg-green-500 text-white px-2 py-1 rounded transition">
                        Ver Todos
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// ============================================================
// RENDER: renderAdminAtletas
// ============================================================
function renderAdminAtletas() {
    const container = document.getElementById('adminAtletasList');
    if (!container) return;

    const search = (document.getElementById('atletaSearchInput')?.value || '').toLowerCase();
    const filtered = players.filter(p =>
        !search || (p.name || '').toLowerCase().includes(search)
    );

    if (!filtered.length) {
        container.innerHTML = `<p class="text-slate-400 text-sm py-2">No se encontraron atletas.</p>`;
        return;
    }

    container.innerHTML = filtered.map(p => `
        <div class="flex items-center justify-between bg-slate-700 rounded p-2 mb-1">
            <div class="text-sm">
                <span class="text-white font-semibold">${p.name || ''}</span>
                <span class="text-slate-400 ml-2 text-xs">${p.category || ''} · ${p.sex || ''} · ${p.estado || ''}</span>
            </div>
            <div class="flex gap-1">
                <button onclick="editPlayer('${p.id}')" class="text-xs bg-yellow-500 hover:bg-yellow-400 text-black px-2 py-1 rounded">Editar</button>
                <button onclick="deletePlayer('${p.id}')" class="text-xs bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded">Eliminar</button>
            </div>
        </div>
    `).join('');
}

// ============================================================
// RENDER: renderAdminEvents
// ============================================================
function renderAdminEvents() {
    const container = document.getElementById('adminEventsList');
    if (!container) return;

    if (!events.length) {
        container.innerHTML = `<p class="text-slate-400 text-sm py-2">No hay eventos.</p>`;
        return;
    }

    container.innerHTML = events.map(ev => `
        <div class="flex items-center justify-between bg-slate-700 rounded p-2 mb-1">
            <div class="text-sm">
                <span class="text-white font-semibold">${ev.name || ''}</span>
                <span class="text-slate-400 ml-2 text-xs">${ev.date || ''}</span>
            </div>
            <button onclick="deleteEvent('${ev.id}')" class="text-xs bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded">Eliminar</button>
        </div>
    `).join('');
}

// ============================================================
// SELECTORES
// ============================================================
function updateEventSelect() {
    const sel = document.getElementById('adminEventSelect');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = `<option value="">-- Seleccionar Evento --</option>` +
        events.map(ev => `<option value="${ev.name}" ${ev.name === current ? 'selected' : ''}>${ev.name}</option>`).join('');
}

function updateAtletaSelector(atletas) {
    const sel = document.getElementById('adminAtletaSelect');
    if (!sel) return;
    sel.innerHTML = `<option value="">-- Seleccionar Atleta --</option>` +
        atletas.map(p => `<option value="${p.name}">${p.name} (${p.category || ''})</option>`).join('');
}

function loadAtletasToSelector() {
    updateAtletaSelector(players);
}

// ============================================================
// GUARDAR EVENTO
// ============================================================
async function saveEvent() {
    if (!isAdmin) return alert('Debes estar en modo administrador.');
    const name = document.getElementById('eventName')?.value.trim();
    const date = document.getElementById('eventDate')?.value;
    const desc = document.getElementById('eventDesc')?.value.trim();
    if (!name) return alert('El nombre del evento es requerido.');

    try {
        await addDoc(collection(db, `artifacts/${appId}/public/data/events`), {
            name, date: date || '', desc: desc || '',
            createdAt: new Date().toISOString()
        });
        document.getElementById('eventName').value = '';
        document.getElementById('eventDate').value = '';
        if (document.getElementById('eventDesc')) document.getElementById('eventDesc').value = '';
    } catch (err) {
        alert('Error guardando evento: ' + err.message);
    }
}

// ============================================================
// GUARDAR/EDITAR ATLETA
// ============================================================
async function savePlayer() {
    if (!isAdmin) return alert('Debes estar en modo administrador.');

    const id = document.getElementById('editPlayerId')?.value;
    const data = {
        event: document.getElementById('playerEvent')?.value || '',
        name: document.getElementById('playerName')?.value.trim() || '',
        estado: document.getElementById('playerEstado')?.value || '',
        sex: document.getElementById('playerSex')?.value || '',
        category: document.getElementById('playerCategory')?.value || '',
        group: document.getElementById('playerGroup')?.value || '',
        phase: document.getElementById('playerPhase')?.value || '',
        esgrimaV: parseInt(document.getElementById('playerEsgrimaV')?.value) || 0,
        esgrimaD: parseInt(document.getElementById('playerEsgrimaD')?.value) || 0,
        esgrimaTotal: parseInt(document.getElementById('playerEsgrimaTotal')?.value) || 0,
        obstaculos: parseInt(document.getElementById('playerObstaculos')?.value) || 0,
        natacion: parseInt(document.getElementById('playerNatacion')?.value) || 0,
        laser: parseInt(document.getElementById('playerLaser')?.value) || 0,
        updatedAt: new Date().toISOString()
    };

    if (!data.name) return alert('El nombre del atleta es requerido.');

    try {
        const ref = id
            ? doc(db, `artifacts/${appId}/public/data/athletes`, id)
            : doc(collection(db, `artifacts/${appId}/public/data/athletes`));
        await setDoc(ref, data, { merge: true });
        cancelEditPlayer();
    } catch (err) {
        alert('Error guardando atleta: ' + err.message);
    }
}

function editPlayer(id) {
    const p = players.find(x => x.id === id);
    if (!p) return;

    const set = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val || ''; };
    set('editPlayerId', p.id);
    set('playerEvent', p.event);
    set('playerName', p.name);
    set('playerEstado', p.estado);
    set('playerSex', p.sex);
    set('playerCategory', p.category);
    set('playerGroup', p.group);
    set('playerPhase', p.phase);
    set('playerEsgrimaV', p.esgrimaV);
    set('playerEsgrimaD', p.esgrimaD);
    set('playerEsgrimaTotal', p.esgrimaTotal);
    set('playerObstaculos', p.obstaculos);
    set('playerNatacion', p.natacion);
    set('playerLaser', p.laser);

    const titleEl = document.getElementById('atletaFormTitle');
    if (titleEl) titleEl.textContent = `Editando: ${p.name}`;

    const cancelBtn = document.getElementById('cancelEditBtn');
    if (cancelBtn) cancelBtn.classList.remove('hidden');
}

function cancelEditPlayer() {
    ['editPlayerId','playerEvent','playerName','playerEstado','playerSex','playerCategory',
     'playerGroup','playerPhase','playerEsgrimaV','playerEsgrimaD','playerEsgrimaTotal',
     'playerObstaculos','playerNatacion','playerLaser'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const titleEl = document.getElementById('atletaFormTitle');
    if (titleEl) titleEl.textContent = 'Registrar Atleta';
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (cancelBtn) cancelBtn.classList.add('hidden');
}

async function deletePlayer(id) {
    if (!confirm('¿Eliminar este atleta?')) return;
    try {
        await deleteDoc(doc(db, `artifacts/${appId}/public/data/athletes`, id));
    } catch (err) {
        alert('Error eliminando atleta: ' + err.message);
    }
}

// ============================================================
// DISCIPLINAS
// ============================================================
async function saveDisciplina() {
    if (!isAdmin) return alert('Debes estar en modo administrador.');

    const event = document.getElementById('adminEventSelect')?.value;
    const atleta = document.getElementById('adminAtletaSelect')?.value;
    const discipline = document.getElementById('adminDisciplina')?.value;
    const estado = document.getElementById('adminEstado')?.value;
    const genero = document.getElementById('adminGenero')?.value;
    const categoria = document.getElementById('adminCategoria')?.value;
    const fase = document.getElementById('adminFase')?.value;
    const grupo = document.getElementById('adminGrupo')?.value;
    const tiempoInicial = document.getElementById('discTiempoInicial')?.value;
    const penalidad = parseInt(document.getElementById('discPenalidad')?.value) || 0;
    const tiempoFinal = document.getElementById('discTiempoFinal')?.value;

    if (!atleta || !discipline || !event) return alert('Evento, atleta y disciplina son requeridos.');

    try {
        await addDoc(collection(db, `artifacts/${appId}/public/data/disciplinas`), {
            event, atleta, discipline, estado, genero, categoria, fase, grupo,
            tiempoInicial, penalidad, tiempoFinal,
            puntos: calcularPuntosDisciplina(discipline, tiempoFinal, categoria),
            createdAt: new Date().toISOString()
        });
    } catch (err) {
        alert('Error guardando disciplina: ' + err.message);
    }
}

function calcularPuntosDisciplina(discipline, tiempoFinal, categoria) {
    // Placeholder genérico; las funciones específicas se usan externamente
    return 0;
}

async function deleteDisc(id) {
    if (!confirm('¿Eliminar este registro permanentemente?')) return;
    try {
        await deleteDoc(doc(db, `artifacts/${appId}/public/data/disciplinas`, id));
    } catch (err) {
        alert('Error eliminando registro: ' + err.message);
    }
}

// Carga los datos de un registro en el modal de edición
function editDisc(id) {
    const d = discData.find(x => x.id === id);
    if (!d) return;

    // Llenar los campos del formulario de disciplina con los datos del registro
    const setVal = (elId, val) => {
        const el = document.getElementById(elId);
        if (el) el.value = val || '';
    };

    setVal('editDiscId', d.id);
    setVal('editDiscAtleta', d.atleta);
    setVal('editDiscDisciplina', d.discipline);
    setVal('editDiscEstado', d.estado || '');
    setVal('editDiscTiempoInicial', d.tiempoInicial || '');
    setVal('editDiscPenalidad', d.penalidad || 0);
    setVal('editDiscTiempoFinal', d.tiempoFinal || '');

    // Mostrar el modal de edición
    const modal = document.getElementById('editDiscModal');
    if (modal) {
        modal.classList.remove('hidden');
        // Actualizar label con nombre del atleta
        const lbl = document.getElementById('editDiscAtletaLabel');
        if (lbl) lbl.textContent = `Disciplina: ${d.discipline || ''} · Evento: ${d.event || ''}`;
    }
}

// Calcula el tiempo final en el modal de edición
function autoCalculateEditDiscTime() {
    const tiInit = document.getElementById('editDiscTiempoInicial')?.value;
    const pen = parseInt(document.getElementById('editDiscPenalidad')?.value) || 0;
    const finalEl = document.getElementById('editDiscTiempoFinal');
    if (!finalEl) return;

    if (!tiInit) { finalEl.value = ''; return; }
    const baseSeconds = parseTime(tiInit);
    const finalSeconds = baseSeconds + (pen * 25);
    const mins = Math.floor(finalSeconds / 60);
    const secs = Math.round(finalSeconds % 60);
    finalEl.value = `${mins}:${String(secs).padStart(2, '0')}`;
}

// Guarda los cambios del modal de edición en Firestore
async function saveDiscEdit() {
    const id = document.getElementById('editDiscId')?.value;
    if (!id) return;

    const tiempoInicial = document.getElementById('editDiscTiempoInicial')?.value || '';
    const penalidad = parseInt(document.getElementById('editDiscPenalidad')?.value) || 0;
    const tiempoFinal = document.getElementById('editDiscTiempoFinal')?.value || '';
    const estado = document.getElementById('editDiscEstado')?.value || '';

    try {
        await setDoc(doc(db, `artifacts/${appId}/public/data/disciplinas`, id), {
            tiempoInicial, penalidad, tiempoFinal, estado,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        closeEditDiscModal();
    } catch (err) {
        alert('Error actualizando registro: ' + err.message);
    }
}

// Marca un registro como ELIMINADO (sin borrar de Firestore)
async function marcarEliminado(id) {
    if (!confirm('¿Marcar este atleta como ELIMINADO de la prueba?\n(No se borrará, se puede restaurar)')) return;
    try {
        await setDoc(doc(db, `artifacts/${appId}/public/data/disciplinas`, id),
            { estado: 'ELIMINADO', tiempoFinal: '', puntos: 0, updatedAt: new Date().toISOString() },
            { merge: true }
        );
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

// Restaura un registro marcado como ELIMINADO
async function restaurarDisc(id) {
    if (!confirm('¿Restaurar este atleta?')) return;
    try {
        await setDoc(doc(db, `artifacts/${appId}/public/data/disciplinas`, id),
            { estado: '', updatedAt: new Date().toISOString() },
            { merge: true }
        );
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

function closeEditDiscModal() {
    const modal = document.getElementById('editDiscModal');
    if (modal) modal.classList.add('hidden');
}

async function deleteEvent(id) {
    if (!confirm('¿Eliminar este evento?')) return;
    try {
        await deleteDoc(doc(db, `artifacts/${appId}/public/data/events`, id));
    } catch (err) {
        alert('Error eliminando evento: ' + err.message);
    }
}

// ============================================================
// AUTO CÁLCULO DE TIEMPO FINAL
// ============================================================
function autoCalculateFinalTime() {
    const tiInit = document.getElementById('discTiempoInicial')?.value;
    const pen = parseInt(document.getElementById('discPenalidad')?.value) || 0;
    if (!tiInit) return;

    const baseSeconds = parseTime(tiInit);
    const finalSeconds = baseSeconds + (pen * 25);
    const minutes = Math.floor(finalSeconds / 60);
    const secs = Math.round(finalSeconds % 60);
    const finalStr = `${minutes}:${String(secs).padStart(2, '0')}`;

    const finalEl = document.getElementById('discTiempoFinal');
    if (finalEl) finalEl.value = finalStr;
}

// ============================================================
// FILTROS Y NAVEGACIÓN
// ============================================================
function applyFilters(eventName, eventId, sex, phase, category, group) {
    const discipline = document.getElementById('adminDisciplina')?.value || '';
    if (discipline && discipline !== 'Obstaculos Laser Run') {
        renderDisciplinas(eventName);
        showSubView('disciplinas');
    } else {
        renderResults(eventName, sex, phase, category, discipline, group);
        showSubView('ranking');
    }
}

function showSubView(view) {
    const views = ['rankingSubView', 'statusSubView', 'handicapSubView', 'tournamentSubView', 'disciplinasSubView'];
    views.forEach(v => {
        const el = document.getElementById(v);
        if (el) el.classList.add('hidden');
    });

    const target = document.getElementById(view + 'SubView') || document.getElementById(view);
    if (target) target.classList.remove('hidden');

    // Resaltar botón activo
    ['btnRank','btnStat','btnHandi','btnTourney'].forEach(b => {
        const btn = document.getElementById(b);
        if (btn) btn.classList.remove('bg-blue-600');
    });
    const map = { ranking: 'btnRank', status: 'btnStat', handicap: 'btnHandi', tournament: 'btnTourney' };
    const activeBtn = document.getElementById(map[view]);
    if (activeBtn) activeBtn.classList.add('bg-blue-600');
}

function toggleAccordion(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('hidden');
    const icon = document.getElementById('ico-' + id);
    if (icon) icon.classList.toggle('rotate-180');
}

// ============================================================
// ADMIN
// ============================================================
function toggleAdminMode() {
    const adminPanel = document.getElementById('adminPanel');
    if (!adminPanel) return;

    if (!isAdmin) {
        openLoginModal();
    } else {
        adminPanel.classList.toggle('hidden');
    }
}

function openLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.classList.remove('hidden');
}

function closeLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.classList.add('hidden');
    const passInput = document.getElementById('adminPasswordInput');
    if (passInput) passInput.value = '';
}

function checkPassword() {
    const input = document.getElementById('adminPasswordInput')?.value;
    if (input === ADMIN_PASSWORD) {
        isAdmin = true;
        closeLoginModal();
        const adminPanel = document.getElementById('adminPanel');
        if (adminPanel) adminPanel.classList.remove('hidden');
        const adminBadge = document.getElementById('adminBadge');
        if (adminBadge) adminBadge.classList.remove('hidden');
        const adminToggleBtn = document.getElementById('adminToggleBtn');
        if (adminToggleBtn) adminToggleBtn.textContent = 'Cerrar Admin';
    } else {
        alert('Contraseña incorrecta.');
    }
}

function logoutAdmin() {
    isAdmin = false;
    const adminPanel = document.getElementById('adminPanel');
    if (adminPanel) adminPanel.classList.add('hidden');
    const adminBadge = document.getElementById('adminBadge');
    if (adminBadge) adminBadge.classList.add('hidden');
    const adminToggleBtn = document.getElementById('adminToggleBtn');
    if (adminToggleBtn) adminToggleBtn.textContent = 'Admin';
}

async function logoutSession() {
    try {
        if (auth) await signOut(auth);
        window.location.href = 'index.html';
    } catch (err) {
        alert('Error cerrando sesión: ' + err.message);
    }
}

// ============================================================
// AUTH UI
// ============================================================
function switchTab(mode) {
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const submitBtn = document.getElementById('submitBtn');

    if (mode === 'login') {
        tabLogin?.classList.add('active', 'bg-blue-600', 'text-white');
        tabLogin?.classList.remove('text-slate-400');
        tabRegister?.classList.remove('active', 'bg-blue-600', 'text-white');
        tabRegister?.classList.add('text-slate-400');
        if (submitBtn) submitBtn.textContent = 'Iniciar Sesión';
    } else {
        tabRegister?.classList.add('active', 'bg-blue-600', 'text-white');
        tabRegister?.classList.remove('text-slate-400');
        tabLogin?.classList.remove('active', 'bg-blue-600', 'text-white');
        tabLogin?.classList.add('text-slate-400');
        if (submitBtn) submitBtn.textContent = 'Crear Cuenta';
    }
}

function filterAtletasList() {
    renderAdminAtletas();
}

// ============================================================
// UTILIDADES DE TIEMPO
// ============================================================
function parseTime(val) {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    const str = String(val).trim();
    if (str.includes(':')) {
        const [min, sec] = str.split(':').map(Number);
        return (min * 60) + (sec || 0);
    }
    return parseFloat(str) || 0;
}

function formatHandicapTime(seconds) {
    if (!seconds || seconds <= 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function calculatePenaltyAddition(pts) {
    const totalSecs = pts * 25;
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

// ============================================================
// FUNCIONES DE PUNTOS (EXACTAS DEL ORIGINAL)
// ============================================================
function calcularPuntosObstaculosRelevo(tObs) {
    const base = 300;
    const refTime = 7 * 60 + 30; // 7:30 referencia
    const diff = tObs - refTime;
    return Math.round(base - (diff / 2));
}

function calcularPuntosNatacionRelevo(tNat, categoria) {
    const refs = {
        'U09': 2*60+30, 'U11': 2*60+15, 'U13': 2*60,
        'U15': 1*60+50, 'U17': 1*60+40, 'U19': 1*60+35,
        'Junior': 1*60+30, 'Senior': 1*60+28, 'JDN 2026': 2*60
    };
    const ref = refs[categoria] || (2*60);
    const diff = tNat - ref;
    return Math.round(304 - (diff * 2));
}

function calcularPuntosLaserRelevo(tLas, categoria) {
    const refs = {
        'U09': 14*60, 'U11': 13*60, 'U13': 12*60,
        'U15': 11*60, 'U17': 10*60+30, 'U19': 10*60,
        'Junior': 9*60+30, 'Senior': 9*60, 'JDN 2026': 12*60
    };
    const ref = refs[categoria] || (12*60);
    const diff = tLas - ref;
    return Math.round(500 - (diff / 2));
}

function calcularPuntosNatacionJDN(tNat, esRelevo) {
    const ref = esRelevo ? 2*60 : 1*60+30;
    const diff = tNat - ref;
    return Math.round(304 - (diff * 2));
}

function calcularPuntosLaserJDN(tLas, categoria, esRelevo) {
    const refs = {
        'U09': 14*60, 'U11': 13*60, 'U13': 12*60,
        'U15': 11*60, 'U17': 10*60+30, 'U19': 10*60,
        'Junior': 9*60+30, 'Senior': 9*60
    };
    const ref = refs[categoria] || (12*60);
    const diff = tLas - ref;
    const factor = esRelevo ? 0.5 : 1;
    return Math.round(500 - (diff * factor));
}

// ============================================================
// ADVANCE MANAGER (CORREGIDO)
// ============================================================
function openAdvanceManager() {
    // CORREGIDO: usar getElementById en lugar de variable modal no declarada
    const modal = document.getElementById('advanceManagerModal');
    if (modal) modal.classList.remove('hidden');
    dibujarRondas();
}

function closeAdvanceManager() {
    const modal = document.getElementById('advanceManagerModal');
    if (modal) modal.classList.add('hidden');
}

function prepareSelection(name, btn) {
    // Deseleccionar anterior
    if (selectedAdvanceBtn) selectedAdvanceBtn.classList.remove('ring-2', 'ring-yellow-400');
    selectedAdvanceName = name;
    selectedAdvanceBtn = btn;
    if (btn) btn.classList.add('ring-2', 'ring-yellow-400');
}

function assignToSlot(roundId, index) {
    if (!selectedAdvanceName) return alert('Selecciona un atleta primero.');
    if (!window.bracketData[roundId]) window.bracketData[roundId] = [];
    window.bracketData[roundId][index] = selectedAdvanceName;
    selectedAdvanceName = null;
    if (selectedAdvanceBtn) selectedAdvanceBtn.classList.remove('ring-2', 'ring-yellow-400');
    selectedAdvanceBtn = null;
    dibujarRondas();
    refreshAdvanceDestinations();
}

function assignToWinner() {
    if (!selectedAdvanceName) return alert('Selecciona un atleta primero.');
    window.bracketWinners.campeon = selectedAdvanceName;
    selectedAdvanceName = null;
    if (selectedAdvanceBtn) selectedAdvanceBtn.classList.remove('ring-2', 'ring-yellow-400');
    selectedAdvanceBtn = null;
    updateBracketControls();
}

// CORREGIDO: función renombrada de refreshDestinations → refreshAdvanceDestinations
function refreshAdvanceDestinations() {
    const container = document.getElementById('advanceDestinations');
    if (!container) return;

    const rounds = ['round32', 'round16', 'round8', 'semi', 'final'];
    container.innerHTML = rounds.map(r => {
        const slots = window.bracketData[r] || [];
        return slots.map((name, i) => `
            <div class="flex items-center justify-between bg-slate-700 rounded p-2 mb-1 text-sm">
                <span class="text-white">${r}[${i}]: ${name || '<vacío>'}</span>
                <button onclick="assignToSlot('${r}', ${i})"
                    class="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded">
                    Asignar aquí
                </button>
            </div>
        `).join('');
    }).join('');
}

// CORREGIDO: usa getElementById en lugar de variable `modal` no declarada
function dibujarRondas() {
    const modal = document.getElementById('advanceManagerModal');
    if (!modal) return;

    const bracketContainer = modal.querySelector('#bracketVisual') || modal.querySelector('.bracket-container');
    if (!bracketContainer) return;

    const rounds = [
        { key: 'round32', label: 'Ronda 32' },
        { key: 'round16', label: 'Ronda 16' },
        { key: 'round8', label: 'Cuartos' },
        { key: 'semi', label: 'Semifinal' },
        { key: 'final', label: 'Final' }
    ];

    bracketContainer.innerHTML = rounds.map(r => {
        const slots = window.bracketData[r.key] || [];
        return `
            <div class="round-column mr-4">
                <h4 class="text-white font-bold text-sm mb-2">${r.label}</h4>
                ${slots.map((name, i) => `
                    <div class="bg-slate-700 rounded p-2 mb-1 text-xs text-white cursor-pointer hover:bg-slate-600"
                         onclick="colocarEnLlave('${r.key}', ${i})">
                        ${name || `<Slot ${i + 1}>`}
                    </div>
                `).join('')}
            </div>
        `;
    }).join('');
}

function colocarEnLlave(ronda, index) {
    if (!selectedAdvanceName) return alert('Selecciona un atleta primero.');
    if (!window.bracketData[ronda]) window.bracketData[ronda] = [];
    window.bracketData[ronda][index] = selectedAdvanceName;
    selectedAdvanceName = null;
    if (selectedAdvanceBtn) selectedAdvanceBtn.classList.remove('ring-2', 'ring-yellow-400');
    selectedAdvanceBtn = null;
    dibujarRondas();
}

function marcarParaMover(nombre, boton) {
    prepareSelection(nombre, boton);
}

// CORREGIDO: usa currentRenderParams para re-renderizar
window.advancePlayer = function(roundIndex, winnerName) {
    const rounds = ['round32', 'round16', 'round8', 'semi'];
    if (roundIndex < rounds.length) {
        const nextRound = rounds[roundIndex + 1] || 'final';
        const nextData = window.bracketData[nextRound] || [];
        const emptySlot = nextData.findIndex(s => !s);
        if (emptySlot !== -1) {
            window.bracketData[nextRound][emptySlot] = winnerName;
        } else {
            window.bracketData[nextRound].push(winnerName);
        }
    }
    if (currentRenderParams) {
        const { eventName, sex, phase, category, discipline, group } = currentRenderParams;
        renderResults(eventName, sex, phase, category, discipline, group);
    }
    dibujarRondas();
};

function resetBrackets() {
    if (confirm('¿Reiniciar todo el torneo? Esta acción no se puede deshacer.')) {
        confirmarReinicioTorneo();
    }
}

function confirmarReinicioTorneo() {
    window.bracketWinners = {
        round32: Array(32).fill(""),
        round16: Array(16).fill(""),
        round8: Array(8).fill(""),
        semi: Array(4).fill(""),
        campeon: null
    };
    window.bracketData = {
        round32: Array(32).fill(""),
        round16: Array(16).fill(""),
        round8: Array(8).fill(""),
        semi: Array(4).fill(""),
        final: Array(2).fill("")
    };
    updateBracketControls();
    dibujarRondas();
}

function updateBracketControls() {
    const campeon = document.getElementById('campeonDisplay');
    if (campeon) {
        campeon.textContent = window.bracketWinners.campeon
            ? `🏆 Campeón: ${window.bracketWinners.campeon}`
            : 'Sin campeón aún';
    }
}

function toggleBracketAdmin() {
    const modal = document.getElementById('bracketAdminModal');
    if (modal) modal.classList.toggle('hidden');
}

function generarEstructuraEliminacion(atletas) {
    const n = atletas.length;
    const rounds = [];
    let current = [...atletas];

    while (current.length > 1) {
        const nextRound = [];
        for (let i = 0; i < current.length; i += 2) {
            nextRound.push({ a: current[i], b: current[i + 1] || 'BYE' });
        }
        rounds.push(nextRound);
        current = nextRound.map(match => match.a); // placeholder: ganador TBD
    }

    return rounds;
}

// ============================================================
// DESCARGA PDF SEGÚN VISTA
// ============================================================
function ejecutarDescargaSegunVista() {
    // Detectar vista activa
    const isRanking = !document.getElementById('rankingSubView')?.classList.contains('hidden');
    const isHandi = !document.getElementById('handicapSubView')?.classList.contains('hidden');
    const isTourney = !document.getElementById('tournamentSubView')?.classList.contains('hidden');
    const isDisc = !document.getElementById('disciplinasSubView')?.classList.contains('hidden');

    if (isTourney) return downloadBracketPDF();
    if (isHandi) return downloadHandicapPDF();
    if (isDisc) return downloadDisciplinasPDF();
    return downloadGeneralPDF();
}

// ============================================================
// PDF HELPERS
// ============================================================
async function _loadJsPDF() {
    if (window.jspdf) return window.jspdf.jsPDF;
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.onload = () => resolve(window.jspdf.jsPDF);
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

async function _prepararPagina(doc, subtitulo) {
    const { primary, accent } = PDF_CONFIG.colors;

    // Header
    doc.setFillColor(...primary);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text('PENTATLÓN MODERNO', 105, 12, { align: 'center' });
    doc.setFontSize(10);
    doc.text(subtitulo || '', 105, 22, { align: 'center' });

    // Intentar cargar logo
    try {
        const img = new Image();
        img.src = PDF_CONFIG.logoPath;
        await new Promise(r => { img.onload = r; img.onerror = r; });
        if (img.complete && img.naturalWidth) {
            doc.addImage(img, 'JPEG', 10, 3, 24, 24);
        }
    } catch (_) {}

    // Fecha
    doc.setFontSize(8);
    doc.setTextColor(...PDF_CONFIG.colors.secondary);
    doc.text(new Date().toLocaleDateString('es-VE'), 200, 35, { align: 'right' });

    return 40; // y inicial del contenido
}

// ── downloadGeneralPDF (UNA SOLA DEFINICIÓN) ──────────────────
async function downloadGeneralPDF() {
    try {
        const JsPDF = await _loadJsPDF();
        const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        let y = await _prepararPagina(doc, `Resultados – ${currentEventTitle}`);

        if (currentFiltersInfo) {
            doc.setFontSize(9);
            doc.setTextColor(...PDF_CONFIG.colors.secondary);
            doc.text(`Filtros: ${currentFiltersInfo}`, 14, y);
            y += 6;
        }

        // Encabezados tabla
        const cols = [14, 60, 90, 110, 130, 150, 170];
        const headers = ['#', 'Atleta', 'ESG', 'OBS', 'NAT', 'LASER', 'TOTAL'];
        doc.setFillColor(...PDF_CONFIG.colors.primary);
        doc.rect(10, y, 190, 7, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        headers.forEach((h, i) => doc.text(h, cols[i], y + 5));
        y += 9;

        // Datos
        const scored = players
            .filter(p => !currentRenderParams || !currentRenderParams.eventName || p.event === currentRenderParams.eventName)
            .map(p => ({
                ...p,
                total: (parseInt(p.esgrimaTotal)||0)+(parseInt(p.obstaculos)||0)+(parseInt(p.natacion)||0)+(parseInt(p.laser)||0)
            }))
            .sort((a, b) => b.total - a.total);

        scored.forEach((p, i) => {
            if (y > 270) { doc.addPage(); y = 15; }
            doc.setFillColor(i % 2 === 0 ? 248 : 255, i % 2 === 0 ? 248 : 255, i % 2 === 0 ? 248 : 255);
            doc.rect(10, y, 190, 6, 'F');
            doc.setTextColor(...PDF_CONFIG.colors.primary);
            doc.setFontSize(8);
            doc.text(String(i + 1), cols[0], y + 4);
            doc.text(p.name || '', cols[1], y + 4);
            doc.text(String(p.esgrimaTotal || 0), cols[2], y + 4);
            doc.text(String(p.obstaculos || 0), cols[3], y + 4);
            doc.text(String(p.natacion || 0), cols[4], y + 4);
            doc.text(String(p.laser || 0), cols[5], y + 4);
            doc.text(String(p.total), cols[6], y + 4);
            y += 6;
        });

        doc.save(`pentatlon-resultados-${Date.now()}.pdf`);
    } catch (err) {
        alert('Error generando PDF: ' + err.message);
    }
}

async function downloadBracketPDF() {
    try {
        const JsPDF = await _loadJsPDF();
        const doc = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        let y = await _prepararPagina(doc, 'Llaves del Torneo');

        doc.setFontSize(10);
        doc.setTextColor(...PDF_CONFIG.colors.primary);
        doc.text('Bracket del torneo', 14, y + 6);

        const rounds = ['round32', 'round16', 'round8', 'semi', 'final'];
        const labels = ['R32', 'R16', 'QF', 'SF', 'F'];
        let x = 14;

        rounds.forEach((r, ri) => {
            const slots = window.bracketData[r] || [];
            doc.setFontSize(8);
            doc.setTextColor(...PDF_CONFIG.colors.secondary);
            doc.text(labels[ri], x, y + 4);
            slots.forEach((name, i) => {
                if (name) {
                    doc.setFontSize(7);
                    doc.setTextColor(...PDF_CONFIG.colors.primary);
                    doc.text(name, x, y + 10 + i * 5);
                }
            });
            x += 50;
        });

        if (window.bracketWinners.campeon) {
            doc.setFontSize(12);
            doc.setTextColor(...PDF_CONFIG.colors.accent);
            doc.text(`🏆 Campeón: ${window.bracketWinners.campeon}`, 148, y + 60, { align: 'center' });
        }

        doc.save(`pentatlon-torneo-${Date.now()}.pdf`);
    } catch (err) {
        alert('Error generando PDF de torneo: ' + err.message);
    }
}

async function downloadHandicapPDF() {
    try {
        const JsPDF = await _loadJsPDF();
        const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        let y = await _prepararPagina(doc, `Hándicap – ${currentEventTitle}`);

        const cols = [14, 80, 130];
        const headers = ['Atleta', 'Puntos', 'Salida'];
        doc.setFillColor(...PDF_CONFIG.colors.primary);
        doc.rect(10, y, 190, 7, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        headers.forEach((h, i) => doc.text(h, cols[i], y + 5));
        y += 9;

        const scored = players.map(p => ({
            ...p,
            total: (parseInt(p.esgrimaTotal)||0)+(parseInt(p.obstaculos)||0)+(parseInt(p.natacion)||0)+(parseInt(p.laser)||0)
        })).sort((a, b) => b.total - a.total);

        const leader = scored[0];
        scored.forEach((p, i) => {
            if (y > 270) { doc.addPage(); y = 15; }
            const diff = leader ? leader.total - p.total : 0;
            const salida = formatHandicapTime(diff * 0); // según reglas UIPM
            doc.setFillColor(i % 2 === 0 ? 248 : 255, 248, 248);
            doc.rect(10, y, 190, 6, 'F');
            doc.setTextColor(...PDF_CONFIG.colors.primary);
            doc.setFontSize(8);
            doc.text(p.name || '', cols[0], y + 4);
            doc.text(String(p.total), cols[1], y + 4);
            doc.text(salida, cols[2], y + 4);
            y += 6;
        });

        doc.save(`pentatlon-handicap-${Date.now()}.pdf`);
    } catch (err) {
        alert('Error generando PDF de hándicap: ' + err.message);
    }
}

async function downloadDisciplinasPDF() {
    try {
        const JsPDF = await _loadJsPDF();
        const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        let y = await _prepararPagina(doc, `Disciplinas – ${currentEventTitle}`);

        const cols = [14, 60, 100, 130, 155, 175];
        const headers = ['Atleta', 'Disciplina', 'T. Inicial', 'Penalidad', 'T. Final', 'Puntos'];
        doc.setFillColor(...PDF_CONFIG.colors.primary);
        doc.rect(10, y, 190, 7, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        headers.forEach((h, i) => doc.text(h, cols[i], y + 5));
        y += 9;

        discData.forEach((d, i) => {
            if (y > 270) { doc.addPage(); y = 15; }
            doc.setFillColor(i % 2 === 0 ? 248 : 255, 248, 248);
            doc.rect(10, y, 190, 6, 'F');
            doc.setTextColor(...PDF_CONFIG.colors.primary);
            doc.setFontSize(8);
            doc.text(d.atleta || '', cols[0], y + 4);
            doc.text(d.discipline || '', cols[1], y + 4);
            doc.text(d.tiempoInicial || '', cols[2], y + 4);
            doc.text(String(d.penalidad || 0), cols[3], y + 4);
            doc.text(d.tiempoFinal || '', cols[4], y + 4);
            doc.text(String(d.puntos || 0), cols[5], y + 4);
            y += 6;
        });

        doc.save(`pentatlon-disciplinas-${Date.now()}.pdf`);
    } catch (err) {
        alert('Error generando PDF de disciplinas: ' + err.message);
    }
}

// ============================================================
// EXPONER AL WINDOW (para onclick en HTML)
// ============================================================
window.start = start;
window.saveEvent = saveEvent;
window.savePlayer = savePlayer;
window.editPlayer = editPlayer;
window.cancelEditPlayer = cancelEditPlayer;
window.deletePlayer = deletePlayer;
window.saveDisciplina = saveDisciplina;
window.deleteDisc = deleteDisc;
window.editDisc = editDisc;
window.marcarEliminado = marcarEliminado;
window.restaurarDisc = restaurarDisc;
window.saveDiscEdit = saveDiscEdit;
window.closeEditDiscModal = closeEditDiscModal;
window.autoCalculateEditDiscTime = autoCalculateEditDiscTime;
window.deleteEvent = deleteEvent;
window.autoCalculateFinalTime = autoCalculateFinalTime;
window.applyFilters = applyFilters;
window.showSubView = showSubView;
window.toggleAccordion = toggleAccordion;
window.toggleAdminMode = toggleAdminMode;
window.openLoginModal = openLoginModal;
window.closeLoginModal = closeLoginModal;
window.checkPassword = checkPassword;
window.logoutAdmin = logoutAdmin;
window.logoutSession = logoutSession;
window.switchTab = switchTab;
window.filterAtletasList = filterAtletasList;
window.openAdvanceManager = openAdvanceManager;
window.closeAdvanceManager = closeAdvanceManager;
window.prepareSelection = prepareSelection;
window.assignToSlot = assignToSlot;
window.assignToWinner = assignToWinner;
window.refreshAdvanceDestinations = refreshAdvanceDestinations;
window.dibujarRondas = dibujarRondas;
window.colocarEnLlave = colocarEnLlave;
window.marcarParaMover = marcarParaMover;
window.resetBrackets = resetBrackets;
window.confirmarReinicioTorneo = confirmarReinicioTorneo;
window.updateBracketControls = updateBracketControls;
window.toggleBracketAdmin = toggleBracketAdmin;
window.generarEstructuraEliminacion = generarEstructuraEliminacion;
window.ejecutarDescargaSegunVista = ejecutarDescargaSegunVista;
window.downloadGeneralPDF = downloadGeneralPDF;
window.downloadBracketPDF = downloadBracketPDF;
window.downloadHandicapPDF = downloadHandicapPDF;
window.downloadDisciplinasPDF = downloadDisciplinasPDF;
window.renderResults = renderResults;
window.renderDisciplinas = renderDisciplinas;
window.calcularPuntosObstaculosRelevo = calcularPuntosObstaculosRelevo;
window.calcularPuntosNatacionRelevo = calcularPuntosNatacionRelevo;
window.calcularPuntosLaserRelevo = calcularPuntosLaserRelevo;
window.calcularPuntosNatacionJDN = calcularPuntosNatacionJDN;
window.calcularPuntosLaserJDN = calcularPuntosLaserJDN;
window.parseTime = parseTime;
window.formatHandicapTime = formatHandicapTime;
window.calculatePenaltyAddition = calculatePenaltyAddition;
window.currentRenderParams = currentRenderParams;

// ============================================================
// INICIAR APLICACIÓN
// ============================================================
start();
