/* ============================================================
   CONFIGURACIÓN DE FIREBASE
   ============================================================ */
const firebaseConfig = {
    apiKey: "AIzaSyDMabE70hIApcNU5RY3_WEEIF-BWUzO0K4",
    authDomain: "kerim-music-a9c46.firebaseapp.com",
    projectId: "kerim-music-a9c46",
    storageBucket: "kerim-music-a9c46.firebasestorage.app",
    messagingSenderId: "470731440209",
    appId: "1:470731440209:web:f6eba4784027a5d8c57870",
    measurementId: "G-LBHTKL8KDK"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

/* ============================================================
   0. AUTENTICACIÓN OBLIGATORIA CON GOOGLE
   ============================================================ */
const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

function isWebView() {
    const ua = navigator.userAgent || navigator.vendor || window.opera || '';
    return (
        /\bwv\b/.test(ua) ||
        (/iPhone|iPod|iPad/.test(ua) && !/Safari/.test(ua)) ||
        (typeof window.AndroidBridge !== 'undefined') ||
        (/Version\/[\d.]+.*Chrome/.test(ua) && /; wv\)/.test(ua)) ||
        (/FBAN|FBAV|Instagram|Line/.test(ua))
    );
}

const authGate      = document.getElementById('auth-gate');
const authBtn       = document.getElementById('auth-google-btn');
const authErrorEl   = document.getElementById('auth-gate-error');
const appContainer  = document.querySelector('.app-container');

function showAuthGate() {
    if (authGate) { authGate.classList.remove('hidden'); authGate.setAttribute('aria-hidden', 'false'); }
    if (appContainer) appContainer.classList.add('auth-locked');
    document.body.style.overflow = 'hidden';
}
function hideAuthGate() {
    if (authGate) { authGate.classList.add('hidden'); authGate.setAttribute('aria-hidden', 'true'); }
    if (appContainer) appContainer.classList.remove('auth-locked');
    document.body.style.overflow = '';
}
function setAuthError(msg) { if (authErrorEl) authErrorEl.textContent = msg || ''; }

showAuthGate();

auth.getRedirectResult()
    .then((result) => { if (result && result.user) console.log('✅ Vuelto de redirect:', result.user.email); })
    .catch((err) => {
        console.error('Error en getRedirectResult:', err);
        if (err && err.code) {
            let msg = 'Error al iniciar sesión con Google.';
            if (err.code === 'auth/unauthorized-domain') msg = 'Dominio no autorizado en Firebase.';
            else if (err.code === 'auth/network-request-failed') msg = 'Sin conexión. Revisa tu internet.';
            else if (err.code === 'auth/operation-not-allowed') msg = 'Google no está habilitado en Firebase.';
            setAuthError(msg);
        }
    });

auth.onAuthStateChanged(async (user) => {
    if (user) {
        window.__currentUser = user;
        console.log('✅ Sesión iniciada:', user.email, '| UID:', user.uid);
        hideAuthGate();

        const userNameEl = document.getElementById('submenu-user-name');
        const userSubEl  = document.getElementById('submenu-user-sub');

        if (userNameEl) {
            let displayName = user.displayName || user.email || user.uid;
            let subText = user.email ? user.email : 'Perfil de usuario';
            try {
                const docRef = db.collection('historial_usuarios').doc(user.uid);
                const docSnap = await docRef.get();
                if (docSnap.exists) {
                    const data = docSnap.data();
                    if (data.nombre) displayName = data.nombre;
                    else if (data.name) displayName = data.name;
                    else if (data.displayName) displayName = data.displayName;
                    if (data.rol) subText = data.rol;
                }
            } catch (e) { console.warn('No se pudo obtener el nombre desde Firestore:', e); }
            userNameEl.textContent = displayName;
            if (userSubEl) userSubEl.textContent = subText;
        }

        try {
            const docRef = db.collection('historial_usuarios').doc(user.uid);
            const docSnap = await docRef.get();
            const baseData = {
                nombre: user.displayName || (user.email ? user.email.split('@')[0] : '') || 'Usuario',
                email:  (user.email || '').toLowerCase(),
                foto:   user.photoURL || ''
            };
            if (!docSnap.exists) {
                await docRef.set(baseData, { merge: true });
                console.log('🆕 Perfil de usuario creado en historial_usuarios');
            } else {
                const existing = docSnap.data() || {};
                const update = {};
                if (!existing.nombre && baseData.nombre) update.nombre = baseData.nombre;
                if (!existing.email  && baseData.email)  update.email  = baseData.email;
                if (!existing.foto   && baseData.foto)   update.foto   = baseData.foto;
                if (Object.keys(update).length) {
                    await docRef.set(update, { merge: true });
                    console.log('🔄 Perfil de usuario sincronizado:', update);
                }
            }
        } catch (e) { console.warn('No se pudo sincronizar nombre/email en Firestore:', e); }

        await cargarOyentesDeTodas();
        if (typeof window.__cargarHistorialUsuario === 'function') {
            await window.__cargarHistorialUsuario();
            if (typeof window.__buildListenAgain === 'function') window.__buildListenAgain();
        }
        if (typeof window.__cargarPlaylistsUsuario === 'function') {
            await window.__cargarPlaylistsUsuario();
            if (typeof window.__buildListenAgain === 'function') window.__buildListenAgain();
        }
    } else {
        window.__currentUser = null;
        console.log('🔒 Sin sesión. App bloqueada.');
        showAuthGate();
        const userNameEl = document.getElementById('submenu-user-name');
        const userSubEl  = document.getElementById('submenu-user-sub');
        if (userNameEl) userNameEl.textContent = 'UID del usuario';
        if (userSubEl) userSubEl.textContent = '(A qui va el nombre de usuario)';
    }
});

if (authBtn) {
    authBtn.addEventListener('click', async () => {
        setAuthError('');
        authBtn.disabled = true;
        const originalHTML = authBtn.innerHTML;
        authBtn.innerHTML = '<span>Conectando…</span>';
        try {
            if (isWebView()) await auth.signInWithRedirect(googleProvider);
            else             await auth.signInWithPopup(googleProvider);
        } catch (err) {
            console.error('Error al iniciar sesión:', err);
            let msg = 'No se pudo iniciar sesión. Intenta de nuevo.';
            if (err && err.code === 'auth/popup-closed-by-user')        msg = 'Cancelaste el inicio de sesión.';
            else if (err && err.code === 'auth/popup-blocked')           msg = 'Permite las ventanas emergentes para iniciar sesión.';
            else if (err && err.code === 'auth/network-request-failed')  msg = 'Sin conexión. Revisa tu internet.';
            else if (err && err.code === 'auth/unauthorized-domain')     msg = 'Dominio no autorizado en Firebase.';
            setAuthError(msg);
        } finally {
            authBtn.disabled = false;
            authBtn.innerHTML = originalHTML;
        }
    });
}

/* ============================================================
   0.2. SISTEMA DE OYENTES ÚNICOS
   ============================================================ */
const DIAS_VENTANA = 28;
let oyentesCache = {};

function esNuevoOyente(nombreCancion, uid) {
    const data = oyentesCache[nombreCancion] || {};
    const fecha = data[uid];
    if (!fecha) return true;
    const diffDias = (Date.now() - fecha.getTime()) / (1000 * 60 * 60 * 24);
    return diffDias >= DIAS_VENTANA;
}

function contarOyentes(nombreCancion) {
    const data = oyentesCache[nombreCancion] || {};
    const ahora = Date.now();
    const limite = ahora - DIAS_VENTANA * 24 * 60 * 60 * 1000;
    let count = 0;
    for (const uid in data) {
        const fecha = data[uid];
        if (fecha && fecha.getTime() >= limite) count++;
    }
    return count;
}

async function registrarOyente(nombreCancion) {
    const user = firebase.auth().currentUser;
    if (!user) return;
    const uid = user.uid;
    if (!oyentesCache[nombreCancion]) oyentesCache[nombreCancion] = {};
    oyentesCache[nombreCancion][uid] = new Date();
    const item = buscarItemPorTitulo(nombreCancion);
    if (item) pintarReproducciones(item, contarOyentes(nombreCancion));
    try {
        const docRef = db.collection('oyentes_canciones').doc(nombreCancion);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            await docRef.update({ [`oyentes.${uid}`]: firebase.firestore.FieldValue.serverTimestamp() });
        } else {
            await docRef.set({ oyentes: { [uid]: firebase.firestore.FieldValue.serverTimestamp() } });
        }
    } catch (e) { console.error('Error al registrar oyente:', e); }
}

async function cargarOyentesCancion(nombreCancion) {
    try {
        const docRef = db.collection('oyentes_canciones').doc(nombreCancion);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            const data = docSnap.data();
            const oyentes = data.oyentes || {};
            oyentesCache[nombreCancion] = {};
            for (const uid in oyentes) {
                const fecha = oyentes[uid];
                if (fecha && typeof fecha.toDate === 'function') oyentesCache[nombreCancion][uid] = fecha.toDate();
            }
        } else { oyentesCache[nombreCancion] = {}; }
    } catch (e) { oyentesCache[nombreCancion] = {}; }
}

async function cargarOyentesDeTodas() {
    const items = document.querySelectorAll('.playlist-item');
    const promesas = [];
    items.forEach(item => {
        const titulo = item.querySelector('.item-title')?.textContent.trim() || '';
        if (!titulo) return;
        promesas.push(cargarOyentesCancion(titulo).then(() => {
            pintarReproducciones(item, contarOyentes(titulo));
        }));
    });
    await Promise.all(promesas);
    console.log('🔥 Oyentes cargados para todas las canciones');
}

function buscarItemPorTitulo(titulo) {
    const items = document.querySelectorAll('.playlist-item');
    for (const item of items) {
        const t = item.querySelector('.item-title')?.textContent.trim() || '';
        if (t === titulo) return item;
    }
    return null;
}

/* ============================================================
   0.3. HISTORIAL DE REPRODUCCIONES POR USUARIO
   ============================================================ */
const MAX_HISTORIAL = 50;
let historialCache = [];

async function cargarHistorialUsuario() {
    const user = firebase.auth().currentUser;
    if (!user) { historialCache = []; return; }
    try {
        const docRef = db.collection('historial_usuarios').doc(user.uid);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            const data = docSnap.data();
            const canciones = Array.isArray(data.canciones) ? data.canciones : [];
            historialCache = canciones
                .map(c => ({
                    titulo: c.titulo,
                    fecha: (c.fecha && typeof c.fecha.toDate === 'function') ? c.fecha.toDate() : new Date(0)
                }))
                .filter(c => c.titulo)
                .sort((a, b) => b.fecha - a.fecha)
                .slice(0, MAX_HISTORIAL);
        } else { historialCache = []; }
    } catch (e) { historialCache = []; }
}

async function guardarEnHistorial(titulo) {
    const user = firebase.auth().currentUser;
    if (!user || !titulo) return;
    historialCache = historialCache.filter(c => c.titulo !== titulo);
    historialCache.unshift({ titulo, fecha: new Date() });
    if (historialCache.length > MAX_HISTORIAL) historialCache.length = MAX_HISTORIAL;
    if (typeof window.__buildListenAgain === 'function') window.__buildListenAgain();
    try {
        const docRef = db.collection('historial_usuarios').doc(user.uid);
        const docSnap = await docRef.get();
        const nuevasCanciones = historialCache.map(c => ({
            titulo: c.titulo,
            fecha: firebase.firestore.Timestamp.fromDate(c.fecha)
        }));
        if (docSnap.exists) await docRef.update({ canciones: nuevasCanciones });
        else await docRef.set({ canciones: nuevasCanciones });
    } catch (e) { console.warn('Error al guardar historial:', e); }
}

window.__cargarHistorialUsuario = cargarHistorialUsuario;
window.__guardarEnHistorial = guardarEnHistorial;
window.__getHistorialCache = () => historialCache;

/* ============================================================
   0.4. SISTEMA DE PLAYLISTS "VOLVER A OÍR"
   ============================================================ */
const MAX_CANCIONES_POR_PLAYLIST = 10;
const MAX_COMPLETADAS = 300;
let completadasCache = [];
let playlistsExclusionsCache = {};

async function cargarPlaylistsUsuario() {
    const user = firebase.auth().currentUser;
    if (!user) { completadasCache = []; playlistsExclusionsCache = {}; return; }
    try {
        const docRef = db.collection('historial_usuarios').doc(user.uid);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            const data = docSnap.data();
            const completadas = Array.isArray(data.canciones_completadas) ? data.canciones_completadas : [];
            completadasCache = completadas
                .map(c => ({
                    titulo: c.titulo || '',
                    fecha: (c.fecha && typeof c.fecha.toDate === 'function') ? c.fecha.toDate() : new Date(0)
                }))
                .filter(c => c.titulo)
                .slice(-MAX_COMPLETADAS);
            playlistsExclusionsCache = (data.playlists_edits && typeof data.playlists_edits === 'object')
                ? data.playlists_edits : {};
        } else {
            completadasCache = [];
            playlistsExclusionsCache = {};
        }
    } catch (e) {
        completadasCache = [];
        playlistsExclusionsCache = {};
    }
}

async function guardarCompletadasEnHistorial() {
    const user = firebase.auth().currentUser;
    if (!user) return;
    try {
        const docRef = db.collection('historial_usuarios').doc(user.uid);
        const docSnap = await docRef.get();
        const dataToSave = {
            canciones_completadas: completadasCache.map(c => ({
                titulo: c.titulo,
                fecha: firebase.firestore.Timestamp.fromDate(c.fecha)
            }))
        };
        if (docSnap.exists) await docRef.update(dataToSave);
        else await docRef.set(dataToSave);
    } catch (e) { console.warn('Error al guardar completadas:', e); }
}

async function guardarEnPlaylist(titulo) {
    const user = firebase.auth().currentUser;
    if (!user || !titulo) return;
    completadasCache = completadasCache.filter(c => c.titulo !== titulo);
    completadasCache.push({ titulo, fecha: new Date() });
    if (completadasCache.length > MAX_COMPLETADAS) completadasCache = completadasCache.slice(-MAX_COMPLETADAS);
    await guardarCompletadasEnHistorial();
    if (typeof window.__buildListenAgain === 'function') window.__buildListenAgain();
}

function computePlaylistsFromCompletadas() {
    const playlists = [];
    const total = completadasCache.length;
    for (let i = 0; i < total; i += MAX_CANCIONES_POR_PLAYLIST) {
        const chunk = completadasCache.slice(i, i + MAX_CANCIONES_POR_PLAYLIST);
        if (!chunk.length) continue;
        const idx = Math.floor(i / MAX_CANCIONES_POR_PLAYLIST) + 1;
        const plId = 'pl_' + idx;
        const exclusions = playlistsExclusionsCache[plId] || {};
        const excluidas = Array.isArray(exclusions.excluidas) ? exclusions.excluidas : [];
        const cancionesFiltradas = chunk.filter(c => !excluidas.includes(c.titulo));
        if (!cancionesFiltradas.length) continue;
        playlists.push({
            id: plId,
            nombre: 'Volver a Oír',
            fecha: chunk[0].fecha,
            canciones: cancionesFiltradas,
            isOwner: true
        });
    }
    return playlists;
}

window.__cargarPlaylistsUsuario = cargarPlaylistsUsuario;
window.__guardarEnPlaylist     = guardarEnPlaylist;
window.__getPlaylistsCache     = computePlaylistsFromCompletadas;

window.__guardarEdicionPlaylist = async function (playlist, excluidas) {
    const user = firebase.auth().currentUser;
    if (!user || !playlist || !Array.isArray(excluidas)) return;
    if (!playlistsExclusionsCache[playlist.id]) playlistsExclusionsCache[playlist.id] = {};
    const previas = Array.isArray(playlistsExclusionsCache[playlist.id].excluidas)
        ? playlistsExclusionsCache[playlist.id].excluidas : [];
    playlistsExclusionsCache[playlist.id].excluidas = Array.from(new Set([...previas, ...excluidas]));
    try {
        const docRef = db.collection('historial_usuarios').doc(user.uid);
        await docRef.set({ playlists_edits: playlistsExclusionsCache }, { merge: true });
    } catch (e) { throw e; }

    try {
        const cancionesFiltradas = playlist.canciones.filter(c => !excluidas.includes(c.titulo));
        const plRoot = document.getElementById('playlist');
        function findItem(titulo) {
            if (!plRoot) return null;
            const n = String(titulo || '').toLowerCase().trim();
            if (!n) return null;
            for (const it of plRoot.querySelectorAll('.playlist-item')) {
                const t = (it.querySelector('.item-title')?.textContent || '').trim().toLowerCase();
                if (t === n) return it;
            }
            return null;
        }
        const cancionesSync = cancionesFiltradas.map(c => {
            const it = findItem(c.titulo);
            return {
                titulo: c.titulo,
                portada: (it && it.querySelector('.thumbnail img')?.src) || c.portada || '',
                subtitulo: (it && it.querySelector('.item-subtitle')?.textContent.trim()) || c.subtitulo || ''
            };
        });
        let portada = '';
        for (const c of cancionesSync) { if (c.portada) { portada = c.portada; break; } }
        const snap = await db.collection('playlists_compartidas')
            .where('de', '==', user.uid)
            .where('playlistId', '==', playlist.id)
            .get();
        if (!snap.empty) {
            await Promise.all(snap.docs.map(d => d.ref.update({ canciones: cancionesSync, portada })));
        }
    } catch (e) { console.warn('Error sincronizando compartidas:', e); }
};

/* ============================================================
   1. DATOS GLOBALES Y UTILIDADES
   ============================================================ */
let firebaseDocsCache = [];
window.__showAllSongs = false;
window.__omegaShuffleOn = true;

function normalizeStr(str) {
    return String(str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
}

function findFirebaseDoc(songTitle) {
    if (!songTitle || !firebaseDocsCache.length) return null;
    const nTitle = normalizeStr(songTitle);
    if (!nTitle) return null;
    for (const doc of firebaseDocsCache) if (normalizeStr(doc.id) === nTitle) return doc;
    for (const doc of firebaseDocsCache) {
        const nId = normalizeStr(doc.id);
        if (nId && (nId.includes(nTitle) || nTitle.includes(nId))) return doc;
    }
    const prefix = nTitle.substring(0, Math.min(nTitle.length, 6));
    if (prefix.length >= 4) {
        for (const doc of firebaseDocsCache) if (normalizeStr(doc.id).startsWith(prefix)) return doc;
    }
    return null;
}

async function cargarDocsDeFirebase() {
    try {
        const snap = await db.collection('Radio_Muisc').get();
        firebaseDocsCache = snap.docs.map(d => ({ id: d.id, ref: d.ref, data: d.data() || {} }));
    } catch (e) { console.warn('⚠️ No se pudieron cargar docs:', e); }
}

function pintarReproducciones(item, count) {
    if (!item) return;
    const info = item.querySelector('.item-info');
    if (!info) return;
    let badge = info.querySelector('.item-plays');
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'item-plays';
        info.appendChild(badge);
    }
    badge.textContent = `👥 ${count} oyente${count === 1 ? '' : 's'}`;
}

window.__artistFilter = null;
window.__artistFilterName = '';

function clearArtistFilter() {
    window.__artistFilter = null;
    window.__artistFilterName = '';
    document.dispatchEvent(new CustomEvent('omega:artistmode', { detail: { active: false } }));
}

function setArtistFilter(items, name) {
    if (!items || !items.length) return;
    window.__artistFilter = items.slice();
    window.__artistFilterName = name || '';
    document.dispatchEvent(new CustomEvent('omega:artistmode', { detail: { active: true, name: name || '' } }));
}

/* ============================================================
   3. REPRODUCTOR PRINCIPAL
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {

    const playButton     = document.getElementById('play-button');
    const playIcon       = document.getElementById('play-icon');
    const audioPlayer    = document.getElementById('audio-player');
    const progressBar    = document.getElementById('progress-bar');
    const currentTimeEl  = document.getElementById('current-time');
    const durationEl     = document.getElementById('duration');
    const playerTitle    = document.getElementById('player-title');
    const playerCover    = document.getElementById('player-cover');
    const player         = document.getElementById('player');
    const playlist       = document.getElementById('playlist');

    if (!audioPlayer || !playlist) return;

    let currentItem = null;
    let isSkipping  = false;

    const ICON_PLAY  = '<polygon points="5,3 19,12 5,21" fill="#ffffff" />';
    const ICON_PAUSE = '<rect x="6" y="4" width="4" height="16" fill="#ffffff" />' +
                       '<rect x="14" y="4" width="4" height="16" fill="#ffffff" />';

    function haptic(ms) {
        if (navigator.vibrate) { try { navigator.vibrate(ms || 12); } catch (_) {} }
    }

    function attachRipple(el, options) {
        if (!el || el.dataset.rippleReady === '1') return;
        el.dataset.rippleReady = '1';
        if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
        el.classList.add('ripple-host');
        el.addEventListener('pointerdown', (e) => {
            const rect = el.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = (e.clientX || rect.left + rect.width / 2) - rect.left;
            const y = (e.clientY || rect.top + rect.height / 2) - rect.top;
            const ripple = document.createElement('span');
            ripple.className = 'ripple';
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = (x - size / 2) + 'px';
            ripple.style.top  = (y - size / 2) + 'px';
            el.appendChild(ripple);
            ripple.addEventListener('animationend', () => ripple.remove());
        });
        el.addEventListener('pointerdown', () => haptic(options && options.haptic), { passive: true });
    }

    ['.menu-btn', '.heart-search-btn', '.share-btn', '.close-submenu', '.submenu-link', '.play-button'].forEach(selector => {
        document.querySelectorAll(selector).forEach(el => attachRipple(el));
    });
    document.querySelectorAll('.playlist-item').forEach(el => {
        attachRipple(el, { haptic: 0 });
        el.style.setProperty('--ripple-color', 'rgba(255, 255, 255, 0.10)');
    });

    function formatTime(seconds) {
        if (!isFinite(seconds) || seconds < 0) return '0:00';
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    }
    function updateProgress(percent) {
        if (!progressBar) return;
        const value = Math.min(100, Math.max(0, percent));
        progressBar.style.setProperty('--progress', `${value}%`);
        progressBar.setAttribute('aria-valuenow', Math.round(value));
    }
    function updateIcon(playing) {
        if (!playIcon || !playButton) return;
        playIcon.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
        playIcon.style.marginLeft = playing ? '0' : '3px';
        playButton.setAttribute('aria-label', playing ? 'Pausar' : 'Reproducir');
    }
    function getAllItems() { return Array.from(playlist.querySelectorAll('.playlist-item')); }
    function isShuffleOn() { return window.__omegaShuffleOn !== false; }
    function getItemTitle(item) {
        if (!item) return '';
        return item.querySelector('.item-title')?.textContent.trim() || item.dataset.title?.trim() || '';
    }
    function getItemCover(item) {
        if (!item) return '';
        const img = item.querySelector('.thumbnail img');
        if (img && img.getAttribute('src')) return img.src;
        return item.dataset.cover || '';
    }
    function getCandidateItems() {
        const all = getAllItems();
        if (window.__artistFilter && window.__artistFilter.length) {
            const filtered = all.filter(i => window.__artistFilter.includes(i));
            if (filtered.length) return filtered;
        }
        return all;
    }
    function loadItem(item, autoplay = true) {
        if (!item) return;
        const src = item.dataset.src;
        const cover = getItemCover(item);
        const title = getItemTitle(item);
        if (!src) { handleLoadError(item); return; }
        getAllItems().forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        currentItem = item;
        if (playerCover) {
            if (cover) playerCover.src = cover;
            else playerCover.removeAttribute('src');
        }
        if (playerTitle) playerTitle.textContent = title;
        if (player) player.classList.add('active');
        audioPlayer.src = src;
        audioPlayer.currentTime = 0;
        updateProgress(0);
        if (currentTimeEl) currentTimeEl.textContent = '0:00';
        if (durationEl) durationEl.textContent = '0:00';
        if (autoplay) audioPlayer.play().catch(err => console.warn('Auto-play falló:', err));
    }
    function handleLoadError() {
        if (isSkipping) return;
        isSkipping = true;
        updateIcon(false); updateProgress(0);
        if (currentTimeEl) currentTimeEl.textContent = '0:00';
        if (durationEl) durationEl.textContent = '0:00';
        setTimeout(() => { isSkipping = false; playRandomItem(); }, 300);
    }
    audioPlayer.addEventListener('error', () => handleLoadError());

    function playRandomItem() {
        const items = getCandidateItems();
        if (!items.length) return;
        if (!isShuffleOn()) {
            let startIdx = 0;
            if (currentItem) {
                const idx = items.indexOf(currentItem);
                if (idx !== -1) startIdx = (idx + 1) % items.length;
            }
            loadItem(items[startIdx], true);
            return;
        }
        let candidates = items;
        if (items.length > 1 && currentItem && items.includes(currentItem)) {
            candidates = items.filter(i => i !== currentItem);
        }
        if (!candidates.length) candidates = items;
        const randomItem = candidates[Math.floor(Math.random() * candidates.length)];
        loadItem(randomItem, true);
    }
    function goNextItem() {
        const items = getCandidateItems();
        if (!items.length) return;
        if (isShuffleOn()) { playRandomItem(); return; }
        let idx = items.indexOf(currentItem);
        if (idx === -1) idx = 0;
        loadItem(items[(idx + 1) % items.length], true);
    }
    function goPrevItem() {
        const items = getCandidateItems();
        if (!items.length) return;
        if (isShuffleOn()) { playRandomItem(); return; }
        let idx = items.indexOf(currentItem);
        if (idx === -1) idx = 0;
        loadItem(items[(idx - 1 + items.length) % items.length], true);
    }
    document.addEventListener('omega:next', () => goNextItem());
    document.addEventListener('omega:prev', () => goPrevItem());

    playButton.addEventListener('click', () => {
        if (!currentItem) { playRandomItem(); return; }
        if (audioPlayer.paused) audioPlayer.play().catch(err => console.error('Error:', err));
        else audioPlayer.pause();
    });
    audioPlayer.addEventListener('play', () => updateIcon(true));
    audioPlayer.addEventListener('pause', () => updateIcon(false));
    audioPlayer.addEventListener('loadedmetadata', () => {
        if (durationEl) durationEl.textContent = formatTime(audioPlayer.duration);
    });
    audioPlayer.addEventListener('timeupdate', () => {
        if (currentTimeEl) currentTimeEl.textContent = formatTime(audioPlayer.currentTime);
        if (audioPlayer.duration > 0) updateProgress((audioPlayer.currentTime / audioPlayer.duration) * 100);
    });
    audioPlayer.addEventListener('ended', async (e) => {
        if (e.defaultPrevented) return;
        const duration = audioPlayer.duration;
        const played = audioPlayer.currentTime;
        const completed = !!duration && isFinite(duration) && played >= (duration - 1.5);
        updateIcon(false); updateProgress(0);
        if (currentTimeEl) currentTimeEl.textContent = '0:00';
        if (completed && currentItem) {
            const titulo = getItemTitle(currentItem);
            const user = firebase.auth().currentUser;
            if (titulo && user && esNuevoOyente(titulo, user.uid)) await registrarOyente(titulo);
            if (titulo && user && typeof window.__guardarEnPlaylist === 'function') await window.__guardarEnPlaylist(titulo);
        }
        playRandomItem();
    });

    progressBar && progressBar.addEventListener('click', (e) => {
        if (!audioPlayer.duration) return;
        const rect = progressBar.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        audioPlayer.currentTime = Math.min(1, Math.max(0, ratio)) * audioPlayer.duration;
    });

    playlist.addEventListener('click', (e) => {
        const item = e.target.closest('.playlist-item');
        if (!item) return;
        if (window.__artistFilter && window.__artistFilter.length) {
            if (!window.__artistFilter.includes(item)) clearArtistFilter();
        }
        loadItem(item, true);
    });

    /* BUSCADOR */
    const heartSearchBtn  = document.getElementById('heart-search-btn');
    const searchContainer = document.getElementById('search-container');
    const searchInput     = document.getElementById('search-input');

    function applySearchVisibility() {
        const q = (searchInput?.value || '').toLowerCase().trim();
        const items = document.querySelectorAll('.playlist-item');
        items.forEach(item => {
            if (!q) { item.style.display = window.__showAllSongs ? 'flex' : 'none'; return; }
            const title = item.querySelector('.item-title')?.textContent.toLowerCase() || '';
            const subtitle = item.querySelector('.item-subtitle')?.textContent.toLowerCase() || '';
            item.style.display = (title.includes(q) || subtitle.includes(q)) ? 'flex' : 'none';
        });
    }
    window.__applySearchVisibility = applySearchVisibility;

    if (heartSearchBtn && searchContainer && searchInput) {
        heartSearchBtn.addEventListener('click', () => {
            searchContainer.classList.toggle('visible');
            if (searchContainer.classList.contains('visible')) searchInput.focus();
            else { searchInput.value = ''; searchInput.dispatchEvent(new Event('input')); }
        });
        searchInput.addEventListener('input', applySearchVisibility);
    }

    /* COMPARTIR */
    const shareBtn = document.getElementById('share-btn');
    const SHARE_URL = 'https://kerimmusic.github.io/DescargarAppOmegaBeats/';
    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            const currentTitle = currentItem ? getItemTitle(currentItem) : document.title;
            const shareData = {
                title: 'Omega Beats',
                text: currentTitle ? `Escucha este beat: ${currentTitle}` : 'Escucha Omega Beats',
                url: SHARE_URL
            };
            if (navigator.share) navigator.share(shareData).catch((error) => console.log('Error:', error));
            else {
                const textToCopy = `${shareData.text}\n${SHARE_URL}`;
                navigator.clipboard.writeText(textToCopy).then(() => alert('¡Enlace copiado!'))
                    .catch(err => alert('No se pudo compartir. Copia: ' + SHARE_URL));
            }
        });
    }

    /* MENÚ */
    const menuBtn         = document.getElementById('menu-btn');
    const submenu         = document.getElementById('submenu');
    const submenuOverlay  = document.getElementById('submenu-overlay');
    const closeSubmenuBtn = document.getElementById('close-submenu');

    function openSubmenu() {
        if (!submenu || !submenuOverlay) return;
        submenu.classList.add('visible');
        submenuOverlay.classList.add('visible');
        submenu.setAttribute('aria-hidden', 'false');
    }
    function closeSubmenu() {
        if (!submenu || !submenuOverlay) return;
        submenu.classList.remove('visible');
        submenuOverlay.classList.remove('visible');
        submenu.setAttribute('aria-hidden', 'true');
    }
    if (menuBtn) menuBtn.addEventListener('click', openSubmenu);
    if (closeSubmenuBtn) closeSubmenuBtn.addEventListener('click', closeSubmenu);
    if (submenuOverlay) submenuOverlay.addEventListener('click', closeSubmenu);

    document.querySelectorAll('.submenu-link').forEach(link => {
        link.addEventListener('click', (e) => {
            if (link.id === 'logout-link') return;
            if (link.id === 'mi-playlist-link') return;
            closeSubmenu();
        });
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSubmenu(); });

    /* FULLSCREEN PLAYER */
    if (!player || !playerCover || !playerTitle || !playButton) return;

    const fsHTML = `
        <div class="fs-player" id="fs-player" aria-hidden="true">
            <div class="fs-bg" id="fs-bg"></div>
            <div class="fs-top-bar">
                <button class="fs-close" id="fs-close" aria-label="Cerrar">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
                         stroke="#ffffff" stroke-width="2.4" stroke-linecap="round">
                        <line x1="6" y1="6"  x2="18" y2="18"/>
                        <line x1="18" y1="6" x2="6"  y2="18"/>
                    </svg>
                </button>
            </div>
            <div class="fs-content" id="fs-content">
                <div class="fs-vinyl-wrap" id="fs-vinyl-wrap">
                    <div class="fs-vinyl" id="fs-vinyl">
                        <img class="fs-cover" id="fs-cover" alt="Portada">
                    </div>
                    <span class="fs-spindle"></span>
                </div>
                <h2 class="fs-title" id="fs-title">Título del Beat</h2>
                <div class="fs-actions">
                    <button class="fs-like" id="fs-like" type="button" aria-label="Me gusta">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                        </svg>
                        <span>Me Gusta</span>
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', fsHTML);

    const fsPlayer = document.getElementById('fs-player');
    const fsBg = document.getElementById('fs-bg');
    const fsContent = document.getElementById('fs-content');
    const fsVinyl = document.getElementById('fs-vinyl');
    const fsCover = document.getElementById('fs-cover');
    const fsTitle = document.getElementById('fs-title');
    const fsClose = document.getElementById('fs-close');

    let lastCoverSrc = '';
    function syncFromMini() {
        const newCover = playerCover.getAttribute('src') || '';
        const newTitle = (playerTitle.textContent || '').trim() || 'Título del Beat';
        if (newCover && newCover !== lastCoverSrc) {
            fsCover.src = newCover;
            fsBg.style.backgroundImage = `url("${newCover}")`;
            lastCoverSrc = newCover;
        } else if (!newCover) {
            fsCover.removeAttribute('src');
            fsBg.style.backgroundImage = '';
            lastCoverSrc = '';
        }
        fsTitle.textContent = newTitle;
    }
    const syncObserver = new MutationObserver(() => syncFromMini());
    syncObserver.observe(playerCover, { attributes: true, attributeFilter: ['src'] });
    syncObserver.observe(playerTitle, { childList: true, characterData: true, subtree: true });

    function updateVinylState() {
        if (audioPlayer.paused) fsVinyl.classList.remove('playing');
        else fsVinyl.classList.add('playing');
    }
    audioPlayer.addEventListener('play', updateVinylState);
    audioPlayer.addEventListener('pause', updateVinylState);
    audioPlayer.addEventListener('ended', updateVinylState);

    function openFullscreen() {
        if (!playlist.querySelector('.playlist-item.active')) playButton.click();
        syncFromMini();
        setTimeout(syncFromMini, 120);
        setTimeout(syncFromMini, 400);
        fsPlayer.classList.add('visible');
        fsPlayer.setAttribute('aria-hidden', 'false');
        updateVinylState();
    }
    function closeFullscreen() {
        fsPlayer.classList.remove('visible');
        fsPlayer.setAttribute('aria-hidden', 'true');
    }
    fsClose && fsClose.addEventListener('click', closeFullscreen);

    function attachGesture(el, onGesture) {
        el.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            if (e.target.closest('button')) return;
            const sx = e.clientX, sy = e.clientY, st = Date.now();
            const target = e.target;
            const pid = e.pointerId;
            function onUp(e2) {
                if (e2.pointerId !== pid) return;
                document.removeEventListener('pointerup', onUp);
                document.removeEventListener('pointercancel', onCancel);
                onGesture({ dx: e2.clientX - sx, dy: e2.clientY - sy, dt: Date.now() - st, target });
            }
            function onCancel(e2) {
                if (e2.pointerId !== pid) return;
                document.removeEventListener('pointerup', onUp);
                document.removeEventListener('pointercancel', onCancel);
            }
            document.addEventListener('pointerup', onUp);
            document.addEventListener('pointercancel', onCancel);
        });
    }

    attachGesture(player, ({ dx, dy, dt, target }) => {
        const absX = Math.abs(dx), absY = Math.abs(dy);
        const onProgress = target && target.closest && target.closest('#progress-bar');
        if (!onProgress && dt < 400 && absX < 12 && absY < 12) { openFullscreen(); return; }
        if (dt > 800) return;
        if (absY > 40 && absY > absX * 1.2 && dy < 0) openFullscreen();
    });

    attachGesture(fsPlayer, ({ dx, dy, dt, target }) => {
        const absX = Math.abs(dx), absY = Math.abs(dy);
        const onVinyl = target && target.closest && target.closest('.fs-vinyl-wrap');
        if (onVinyl && dt < 400 && absX < 12 && absY < 12) { playButton.click(); return; }
        if (dt > 1200) return;
        if (absY > 50 && absY > absX * 1.3) {
            if (dy < 0) goNextItem();
            else goPrevItem();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && fsPlayer.classList.contains('visible')) closeFullscreen();
    });

    (function initFsTitleArtistLink() {
        if (!fsTitle || !playlist) return;
        fsTitle.style.cursor = 'pointer';
        fsTitle.style.pointerEvents = 'auto';
        fsTitle.setAttribute('role', 'button');
        fsTitle.setAttribute('tabindex', '0');
        const COLLAB_SPLIT = /\s+(?:ft\.?|feat\.?|featuring|con|&)\s+/i;
        function getArtistFromActiveItem() {
            const activeItem = playlist.querySelector('.playlist-item.active');
            if (!activeItem) return '';
            const sub = activeItem.querySelector('.item-subtitle')?.textContent || '';
            const idx = sub.indexOf('·');
            const namePart = (idx === -1 ? sub : sub.slice(0, idx)).trim();
            if (!namePart) return '';
            const first = (namePart.split(COLLAB_SPLIT)[0] || namePart).trim();
            return first || namePart;
        }
        function openArtistFromTitle() {
            const artistName = getArtistFromActiveItem();
            if (!artistName) return;
            if (typeof window.__openArtistProfile !== 'function') return;
            closeFullscreen();
            setTimeout(() => window.__openArtistProfile(artistName), 80);
        }
        fsTitle.addEventListener('click', openArtistFromTitle);
        fsTitle.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openArtistFromTitle(); }
        });
    })();

    (async () => {
        await cargarDocsDeFirebase();
        if (firebase.auth().currentUser) {
            await cargarOyentesDeTodas();
            if (typeof window.__cargarHistorialUsuario === 'function') {
                await window.__cargarHistorialUsuario();
                if (typeof window.__buildListenAgain === 'function') window.__buildListenAgain();
            }
            if (typeof window.__cargarPlaylistsUsuario === 'function') {
                await window.__cargarPlaylistsUsuario();
                if (typeof window.__buildListenAgain === 'function') window.__buildListenAgain();
            }
        }
        if (typeof window.__applySearchVisibility === 'function') window.__applySearchVisibility();
    })();
});

/* ============================================================
   4. GESTOR DE ANUNCIOS (FIREBASE) ✨ ACTUALIZADO
   ============================================================ */
(function () {
    'use strict';

    const BEATS_PER_AD  = 6;
    const ADS_PER_CYCLE = 3;
    const SKIP_DELAY    = 5;

    let audioPlayer  = null;
    let originalPlay = null;

    let beatPlayCount     = 0;
    let lastSrc           = '';
    let isAdPlaying       = false;
    let adPlaying         = false;
    let adOnComplete      = null;
    let currentAdMedia    = null;
    let countdownInterval = null;
    let adTimeout         = null;

    let adsCache        = [];
    let adsLoadPromise  = null;
    let dailyViewsCache = {};

    let overlay   = null;
    let adMedia   = null;
    let adSkip    = null;
    let adCounter = null;

    function getTodayKey() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + day;
    }

    function normalizeAd(doc) {
        const d = doc.data() || {};
        const repeticionesPorDia = Number(
            d.repeticionesPorDia ?? d.repeticiones_por_dia ?? d.repeticiones ??
            d.vecesPorDia ?? d.limiteDiario ?? d.limite ?? d.veces ?? 0
        ) || 0;
        const duracionDias = Number(
            d.duracionDias ?? d.duracion_dias ?? d.duracion ?? d.duration ?? 0
        ) || 0;
        let fechaInicio = null;
        const rawFecha = d.fechaInicio || d.fecha_inicio || d.inicio || d.startDate ||
                         d.creado || d.createdAt || d.fecha || null;
        if (rawFecha) {
            if (typeof rawFecha.toDate === 'function') fechaInicio = rawFecha.toDate();
            else if (rawFecha instanceof Date) fechaInicio = rawFecha;
            else if (typeof rawFecha === 'number') fechaInicio = new Date(rawFecha);
            else if (typeof rawFecha === 'string') {
                const parsed = new Date(rawFecha);
                if (!isNaN(parsed.getTime())) fechaInicio = parsed;
            } else if (typeof rawFecha === 'object' && typeof rawFecha.seconds === 'number') {
                fechaInicio = new Date(rawFecha.seconds * 1000);
            }
            if (fechaInicio && isNaN(fechaInicio.getTime())) fechaInicio = null;
        }
        return {
            id: doc.id,
            titulo: d.titulo || d.title || d.nombre || 'Anuncio',
            audio: d.audio || d.audioUrl || d.music || d.musica || '',
            imagen: d.imagen || d.imagenUrl || d.image || d.url || d.portada || '',
            video: d.video || d.videoUrl || '',
            vecesPorDia: repeticionesPorDia,
            repeticionesPorDia: repeticionesPorDia,
            duracionDias: duracionDias,
            fechaInicio: fechaInicio,
            activo: d.activo !== false
        };
    }

    async function cargarAnuncios(force) {
        if (!force && adsLoadPromise) return adsLoadPromise;
        adsLoadPromise = (async () => {
            try {
                const snap = await firebase.firestore().collection('anuncios').get();
                adsCache = snap.docs.map(normalizeAd);
                console.log('[ADS] Anuncios cargados:', adsCache.length);
            } catch (e) {
                console.warn('[ADS] Error cargando anuncios:', e);
                adsCache = [];
            }
            return adsCache;
        })();
        return adsLoadPromise;
    }

    async function cargarVistasDelDia() {
        const hoy = getTodayKey();
        try {
            const snap = await firebase.firestore()
                .collection('anuncios_vistas')
                .where('fecha', '==', hoy)
                .get();
            dailyViewsCache = {};
            snap.forEach(doc => {
                const d = doc.data() || {};
                if (d.adId) dailyViewsCache[d.adId] = Number(d.count) || 0;
            });
        } catch (e) {
            console.warn('[ADS] Error cargando vistas:', e);
            dailyViewsCache = {};
        }
    }

    async function incrementarVista(adId) {
        const hoy = getTodayKey();
        const docId = adId + '_' + hoy;
        dailyViewsCache[adId] = (dailyViewsCache[adId] || 0) + 1;
        try {
            const ref = firebase.firestore().collection('anuncios_vistas').doc(docId);
            await ref.set({
                adId: adId,
                fecha: hoy,
                count: firebase.firestore.FieldValue.increment(1),
                actualizado: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        } catch (e) {
            console.warn('[ADS] Error incrementando vista:', e);
        }
    }

    function adDisponible(ad) {
        if (!ad || ad.activo === false) return false;
        if (!ad.audio && !ad.video) return false;
        if (ad.duracionDias > 0 && ad.fechaInicio) {
            const MS_POR_DIA = 24 * 60 * 60 * 1000;
            const expiraEn = ad.fechaInicio.getTime() + (ad.duracionDias * MS_POR_DIA);
            if (Date.now() >= expiraEn) return false;
        }
        const limite = ad.repeticionesPorDia || ad.vecesPorDia || 0;
        if (limite > 0) {
            const vistas = dailyViewsCache[ad.id] || 0;
            if (vistas >= limite) return false;
        }
        return true;
    }

    function seleccionarAnuncios(cantidad) {
        const disponibles = adsCache.filter(adDisponible);
        for (let i = disponibles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [disponibles[i], disponibles[j]] = [disponibles[j], disponibles[i]];
        }
        return disponibles.slice(0, cantidad);
    }

    function ensureOverlay() {
        if (overlay && overlay.isConnected) return;
        overlay = document.createElement('div');
        overlay.id = 'ad-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.innerHTML =
            '<div class="ad-inner">' +
                '<div class="ad-label">ANUNCIO</div>' +
                '<div class="ad-counter" id="ad-counter"></div>' +
                '<div class="ad-media"></div>' +
                '<button class="ad-skip" type="button" style="display:none;">' +
                    'Saltar anuncio (<span class="ad-countdown">' + SKIP_DELAY + '</span>)' +
                '</button>' +
            '</div>';
        document.body.appendChild(overlay);
        adMedia   = overlay.querySelector('.ad-media');
        adSkip    = overlay.querySelector('.ad-skip');
        adCounter = overlay.querySelector('#ad-counter');
    }

    function cleanupAdMedia() {
        if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
        if (adTimeout) { clearTimeout(adTimeout); adTimeout = null; }
        if (currentAdMedia) {
            try {
                currentAdMedia.pause();
                currentAdMedia.removeAttribute('src');
                currentAdMedia.load();
            } catch (_) {}
            currentAdMedia = null;
        }
        if (adMedia) adMedia.innerHTML = '';
    }

    function finalizarAnuncio() {
        if (!adPlaying) return;
        adPlaying = false;
        cleanupAdMedia();
        if (overlay) {
            overlay.classList.remove('visible');
            overlay.setAttribute('aria-hidden', 'true');
        }
        const cb = adOnComplete;
        adOnComplete = null;
        if (cb) { try { cb(); } catch (e) { console.warn(e); } }
    }

    function mostrarAnuncio(ad, indexInCycle, totalInCycle, onEnd) {
        ensureOverlay();
        adPlaying = true;
        adOnComplete = onEnd;
        const allowSkip = (indexInCycle === totalInCycle - 1);
        if (adCounter) adCounter.textContent = (indexInCycle + 1) + ' / ' + totalInCycle;
        adMedia.innerHTML = '';
        if (currentAdMedia) {
            try {
                currentAdMedia.pause();
                currentAdMedia.removeAttribute('src');
                currentAdMedia.load();
            } catch (_) {}
            currentAdMedia = null;
        }
        let mediaEl = null;
        if (ad.video) {
            mediaEl = document.createElement('video');
            mediaEl.src = ad.video;
            mediaEl.playsInline = true;
            mediaEl.setAttribute('playsinline', '');
            mediaEl.setAttribute('webkit-playsinline', '');
            mediaEl.preload = 'auto';
            mediaEl.controls = false;
            adMedia.appendChild(mediaEl);
        } else {
            if (ad.imagen) {
                const img = document.createElement('img');
                img.src = ad.imagen;
                img.alt = ad.titulo || 'Anuncio';
                img.className = 'ad-cover';
                adMedia.appendChild(img);
            }
            if (ad.audio) {
                mediaEl = document.createElement('audio');
                mediaEl.src = ad.audio;
                mediaEl.preload = 'auto';
                adMedia.appendChild(mediaEl);
            }
        }
        currentAdMedia = mediaEl;
        overlay.classList.add('visible');
        overlay.setAttribute('aria-hidden', 'false');
        if (allowSkip) {
            adSkip.style.display = '';
            adSkip.disabled = true;
            adSkip.innerHTML = 'Saltar anuncio (<span class="ad-countdown">' + SKIP_DELAY + '</span>)';
            let remaining = SKIP_DELAY;
            if (countdownInterval) clearInterval(countdownInterval);
            countdownInterval = setInterval(() => {
                remaining--;
                const el = adSkip.querySelector('.ad-countdown');
                if (el) el.textContent = Math.max(0, remaining);
                if (remaining <= 0) {
                    clearInterval(countdownInterval);
                    countdownInterval = null;
                    adSkip.disabled = false;
                    adSkip.textContent = 'Saltar anuncio ✕';
                }
            }, 1000);
        } else {
            adSkip.style.display = 'none';
            adSkip.disabled = true;
        }
        incrementarVista(ad.id);
        if (mediaEl) {
            mediaEl.addEventListener('ended', finalizarAnuncio, { once: true });
            mediaEl.addEventListener('error', () => {
                adTimeout = setTimeout(finalizarAnuncio, 900);
            }, { once: true });
            const p = mediaEl.play();
            if (p && p.catch) {
                p.catch(() => {
                    mediaEl.muted = true;
                    const p2 = mediaEl.play();
                    if (p2 && p2.catch) {
                        p2.catch(() => { adTimeout = setTimeout(finalizarAnuncio, 4000); });
                    }
                });
            }
        } else {
            adTimeout = setTimeout(finalizarAnuncio, 4000);
        }
    }

    async function mostrarCicloAnuncios(onComplete) {
        if (isAdPlaying) return;
        isAdPlaying = true;
        try { audioPlayer.pause(); } catch (_) {}
        await cargarAnuncios();
        await cargarVistasDelDia();
        const seleccion = seleccionarAnuncios(ADS_PER_CYCLE);
        if (!seleccion.length) {
            console.log('[ADS] No hay anuncios disponibles');
            isAdPlaying = false;
            if (onComplete) onComplete();
            return;
        }
        let idx = 0;
        function siguiente() {
            if (idx >= seleccion.length) {
                isAdPlaying = false;
                if (overlay) {
                    overlay.classList.remove('visible');
                    overlay.setAttribute('aria-hidden', 'true');
                }
                if (onComplete) onComplete();
                return;
            }
            const ad = seleccion[idx];
            const indexInCycle = idx;
            idx++;
            mostrarAnuncio(ad, indexInCycle, seleccion.length, siguiente);
        }
        siguiente();
    }

    function bindSkip() {
        if (!adSkip) return;
        adSkip.addEventListener('click', function () {
            if (adSkip.disabled) return;
            if (navigator.vibrate) { try { navigator.vibrate(12); } catch (_) {} }
            finalizarAnuncio();
        });
    }

    function init() {
        audioPlayer = document.getElementById('audio-player');
        if (!audioPlayer) { setTimeout(init, 200); return; }
        if (audioPlayer.dataset.adManagerReady === '1') return;
        audioPlayer.dataset.adManagerReady = '1';

        originalPlay = audioPlayer.play.bind(audioPlayer);

        audioPlayer.play = function () {
            if (isAdPlaying) return Promise.resolve();
            const src = audioPlayer.src;
            const isNewBeat = src && src !== lastSrc;
            if (isNewBeat) {
                lastSrc = src;
                if (beatPlayCount >= BEATS_PER_AD) {
                    beatPlayCount = 0;
                    mostrarCicloAnuncios(function () {
                        originalPlay().catch(function () {});
                    });
                    return Promise.resolve();
                }
                beatPlayCount++;
            }
            return originalPlay();
        };

        ensureOverlay();
        bindSkip();
        cargarAnuncios().catch(function () {});

        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible') {
                cargarAnuncios(true).catch(function () {});
                cargarVistasDelDia().catch(function () {});
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

/* ============================================================
   5. PERFIL DEL ARTISTA
   ============================================================ */
(function () {
    'use strict';
    function initArtistProfile() {
        const profileEl = document.getElementById('artist-profile');
        const apScroll = document.getElementById('ap-scroll');
        const apHeroImg = document.getElementById('ap-hero-img');
        const apArtist = document.getElementById('ap-artist-name');
        const apTotal = document.getElementById('ap-total-plays');
        const apGrid = document.getElementById('ap-grid');
        const apClose = document.getElementById('ap-close');
        const apListen = document.getElementById('ap-listen-btn');
        const playlist = document.getElementById('playlist');
        if (!profileEl || !apGrid || !playlist || typeof normalizeStr !== 'function') return;

        let currentArtist = null;
        let refreshTimer = null;
        let gridObserver = null;
        const COLLAB_SPLIT = /\s+(?:ft\.?|feat\.?|featuring|con|&)\s+/i;

        function getArtistsFromItem(item) {
            const sub = item.querySelector('.item-subtitle')?.textContent || '';
            const idx = sub.indexOf('·');
            const namePart = (idx === -1 ? sub : sub.slice(0, idx)).trim();
            if (!namePart) return [];
            const parts = namePart.split(COLLAB_SPLIT).map(s => s.trim()).filter(Boolean);
            return parts.length ? parts : [namePart];
        }
        function getArtistItems(artistName) {
            const target = normalizeStr(artistName);
            if (!target) return [];
            return Array.from(playlist.querySelectorAll('.playlist-item')).filter(item =>
                getArtistsFromItem(item).some(n => normalizeStr(n) === target)
            );
        }
        function computeTotalPlays(items) {
            let total = 0;
            items.forEach(item => {
                const title = item.querySelector('.item-title')?.textContent.trim() || '';
                total += contarOyentes(title);
            });
            return total;
        }
        function formatNumber(n) {
            try { return (n || 0).toLocaleString('es-MX'); } catch (_) { return String(n || 0); }
        }
        function updatePlayingCard() {
            const active = playlist.querySelector('.playlist-item.active');
            const activeTitle = active ? (active.querySelector('.item-title')?.textContent.trim() || '') : '';
            apGrid.querySelectorAll('.ap-card').forEach(card => {
                if (activeTitle && card.dataset.title === activeTitle) card.classList.add('playing');
                else card.classList.remove('playing');
            });
        }
        function activateArtistMode(artistName) {
            const list = getArtistItems(artistName);
            if (!list.length) return null;
            if (typeof setArtistFilter === 'function') setArtistFilter(list, artistName);
            else { window.__artistFilter = list.slice(); window.__artistFilterName = artistName; }
            return list;
        }
        function renderProfile(artistName) {
            currentArtist = artistName;
            const items = getArtistItems(artistName);
            if (!items.length) return;
            apArtist.textContent = artistName;
            const covers = items.map(i => i.querySelector('.thumbnail img')?.src).filter(Boolean);
            if (covers.length) {
                const chosen = covers[Math.floor(Math.random() * covers.length)];
                apHeroImg.classList.remove('loaded');
                apHeroImg.src = chosen;
                if (apHeroImg.complete) apHeroImg.classList.add('loaded');
                else apHeroImg.onload = () => apHeroImg.classList.add('loaded');
            } else {
                apHeroImg.removeAttribute('src');
                apHeroImg.classList.remove('loaded');
            }
            apTotal.textContent = formatNumber(computeTotalPlays(items));
            apGrid.innerHTML = '';
            items.forEach(item => {
                const cover = item.querySelector('.thumbnail img')?.src || '';
                const title = item.querySelector('.item-title')?.textContent.trim() || '';
                const card = document.createElement('button');
                card.type = 'button';
                card.className = 'ap-card';
                card.dataset.title = title;
                card.setAttribute('aria-label', title);
                if (cover) {
                    const img = document.createElement('img');
                    img.src = cover; img.alt = title; img.loading = 'lazy';
                    card.appendChild(img);
                }
                const t = document.createElement('span');
                t.className = 'ap-card-title';
                t.textContent = title;
                card.appendChild(t);
                card.addEventListener('click', () => {
                    activateArtistMode(artistName);
                    item.click();
                    setTimeout(updatePlayingCard, 60);
                });
                apGrid.appendChild(card);
            });
            apListen.onclick = () => {
                const list = activateArtistMode(artistName);
                if (!list || !list.length) return;
                list[Math.floor(Math.random() * list.length)].click();
                setTimeout(updatePlayingCard, 60);
            };
            if (refreshTimer) clearInterval(refreshTimer);
            refreshTimer = setInterval(() => {
                if (!profileEl.classList.contains('visible') || !currentArtist) return;
                const cur = getArtistItems(currentArtist);
                apTotal.textContent = formatNumber(computeTotalPlays(cur));
            }, 1500);
            if (gridObserver) gridObserver.disconnect();
            gridObserver = new MutationObserver(() => updatePlayingCard());
            gridObserver.observe(playlist, { subtree: true, attributes: true, attributeFilter: ['class'] });
            if (apScroll) apScroll.scrollTop = 0;
            updatePlayingCard();
        }
        function openProfile(artistName) {
            renderProfile(artistName);
            profileEl.classList.add('visible');
            profileEl.setAttribute('aria-hidden', 'false');
        }
        function closeProfile() {
            profileEl.classList.remove('visible');
            profileEl.setAttribute('aria-hidden', 'true');
            currentArtist = null;
            if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
            if (gridObserver) { gridObserver.disconnect(); gridObserver = null; }
        }
        if (apClose) apClose.addEventListener('click', closeProfile);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && profileEl.classList.contains('visible')) closeProfile();
        });
        window.__openArtistProfile = openProfile;
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initArtistProfile);
    else initArtistProfile();
})();

/* ============================================================
   6. REPETIR + ALEATORIO
   ============================================================ */
(function () {
    'use strict';
    const REPEAT_KEY = 'omega_repeat_mode_v1';
    const SHUFFLE_KEY = 'omega_shuffle_v1';
    let repeatMode = 'off';
    let shuffleOn = true;
    try {
        const r = localStorage.getItem(REPEAT_KEY);
        if (r === 'off' || r === 'all' || r === 'one') repeatMode = r;
        const s = localStorage.getItem(SHUFFLE_KEY);
        if (s === '0') shuffleOn = false;
        else if (s === '1') shuffleOn = true;
    } catch (_) {}
    window.__omegaShuffleOn = shuffleOn;

    function persist() {
        try {
            localStorage.setItem(REPEAT_KEY, repeatMode);
            localStorage.setItem(SHUFFLE_KEY, shuffleOn ? '1' : '0');
        } catch (_) {}
    }
    const ICON_REPEAT = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <polyline points="17 1 21 5 17 9"/>
            <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
            <polyline points="7 23 3 19 7 15"/>
            <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
            <text class="fs-repeat-one-mark" x="12" y="15.3" text-anchor="middle">1</text>
        </svg>`;
    const ICON_SHUFFLE = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <polyline points="16 3 21 3 21 8"/>
            <line x1="4" y1="20" x2="21" y2="3"/>
            <polyline points="21 16 21 21 16 21"/>
            <line x1="15" y1="15" x2="21" y2="21"/>
            <line x1="4" y1="4" x2="9" y2="9"/>
        </svg>`;
    let repeatBtn = null, shuffleBtn = null;

    function haptic() { if (navigator.vibrate) { try { navigator.vibrate(12); } catch (_) {} } }
    function toast(msg) {
        let el = document.getElementById('omega-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'omega-toast';
            el.setAttribute('role', 'status');
            el.setAttribute('aria-live', 'polite');
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.classList.remove('visible');
        void el.offsetWidth;
        el.classList.add('visible');
        clearTimeout(el._omegaModeTimer);
        el._omegaModeTimer = setTimeout(() => el.classList.remove('visible'), 1600);
    }
    function updateRepeatUI() {
        if (!repeatBtn) return;
        repeatBtn.classList.toggle('active', repeatMode !== 'off');
        repeatBtn.classList.toggle('mode-one', repeatMode === 'one');
        const aria = repeatMode === 'one' ? 'Repetir 1 canción' : repeatMode === 'all' ? 'Repetir todo' : 'Repetir desactivado';
        repeatBtn.setAttribute('aria-label', aria);
        repeatBtn.setAttribute('title', aria);
    }
    function updateShuffleUI() {
        if (!shuffleBtn) return;
        shuffleBtn.classList.toggle('active', shuffleOn);
        const aria = shuffleOn ? 'Aleatorio activado' : 'Aleatorio desactivado';
        shuffleBtn.setAttribute('aria-label', aria);
        shuffleBtn.setAttribute('title', aria);
        window.__omegaShuffleOn = shuffleOn;
    }
    function applyRepeatToAudio() {
        const audio = document.getElementById('audio-player');
        if (!audio) return;
        try { audio.loop = false; } catch (_) {}
    }
    function onEndedCapture(e) {
        const audio = document.getElementById('audio-player');
        if (!audio || e.target !== audio) return;
        try {
            const activeItem = document.querySelector('.playlist-item.active');
            if (activeItem) {
                const titulo = activeItem.querySelector('.item-title')?.textContent.trim() || '';
                const user = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth().currentUser : null;
                if (titulo && user && typeof esNuevoOyente === 'function' && typeof registrarOyente === 'function' && esNuevoOyente(titulo, user.uid)) registrarOyente(titulo);
                if (titulo && user && typeof window.__guardarEnPlaylist === 'function') window.__guardarEnPlaylist(titulo);
            }
        } catch (err) { console.warn('Error registrando oyente:', err); }
        if (repeatMode === 'one') {
            e.stopImmediatePropagation();
            e.stopPropagation();
            try { audio.currentTime = 0; } catch (_) {}
            const p = audio.play();
            if (p && p.catch) p.catch(() => {});
            return;
        }
        if (repeatMode === 'all') {
            e.stopImmediatePropagation();
            e.stopPropagation();
            document.dispatchEvent(new CustomEvent('omega:next'));
            return;
        }
    }
    let started = false;
    function init() {
        const fsActions = document.querySelector('.fs-actions');
        if (!fsActions) return false;
        if (!document.getElementById('fs-repeat')) {
            repeatBtn = document.createElement('button');
            repeatBtn.type = 'button';
            repeatBtn.id = 'fs-repeat';
            repeatBtn.className = 'fs-mode-btn';
            repeatBtn.innerHTML = ICON_REPEAT + '<span class="fs-mode-label">Repetir</span>';
            shuffleBtn = document.createElement('button');
            shuffleBtn.type = 'button';
            shuffleBtn.id = 'fs-shuffle';
            shuffleBtn.className = 'fs-mode-btn';
            shuffleBtn.innerHTML = ICON_SHUFFLE + '<span class="fs-mode-label">Aleatorio</span>';
            fsActions.insertBefore(shuffleBtn, fsActions.firstChild);
            fsActions.insertBefore(repeatBtn, fsActions.firstChild);
        } else {
            repeatBtn = document.getElementById('fs-repeat');
            shuffleBtn = document.getElementById('fs-shuffle');
        }
        repeatBtn.addEventListener('click', () => {
            haptic();
            repeatMode = repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off';
            persist(); applyRepeatToAudio(); updateRepeatUI();
            toast(repeatMode === 'off' ? 'Repetir: desactivado' : repeatMode === 'all' ? 'Repetir: toda la lista' : 'Repetir: 1 canción');
        });
        shuffleBtn.addEventListener('click', () => {
            haptic();
            shuffleOn = !shuffleOn;
            persist(); updateShuffleUI();
            toast(shuffleOn ? 'Aleatorio: activado' : 'Aleatorio: desactivado');
        });
        updateRepeatUI(); updateShuffleUI(); applyRepeatToAudio();
        document.addEventListener('ended', onEndedCapture, true);
        return true;
    }
    function bootWithRetry(attempt) {
        if (started) return;
        if (init()) { started = true; return; }
        if ((attempt || 0) < 20) setTimeout(() => bootWithRetry((attempt || 0) + 1), 150);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => bootWithRetry(0));
    else bootWithRetry(0);
})();

/* ============================================================
   7. ORGANIZACIÓN POR ÁLBUMES
   ============================================================ */
(function () {
    'use strict';
    let observer = null;
    let reorganizing = false;
    let bootRetries = 0;
    function getItemTitle(item) { return item ? (item.querySelector('.item-title')?.textContent.trim() || '') : ''; }
    function getAlbumFromItem(item) {
        if (!item) return '';
        const el = item.querySelector('.Album');
        return el ? el.textContent.trim() : '';
    }
    function reorganizeGrid() {
        if (reorganizing) return;
        const apGrid = document.getElementById('ap-grid');
        const playlist = document.getElementById('playlist');
        if (!apGrid || !playlist) return;
        const directCards = Array.from(apGrid.children).filter(el => el.classList && el.classList.contains('ap-card'));
        if (!directCards.length) return;
        const itemByTitle = new Map();
        playlist.querySelectorAll('.playlist-item').forEach(it => {
            const t = getItemTitle(it);
            if (t) itemByTitle.set(t, it);
        });
        const albums = new Map();
        const standalones = [];
        directCards.forEach(card => {
            const title = card.dataset.title || '';
            const item = itemByTitle.get(title);
            const albumName = getAlbumFromItem(item);
            if (albumName) {
                if (!albums.has(albumName)) {
                    const cover = item.querySelector('.thumbnail img')?.src || '';
                    albums.set(albumName, { cover, cards: [] });
                }
                albums.get(albumName).cards.push(card);
            } else standalones.push(card);
        });
        if (!albums.size) return;
        reorganizing = true;
        if (observer) observer.disconnect();
        try {
            directCards.forEach(c => c.remove());
            albums.forEach((albumData, albumName) => {
                const albumEl = document.createElement('div');
                albumEl.className = 'ap-album';
                const header = document.createElement('button');
                header.type = 'button';
                header.className = 'ap-album-header';
                header.setAttribute('aria-expanded', 'false');
                header.setAttribute('aria-label', 'Álbum ' + albumName);
                if (albumData.cover) {
                    const img = document.createElement('img');
                    img.src = albumData.cover; img.alt = albumName; img.loading = 'lazy';
                    header.appendChild(img);
                }
                const info = document.createElement('div');
                info.className = 'ap-album-info';
                const label = document.createElement('span');
                label.className = 'ap-album-label';
                label.textContent = 'ÁLBUM';
                info.appendChild(label);
                const titleEl = document.createElement('span');
                titleEl.className = 'ap-album-title';
                titleEl.textContent = albumName;
                info.appendChild(titleEl);
                const countEl = document.createElement('span');
                countEl.className = 'ap-album-count';
                countEl.textContent = albumData.cards.length + ' ' + (albumData.cards.length === 1 ? 'canción' : 'canciones');
                info.appendChild(countEl);
                header.appendChild(info);
                const arrow = document.createElement('span');
                arrow.className = 'ap-album-arrow';
                arrow.textContent = '▶';
                header.appendChild(arrow);
                header.addEventListener('click', () => {
                    const isExpanded = albumEl.classList.toggle('expanded');
                    header.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
                });
                albumEl.appendChild(header);
                const tracks = document.createElement('div');
                tracks.className = 'ap-album-tracks';
                albumData.cards.forEach(c => tracks.appendChild(c));
                albumEl.appendChild(tracks);
                apGrid.appendChild(albumEl);
            });
            if (standalones.length > 0) {
                const th = document.createElement('div');
                th.className = 'ap-temas-header';
                th.textContent = 'TEMAS';
                apGrid.appendChild(th);
                const tg = document.createElement('div');
                tg.className = 'ap-temas-grid';
                standalones.forEach(c => tg.appendChild(c));
                apGrid.appendChild(tg);
            }
        } finally {
            reorganizing = false;
            if (observer) observer.observe(apGrid, { childList: true });
        }
    }
    function init() {
        const apGrid = document.getElementById('ap-grid');
        if (!apGrid) { if (bootRetries++ < 40) setTimeout(init, 150); return; }
        observer = new MutationObserver(() => {
            if (reorganizing) return;
            const hasDirectCards = Array.from(apGrid.children).some(el => el.classList && el.classList.contains('ap-card'));
            if (hasDirectCards) reorganizeGrid();
        });
        observer.observe(apGrid, { childList: true });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

/* ============================================================
   8. PORTADA / CATEGORÍAS HOME
   ============================================================ */
(function () {
    'use strict';
    const CAROUSEL_LIMIT = 12;
    const COLLAB_SPLIT = /\s+(?:ft\.?|feat\.?|featuring|con|&)\s+/i;

    function norm(str) {
        if (typeof normalizeStr === 'function') return normalizeStr(str);
        return String(str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
    }
    function getItemTitle(item) { return item.querySelector('.item-title')?.textContent.trim() || ''; }
    function getItemCover(item) {
        const img = item.querySelector('.thumbnail img');
        return img ? (img.getAttribute('src') || '') : '';
    }
    function getItemArtists(item) {
        const sub = item.querySelector('.item-subtitle')?.textContent || '';
        const idx = sub.indexOf('·');
        const namePart = (idx === -1 ? sub : sub.slice(0, idx)).trim();
        if (!namePart) return [];
        const parts = namePart.split(COLLAB_SPLIT).map(s => s.trim()).filter(Boolean);
        return parts.length ? parts : [namePart];
    }
    function getItemAlbum(item) {
        const el = item.querySelector('.Album');
        return el ? el.textContent.trim() : '';
    }
    function getPlays(item) {
        if (typeof contarOyentes === 'function') return contarOyentes(getItemTitle(item));
        return 0;
    }
    function shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
    function getAllItems() {
        const pl = document.getElementById('playlist');
        if (!pl) return [];
        return Array.from(pl.querySelectorAll('.playlist-item'));
    }
    function findItemByTitle(title) {
        const n = norm(title);
        if (!n) return null;
        return getAllItems().find(it => norm(getItemTitle(it)) === n) || null;
    }
    function clearNode(el) { while (el.firstChild) el.removeChild(el.firstChild); }

    function makeSongCard(item) {
        const title = getItemTitle(item);
        const cover = getItemCover(item);
        const sub = item.querySelector('.item-subtitle')?.textContent.trim() || '';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'home-card';
        btn.setAttribute('aria-label', title);
        const thumb = document.createElement('div');
        thumb.className = 'home-card-thumb';
        if (cover) {
            const img = document.createElement('img');
            img.src = cover; img.alt = title; img.loading = 'lazy';
            thumb.appendChild(img);
        }
        btn.appendChild(thumb);
        const t = document.createElement('span');
        t.className = 'home-card-title';
        t.textContent = title;
        btn.appendChild(t);
        if (sub) {
            const s = document.createElement('span');
            s.className = 'home-card-sub';
            s.textContent = sub;
            btn.appendChild(s);
        }
        btn.addEventListener('click', () => item.click());
        return btn;
    }

    function buildArtists() {
        const sec = document.getElementById('sec-artists');
        const carousel = document.getElementById('carousel-artists');
        if (!sec || !carousel) return;
        clearNode(carousel);
        const map = new Map();
        getAllItems().forEach(item => {
            getItemArtists(item).forEach(name => {
                const n = norm(name);
                if (!n || map.has(n)) return;
                map.set(n, { name, cover: getItemCover(item) });
            });
        });
        if (!map.size) { sec.style.display = 'none'; return; }
        sec.style.display = '';
        shuffle(Array.from(map.values())).forEach(({ name, cover }) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'home-card home-card--artist';
            btn.setAttribute('aria-label', name);
            const thumb = document.createElement('div');
            thumb.className = 'home-card-thumb';
            if (cover) {
                const img = document.createElement('img');
                img.src = cover; img.alt = name; img.loading = 'lazy';
                thumb.appendChild(img);
            }
            btn.appendChild(thumb);
            const t = document.createElement('span');
            t.className = 'home-card-title';
            t.textContent = name;
            btn.appendChild(t);
            btn.addEventListener('click', () => {
                if (typeof window.__openArtistProfile === 'function') window.__openArtistProfile(name);
            });
            carousel.appendChild(btn);
        });
    }

    function buildListenAgain() {
        const sec = document.getElementById('sec-listen-again');
        const carousel = document.getElementById('carousel-listen-again');
        if (!sec || !carousel) return;
        clearNode(carousel);
        const playlists = (typeof window.__getPlaylistsCache === 'function') ? window.__getPlaylistsCache() : [];
        if (!playlists.length) { sec.style.display = 'none'; return; }
        sec.style.display = '';
        playlists.slice().reverse().forEach(pl => carousel.appendChild(makePlaylistCard(pl)));
    }

    function makePlaylistCard(playlist) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'home-card home-card--playlist';
        btn.setAttribute('aria-label', playlist.nombre);
        const thumb = document.createElement('div');
        thumb.className = 'home-card-thumb playlist-collage';
        const covers = playlist.canciones.slice(0, 4).map(c => {
            const it = findItemByTitle(c.titulo);
            return it ? getItemCover(it) : '';
        });
        while (covers.length < 4) covers.push('');
        covers.forEach(cover => {
            const cell = document.createElement('div');
            cell.className = 'playlist-collage-cell';
            if (cover) {
                const img = document.createElement('img');
                img.src = cover; img.alt = ''; img.loading = 'lazy';
                cell.appendChild(img);
            }
            thumb.appendChild(cell);
        });
        btn.appendChild(thumb);

        const t = document.createElement('span');
        t.className = 'home-card-title';
        t.textContent = playlist.nombre;
        btn.appendChild(t);

        const s = document.createElement('span');
        s.className = 'home-card-sub';
        const n = playlist.canciones.length;
        s.textContent = n + ' ' + (n === 1 ? 'canción' : 'canciones');
        btn.appendChild(s);

        btn.addEventListener('click', () => {
            if (typeof window.__openPlaylistView === 'function') window.__openPlaylistView(playlist);
        });
        return btn;
    }

    function buildMaybe() {
        const sec = document.getElementById('sec-maybe');
        const carousel = document.getElementById('carousel-maybe');
        if (!sec || !carousel) return;
        clearNode(carousel);
        const scored = getAllItems().map(it => ({ it, plays: getPlays(it) }));
        if (!scored.length) { sec.style.display = 'none'; return; }
        scored.sort((a, b) => a.plays - b.plays);
        const take = Math.max(6, Math.ceil(scored.length / 2));
        const pool = scored.slice(0, take).map(x => x.it);
        const picked = shuffle(pool).slice(0, CAROUSEL_LIMIT);
        if (!picked.length) { sec.style.display = 'none'; return; }
        sec.style.display = '';
        picked.forEach(it => carousel.appendChild(makeSongCard(it)));
    }

    function buildTop() {
        const sec = document.getElementById('sec-top');
        const carousel = document.getElementById('carousel-top');
        if (!sec || !carousel) return;
        clearNode(carousel);
        const pool = getAllItems().filter(it => getPlays(it) > 5);
        const picked = shuffle(pool).slice(0, CAROUSEL_LIMIT);
        if (!picked.length) { sec.style.display = 'none'; return; }
        sec.style.display = '';
        picked.forEach(it => carousel.appendChild(makeSongCard(it)));
    }

    function buildAlbums() {
        const sec = document.getElementById('sec-albums');
        const carousel = document.getElementById('carousel-albums');
        if (!sec || !carousel) return;
        clearNode(carousel);
        const map = new Map();
        getAllItems().forEach(item => {
            const album = getItemAlbum(item);
            if (!album) return;
            const artist = getItemArtists(item)[0] || '';
            const key = norm(album) + '::' + norm(artist);
            if (map.has(key)) return;
            map.set(key, { name: album, cover: getItemCover(item), artist });
        });
        if (!map.size) { sec.style.display = 'none'; return; }
        sec.style.display = '';
        shuffle(Array.from(map.values())).slice(0, CAROUSEL_LIMIT).forEach(alb => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'home-card';
            btn.setAttribute('aria-label', alb.name);
            const thumb = document.createElement('div');
            thumb.className = 'home-card-thumb';
            if (alb.cover) {
                const img = document.createElement('img');
                img.src = alb.cover; img.alt = alb.name; img.loading = 'lazy';
                thumb.appendChild(img);
            }
            btn.appendChild(thumb);
            const t = document.createElement('span');
            t.className = 'home-card-title';
            t.textContent = alb.name;
            btn.appendChild(t);
            if (alb.artist) {
                const s = document.createElement('span');
                s.className = 'home-card-sub';
                s.textContent = alb.artist;
                btn.appendChild(s);
            }
            btn.addEventListener('click', () => {
                if (alb.artist && typeof window.__openArtistProfile === 'function') window.__openArtistProfile(alb.artist);
            });
            carousel.appendChild(btn);
        });
    }

    function buildAll() { buildArtists(); buildListenAgain(); buildMaybe(); buildTop(); buildAlbums(); }

    function initHistoryTracking() {
        const audio = document.getElementById('audio-player');
        const pl = document.getElementById('playlist');
        if (!audio || !pl) return;
        audio.addEventListener('play', () => {
            const active = pl.querySelector('.playlist-item.active');
            if (!active) return;
            const titulo = getItemTitle(active);
            if (titulo && typeof window.__guardarEnHistorial === 'function') window.__guardarEnHistorial(titulo);
        });
        audio.addEventListener('ended', () => {
            setTimeout(() => { buildListenAgain(); buildMaybe(); buildTop(); }, 400);
        });
    }

    function boot() {
        let tries = 0;
        (function loop() {
            tries++;
            const hasItems = getAllItems().length > 0;
            if (hasItems || tries >= 20) { buildAll(); initHistoryTracking(); return; }
            if (tries >= 40) return;
            setTimeout(loop, 200);
        })();
    }
    window.__buildListenAgain = buildListenAgain;
    window.__buildArtists = buildArtists;
    window.__buildAlbums = buildAlbums;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();

/* ============================================================
   11. BOTÓN "MOSTRAR TODAS LAS CANCIONES"
   ============================================================ */
(function () {
    'use strict';
    function getPlaylist() { return document.getElementById('playlist'); }
    function getSearchInput() { return document.getElementById('search-input'); }
    function apply() {
        if (typeof window.__applySearchVisibility === 'function') { window.__applySearchVisibility(); return; }
        const pl = getPlaylist();
        if (!pl) return;
        pl.querySelectorAll('.playlist-item').forEach(it => {
            it.style.display = window.__showAllSongs ? 'flex' : 'none';
        });
    }
    function init() {
        const btn = document.getElementById('show-all-btn');
        const si = getSearchInput();
        window.__showAllSongs = false;
        apply();
        if (btn) {
            btn.addEventListener('click', () => {
                if (navigator.vibrate) { try { navigator.vibrate(12); } catch (_) {} }
                window.__showAllSongs = true;
                apply();
                btn.setAttribute('hidden', '');
            });
        }
        if (si) si.addEventListener('input', (e) => {
            const q = (e.target.value || '').trim();
            if (!q && !window.__showAllSongs) apply();
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

/* ============================================================
   12. PUENTE ANDROID
   ============================================================ */
(function () {
    'use strict';
    function safeBridge(method) {
        try {
            var args = Array.prototype.slice.call(arguments, 1);
            if (window.AndroidBridge && typeof window.AndroidBridge[method] === 'function') {
                window.AndroidBridge[method].apply(window.AndroidBridge, args);
            }
        } catch (e) { console.warn('AndroidBridge error:', e); }
    }
    function notificarAndroidPlay() { safeBridge('onPlay'); }
    function notificarAndroidPause() { safeBridge('onPause'); }
    function notificarAndroidTrack() {
        var title = (document.getElementById('player-title')?.textContent || '').trim() || 'Kerim Music';
        var activeItem = document.querySelector('.playlist-item.active');
        var artist = 'Reproduciendo';
        var cover = '';
        if (activeItem) {
            var sub = activeItem.querySelector('.item-subtitle')?.textContent || '';
            var idx = sub.indexOf('·');
            artist = (idx === -1 ? sub : sub.slice(0, idx)).trim() || 'Reproduciendo';
            cover = activeItem.querySelector('.thumbnail img')?.src || '';
        }
        safeBridge('onTrackChangeWithCover', title, artist, cover);
    }
    window.notificarAndroidPlay = notificarAndroidPlay;
    window.notificarAndroidPause = notificarAndroidPause;
    window.notificarAndroidTrack = notificarAndroidTrack;
    function init() {
        var audioPlayer = document.getElementById('audio-player');
        if (!audioPlayer) return;
        audioPlayer.addEventListener('play', function () {
            notificarAndroidPlay();
            setTimeout(notificarAndroidTrack, 150);
        });
        audioPlayer.addEventListener('pause', notificarAndroidPause);
        audioPlayer.addEventListener('loadedmetadata', function () { setTimeout(notificarAndroidTrack, 100); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
    window.nextTrack = function () { document.dispatchEvent(new CustomEvent('omega:next')); };
    window.prevTrack = function () { document.dispatchEvent(new CustomEvent('omega:prev')); };
})();

/* ============================================================
   13. CARGAR CANCIONES SUBIDAS POR USUARIOS
   ============================================================ */
(function () {
    'use strict';
    function init() {
        if (typeof firebase === 'undefined' || !firebase.firestore) { setTimeout(init, 300); return; }
        const db = firebase.firestore();
        const playlist = document.getElementById('playlist');
        if (!playlist) return;
        db.collection('canciones_usuarios')
          .orderBy('fecha', 'desc')
          .onSnapshot((snap) => {
            playlist.querySelectorAll('.playlist-item[data-user-upload="1"]').forEach(el => el.remove());
            const frag = document.createDocumentFragment();
            snap.forEach(doc => {
                const d = doc.data();
                if (!d.audioUrl || !d.titulo) return;
                const div = document.createElement('div');
                div.className = 'playlist-item';
                div.dataset.src = d.audioUrl;
                div.dataset.userUpload = '1';
                div.dataset.title = d.titulo;
                if (d.album) div.dataset.album = d.album;
                const cover = d.imagenUrl || 'https://via.placeholder.com/60/1a1a1a/666?text=%E2%99%AA';
                const artista = d.artista || 'Artista';
                const albumHTML = d.album ? `<span class="Album">${d.album}</span>` : '';
                div.innerHTML = `
                    <div class="thumbnail">
                        <img src="${cover}" alt="Portada" loading="lazy">
                    </div>
                    <div class="item-info">
                        <span class="item-title">${d.titulo}</span>
                        <span class="item-subtitle">${artista} · Subido</span>
                        ${albumHTML}
                    </div>
                `;
                frag.appendChild(div);
            });
            const homeView = playlist.querySelector('#home-view');
            if (homeView) playlist.insertBefore(frag, homeView.nextSibling);
            else playlist.insertBefore(frag, playlist.firstChild);
            if (typeof window.__buildListenAgain === 'function') window.__buildListenAgain();
            if (typeof window.__buildArtists === 'function') { try { window.__buildArtists(); } catch (_) {} }
            if (typeof window.__buildAlbums === 'function') { try { window.__buildAlbums(); } catch (_) {} }
            if (typeof window.__applySearchVisibility === 'function') window.__applySearchVisibility();
          }, (err) => { console.warn('⚠️ No se pudieron cargar canciones:', err); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

/* ============================================================
   14. INTEGRACIÓN CON "SUBIR MÚSICA"
   ============================================================ */
(function () {
    'use strict';
    const PLACEHOLDER_COVER = 'https://via.placeholder.com/60/1a1a1a/666?text=%E2%99%AA';
    const UPLOAD_FLAG = '1';
    let unsubscribeUploads = null;

    function localEscape(str) {
        return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }
    function getPlaylistEl() { return document.getElementById('playlist'); }
    function removeUploadedItems() {
        const pl = getPlaylistEl();
        if (!pl) return;
        pl.querySelectorAll('.playlist-item[data-uploaded="' + UPLOAD_FLAG + '"]').forEach(el => el.remove());
    }
    function buildUploadedItem(data) {
        if (!data || !data.audioUrl || !data.titulo) return null;
        const div = document.createElement('div');
        div.className = 'playlist-item';
        div.dataset.src = data.audioUrl;
        div.dataset.uploaded = UPLOAD_FLAG;
        if (data.album) div.dataset.album = data.album;
        div.dataset.title = data.titulo;
        const cover = data.imagenUrl || PLACEHOLDER_COVER;
        const artista = data.artista || 'Artista';
        const albumHTML = data.album ? '<span class="Album">' + localEscape(data.album) + '</span>' : '';
        div.innerHTML =
            '<div class="thumbnail">' +
                '<img src="' + localEscape(cover) + '" alt="Portada" loading="lazy" ' +
                     'onerror="this.onerror=null;this.src=\'' + PLACEHOLDER_COVER + '\'">' +
            '</div>' +
            '<div class="item-info">' +
                '<span class="item-title">' + localEscape(data.titulo) + '</span>' +
                '<span class="item-subtitle">' + localEscape(artista) + ' · Subido</span>' +
                albumHTML +
            '</div>';
        return div;
    }
    function renderUploaded(canciones) {
        const pl = getPlaylistEl();
        if (!pl) return;
        removeUploadedItems();
        const ordenadas = canciones.slice().sort((a, b) => {
            const fa = a.fecha && typeof a.fecha.seconds === 'number' ? a.fecha.seconds : 0;
            const fb = b.fecha && typeof b.fecha.seconds === 'number' ? b.fecha.seconds : 0;
            return fb - fa;
        });
        const frag = document.createDocumentFragment();
        ordenadas.forEach(c => {
            const el = buildUploadedItem(c);
            if (el) frag.appendChild(el);
        });
        const homeView = pl.querySelector('#home-view');
        if (homeView) pl.insertBefore(frag, homeView.nextSibling);
        else pl.insertBefore(frag, pl.firstChild);
        if (typeof window.__buildListenAgain === 'function') { try { window.__buildListenAgain(); } catch (_) {} }
        if (typeof window.__buildArtists === 'function') { try { window.__buildArtists(); } catch (_) {} }
        if (typeof window.__buildAlbums === 'function') { try { window.__buildAlbums(); } catch (_) {} }
        if (typeof window.__applySearchVisibility === 'function') { try { window.__applySearchVisibility(); } catch (_) {} }
    }
    function listenUploads(uid) {
        if (unsubscribeUploads) { unsubscribeUploads(); unsubscribeUploads = null; }
        removeUploadedItems();
        const db = firebase.firestore();
        const ref = db.collectionGroup('canciones');
        unsubscribeUploads = ref.onSnapshot((snap) => {
            const lista = [];
            snap.forEach(docSnap => {
                const d = docSnap.data() || {};
                if (!d.audioUrl || !d.titulo) return;
                if (d.origen && d.origen !== 'dropbox') return;
                lista.push({
                    id: docSnap.id, titulo: d.titulo, artista: d.artista || '',
                    audioUrl: d.audioUrl, imagenUrl: d.imagenUrl || '',
                    album: d.album || '', fecha: d.fecha || null, uid: d.uid || ''
                });
            });
            renderUploaded(lista);
        }, (err) => { console.warn('⚠️ No se pudieron leer canciones subidas:', err); });
    }
    function stopListening() {
        if (unsubscribeUploads) { unsubscribeUploads(); unsubscribeUploads = null; }
        removeUploadedItems();
    }
    function init() {
        if (typeof firebase === 'undefined' || !firebase.firestore || !firebase.auth) { setTimeout(init, 300); return; }
        const auth = firebase.auth();
        auth.onAuthStateChanged((user) => {
            if (user) listenUploads(user.uid);
            else stopListening();
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

/* ============================================================
   15. OYENTES AUTOMÁTICOS
   ============================================================ */
(function () {
    'use strict';
    function getTitle(item) { return item.querySelector('.item-title')?.textContent.trim() || ''; }
    async function initItemListeners(item) {
        if (!item || item.dataset.oyentesReady === '1') return;
        const titulo = getTitle(item);
        if (!titulo) return;
        item.dataset.oyentesReady = '1';
        try {
            await cargarOyentesCancion(titulo);
            pintarReproducciones(item, contarOyentes(titulo));
        } catch (e) { item.dataset.oyentesReady = '0'; }
    }
    function processItem(item) {
        if (!item || item.nodeType !== 1) return;
        if (!item.classList || !item.classList.contains('playlist-item')) return;
        const titulo = getTitle(item);
        if (!titulo) { setTimeout(() => processItem(item), 120); return; }
        initItemListeners(item);
    }
    function init() {
        const playlist = document.getElementById('playlist');
        if (!playlist) { setTimeout(init, 300); return; }
        playlist.querySelectorAll('.playlist-item').forEach(processItem);
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(m => {
                m.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) return;
                    if (node.classList && node.classList.contains('playlist-item')) processItem(node);
                    else if (node.querySelectorAll) node.querySelectorAll('.playlist-item').forEach(processItem);
                });
            });
        });
        observer.observe(playlist, { childList: true, subtree: true });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

/* ============================================================
   16. CERRAR SESIÓN
   ============================================================ */
(function () {
    'use strict';
    function init() {
        const logoutLink = document.getElementById('logout-link');
        if (!logoutLink) return;
        if (logoutLink.dataset.logoutReady === '1') return;
        logoutLink.dataset.logoutReady = '1';
        logoutLink.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (logoutLink.dataset.loggingOut === '1') return;
            logoutLink.dataset.loggingOut = '1';
            const originalText = logoutLink.textContent;
            logoutLink.textContent = 'Cerrando sesión…';
            logoutLink.style.pointerEvents = 'none';
            logoutLink.style.opacity = '0.6';
            try {
                if (navigator.vibrate) { try { navigator.vibrate(12); } catch (_) {} }
                if (typeof firebase === 'undefined' || !firebase.auth) throw new Error('Firebase no disponible');
                await firebase.auth().signOut();
                const submenu = document.getElementById('submenu');
                const overlay = document.getElementById('submenu-overlay');
                if (submenu) submenu.classList.remove('visible');
                if (overlay) overlay.classList.remove('visible');
                const searchInput = document.getElementById('search-input');
                const searchContainer = document.getElementById('search-container');
                if (searchInput) searchInput.value = '';
                if (searchContainer) searchContainer.classList.remove('visible');
            } catch (err) { alert('No se pudo cerrar sesión.'); }
            finally {
                logoutLink.textContent = originalText;
                logoutLink.style.pointerEvents = '';
                logoutLink.style.opacity = '';
                delete logoutLink.dataset.loggingOut;
            }
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

/* ============================================================
   17. BUSCADOR TIPO SPOTIFY
   ============================================================ */
(function () {
    'use strict';
    const COLLAB_SPLIT = /\s+(?:ft\.?|feat\.?|featuring|con|&)\s+/i;
    function norm(s) {
        return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
    }
    function getItemTitle(item) { return item.querySelector('.item-title')?.textContent.trim() || ''; }
    function getItemSubtitle(item) { return item.querySelector('.item-subtitle')?.textContent.trim() || ''; }
    function getItemArtists(item) {
        const sub = getItemSubtitle(item);
        const idx = sub.indexOf('·');
        const namePart = (idx === -1 ? sub : sub.slice(0, idx)).trim();
        if (!namePart) return [];
        const parts = namePart.split(COLLAB_SPLIT).map(s => s.trim()).filter(Boolean);
        return parts.length ? parts : [namePart];
    }
    function getItemAlbum(item) {
        const el = item.querySelector('.Album');
        return el ? el.textContent.trim() : '';
    }
    function getItemCover(item) { return item.querySelector('.thumbnail img')?.src || ''; }

    let searchResultsEl = null, searchInputEl = null, searchContainerEl = null, playlistEl = null, debounceTimer = null;

    function ensureResultsContainer() {
        if (searchResultsEl && searchResultsEl.isConnected) return searchResultsEl;
        if (!playlistEl) return null;
        searchResultsEl = document.getElementById('search-results');
        if (!searchResultsEl) {
            searchResultsEl = document.createElement('div');
            searchResultsEl.id = 'search-results';
            searchResultsEl.className = 'search-results';
            searchResultsEl.style.display = 'none';
            playlistEl.appendChild(searchResultsEl);
        }
        return searchResultsEl;
    }
    function hideAllItems() {
        if (!playlistEl) return;
        const homeView = document.getElementById('home-view');
        if (homeView) homeView.style.display = 'none';
        playlistEl.querySelectorAll('.playlist-item').forEach(it => { it.style.display = 'none'; });
    }
    function restoreNormalView() {
        if (!playlistEl) return;
        const homeView = document.getElementById('home-view');
        if (homeView) homeView.style.display = '';
        const showAll = window.__showAllSongs === true;
        playlistEl.querySelectorAll('.playlist-item').forEach(it => { it.style.display = showAll ? 'flex' : 'none'; });
    }
    function clearResults() {
        if (!searchResultsEl) return;
        searchResultsEl.innerHTML = '';
        searchResultsEl.style.display = 'none';
    }
    function buildSongRow(item) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'search-row';
        const thumb = document.createElement('div');
        thumb.className = 'search-row-thumb';
        const cover = getItemCover(item);
        if (cover) {
            const img = document.createElement('img');
            img.src = cover; img.alt = getItemTitle(item); img.loading = 'lazy';
            thumb.appendChild(img);
        }
        btn.appendChild(thumb);
        const info = document.createElement('div');
        info.className = 'search-row-info';
        const title = document.createElement('span');
        title.className = 'search-row-title';
        title.textContent = getItemTitle(item);
        info.appendChild(title);
        const sub = document.createElement('span');
        sub.className = 'search-row-sub';
        sub.textContent = getItemSubtitle(item);
        info.appendChild(sub);
        btn.appendChild(info);
        const play = document.createElement('span');
        play.className = 'search-row-play';
        play.textContent = '▶';
        btn.appendChild(play);
        btn.addEventListener('click', () => closeSearchAndPlay(item));
        return btn;
    }
    function buildArtistCard(artist) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'search-card search-card--artist';
        const thumb = document.createElement('div');
        thumb.className = 'search-card-thumb search-card-thumb--round';
        if (artist.cover) {
            const img = document.createElement('img');
            img.src = artist.cover; img.alt = artist.name; img.loading = 'lazy';
            thumb.appendChild(img);
        }
        btn.appendChild(thumb);
        const name = document.createElement('span');
        name.className = 'search-card-title';
        name.textContent = artist.name;
        btn.appendChild(name);
        const label = document.createElement('span');
        label.className = 'search-card-sub';
        label.textContent = 'Artista';
        btn.appendChild(label);
        btn.addEventListener('click', () => {
            closeSearch();
            if (typeof window.__openArtistProfile === 'function') window.__openArtistProfile(artist.name);
        });
        return btn;
    }
    function buildAlbumCard(album) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'search-card';
        const thumb = document.createElement('div');
        thumb.className = 'search-card-thumb';
        if (album.cover) {
            const img = document.createElement('img');
            img.src = album.cover; img.alt = album.name; img.loading = 'lazy';
            thumb.appendChild(img);
        }
        btn.appendChild(thumb);
        const name = document.createElement('span');
        name.className = 'search-card-title';
        name.textContent = album.name;
        btn.appendChild(name);
        if (album.artist) {
            const sub = document.createElement('span');
            sub.className = 'search-card-sub';
            sub.textContent = album.artist;
            btn.appendChild(sub);
        }
        btn.addEventListener('click', () => {
            closeSearch();
            if (album.artist && typeof window.__openArtistProfile === 'function') window.__openArtistProfile(album.artist);
            else if (album.items[0]) album.items[0].click();
        });
        return btn;
    }
    function buildSection(title) {
        const sec = document.createElement('section');
        sec.className = 'search-section';
        const h = document.createElement('h3');
        h.className = 'search-section-title';
        h.textContent = title;
        sec.appendChild(h);
        return sec;
    }
    function renderResults(query) {
        ensureResultsContainer();
        if (!searchResultsEl) return;
        const q = norm(query);
        if (!q) { clearResults(); restoreNormalView(); return; }
        const allItems = Array.from(playlistEl.querySelectorAll('.playlist-item'));
        const songs = [];
        const artistsMap = new Map();
        const albumsMap = new Map();
        allItems.forEach(item => {
            const title = getItemTitle(item);
            const albumName = getItemAlbum(item);
            const artists = getItemArtists(item);
            const cover = getItemCover(item);
            if (norm(title).includes(q)) songs.push(item);
            artists.forEach(a => {
                const nA = norm(a);
                if (!nA.includes(q)) return;
                if (!artistsMap.has(nA)) artistsMap.set(nA, { name: a, cover, items: [] });
                artistsMap.get(nA).items.push(item);
            });
            if (albumName && norm(albumName).includes(q)) {
                const primaryArtist = artists[0] || '';
                const key = norm(albumName) + '::' + norm(primaryArtist);
                if (!albumsMap.has(key)) albumsMap.set(key, { name: albumName, artist: primaryArtist, cover, items: [] });
                albumsMap.get(key).items.push(item);
            }
        });
        searchResultsEl.innerHTML = '';
        hideAllItems();
        const hasResults = songs.length || artistsMap.size || albumsMap.size;
        if (!hasResults) {
            const empty = document.createElement('div');
            empty.className = 'search-empty';
            empty.innerHTML = '<div class="search-empty-title">Sin resultados</div>' +
                              '<div class="search-empty-sub">No se encontró nada para "' + query + '"</div>';
            searchResultsEl.appendChild(empty);
            searchResultsEl.style.display = 'block';
            return;
        }
        if (songs.length) {
            const sec = buildSection('Canciones');
            songs.slice(0, 12).forEach(item => sec.appendChild(buildSongRow(item)));
            searchResultsEl.appendChild(sec);
        }
        if (artistsMap.size) {
            const sec = buildSection('Artistas');
            const grid = document.createElement('div');
            grid.className = 'search-card-grid';
            Array.from(artistsMap.values()).slice(0, 6).forEach(a => grid.appendChild(buildArtistCard(a)));
            sec.appendChild(grid);
            searchResultsEl.appendChild(sec);
        }
        if (albumsMap.size) {
            const sec = buildSection('Álbumes');
            const grid = document.createElement('div');
            grid.className = 'search-card-grid';
            Array.from(albumsMap.values()).slice(0, 6).forEach(a => grid.appendChild(buildAlbumCard(a)));
            sec.appendChild(grid);
            searchResultsEl.appendChild(sec);
        }
        searchResultsEl.style.display = 'block';
        searchResultsEl.scrollTop = 0;
    }
    function closeSearch() {
        if (searchInputEl) searchInputEl.value = '';
        clearResults();
        restoreNormalView();
        if (searchContainerEl) searchContainerEl.classList.remove('visible');
    }
    function closeSearchAndPlay(item) {
        if (searchInputEl) searchInputEl.value = '';
        clearResults();
        restoreNormalView();
        if (searchContainerEl) searchContainerEl.classList.remove('visible');
        setTimeout(() => item.click(), 30);
    }
    function onSearchInput() {
        const q = (searchInputEl?.value || '').trim();
        if (!q) {
            if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
            clearResults();
            restoreNormalView();
            return;
        }
        hideAllItems();
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => renderResults(q), 70);
    }
    function init() {
        searchInputEl = document.getElementById('search-input');
        searchContainerEl = document.getElementById('search-container');
        playlistEl = document.getElementById('playlist');
        if (!searchInputEl || !playlistEl) { setTimeout(init, 200); return; }
        if (searchInputEl.dataset.spotifySearchReady === '1') return;
        searchInputEl.dataset.spotifySearchReady = '1';
        ensureResultsContainer();
        searchInputEl.addEventListener('input', onSearchInput);
        window.__applySearchVisibility = function () {
            const q = (searchInputEl?.value || '').trim();
            if (q) renderResults(q);
            else { clearResults(); restoreNormalView(); }
        };
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

/* ============================================================
   18. VISTA DE "VOLVER A OÍR" (detalle + escuchar + EDITAR)
   ============================================================ */
(function () {
    'use strict';

    function init() {
        const viewEl = document.getElementById('playlist-view');
        const pvScroll = document.getElementById('pv-scroll');
        const pvTitle = document.getElementById('pv-title');
        const pvList = document.getElementById('pv-list');
        const pvCount = document.getElementById('pv-count');
        const pvCover = document.getElementById('pv-cover-img');
        const pvBack = document.getElementById('pv-back');
        const pvPlayAll = document.getElementById('pv-play-all');
        const playlist = document.getElementById('playlist');
        const pvEditBtn = document.getElementById('pv-edit');
        const pvCancelBtn = document.getElementById('pv-cancel');
        const pvSaveBtn = document.getElementById('pv-save');

        if (!viewEl || !pvList || !playlist) return;

        let currentPlaylist = null;
        let editMode = false;
        const editRemoved = new Set();

        function findItemByTitle(title) {
            const n = normalizeStr(title);
            if (!n) return null;
            const items = playlist.querySelectorAll('.playlist-item');
            for (const item of items) {
                const t = item.querySelector('.item-title')?.textContent.trim() || '';
                if (normalizeStr(t) === n) return item;
            }
            return null;
        }
        function getItemCover(item) { return item.querySelector('.thumbnail img')?.src || ''; }

        function buildRow(item, titulo) {
            const cover = getItemCover(item);
            const subtitle = item.querySelector('.item-subtitle')?.textContent.trim() || '';
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'pv-row';
            if (item.classList.contains('active')) row.classList.add('active');
            row.dataset.title = titulo;
            if (cover) {
                const thumb = document.createElement('div');
                thumb.className = 'pv-row-thumb';
                const img = document.createElement('img');
                img.src = cover; img.alt = titulo; img.loading = 'lazy';
                thumb.appendChild(img);
                row.appendChild(thumb);
            }
            const info = document.createElement('div');
            info.className = 'pv-row-info';
            const titleEl = document.createElement('span');
            titleEl.className = 'pv-row-title';
            titleEl.textContent = titulo;
            info.appendChild(titleEl);
            if (subtitle) {
                const subEl = document.createElement('span');
                subEl.className = 'pv-row-sub';
                subEl.textContent = subtitle;
                info.appendChild(subEl);
            }
            row.appendChild(info);
            row.addEventListener('click', () => {
                if (editMode) return;
                item.click();
            });
            return row;
        }

        function refreshPlayingRows() {
            const active = playlist.querySelector('.playlist-item.active');
            const activeTitle = active ? (active.querySelector('.item-title')?.textContent.trim() || '') : '';
            pvList.querySelectorAll('.pv-row').forEach(row => {
                if (activeTitle && row.dataset.title === activeTitle) row.classList.add('active');
                else row.classList.remove('active');
            });
        }

        function updateEditButtonVisibility() {
            if (!pvEditBtn) return;
            const canEdit = !!(currentPlaylist && currentPlaylist.isOwner === true);
            pvEditBtn.style.display = canEdit ? '' : 'none';
        }

        function enterEditMode() {
            if (!currentPlaylist || !currentPlaylist.isOwner) return;
            editMode = true;
            editRemoved.clear();
            viewEl.classList.add('edit-mode');
            if (pvEditBtn) pvEditBtn.style.display = 'none';
            if (pvCancelBtn) pvCancelBtn.style.display = '';
            if (pvPlayAll) pvPlayAll.style.display = 'none';
            if (pvSaveBtn) pvSaveBtn.style.display = '';
            addRemoveButtons();
        }

        function exitEditMode() {
            editMode = false;
            editRemoved.clear();
            viewEl.classList.remove('edit-mode');
            if (pvCancelBtn) pvCancelBtn.style.display = 'none';
            if (pvPlayAll) pvPlayAll.style.display = '';
            if (pvSaveBtn) pvSaveBtn.style.display = 'none';
            updateEditButtonVisibility();
            pvList.querySelectorAll('.pv-row-remove').forEach(el => el.remove());
            pvList.querySelectorAll('.pv-row.removed').forEach(el => {
                el.classList.remove('removed');
                el.style.display = '';
            });
        }

        function addRemoveButtons() {
            pvList.querySelectorAll('.pv-row').forEach(row => {
                if (row.querySelector('.pv-row-remove')) return;
                if (row.style.display === 'none') return;
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'pv-row-remove';
                btn.setAttribute('aria-label', 'Quitar canción');
                btn.innerHTML = '&times;';
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (navigator.vibrate) { try { navigator.vibrate(12); } catch (_) {} }
                    const title = row.dataset.title;
                    if (title) editRemoved.add(title);
                    row.classList.add('removed');
                    row.style.display = 'none';
                });
                row.appendChild(btn);
            });
        }

        function refreshRowsAfterSave() {
            if (!currentPlaylist) return;
            pvList.innerHTML = '';
            currentPlaylist.canciones.forEach(c => {
                const item = findItemByTitle(c.titulo);
                if (!item) return;
                pvList.appendChild(buildRow(item, c.titulo));
            });
            const n = currentPlaylist.canciones.length;
            if (pvCount) pvCount.textContent = n + ' ' + (n === 1 ? 'canción' : 'canciones');
            let coverSet = false;
            for (const c of currentPlaylist.canciones) {
                const it = findItemByTitle(c.titulo);
                if (it) {
                    const cv = getItemCover(it);
                    if (cv) { pvCover.src = cv; coverSet = true; break; }
                }
            }
            if (!coverSet) pvCover.removeAttribute('src');
            refreshPlayingRows();
        }

        async function saveEditChanges() {
            if (!currentPlaylist || !currentPlaylist.isOwner) return;
            if (!editRemoved.size) { exitEditMode(); return; }
            if (pvSaveBtn) { pvSaveBtn.disabled = true; pvSaveBtn.textContent = 'Guardando…'; }
            try {
                const excluidas = Array.from(editRemoved);
                if (typeof window.__guardarEdicionPlaylist === 'function') {
                    await window.__guardarEdicionPlaylist(currentPlaylist, excluidas);
                }
                currentPlaylist.canciones = currentPlaylist.canciones.filter(c => !editRemoved.has(c.titulo));
                exitEditMode();
                if (!currentPlaylist.canciones.length) {
                    closeView();
                    if (typeof window.__buildListenAgain === 'function') { try { window.__buildListenAgain(); } catch (_) {} }
                    return;
                }
                refreshRowsAfterSave();
                if (typeof window.__buildListenAgain === 'function') { try { window.__buildListenAgain(); } catch (_) {} }
            } catch (e) {
                alert('No se pudieron guardar los cambios.');
            } finally {
                if (pvSaveBtn) { pvSaveBtn.disabled = false; pvSaveBtn.textContent = 'Guardar cambios'; }
            }
        }

        function openView(pl) {
            if (editMode) exitEditMode();
            currentPlaylist = pl;
            pvTitle.textContent = pl.nombre || 'Volver a Oír';
            const n = pl.canciones.length;
            pvCount.textContent = n + ' ' + (n === 1 ? 'canción' : 'canciones');
            let coverSet = false;
            for (const c of pl.canciones) {
                const it = findItemByTitle(c.titulo);
                if (it) {
                    const cv = getItemCover(it);
                    if (cv) { pvCover.src = cv; coverSet = true; break; }
                }
            }
            if (!coverSet) pvCover.removeAttribute('src');
            pvList.innerHTML = '';
            pl.canciones.forEach(c => {
                const item = findItemByTitle(c.titulo);
                if (!item) return;
                pvList.appendChild(buildRow(item, c.titulo));
            });
            viewEl.classList.add('visible');
            viewEl.setAttribute('aria-hidden', 'false');
            if (pvScroll) pvScroll.scrollTop = 0;
            updateEditButtonVisibility();
            if (!pvList._omegaObserver) {
                pvList._omegaObserver = new MutationObserver(refreshPlayingRows);
                pvList._omegaObserver.observe(playlist, { subtree: true, attributes: true, attributeFilter: ['class'] });
            }
            refreshPlayingRows();
        }

        function closeView() {
            if (editMode) exitEditMode();
            viewEl.classList.remove('visible');
            viewEl.setAttribute('aria-hidden', 'true');
            currentPlaylist = null;
        }

        if (pvBack) pvBack.addEventListener('click', closeView);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && viewEl.classList.contains('visible')) {
                if (editMode) exitEditMode();
                else closeView();
            }
        });

        if (pvPlayAll) {
            pvPlayAll.addEventListener('click', () => {
                if (editMode) return;
                if (!currentPlaylist || !currentPlaylist.canciones.length) return;
                const items = currentPlaylist.canciones.map(c => findItemByTitle(c.titulo)).filter(Boolean);
                if (!items.length) return;
                if (typeof setArtistFilter === 'function') setArtistFilter(items, currentPlaylist.nombre);
                else { window.__artistFilter = items.slice(); window.__artistFilterName = currentPlaylist.nombre; }
                items[0].click();
                setTimeout(refreshPlayingRows, 60);
            });
        }
        if (pvEditBtn) pvEditBtn.addEventListener('click', enterEditMode);
        if (pvCancelBtn) pvCancelBtn.addEventListener('click', exitEditMode);
        if (pvSaveBtn) pvSaveBtn.addEventListener('click', saveEditChanges);
        window.__openPlaylistView = openView;
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

/* ============================================================
   19. COMPARTIR PLAYLIST ENTRE USUARIOS
   ============================================================ */
(function () {
    'use strict';
    let usersCache = null;
    let usersLoadingPromise = null;
    let currentPlaylistToShare = null;
    let currentTargetUser = null;
    let sharedUnsubscribe = null;
    let contactosRecientesCache = null;
    let yaCompartidosCache = new Set();

    const $ = (id) => document.getElementById(id);

    function findLocalItemByTitle(title) {
        const pl = $('playlist');
        if (!pl) return null;
        const n = String(title || '').toLowerCase().trim();
        if (!n) return null;
        for (const it of pl.querySelectorAll('.playlist-item')) {
            const t = (it.querySelector('.item-title')?.textContent || '').trim();
            if (t.toLowerCase() === n) return it;
        }
        return null;
    }
    function getCoverFromItem(item) { return item ? (item.querySelector('.thumbnail img')?.src || '') : ''; }
    function getSubtitleFromItem(item) { return item ? (item.querySelector('.item-subtitle')?.textContent.trim() || '') : ''; }

    function normalizeUserStr(str) {
        return String(str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
    }

    async function cargarUsuariosFirebase() {
        if (usersCache) return usersCache;
        if (usersLoadingPromise) return usersLoadingPromise;
        usersLoadingPromise = (async () => {
            const snap = await firebase.firestore().collection('historial_usuarios').limit(1000).get();
            const users = [];
            snap.forEach(doc => {
                const d = doc.data() || {};
                const nombre = d.nombre || d.name || d.displayName || '';
                const email = (d.email || '').toLowerCase();
                const foto = d.foto || d.photoURL || d.photoUrl || '';
                if (!nombre && !email) return;
                users.push({ uid: doc.id, nombre: nombre || (email ? email.split('@')[0] : 'Usuario'), email, foto });
            });
            usersCache = users;
            return users;
        })().catch(err => { usersLoadingPromise = null; throw err; });
        return usersLoadingPromise;
    }

    async function cargarContactosRecientes() {
        const user = firebase.auth().currentUser;
        if (!user) return [];
        if (contactosRecientesCache) return contactosRecientesCache;
        try {
            const docRef = firebase.firestore().collection('historial_usuarios').doc(user.uid);
            const docSnap = await docRef.get();
            const data = docSnap.exists ? (docSnap.data() || {}) : {};
            const contactos = Array.isArray(data.contactos_compartidos) ? data.contactos_compartidos : [];
            contactos.sort((a, b) => {
                const fa = a.fecha && typeof a.fecha.toDate === 'function' ? a.fecha.toDate().getTime() : 0;
                const fb = b.fecha && typeof b.fecha.toDate === 'function' ? b.fecha.toDate().getTime() : 0;
                return fb - fa;
            });
            contactosRecientesCache = contactos.slice(0, 20);
            return contactosRecientesCache;
        } catch (e) { contactosRecientesCache = []; return []; }
    }

    async function registrarContactoCompartido(targetUid, targetName, targetEmail, targetFoto) {
        const user = firebase.auth().currentUser;
        if (!user || !targetUid) return;
        try {
            const docRef = firebase.firestore().collection('historial_usuarios').doc(user.uid);
            const docSnap = await docRef.get();
            const data = docSnap.exists ? (docSnap.data() || {}) : {};
            let contactos = Array.isArray(data.contactos_compartidos) ? data.contactos_compartidos.slice() : [];
            contactos = contactos.filter(c => c && c.uid !== targetUid);
            contactos.unshift({
                uid: targetUid, nombre: targetName || '',
                email: (targetEmail || '').toLowerCase(), foto: targetFoto || '',
                fecha: firebase.firestore.FieldValue.serverTimestamp()
            });
            contactos = contactos.slice(0, 30);
            if (docSnap.exists) await docRef.update({ contactos_compartidos: contactos });
            else await docRef.set({ contactos_compartidos: contactos }, { merge: true });
            contactosRecientesCache = null;
        } catch (e) { console.warn(e); }
    }

    async function cargarCompartidosDePlaylist(playlist) {
        yaCompartidosCache = new Set();
        const user = firebase.auth().currentUser;
        if (!user || !playlist) return;
        try {
            const snap = await firebase.firestore().collection('playlists_compartidas').where('de', '==', user.uid).get();
            const nombreActual = String(playlist.nombre || '').trim().toLowerCase();
            const idActual = String(playlist.id || '').trim();
            snap.forEach(doc => {
                const d = doc.data() || {};
                const nombreDoc = String(d.nombre || '').trim().toLowerCase();
                const idDoc = String(d.playlistId || '').trim();
                const coincideNombre = nombreActual && nombreDoc && nombreActual === nombreDoc;
                const coincideId = idActual && idDoc && idActual === idDoc;
                if (coincideNombre || coincideId) { if (d.para) yaCompartidosCache.add(d.para); }
            });
        } catch (e) { console.warn(e); }
    }

    async function buscarDocCompartido(playlist, targetUid) {
        const user = firebase.auth().currentUser;
        if (!user || !playlist || !targetUid) return null;
        try {
            const snap = await firebase.firestore().collection('playlists_compartidas')
                .where('de', '==', user.uid).where('para', '==', targetUid).get();
            const nombreActual = String(playlist.nombre || '').trim().toLowerCase();
            const idActual = String(playlist.id || '').trim();
            for (const doc of snap.docs) {
                const d = doc.data() || {};
                const nombreDoc = String(d.nombre || '').trim().toLowerCase();
                const idDoc = String(d.playlistId || '').trim();
                const coincideNombre = nombreActual && nombreDoc && nombreActual === nombreDoc;
                const coincideId = idActual && idDoc && idActual === idDoc;
                if (coincideNombre || coincideId) return { id: doc.id, ref: doc.ref };
            }
        } catch (e) { console.warn(e); }
        return null;
    }

    async function dejarDeCompartirPlaylist(playlist, targetUid) {
        const doc = await buscarDocCompartido(playlist, targetUid);
        if (!doc) throw new Error('No se encontró la playlist compartida.');
        await doc.ref.delete();
        yaCompartidosCache.delete(targetUid);
        return true;
    }

    async function buscarUsuariosEnFirestore(query) {
        const raw = String(query || '').trim();
        const q = normalizeUserStr(raw);
        if (!q) return [];
        const db = firebase.firestore();
        const col = db.collection('historial_usuarios');
        const currentUid = firebase.auth().currentUser?.uid || '';
        const resultados = new Map();
        function pushDoc(doc) {
            if (doc.id === currentUid) return;
            const d = doc.data() || {};
            const nombre = d.nombre || d.name || d.displayName || '';
            const email = (d.email || '').toLowerCase();
            if (!nombre && !email) return;
            resultados.set(doc.id, { uid: doc.id, nombre: nombre || (email ? email.split('@')[0] : 'Usuario'), email, foto: d.foto || d.photoURL || d.photoUrl || '' });
        }
        try { (await col.where('email', '==', raw.toLowerCase()).limit(10).get()).forEach(pushDoc); } catch (e) {}
        try { (await col.orderBy('nombre').startAt(raw).endAt(raw + '\uf8ff').limit(20).get()).forEach(pushDoc); } catch (e) {}
        try {
            const todos = await cargarUsuariosFirebase();
            todos.forEach(u => {
                if (u.uid === currentUid) return;
                const nNombre = normalizeUserStr(u.nombre);
                const nEmail = normalizeUserStr(u.email);
                if (nNombre.includes(q) || nEmail.includes(q)) resultados.set(u.uid, u);
            });
        } catch (e) {}
        return Array.from(resultados.values()).slice(0, 40);
    }

    function filtrarUsuarios(users, q) {
        const nq = normalizeUserStr(q);
        if (!nq) return users.slice(0, 40);
        return users.filter(u =>
            normalizeUserStr(u.nombre).includes(nq) ||
            normalizeUserStr(u.email).includes(nq) ||
            normalizeUserStr(u.uid).includes(nq)
        ).slice(0, 40);
    }

    async function compartirPlaylistConUsuario(playlist, targetUid, targetName, targetEmail, targetFoto) {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Debes iniciar sesión.');
        if (!playlist || !Array.isArray(playlist.canciones) || !playlist.canciones.length) throw new Error('La playlist está vacía.');
        if (user.uid === targetUid) throw new Error('No puedes compartir contigo mismo.');
        const canciones = playlist.canciones.map(c => {
            const it = findLocalItemByTitle(c.titulo);
            return { titulo: c.titulo, portada: getCoverFromItem(it) || c.portada || '', subtitulo: getSubtitleFromItem(it) || c.subtitulo || '' };
        });
        let portada = '';
        for (const c of canciones) { if (c.portada) { portada = c.portada; break; } }
        await firebase.firestore().collection('playlists_compartidas').add({
            de: user.uid, deNombre: user.displayName || user.email || 'Usuario', deEmail: user.email || '',
            para: targetUid, paraNombre: targetName || '',
            nombre: playlist.nombre || 'Playlist', playlistId: playlist.id || '',
            portada, canciones, fecha: firebase.firestore.FieldValue.serverTimestamp()
        });
        await registrarContactoCompartido(targetUid, targetName, targetEmail, targetFoto);
        yaCompartidosCache.add(targetUid);
        return true;
    }

    function buildUserRow(u, onPick, mode) {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'share-user-row';
        if (mode === 'recent') row.classList.add('share-user-row--recent');
        if (mode === 'already') row.classList.add('share-user-row--already');
        const av = document.createElement('div');
        av.className = 'share-user-avatar';
        if (u.foto) {
            const img = document.createElement('img');
            img.src = u.foto; img.alt = u.nombre;
            av.appendChild(img);
        } else av.textContent = (String(u.nombre).trim()[0] || '?').toUpperCase();
        row.appendChild(av);
        const info = document.createElement('div');
        info.className = 'share-user-info';
        const nameEl = document.createElement('span');
        nameEl.className = 'share-user-name';
        nameEl.textContent = u.nombre;
        info.appendChild(nameEl);
        const subEl = document.createElement('span');
        subEl.className = 'share-user-sub';
        if (mode === 'already') subEl.textContent = 'Ya compartida · ' + (u.email || 'Usuario');
        else if (mode === 'recent') subEl.textContent = 'Seguir compartiendo · ' + (u.email || 'Usuario');
        else subEl.textContent = u.email || 'Usuario de Kerim Music';
        info.appendChild(subEl);
        row.appendChild(info);
        const action = document.createElement('span');
        action.className = 'share-user-action';
        if (mode === 'already') { action.classList.add('share-user-action--danger'); action.textContent = 'Dejar de compartir'; }
        else if (mode === 'recent') action.textContent = 'Continuar';
        else action.textContent = 'Compartir';
        row.appendChild(action);
        row.addEventListener('click', () => onPick(u));
        return row;
    }

    function renderUserResults(users, container, onPick, query) {
        if (!container) return;
        container.innerHTML = '';
        const currentUid = firebase.auth().currentUser?.uid || '';
        const filtered = users.filter(u => u.uid !== currentUid);
        if (!filtered.length) {
            const empty = document.createElement('div');
            empty.className = 'search-empty';
            empty.innerHTML =
                '<div class="search-empty-title">' + (query ? 'Sin resultados' : 'Sin usuarios') + '</div>' +
                '<div class="search-empty-sub">' + (query ? `No se encontró "${query}".` : 'Aún no hay otros usuarios.') + '</div>';
            container.appendChild(empty);
            return;
        }
        const yaList = [], resto = [];
        filtered.forEach(u => { if (yaCompartidosCache.has(u.uid)) yaList.push(u); else resto.push(u); });
        yaList.forEach(u => container.appendChild(buildUserRow(u, onPick, 'already')));
        resto.forEach(u => container.appendChild(buildUserRow(u, onPick, 'search')));
    }

    async function renderSeguirCompartiendo(container, onPick) {
        if (!container) return;
        const recientes = await cargarContactosRecientes();
        const currentUid = firebase.auth().currentUser?.uid || '';
        const validos = recientes.filter(c => c && c.uid && c.uid !== currentUid);
        if (!validos.length) { container.innerHTML = ''; container.style.display = 'none'; return; }
        container.innerHTML = '';
        container.style.display = '';
        const header = document.createElement('div');
        header.className = 'share-recent-header';
        header.textContent = 'Seguir compartiendo';
        container.appendChild(header);
        const list = document.createElement('div');
        list.className = 'share-recent-list';
        validos.slice(0, 5).forEach(c => {
            const u = { uid: c.uid, nombre: c.nombre || 'Usuario', email: (c.email || '').toLowerCase(), foto: c.foto || '' };
            const mode = yaCompartidosCache.has(u.uid) ? 'already' : 'recent';
            list.appendChild(buildUserRow(u, onPick, mode));
        });
        container.appendChild(list);
    }

    async function openShareModal(playlist) {
        currentPlaylistToShare = playlist;
        currentTargetUser = null;
        contactosRecientesCache = null;
        const modal = $('share-modal');
        const input = $('share-modal-input');
        const results = $('share-modal-results');
        const status = $('share-modal-status');
        const recentBox = $('share-modal-recent');
        if (!modal) return;
        if (input) input.value = '';
        if (status) { status.textContent = ''; status.classList.remove('ok'); }
        if (results) results.innerHTML = '';
        if (recentBox) { recentBox.innerHTML = ''; recentBox.style.display = 'none'; }
        modal.classList.add('visible');
        modal.setAttribute('aria-hidden', 'false');
        await cargarCompartidosDePlaylist(playlist);
        cargarUsuariosFirebase().catch(() => {});
    }

    function closeShareModal() {
        const modal = $('share-modal');
        if (!modal) return;
        modal.classList.remove('visible');
        modal.setAttribute('aria-hidden', 'true');
        currentPlaylistToShare = null;
        currentTargetUser = null;
    }

    async function onPickUser(u) {
        const status = $('share-modal-status');
        if (!status) return;
        if (currentTargetUser && currentTargetUser.uid === u.uid) return;
        currentTargetUser = u;
        const yaCompartida = yaCompartidosCache.has(u.uid);
        if (yaCompartida) {
            status.textContent = 'Dejando de compartir con ' + u.nombre + '…';
            status.classList.remove('ok');
            try {
                await dejarDeCompartirPlaylist(currentPlaylistToShare, u.uid);
                status.textContent = '✓ Dejaste de compartir con ' + u.nombre;
                status.classList.add('ok');
                const results = $('share-modal-results');
                if (usersCache) {
                    const q = ($('share-modal-input')?.value || '').trim();
                    if (q) renderUserResults(filtrarUsuarios(usersCache, q), results, onPickUser, q);
                    else if (results) results.innerHTML = '';
                }
                setTimeout(() => { status.textContent = ''; status.classList.remove('ok'); currentTargetUser = null; }, 1400);
            } catch (err) {
                status.textContent = err.message || 'No se pudo dejar de compartir.';
                status.classList.remove('ok');
                currentTargetUser = null;
            }
            return;
        }
        status.textContent = 'Compartiendo con ' + u.nombre + '…';
        status.classList.remove('ok');
        try {
            await compartirPlaylistConUsuario(currentPlaylistToShare, u.uid, u.nombre, u.email, u.foto);
            status.textContent = '✓ Playlist compartida con ' + u.nombre;
            status.classList.add('ok');
            const results = $('share-modal-results');
            if (usersCache) {
                const q = ($('share-modal-input')?.value || '').trim();
                if (q) renderUserResults(filtrarUsuarios(usersCache, q), results, onPickUser, q);
                else if (results) results.innerHTML = '';
            }
            setTimeout(() => { status.textContent = ''; status.classList.remove('ok'); currentTargetUser = null; }, 1600);
        } catch (err) {
            status.textContent = err.message || 'No se pudo compartir la playlist.';
            status.classList.remove('ok');
            currentTargetUser = null;
        }
    }

    function renderSharedPlaylists(playlists) {
        const sec = $('sec-shared');
        const carousel = $('carousel-shared');
        if (!sec || !carousel) return;
        carousel.innerHTML = '';
        if (!playlists.length) { sec.style.display = 'none'; return; }
        sec.style.display = '';
        playlists.forEach(pl => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'home-card home-card--playlist';
            card.setAttribute('aria-label', pl.nombre);
            const thumb = document.createElement('div');
            thumb.className = 'home-card-thumb';
            if (pl.portada) {
                const img = document.createElement('img');
                img.src = pl.portada; img.alt = pl.nombre; img.loading = 'lazy';
                thumb.appendChild(img);
            }
            card.appendChild(thumb);
            const t = document.createElement('span');
            t.className = 'home-card-title';
            t.textContent = pl.nombre;
            card.appendChild(t);
            const s = document.createElement('span');
            s.className = 'home-card-sub';
            s.textContent = 'De ' + (pl.deNombre || 'un usuario');
            card.appendChild(s);
            card.addEventListener('click', () => {
                if (typeof window.__openPlaylistView === 'function') window.__openPlaylistView(pl);
            });
            carousel.appendChild(card);
        });
    }

    function listenSharedPlaylists(user) {
        if (sharedUnsubscribe) { sharedUnsubscribe(); sharedUnsubscribe = null; }
        sharedUnsubscribe = firebase.firestore().collection('playlists_compartidas')
            .where('para', '==', user.uid).onSnapshot(snap => {
                const list = [];
                snap.forEach(doc => {
                    const d = doc.data() || {};
                    list.push({
                        id: doc.id, nombre: d.nombre || 'Playlist compartida',
                        portada: d.portada || '', deNombre: d.deNombre || '',
                        canciones: Array.isArray(d.canciones) ? d.canciones.slice() : [],
                        isOwner: false
                    });
                });
                list.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
                renderSharedPlaylists(list);
            }, err => { renderSharedPlaylists([]); });
    }

    function init() {
        if (typeof window.__openPlaylistView === 'function' && !window.__openPlaylistView.__shareWrapped) {
            const orig = window.__openPlaylistView;
            const wrapped = function (pl) {
                window.__currentOpenPlaylist = pl;
                return orig.apply(this, arguments);
            };
            wrapped.__shareWrapped = true;
            window.__openPlaylistView = wrapped;
        }
        const shareBtn = $('pv-share');
        const input = $('share-modal-input');
        const results = $('share-modal-results');
        const recentBox = $('share-modal-recent');
        const closeBtn = $('share-modal-close');
        const backdrop = $('share-modal-backdrop');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => {
                const pl = window.__currentOpenPlaylist;
                if (!pl) return;
                openShareModal(pl);
            });
        }
        if (closeBtn) closeBtn.addEventListener('click', closeShareModal);
        if (backdrop) backdrop.addEventListener('click', closeShareModal);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && $('share-modal')?.classList.contains('visible')) closeShareModal();
        });
        let debounceTimer = null;
        let searchToken = 0;
        if (input) {
            input.addEventListener('input', () => {
                const q = input.value.trim();
                if (debounceTimer) clearTimeout(debounceTimer);
                if (recentBox) { recentBox.innerHTML = ''; recentBox.style.display = 'none'; }
                if (!q) {
                    if (results) results.innerHTML = '';
                    return;
                }
                if (usersCache) renderUserResults(filtrarUsuarios(usersCache, q), results, onPickUser, q);
                debounceTimer = setTimeout(async () => {
                    const myToken = ++searchToken;
                    try {
                        const encontrados = await buscarUsuariosEnFirestore(q);
                        if (myToken !== searchToken) return;
                        renderUserResults(encontrados, results, onPickUser, q);
                    } catch (err) {}
                }, 150);
            });
        }
        if (typeof firebase !== 'undefined' && firebase.auth) {
            firebase.auth().onAuthStateChanged(user => {
                if (user) listenSharedPlaylists(user);
                else {
                    if (sharedUnsubscribe) { sharedUnsubscribe(); sharedUnsubscribe = null; }
                    renderSharedPlaylists([]);
                }
            });
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

/* ============================================================
   20. MI PLAYLIST (crear, listar, público/privado, añadir)
   ============================================================ */
(function () {
    'use strict';

    const COLLECTION = 'mis_playlists';
    let miPlaylistsCache = [];
    let miUnsubscribe = null;
    let currentSongToAdd = null;

    function $(id) { return document.getElementById(id); }

    function findLocalItem(title) {
        const pl = $('playlist');
        if (!pl || !title) return null;
        const n = String(title).toLowerCase().trim();
        for (const it of pl.querySelectorAll('.playlist-item')) {
            const t = (it.querySelector('.item-title')?.textContent || '').trim().toLowerCase();
            if (t === n) return it;
        }
        return null;
    }

    function renderMiPlaylists() {
        const grid = $('mp-grid');
        const empty = $('mp-empty');
        if (!grid) return;
        grid.innerHTML = '';
        if (!miPlaylistsCache.length) {
            if (empty) empty.style.display = '';
            return;
        }
        if (empty) empty.style.display = 'none';

        miPlaylistsCache.forEach(pl => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'mp-card';
            card.setAttribute('aria-label', pl.nombre || 'Playlist');

            const thumb = document.createElement('div');
            thumb.className = 'mp-card-thumb';

            const canciones = Array.isArray(pl.canciones) ? pl.canciones : [];
            const covers = canciones.slice(0, 4).map(c => {
                const local = findLocalItem(c.titulo);
                return local ? (local.querySelector('.thumbnail img')?.src || '') : (c.portada || '');
            });
            while (covers.length < 4) covers.push('');

            covers.forEach(cover => {
                const cell = document.createElement('div');
                cell.className = 'playlist-collage-cell';
                if (cover) {
                    const img = document.createElement('img');
                    img.src = cover; img.alt = ''; img.loading = 'lazy';
                    cell.appendChild(img);
                }
                thumb.appendChild(cell);
            });
            card.appendChild(thumb);

            const t = document.createElement('span');
            t.className = 'mp-card-title';
            t.textContent = pl.nombre || 'Playlist';
            card.appendChild(t);

            const s = document.createElement('span');
            s.className = 'mp-card-sub';
            const n = canciones.length;
            const vis = pl.privada ? 'Privada' : 'Pública';
            s.textContent = n + ' ' + (n === 1 ? 'canción' : 'canciones') + ' · ' + vis;
            card.appendChild(s);

            const badge = document.createElement('button');
            badge.type = 'button';
            badge.className = 'mp-card-badge';
            badge.textContent = pl.privada ? '🔒' : '🌐';
            badge.title = pl.privada ? 'Cambiar a Pública' : 'Cambiar a Privada';
            badge.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                togglePlaylistVisibility(pl.id, !pl.privada);
            });
            card.appendChild(badge);

            card.addEventListener('click', () => openMiPlaylist(pl));
            grid.appendChild(card);
        });
    }

    function openMiPlaylist(pl) {
        const canciones = (Array.isArray(pl.canciones) ? pl.canciones : []).map(c => {
            const local = findLocalItem(c.titulo);
            return {
                titulo: c.titulo,
                portada: (local && local.querySelector('.thumbnail img')?.src) || c.portada || '',
                subtitulo: (local && local.querySelector('.item-subtitle')?.textContent.trim()) || c.subtitulo || ''
            };
        });
        const plView = {
            id: pl.id,
            nombre: pl.nombre,
            canciones,
            isOwner: true,
            esMiPlaylist: true,
            privada: !!pl.privada
        };
        if (typeof window.__openPlaylistView === 'function') window.__openPlaylistView(plView);
    }

    function loadMisPlaylists() {
        const user = firebase.auth().currentUser;
        if (miUnsubscribe) { miUnsubscribe(); miUnsubscribe = null; }
        if (!user) { miPlaylistsCache = []; renderMiPlaylists(); return; }
        miUnsubscribe = firebase.firestore()
            .collection(COLLECTION)
            .where('uid', '==', user.uid)
            .onSnapshot(snap => {
                miPlaylistsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                miPlaylistsCache.sort((a, b) => {
                    const fa = a.fecha && typeof a.fecha.seconds === 'number' ? a.fecha.seconds : 0;
                    const fb = b.fecha && typeof b.fecha.seconds === 'number' ? b.fecha.seconds : 0;
                    return fb - fa;
                });
                renderMiPlaylists();
            }, err => {
                miPlaylistsCache = [];
                renderMiPlaylists();
            });
    }

    function openMiPlaylistView() {
        const view = $('mi-playlist-view');
        if (!view) return;
        view.classList.add('visible');
        view.setAttribute('aria-hidden', 'false');
        renderMiPlaylists();
    }
    function closeMiPlaylistView() {
        const view = $('mi-playlist-view');
        if (!view) return;
        view.classList.remove('visible');
        view.setAttribute('aria-hidden', 'true');
    }

    function openCreateModal() {
        const modal = $('mp-create-modal');
        const input = $('mp-create-input');
        const status = $('mp-create-status');
        const privCheck = $('mp-create-private');
        if (!modal) return;
        if (input) input.value = '';
        if (status) { status.textContent = ''; status.classList.remove('ok'); }
        if (privCheck) privCheck.checked = false;
        modal.classList.add('visible');
        modal.setAttribute('aria-hidden', 'false');
        setTimeout(() => input && input.focus(), 120);
    }
    function closeCreateModal() {
        const modal = $('mp-create-modal');
        if (!modal) return;
        modal.classList.remove('visible');
        modal.setAttribute('aria-hidden', 'true');
    }

    async function createPlaylist() {
        const user = firebase.auth().currentUser;
        if (!user) return;
        const input = $('mp-create-input');
        const status = $('mp-create-status');
        const confirmBtn = $('mp-create-confirm');
        const privCheck = $('mp-create-private');

        const nombre = (input?.value || '').trim();
        if (!nombre) {
            if (status) { status.textContent = 'Escribe un nombre'; status.classList.remove('ok'); }
            return;
        }
        if (confirmBtn) confirmBtn.disabled = true;
        if (status) { status.textContent = 'Creando...'; status.classList.remove('ok'); }
        try {
            await firebase.firestore().collection(COLLECTION).add({
                uid: user.uid,
                nombre,
                privada: !!(privCheck && privCheck.checked),
                canciones: [],
                fecha: firebase.firestore.FieldValue.serverTimestamp()
            });
            if (status) { status.textContent = '✓ Playlist creada'; status.classList.add('ok'); }
            setTimeout(closeCreateModal, 500);
        } catch (e) {
            if (status) { status.textContent = 'Error: ' + (e.message || 'intenta de nuevo'); status.classList.remove('ok'); }
        } finally {
            if (confirmBtn) confirmBtn.disabled = false;
        }
    }

    function openAddToPlaylistModal(songData) {
        currentSongToAdd = songData;
        const modal = $('mp-add-modal');
        const list = $('mp-add-list');
        const status = $('mp-add-status');
        if (!modal || !list) return;
        if (status) { status.textContent = ''; status.classList.remove('ok'); }
        list.innerHTML = '';
        if (!miPlaylistsCache.length) {
            const empty = document.createElement('div');
            empty.className = 'search-empty';
            empty.innerHTML = '<div class="search-empty-title">Sin playlists</div>' +
                              '<div class="search-empty-sub">Crea una playlist primero desde "Mi Playlist"</div>';
            list.appendChild(empty);
        } else {
            miPlaylistsCache.forEach(pl => {
                const row = document.createElement('button');
                row.type = 'button';
                row.className = 'mp-add-row';
                const cover = document.createElement('div');
                cover.className = 'mp-add-row-thumb';
                const firstSong = (pl.canciones && pl.canciones[0]) ? pl.canciones[0] : null;
                const coverUrl = firstSong
                    ? ((findLocalItem(firstSong.titulo)?.querySelector('.thumbnail img')?.src) || firstSong.portada || '')
                    : '';
                if (coverUrl) {
                    const img = document.createElement('img');
                    img.src = coverUrl; img.alt = pl.nombre || '';
                    cover.appendChild(img);
                }
                row.appendChild(cover);
                const info = document.createElement('div');
                info.className = 'mp-add-row-info';
                const nameEl = document.createElement('span');
                nameEl.className = 'mp-add-row-name';
                nameEl.textContent = pl.nombre || 'Playlist';
                info.appendChild(nameEl);
                const subEl = document.createElement('span');
                subEl.className = 'mp-add-row-sub';
                const n = pl.canciones ? pl.canciones.length : 0;
                subEl.textContent = n + ' ' + (n === 1 ? 'canción' : 'canciones');
                info.appendChild(subEl);
                row.appendChild(info);
                row.addEventListener('click', () => addSongToPlaylist(pl));
                list.appendChild(row);
            });
        }
        modal.classList.add('visible');
        modal.setAttribute('aria-hidden', 'false');
    }
    function closeAddModal() {
        const modal = $('mp-add-modal');
        if (!modal) return;
        modal.classList.remove('visible');
        modal.setAttribute('aria-hidden', 'true');
        currentSongToAdd = null;
    }

    async function addSongToPlaylist(pl) {
        const status = $('mp-add-status');
        if (!currentSongToAdd || !pl) return;
        if (status) { status.textContent = 'Guardando...'; status.classList.remove('ok'); }
        try {
            const canciones = Array.isArray(pl.canciones) ? pl.canciones.slice() : [];
            const yaEsta = canciones.some(c => c.titulo === currentSongToAdd.titulo);
            if (yaEsta) {
                if (status) { status.textContent = 'Ya está en esta playlist'; status.classList.add('ok'); }
                setTimeout(closeAddModal, 1100);
                return;
            }
            canciones.push({
                titulo: currentSongToAdd.titulo,
                portada: currentSongToAdd.portada || '',
                subtitulo: currentSongToAdd.subtitulo || ''
            });
            await firebase.firestore().collection(COLLECTION).doc(pl.id).update({ canciones });
            if (status) { status.textContent = '✓ Añadida a ' + pl.nombre; status.classList.add('ok'); }
            setTimeout(closeAddModal, 1000);
        } catch (e) {
            if (status) { status.textContent = 'Error: ' + (e.message || 'intenta de nuevo'); status.classList.remove('ok'); }
        }
    }

    function getCurrentSongData() {
        const titleEl = $('player-title');
        const coverEl = $('player-cover');
        const activeItem = document.querySelector('.playlist-item.active');
        if (!titleEl) return null;
        const titulo = (titleEl.textContent || '').trim();
        if (!titulo || titulo === 'Titulo del Beats') return null;
        const portada = coverEl?.getAttribute('src') || '';
        const subtitulo = activeItem?.querySelector('.item-subtitle')?.textContent.trim() || '';
        return { titulo, portada, subtitulo };
    }

    async function togglePlaylistVisibility(plId, nuevoPrivada) {
        try {
            await firebase.firestore().collection(COLLECTION).doc(plId).update({ privada: !!nuevoPrivada });
        } catch (e) { console.warn('Error actualizando visibilidad:', e); }
    }

    function injectShareVisibilityToggle() {
        const modal = $('share-modal');
        const box = modal?.querySelector('.share-modal-box');
        if (!box) return;
        const existing = box.querySelector('.mp-share-vis');
        if (existing) existing.remove();
        const pl = window.__currentOpenPlaylist;
        if (!pl || !pl.esMiPlaylist) return;

        const wrap = document.createElement('div');
        wrap.className = 'mp-share-vis';
        const label = document.createElement('span');
        label.className = 'mp-share-vis-label';
        label.textContent = 'Visibilidad';
        wrap.appendChild(label);
        const options = document.createElement('div');
        options.className = 'mp-share-vis-options';

        const btnPublic = document.createElement('button');
        btnPublic.type = 'button';
        btnPublic.className = 'mp-share-vis-btn' + (!pl.privada ? ' active' : '');
        btnPublic.textContent = 'Pública';
        btnPublic.addEventListener('click', async () => {
            if (pl.privada) { await togglePlaylistVisibility(pl.id, false); pl.privada = false; }
            btnPublic.classList.add('active');
            btnPriv.classList.remove('active');
        });
        options.appendChild(btnPublic);

        const btnPriv = document.createElement('button');
        btnPriv.type = 'button';
        btnPriv.className = 'mp-share-vis-btn' + (pl.privada ? ' active' : '');
        btnPriv.textContent = 'Privada';
        btnPriv.addEventListener('click', async () => {
            if (!pl.privada) { await togglePlaylistVisibility(pl.id, true); pl.privada = true; }
            btnPriv.classList.add('active');
            btnPublic.classList.remove('active');
        });
        options.appendChild(btnPriv);
        wrap.appendChild(options);

        const input = box.querySelector('.share-modal-input');
        if (input) box.insertBefore(wrap, input);
        else box.appendChild(wrap);
    }

    function init() {
        const miLink = $('mi-playlist-link');
        const mpBack = $('mp-back');
        const mpCreate = $('mp-create');
        const mpCreateClose = $('mp-create-close');
        const mpCreateCancel = $('mp-create-cancel');
        const mpCreateBackdrop = $('mp-create-backdrop');
        const mpCreateConfirm = $('mp-create-confirm');
        const mpAddClose = $('mp-add-close');
        const mpAddBackdrop = $('mp-add-backdrop');

        if (miLink) {
            miLink.addEventListener('click', (e) => {
                e.preventDefault();
                const sm = $('submenu');
                const so = $('submenu-overlay');
                if (sm) sm.classList.remove('visible');
                if (so) so.classList.remove('visible');
                openMiPlaylistView();
            });
        }
        if (mpBack) mpBack.addEventListener('click', closeMiPlaylistView);
        if (mpCreate) mpCreate.addEventListener('click', openCreateModal);
        if (mpCreateClose) mpCreateClose.addEventListener('click', closeCreateModal);
        if (mpCreateCancel) mpCreateCancel.addEventListener('click', closeCreateModal);
        if (mpCreateBackdrop) mpCreateBackdrop.addEventListener('click', closeCreateModal);
        if (mpCreateConfirm) mpCreateConfirm.addEventListener('click', createPlaylist);
        if (mpAddClose) mpAddClose.addEventListener('click', closeAddModal);
        if (mpAddBackdrop) mpAddBackdrop.addEventListener('click', closeAddModal);

        const inputCreate = $('mp-create-input');
        if (inputCreate) {
            inputCreate.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); createPlaylist(); }
            });
        }

        document.addEventListener('click', (e) => {
            const likeBtn = e.target.closest('#fs-like');
            if (!likeBtn) return;
            setTimeout(() => {
                const song = getCurrentSongData();
                if (!song) return;
                openAddToPlaylistModal(song);
            }, 150);
        });

        const shareModal = $('share-modal');
        if (shareModal) {
            const obs = new MutationObserver(() => {
                if (shareModal.classList.contains('visible')) injectShareVisibilityToggle();
            });
            obs.observe(shareModal, { attributes: true, attributeFilter: ['class'] });
        }

        if (typeof firebase !== 'undefined' && firebase.auth) {
            firebase.auth().onAuthStateChanged(user => {
                if (user) loadMisPlaylists();
                else { miPlaylistsCache = []; renderMiPlaylists(); }
            });
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    window.__openMiPlaylistView = openMiPlaylistView;
    window.__togglePlaylistVisibility = togglePlaylistVisibility;
})();

/* ============================================================
   21. RESET DE SCROLL: cada ventana abre desde arriba
   ============================================================ */
(function () {
    'use strict';

    const SCROLLABLE_SELECTORS = [
        '.pv-scroll',
        '.ap-scroll',
        '.av-scroll',
        '.mp-scroll',
        '.playlist',
        '.share-modal-results',
        '.mp-add-list',
        '.search-results'
    ].join(',');

    function resetAllScrolls(root) {
        if (!root) return;
        const targets = new Set([root]);
        if (root.matches && root.matches(SCROLLABLE_SELECTORS)) targets.add(root);
        root.querySelectorAll(SCROLLABLE_SELECTORS).forEach(el => targets.add(el));
        targets.forEach(el => {
            try {
                el.scrollTop = 0;
                if (typeof el.scrollTo === 'function') el.scrollTo(0, 0);
            } catch (_) {}
        });
    }

    function forceReset(root) {
        resetAllScrolls(root);
        if (window.requestAnimationFrame) {
            requestAnimationFrame(() => resetAllScrolls(root));
        }
        setTimeout(() => resetAllScrolls(root), 60);
        setTimeout(() => resetAllScrolls(root), 180);
        setTimeout(() => resetAllScrolls(root), 420);
    }

    function observeView(el) {
        if (!el || el.dataset.scrollResetReady === '1') return;
        el.dataset.scrollResetReady = '1';

        const obs = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.attributeName !== 'class') continue;
                if (!el.classList.contains('visible')) continue;
                forceReset(el);
                break;
            }
        });
        obs.observe(el, { attributes: true, attributeFilter: ['class'] });

        if (el.classList.contains('visible')) forceReset(el);
    }

    function init() {
        const ids = [
            'playlist-view',
            'artist-profile',
            'album-view',
            'mi-playlist-view',
            'share-modal',
            'mp-create-modal',
            'mp-add-modal'
        ];
        ids.forEach(id => observeView(document.getElementById(id)));

        const closeButtons = [
            'pv-back', 'ap-close', 'av-back', 'mp-back',
            'share-modal-close', 'mp-create-close', 'mp-add-close'
        ];
        closeButtons.forEach(id => {
            const btn = document.getElementById(id);
            if (!btn || btn.dataset.scrollResetReady === '1') return;
            btn.dataset.scrollResetReady = '1';
            btn.addEventListener('click', () => {
                const parent = btn.closest(
                    '.playlist-view, .artist-profile, .album-view, .mi-playlist-view, ' +
                    '.share-modal, .mp-modal'
                );
                if (parent) resetAllScrolls(parent);
            }, true);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.__resetViewScroll = function (sel) {
        const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
        if (el) forceReset(el);
    };
})();

/* ============================================================
   22. VENTANAS EXCLUSIVAS
   ============================================================ */
(function () {
    'use strict';

    const MAIN_VIEW_IDS = [
        'playlist-view',
        'artist-profile',
        'album-view',
        'mi-playlist-view'
    ];

    function getMainViews() {
        return MAIN_VIEW_IDS
            .map(id => document.getElementById(id))
            .filter(Boolean);
    }

    function closeOthers(activeEl) {
        getMainViews().forEach(el => {
            if (el === activeEl) return;
            if (!el.classList.contains('visible')) return;
            el.classList.remove('visible');
            el.setAttribute('aria-hidden', 'true');
        });
    }

    function observeView(el) {
        if (!el || el.dataset.exclusiveReady === '1') return;
        el.dataset.exclusiveReady = '1';
        const obs = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.attributeName !== 'class') continue;
                if (el.classList.contains('visible')) {
                    closeOthers(el);
                    break;
                }
            }
        });
        obs.observe(el, { attributes: true, attributeFilter: ['class'] });
    }

    function scan() {
        getMainViews().forEach(observeView);
    }

    let attempts = 0;
    function boot() {
        attempts++;
        scan();
        if (attempts < 20 && getMainViews().length === 0) {
            setTimeout(boot, 200);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();

/* ============================================================
   23. PLAYLISTS PÚBLICAS EN EL REPRODUCTOR
   ============================================================ */
(function () {
    'use strict';

    let publicUnsubscribe = null;

    function $(id) { return document.getElementById(id); }

    function ensurePublicSection() {
        let sec = $('sec-public');
        if (sec) return { sec, carousel: $('carousel-public') };

        const homeView = $('home-view');
        if (!homeView) return null;

        const template =
            $('sec-listen-again') || $('sec-shared') ||
            $('sec-artists')      || $('sec-top')    ||
            $('sec-maybe')        || $('sec-albums');

        sec = document.createElement('section');
        sec.id = 'sec-public';
        if (template && template.className) sec.className = template.className;
        sec.style.display = 'none';

        const templateTitle = template
            ? template.querySelector('h1, h2, h3, [class*="section-title"], [class*="title"]')
            : null;
        const title = document.createElement(templateTitle ? templateTitle.tagName : 'h2');
        if (templateTitle && templateTitle.className) title.className = templateTitle.className;
        else title.className = 'home-section-title';
        title.textContent = 'Playlists públicas';
        sec.appendChild(title);

        const templateCarousel = template ? template.querySelector('[id^="carousel-"]') : null;
        const carousel = document.createElement('div');
        carousel.id = 'carousel-public';
        if (templateCarousel && templateCarousel.className) carousel.className = templateCarousel.className;
        sec.appendChild(carousel);

        const sharedSec = $('sec-shared');
        if (sharedSec && sharedSec.parentNode === homeView) {
            homeView.insertBefore(sec, sharedSec.nextSibling);
        } else {
            homeView.appendChild(sec);
        }
        return { sec, carousel };
    }

    function findLocalItemByTitle(title) {
        const pl = $('playlist');
        if (!pl) return null;
        const n = String(title || '').toLowerCase().trim();
        if (!n) return null;
        for (const it of pl.querySelectorAll('.playlist-item')) {
            const t = (it.querySelector('.item-title')?.textContent || '').trim().toLowerCase();
            if (t === n) return it;
        }
        return null;
    }

    function openPublicPlaylistView(pl) {
        const currentUid = (firebase.auth().currentUser && firebase.auth().currentUser.uid) || '';
        const isOwner = pl.uid === currentUid;

        const canciones = (Array.isArray(pl.canciones) ? pl.canciones : []).map(c => {
            const local = findLocalItemByTitle(c.titulo);
            return {
                titulo: c.titulo,
                portada: (local && local.querySelector('.thumbnail img')?.src) || c.portada || '',
                subtitulo:
                    (local && local.querySelector('.item-subtitle')?.textContent.trim()) ||
                    c.subtitulo || ''
            };
        });

        const plView = {
            id: pl.id,
            nombre: pl.nombre,
            canciones,
            isOwner,
            esMiPlaylist: isOwner,
            privada: false,
            esPublica: true
        };
        if (typeof window.__openPlaylistView === 'function') {
            window.__openPlaylistView(plView);
        }
    }

    function renderPublicPlaylists(playlists) {
        const els = ensurePublicSection();
        if (!els) return;
        const { sec, carousel } = els;
        carousel.innerHTML = '';

        if (!playlists.length) {
            sec.style.display = 'none';
            return;
        }
        sec.style.display = '';

        const currentUid = (firebase.auth().currentUser && firebase.auth().currentUser.uid) || '';

        playlists.forEach(pl => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'home-card home-card--playlist';
            card.setAttribute('aria-label', pl.nombre || 'Playlist');

            const thumb = document.createElement('div');
            thumb.className = 'home-card-thumb playlist-collage';
            const canciones = Array.isArray(pl.canciones) ? pl.canciones : [];
            const covers = canciones.slice(0, 4).map(c => {
                const local = findLocalItemByTitle(c.titulo);
                return local ? (local.querySelector('.thumbnail img')?.src || '') : (c.portada || '');
            });
            while (covers.length < 4) covers.push('');
            covers.forEach(cover => {
                const cell = document.createElement('div');
                cell.className = 'playlist-collage-cell';
                if (cover) {
                    const img = document.createElement('img');
                    img.src = cover; img.alt = ''; img.loading = 'lazy';
                    cell.appendChild(img);
                }
                thumb.appendChild(cell);
            });
            card.appendChild(thumb);

            const t = document.createElement('span');
            t.className = 'home-card-title';
            t.textContent = pl.nombre || 'Playlist';
            card.appendChild(t);

            const s = document.createElement('span');
            s.className = 'home-card-sub';
            const n = canciones.length;
            const isOwner = pl.uid === currentUid;
            s.textContent = (isOwner ? 'Tu playlist · ' : 'Pública · ')
                          + n + ' ' + (n === 1 ? 'canción' : 'canciones');
            card.appendChild(s);

            card.addEventListener('click', () => {
                if (navigator.vibrate) { try { navigator.vibrate(12); } catch (_) {} }
                openPublicPlaylistView(pl);
            });
            carousel.appendChild(card);
        });
    }

    function listenPublicPlaylists() {
        if (publicUnsubscribe) { publicUnsubscribe(); publicUnsubscribe = null; }
        publicUnsubscribe = firebase.firestore()
            .collection('mis_playlists')
            .where('privada', '==', false)
            .onSnapshot(snap => {
                const list = [];
                snap.forEach(doc => {
                    const d = doc.data() || {};
                    list.push({
                        id: doc.id,
                        uid: d.uid || '',
                        nombre: d.nombre || 'Playlist',
                        canciones: Array.isArray(d.canciones) ? d.canciones.slice() : []
                    });
                });
                list.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
                renderPublicPlaylists(list);
            }, err => {
                console.warn('⚠️ Error cargando playlists públicas:', err);
                renderPublicPlaylists([]);
            });
    }

    function wrapPlaylistViewForPermissions() {
        if (typeof window.__openPlaylistView !== 'function') return;
        if (window.__openPlaylistView.__publicPermWrapped) return;

        const orig = window.__openPlaylistView;
        const wrapped = function (pl) {
            const result = orig.apply(this, arguments);
            const shareBtn = document.getElementById('pv-share');
            if (shareBtn && pl && pl.esPublica) {
                shareBtn.style.display = '';
                if (pl.isOwner !== true) {
                    shareBtn.style.display = 'none';
                }
            }
            return result;
        };
        wrapped.__publicPermWrapped = true;
        window.__openPlaylistView = wrapped;
    }

    function init() {
        if (typeof firebase === 'undefined' || !firebase.auth) {
            setTimeout(init, 300);
            return;
        }
        wrapPlaylistViewForPermissions();

        firebase.auth().onAuthStateChanged(user => {
            if (user) {
                wrapPlaylistViewForPermissions();
                listenPublicPlaylists();
            } else {
                if (publicUnsubscribe) { publicUnsubscribe(); publicUnsubscribe = null; }
                renderPublicPlaylists([]);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

/* ============================================================
   24. MENSAJES DIRECTOS
   ============================================================ */
(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const MAIN_VIEWS = ['playlist-view', 'artist-profile', 'album-view', 'mi-playlist-view'];
    const MY_VIEWS   = ['mensajes-view', 'chat-view', 'newmsg-view'];
    const ALL_VIEWS  = MAIN_VIEWS.concat(MY_VIEWS);

    let currentUser = null;
    let currentChat = null;
    let currentAttachment = null;
    let unsubConversaciones = null;
    let unsubChatMessages = null;
    let allUsersCache = null;
    let allUsersPromise = null;
    let lastRenderedIds = '';

    function normalizeStr(s) {
        return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    }
    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }
    function makeConvId(uid1, uid2) {
        return [uid1, uid2].sort().join('__');
    }
    function timeAgo(date) {
        if (!date) return '';
        const diff = (Date.now() - date.getTime()) / 1000;
        if (diff < 60) return 'ahora';
        if (diff < 3600) return Math.floor(diff / 60) + 'm';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h';
        if (diff < 604800) return Math.floor(diff / 86400) + 'd';
        return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
    }
    function avatarHTML(u) {
        const name = (u && u.nombre) || 'U';
        const initial = name.trim()[0] ? name.trim()[0].toUpperCase() : '?';
        if (u && u.foto) {
            return '<img src="' + escapeHtml(u.foto) + '" alt="' + escapeHtml(name) + '" onerror="this.style.display=\'none\';this.parentNode.textContent=\'' + initial + '\';">';
        }
        return initial;
    }

    function closeOtherViews(except) {
        ALL_VIEWS.forEach(id => {
            if (id === except) return;
            const el = $(id);
            if (el && el.classList.contains('visible')) {
                el.classList.remove('visible');
                el.setAttribute('aria-hidden', 'true');
            }
        });
    }
    function openView(id) {
        closeOtherViews(id);
        const el = $(id);
        if (el) { el.classList.add('visible'); el.setAttribute('aria-hidden', 'false'); }
    }
    function closeView(id) {
        const el = $(id);
        if (el) { el.classList.remove('visible'); el.setAttribute('aria-hidden', 'true'); }
    }
    function watchOtherViews() {
        MAIN_VIEWS.forEach(id => {
            const el = $(id);
            if (!el || el.dataset.msgWatch === '1') return;
            el.dataset.msgWatch = '1';
            const obs = new MutationObserver((muts) => {
                for (const m of muts) {
                    if (m.attributeName === 'class' && el.classList.contains('visible')) {
                        MY_VIEWS.forEach(mid => closeView(mid));
                        break;
                    }
                }
            });
            obs.observe(el, { attributes: true, attributeFilter: ['class'] });
        });
    }

    async function loadAllUsers() {
        if (allUsersCache) return allUsersCache;
        if (allUsersPromise) return allUsersPromise;
        allUsersPromise = (async () => {
            const snap = await firebase.firestore().collection('historial_usuarios').limit(1000).get();
            const users = [];
            snap.forEach(doc => {
                const d = doc.data() || {};
                const nombre = d.nombre || d.name || d.displayName || '';
                const email = (d.email || '').toLowerCase();
                const foto = d.foto || d.photoURL || d.photoUrl || '';
                if (!nombre && !email) return;
                users.push({ uid: doc.id, nombre: nombre || (email ? email.split('@')[0] : 'Usuario'), email, foto });
            });
            allUsersCache = users;
            return users;
        })().catch(err => { allUsersPromise = null; throw err; });
        return allUsersPromise;
    }
    function filterUsers(users, q) {
        const me = currentUser ? currentUser.uid : '';
        const list = users.filter(u => u.uid !== me);
        const nq = normalizeStr(q);
        if (!nq) return list.slice(0, 60);
        return list.filter(u =>
            normalizeStr(u.nombre).includes(nq) ||
            normalizeStr(u.email).includes(nq)
        ).slice(0, 60);
    }

    function listenConversaciones() {
        if (unsubConversaciones) { unsubConversaciones(); unsubConversaciones = null; }
        if (!currentUser) return;
        unsubConversaciones = firebase.firestore()
            .collection('conversaciones')
            .where('participantes', 'array-contains', currentUser.uid)
            .onSnapshot(snap => {
                const convs = [];
                let totalUnread = 0;
                snap.forEach(doc => {
                    const d = doc.data() || {};
                    const otherUid = (d.participantes || []).find(u => u !== currentUser.uid);
                    if (!otherUid) return;
                    const info = (d.info && d.info[otherUid]) || {};
                    const noLeidos = (d.noLeidos && d.noLeidos[currentUser.uid]) || 0;
                    totalUnread += noLeidos;
                    const ultimo = d.ultimoMensaje || {};
                    convs.push({
                        id: doc.id,
                        otherUid,
                        otherName: info.nombre || 'Usuario',
                        otherFoto: info.foto || '',
                        ultimoTexto: ultimo.texto || '',
                        tieneCancion: !!ultimo.tieneCancion,
                        fecha: ultimo.fecha && typeof ultimo.fecha.toDate === 'function' ? ultimo.fecha.toDate() : null,
                        noLeidos
                    });
                });
                convs.sort((a, b) => (b.fecha ? b.fecha.getTime() : 0) - (a.fecha ? a.fecha.getTime() : 0));
                renderConversaciones(convs);
                updateBadge(totalUnread);
            }, err => {
                console.warn('Error cargando conversaciones:', err);
                renderConversaciones([]);
                updateBadge(0);
            });
    }
    function updateBadge(n) {
        const badge = $('msg-badge');
        if (!badge) return;
        if (!n || n <= 0) { badge.style.display = 'none'; badge.textContent = '0'; }
        else { badge.style.display = 'inline-flex'; badge.textContent = String(n > 99 ? '99+' : n); }
    }

    function renderConversaciones(convs) {
        const list = $('msg-list');
        const empty = $('msg-empty');
        if (!list) return;
        list.innerHTML = '';
        if (!convs.length) {
            if (empty) empty.style.display = '';
            return;
        }
        if (empty) empty.style.display = 'none';

        convs.forEach(c => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'msg-row';
            if (c.noLeidos > 0) btn.classList.add('msg-row--unread');

            const av = document.createElement('div');
            av.className = 'msg-row-avatar';
            av.innerHTML = avatarHTML({ nombre: c.otherName, foto: c.otherFoto });
            btn.appendChild(av);

            const info = document.createElement('div');
            info.className = 'msg-row-info';

            const top = document.createElement('div');
            top.className = 'msg-row-top';
            const nameEl = document.createElement('span');
            nameEl.className = 'msg-row-name';
            nameEl.textContent = c.otherName;
            top.appendChild(nameEl);
            const timeEl = document.createElement('span');
            timeEl.className = 'msg-row-time';
            timeEl.textContent = timeAgo(c.fecha);
            top.appendChild(timeEl);
            info.appendChild(top);

            const prev = document.createElement('div');
            prev.className = 'msg-row-preview';
            if (c.tieneCancion) {
                const songTag = document.createElement('span');
                songTag.className = 'msg-row-song-tag';
                songTag.textContent = '♪ ';
                prev.appendChild(songTag);
            }
            const txt = document.createElement('span');
            txt.textContent = c.ultimoTexto || (c.tieneCancion ? 'Te compartió una canción' : '');
            prev.appendChild(txt);
            info.appendChild(prev);
            btn.appendChild(info);

            if (c.noLeidos > 0) {
                const badge = document.createElement('span');
                badge.className = 'msg-row-badge';
                badge.textContent = String(c.noLeidos > 99 ? '99+' : c.noLeidos);
                btn.appendChild(badge);
            }

            btn.addEventListener('click', () => {
                openChat({ uid: c.otherUid, nombre: c.otherName, foto: c.otherFoto });
            });
            list.appendChild(btn);
        });
    }

    async function openChat(otherUser) {
        if (!currentUser || !otherUser) return;
        currentChat = otherUser;
        const convId = makeConvId(currentUser.uid, otherUser.uid);

        const av = $('chat-avatar');
        if (av) av.innerHTML = avatarHTML(otherUser);
        const un = $('chat-username');
        if (un) un.textContent = otherUser.nombre || 'Usuario';

        const msgs = $('chat-messages');
        if (msgs) msgs.innerHTML = '';
        lastRenderedIds = '';
        renderAttachment();

        openView('chat-view');
        setTimeout(scrollChatToBottom, 80);

        try { await ensureConversation(convId, otherUser); }
        catch (e) { console.warn('No se pudo crear conversación:', e); }

        if (unsubChatMessages) { unsubChatMessages(); unsubChatMessages = null; }
        unsubChatMessages = firebase.firestore()
            .collection('conversaciones').doc(convId)
            .collection('mensajes')
            .orderBy('fecha', 'asc')
            .onSnapshot(snap => {
                const arr = [];
                snap.forEach(doc => {
                    const d = doc.data() || {};
                    arr.push({
                        id: doc.id,
                        de: d.de,
                        texto: d.texto || '',
                        cancion: d.cancion || null,
                        fecha: d.fecha && typeof d.fecha.toDate === 'function' ? d.fecha.toDate() : null
                    });
                });
                renderChatMessages(arr);
                markConversationRead(convId);
            }, err => { console.warn('Error cargando mensajes:', err); });
    }

    async function ensureConversation(convId, otherUser) {
        const ref = firebase.firestore().collection('conversaciones').doc(convId);
        const snap = await ref.get();
        const info = {
            [currentUser.uid]: {
                nombre: currentUser.displayName || currentUser.email || 'Usuario',
                foto: currentUser.photoURL || ''
            },
            [otherUser.uid]: {
                nombre: otherUser.nombre || 'Usuario',
                foto: otherUser.foto || ''
            }
        };
        if (!snap.exists) {
            await ref.set({
                participantes: [currentUser.uid, otherUser.uid].sort(),
                info,
                noLeidos: { [currentUser.uid]: 0, [otherUser.uid]: 0 },
                ultimoMensaje: null,
                actualizado: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            const d = snap.data() || {};
            const existingInfo = d.info || {};
            const update = {};
            Object.keys(info).forEach(uid => {
                const oldInfo = existingInfo[uid] || {};
                if (oldInfo.nombre !== info[uid].nombre || oldInfo.foto !== info[uid].foto) {
                    update['info.' + uid] = info[uid];
                }
            });
            if (Object.keys(update).length) await ref.update(update);
        }
    }

    async function markConversationRead(convId) {
        if (!currentUser) return;
        try {
            await firebase.firestore().collection('conversaciones').doc(convId).update({
                ['noLeidos.' + currentUser.uid]: 0
            });
        } catch (e) {}
    }

    function renderChatMessages(messages) {
        const container = $('chat-messages');
        if (!container) return;
        const idsKey = messages.map(m => m.id).join('|');
        if (idsKey === lastRenderedIds) return;
        lastRenderedIds = idsKey;

        container.innerHTML = '';
        messages.forEach(m => {
            const isMine = m.de === currentUser.uid;
            const row = document.createElement('div');
            row.className = 'chat-row ' + (isMine ? 'chat-row--out' : 'chat-row--in');

            const bubble = document.createElement('div');
            bubble.className = 'chat-bubble ' + (isMine ? 'chat-bubble--out' : 'chat-bubble--in');

            if (m.cancion && m.cancion.audioUrl) {
                const song = document.createElement('button');
                song.type = 'button';
                song.className = 'chat-bubble-song';
                const thumb = document.createElement('div');
                thumb.className = 'chat-bubble-song-thumb';
                if (m.cancion.portada) {
                    const img = document.createElement('img');
                    img.src = m.cancion.portada;
                    img.alt = '';
                    img.loading = 'lazy';
                    thumb.appendChild(img);
                }
                song.appendChild(thumb);
                const info = document.createElement('div');
                info.className = 'chat-bubble-song-info';
                const t = document.createElement('span');
                t.className = 'chat-bubble-song-title';
                t.textContent = m.cancion.titulo || 'Canción';
                info.appendChild(t);
                const s = document.createElement('span');
                s.className = 'chat-bubble-song-sub';
                s.textContent = (m.cancion.artista || 'Artista') + ' · Toca para reproducir';
                info.appendChild(s);
                song.appendChild(info);
                song.addEventListener('click', () => playSharedSong(m.cancion));
                bubble.appendChild(song);
            }

            if (m.texto) {
                const txt = document.createElement('div');
                txt.className = 'chat-bubble-text';
                txt.textContent = m.texto;
                bubble.appendChild(txt);
            }

            const time = document.createElement('div');
            time.className = 'chat-bubble-time';
            time.textContent = m.fecha ? m.fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '';
            bubble.appendChild(time);

            row.appendChild(bubble);
            container.appendChild(row);
        });
        setTimeout(scrollChatToBottom, 40);
    }

    function scrollChatToBottom() {
        const scroll = $('chat-scroll');
        if (scroll) scroll.scrollTop = scroll.scrollHeight;
    }

    function playSharedSong(cancion) {
        if (!cancion || !cancion.audioUrl) return;
        const playlist = $('playlist');
        if (!playlist) return;
        const target = String(cancion.titulo || '').toLowerCase();
        for (const it of playlist.querySelectorAll('.playlist-item')) {
            const t = (it.querySelector('.item-title')?.textContent || '').trim().toLowerCase();
            if (t && t === target) { it.click(); return; }
        }
        const div = document.createElement('div');
        div.className = 'playlist-item';
        div.dataset.src = cancion.audioUrl;
        div.dataset.msgSong = '1';
        div.dataset.title = cancion.titulo || '';
        const cover = cancion.portada || 'https://via.placeholder.com/60/1a1a1a/666?text=%E2%99%AA';
        div.innerHTML =
            '<div class="thumbnail"><img src="' + escapeHtml(cover) + '" alt="Portada" loading="lazy"></div>' +
            '<div class="item-info">' +
                '<span class="item-title">' + escapeHtml(cancion.titulo || '') + '</span>' +
                '<span class="item-subtitle">' + escapeHtml(cancion.artista || 'Artista') + '</span>' +
            '</div>';
        const homeView = playlist.querySelector('#home-view');
        if (homeView) playlist.insertBefore(div, homeView.nextSibling);
        else playlist.insertBefore(div, playlist.firstChild);
        setTimeout(() => div.click(), 30);
    }

    async function sendMessage() {
        if (!currentUser || !currentChat) return;
        const input = $('chat-input');
        const texto = (input ? input.value : '').trim();
        const cancion = currentAttachment;
        if (!texto && !cancion) return;

        const convId = makeConvId(currentUser.uid, currentChat.uid);
        if (input) input.value = '';
        currentAttachment = null;
        renderAttachment();

        try { await ensureConversation(convId, currentChat); } catch (e) {}

        const payload = {
            de: currentUser.uid,
            texto: texto,
            cancion: cancion ? {
                titulo: cancion.titulo,
                artista: cancion.artista || '',
                portada: cancion.portada || '',
                audioUrl: cancion.audioUrl || ''
            } : null,
            fecha: firebase.firestore.FieldValue.serverTimestamp(),
            leido: false
        };

        try {
            const convRef = firebase.firestore().collection('conversaciones').doc(convId);
            await convRef.collection('mensajes').add(payload);
            await convRef.update({
                ultimoMensaje: {
                    texto: texto || (cancion ? '🎵 ' + (cancion.titulo || 'Canción') : ''),
                    de: currentUser.uid,
                    fecha: firebase.firestore.FieldValue.serverTimestamp(),
                    tieneCancion: !!cancion
                },
                ['noLeidos.' + currentChat.uid]: firebase.firestore.FieldValue.increment(1),
                ['noLeidos.' + currentUser.uid]: 0,
                actualizado: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (e) { console.warn('Error enviando mensaje:', e); }
    }

    function renderAttachment() {
        const wrap = $('chat-attachment');
        if (!wrap) return;
        if (!currentAttachment) { wrap.style.display = 'none'; wrap.innerHTML = ''; return; }
        wrap.style.display = '';
        wrap.innerHTML = '';
        const thumb = document.createElement('div');
        thumb.className = 'chat-attachment-thumb';
        if (currentAttachment.portada) {
            const img = document.createElement('img');
            img.src = currentAttachment.portada;
            img.alt = '';
            thumb.appendChild(img);
        }
        wrap.appendChild(thumb);
        const info = document.createElement('div');
        info.className = 'chat-attachment-info';
        const t = document.createElement('span');
        t.className = 'chat-attachment-title';
        t.textContent = currentAttachment.titulo || '';
        info.appendChild(t);
        const s = document.createElement('span');
        s.className = 'chat-attachment-sub';
        s.textContent = currentAttachment.artista || 'Artista';
        info.appendChild(s);
        wrap.appendChild(info);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'chat-attachment-remove';
        btn.setAttribute('aria-label', 'Quitar canción');
        btn.innerHTML = '&times;';
        btn.addEventListener('click', () => { currentAttachment = null; renderAttachment(); });
        wrap.appendChild(btn);
    }

    async function openNewMessageFlow() {
        openView('newmsg-view');
        const input = $('newmsg-input');
        if (input) input.value = '';
        const list = $('newmsg-list');
        if (list) list.innerHTML = '<div class="newmsg-empty">Escribe un nombre o correo para buscar</div>';
        loadAllUsers().catch(() => {});
    }

    function renderNewMessageList(users) {
        const list = $('newmsg-list');
        if (!list) return;
        list.innerHTML = '';
        if (!users.length) {
            const e = document.createElement('div');
            e.className = 'newmsg-empty';
            e.textContent = 'Sin resultados';
            list.appendChild(e);
            return;
        }
        users.forEach(u => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'newmsg-row';
            const av = document.createElement('div');
            av.className = 'newmsg-row-avatar';
            av.innerHTML = avatarHTML(u);
            btn.appendChild(av);
            const info = document.createElement('div');
            info.className = 'newmsg-row-info';
            const n = document.createElement('span');
            n.className = 'newmsg-row-name';
            n.textContent = u.nombre || 'Usuario';
            info.appendChild(n);
            const e = document.createElement('span');
            e.className = 'newmsg-row-email';
            e.textContent = u.email || '';
            info.appendChild(e);
            btn.appendChild(info);
            btn.addEventListener('click', () => {
                openChat({ uid: u.uid, nombre: u.nombre, foto: u.foto });
            });
            list.appendChild(btn);
        });
    }

    function injectFsMessageButton() {
        const fsActions = document.querySelector('.fs-actions');
        if (!fsActions) return false;
        if (document.getElementById('fs-message-btn')) return true;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'fs-message-btn';
        btn.className = 'fs-mode-btn';
        btn.setAttribute('aria-label', 'Enviar por mensaje');
        btn.innerHTML =
            '<svg viewBox="0 0 24 24" aria-hidden="true">' +
                '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>' +
            '</svg>' +
            '<span class="fs-mode-label">Mensaje</span>';

        const likeBtn = fsActions.querySelector('#fs-like');
        if (likeBtn) fsActions.insertBefore(btn, likeBtn);
        else fsActions.insertBefore(btn, fsActions.firstChild);

        btn.addEventListener('click', () => {
            const activeItem = document.querySelector('.playlist-item.active');
            if (!activeItem) return;
            const titleEl = activeItem.querySelector('.item-title');
            const subEl   = activeItem.querySelector('.item-subtitle');
            const imgEl   = activeItem.querySelector('.thumbnail img');
            const song = {
                titulo: (titleEl?.textContent || '').trim(),
                artista: (subEl?.textContent || '').split('·')[0].trim(),
                portada: imgEl?.src || '',
                audioUrl: activeItem.dataset.src || ''
            };
            if (!song.titulo || !song.audioUrl) return;
            currentAttachment = song;
            const fsPlayer = document.getElementById('fs-player');
            if (fsPlayer) {
                fsPlayer.classList.remove('visible');
                fsPlayer.setAttribute('aria-hidden', 'true');
            }
            openNewMessageFlow();
        });
        return true;
    }

    function setupMenuLink() {
        const link = $('mensajes-link');
        if (!link || link.dataset.msgReady === '1') return;
        link.dataset.msgReady = '1';
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sm = $('submenu');
            const so = $('submenu-overlay');
            if (sm) sm.classList.remove('visible');
            if (so) so.classList.remove('visible');
            openView('mensajes-view');
        });
    }

    function init() {
        if (typeof firebase === 'undefined' || !firebase.auth) {
            setTimeout(init, 300);
            return;
        }
        setupMenuLink();
        watchOtherViews();

        const msgBack = $('msg-back');
        if (msgBack) msgBack.addEventListener('click', () => closeView('mensajes-view'));
        const msgNew = $('msg-new-btn');
        if (msgNew) msgNew.addEventListener('click', () => {
            currentAttachment = null;
            renderAttachment();
            openNewMessageFlow();
        });

        const newmsgBack = $('newmsg-back');
        if (newmsgBack) newmsgBack.addEventListener('click', () => {
            currentAttachment = null;
            renderAttachment();
            closeView('newmsg-view');
        });

        const newmsgInput = $('newmsg-input');
        if (newmsgInput) {
            let deb = null;
            newmsgInput.addEventListener('input', () => {
                if (deb) clearTimeout(deb);
                const q = newmsgInput.value.trim();
                if (!q) {
                    const list = $('newmsg-list');
                    if (list) list.innerHTML = '<div class="newmsg-empty">Escribe un nombre o correo para buscar</div>';
                    return;
                }
                deb = setTimeout(async () => {
                    try {
                        const users = await loadAllUsers();
                        renderNewMessageList(filterUsers(users, q));
                    } catch (e) {}
                }, 100);
            });
        }

        const chatBack = $('chat-back');
        if (chatBack) chatBack.addEventListener('click', () => {
            closeView('chat-view');
            if (unsubChatMessages) { unsubChatMessages(); unsubChatMessages = null; }
            currentChat = null;
            currentAttachment = null;
            renderAttachment();
        });

        const chatSend = $('chat-send');
        if (chatSend) chatSend.addEventListener('click', sendMessage);
        const chatInput = $('chat-input');
        if (chatInput) {
            chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); sendMessage(); }
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            if ($('chat-view')?.classList.contains('visible')) {
                closeView('chat-view');
                if (unsubChatMessages) { unsubChatMessages(); unsubChatMessages = null; }
                currentChat = null;
                currentAttachment = null;
                renderAttachment();
            } else if ($('newmsg-view')?.classList.contains('visible')) {
                closeView('newmsg-view');
                currentAttachment = null;
                renderAttachment();
            } else if ($('mensajes-view')?.classList.contains('visible')) {
                closeView('mensajes-view');
            }
        });

        let attempts = 0;
        (function retry() {
            attempts++;
            if (injectFsMessageButton()) return;
            if (attempts < 40) setTimeout(retry, 250);
        })();

        firebase.auth().onAuthStateChanged(user => {
            currentUser = user;
            if (user) {
                listenConversaciones();
            } else {
                if (unsubConversaciones) { unsubConversaciones(); unsubConversaciones = null; }
                if (unsubChatMessages) { unsubChatMessages(); unsubChatMessages = null; }
                renderConversaciones([]);
                updateBadge(0);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.__msgOpenChat = openChat;
})();

/* ============================================================
   25. REFUERZO: Refresco directo de la lista de conversaciones
   ============================================================ */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }
    function ago(d) {
        if (!d) return '';
        const s = (Date.now() - d.getTime()) / 1000;
        if (s < 60) return 'ahora';
        if (s < 3600) return Math.floor(s / 60) + 'm';
        if (s < 86400) return Math.floor(s / 3600) + 'h';
        if (s < 604800) return Math.floor(s / 86400) + 'd';
        return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
    }
    function avatar(u) {
        const n = (u && u.nombre) || 'U';
        const i = n.trim()[0] ? n.trim()[0].toUpperCase() : '?';
        if (u && u.foto) {
            return '<img src="' + esc(u.foto) + '" alt="" onerror="this.style.display=\'none\';this.parentNode.textContent=\'' + i + '\';">';
        }
        return i;
    }

    async function refresh() {
        const user = firebase.auth().currentUser;
        if (!user) return;
        try {
            const snap = await firebase.firestore()
                .collection('conversaciones')
                .where('participantes', 'array-contains', user.uid)
                .get();
            console.log('🔄 [MSG-FIX] Conversaciones encontradas:', snap.size);

            const list = $('msg-list');
            const empty = $('msg-empty');
            if (!list) return;
            list.innerHTML = '';
            if (snap.empty) {
                if (empty) empty.style.display = '';
                return;
            }
            if (empty) empty.style.display = 'none';

            const convs = [];
            let totalUnread = 0;
            snap.forEach(doc => {
                const d = doc.data() || {};
                const otherUid = (d.participantes || []).find(u => u !== user.uid);
                if (!otherUid) return;
                const info = (d.info && d.info[otherUid]) || {};
                const noLeidos = (d.noLeidos && d.noLeidos[user.uid]) || 0;
                totalUnread += noLeidos;
                const ult = d.ultimoMensaje || {};
                convs.push({
                    otherUid,
                    otherName: info.nombre || 'Usuario',
                    otherFoto: info.foto || '',
                    ultimoTexto: ult.texto || '',
                    tieneCancion: !!ult.tieneCancion,
                    fecha: ult.fecha && typeof ult.fecha.toDate === 'function' ? ult.fecha.toDate() : null,
                    noLeidos
                });
            });
            convs.sort((a, b) => (b.fecha ? b.fecha.getTime() : 0) - (a.fecha ? a.fecha.getTime() : 0));

            convs.forEach(c => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'msg-row';
                if (c.noLeidos > 0) btn.classList.add('msg-row--unread');

                const av = document.createElement('div');
                av.className = 'msg-row-avatar';
                av.innerHTML = avatar({ nombre: c.otherName, foto: c.otherFoto });
                btn.appendChild(av);

                const info = document.createElement('div');
                info.className = 'msg-row-info';
                const top = document.createElement('div');
                top.className = 'msg-row-top';
                const nm = document.createElement('span');
                nm.className = 'msg-row-name';
                nm.textContent = c.otherName;
                top.appendChild(nm);
                const tm = document.createElement('span');
                tm.className = 'msg-row-time';
                tm.textContent = ago(c.fecha);
                top.appendChild(tm);
                info.appendChild(top);
                const pv = document.createElement('div');
                pv.className = 'msg-row-preview';
                if (c.tieneCancion) {
                    const tag = document.createElement('span');
                    tag.className = 'msg-row-song-tag';
                    tag.textContent = '♪ ';
                    pv.appendChild(tag);
                }
                const txt = document.createElement('span');
                txt.textContent = c.ultimoTexto || (c.tieneCancion ? 'Te compartió una canción' : '');
                pv.appendChild(txt);
                info.appendChild(pv);
                btn.appendChild(info);
                if (c.noLeidos > 0) {
                    const b = document.createElement('span');
                    b.className = 'msg-row-badge';
                    b.textContent = String(c.noLeidos > 99 ? '99+' : c.noLeidos);
                    btn.appendChild(b);
                }
                btn.addEventListener('click', () => {
                    if (typeof window.__msgOpenChat === 'function') {
                        window.__msgOpenChat({ uid: c.otherUid, nombre: c.otherName, foto: c.otherFoto });
                    }
                });
                list.appendChild(btn);
            });

            const badge = $('msg-badge');
            if (badge) {
                if (totalUnread > 0) {
                    badge.style.display = 'inline-flex';
                    badge.textContent = String(totalUnread > 99 ? '99+' : totalUnread);
                } else {
                    badge.style.display = 'none';
                    badge.textContent = '0';
                }
            }
        } catch (err) {
            console.warn('⚠️ [MSG-FIX] Error:', err && err.code, err && err.message);
            if (err && err.code === 'permission-denied') {
                console.warn('👉 Revisa las reglas de Firestore para la colección "conversaciones". Debe permitir leer a los participantes.');
            }
        }
    }

    function init() {
        if (typeof firebase === 'undefined' || !firebase.auth) { setTimeout(init, 300); return; }
        const view = document.getElementById('mensajes-view');
        if (!view || view.dataset.msgFix === '1') return;
        view.dataset.msgFix = '1';

        let last = 0;
        const obs = new MutationObserver(muts => {
            for (const m of muts) {
                if (m.attributeName !== 'class') continue;
                if (!view.classList.contains('visible')) continue;
                const now = Date.now();
                if (now - last < 700) break;
                last = now;
                console.log('👀 [MSG-FIX] Vista Mensajes abierta → refrescando lista');
                refresh();
                break;
            }
        });
        obs.observe(view, { attributes: true, attributeFilter: ['class'] });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

/* ============================================================
   26. NOTIFICACIONES DE MENSAJES (badge + historial persistente)
   ============================================================ */
(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);

    let unsubBadge    = null;
    let currentUid    = null;
    let lastUnread    = 0;
    let badgeDebounce = null;

    function paintBadge(total) {
        const badge = $('msg-badge');
        if (!badge) return;
        const n = Math.max(0, Number(total) || 0);

        if (n === 0) {
            badge.style.display = 'none';
            badge.textContent   = '0';
        } else {
            badge.style.display = 'inline-flex';
            badge.textContent   = n > 99 ? '99+' : String(n);
        }

        if (lastUnread > 0 && n === 0) {
            badge.style.display = 'none';
        }
        lastUnread = n;
    }

    async function computeAndPaintBadge() {
        if (!currentUid) { paintBadge(0); return; }
        try {
            const snap = await firebase.firestore()
                .collection('conversaciones')
                .where('participantes', 'array-contains', currentUid)
                .get();
            let total = 0;
            snap.forEach(doc => {
                const d = doc.data() || {};
                total += (d.noLeidos && d.noLeidos[currentUid]) || 0;
            });
            paintBadge(total);
        } catch (e) {
            console.warn('[MSG-NOTIF] Fallback error:', e && e.code);
        }
    }

    function listenBadge() {
        if (unsubBadge) { unsubBadge(); unsubBadge = null; }
        if (!currentUid) { paintBadge(0); return; }

        unsubBadge = firebase.firestore()
            .collection('conversaciones')
            .where('participantes', 'array-contains', currentUid)
            .onSnapshot(snap => {
                let total = 0;
                let lastMsgInfo = null;

                snap.forEach(doc => {
                    const d = doc.data() || {};
                    const unread = (d.noLeidos && d.noLeidos[currentUid]) || 0;
                    total += unread;
                    
                    if (unread > 0) {
                        const otherUid = (d.participantes || []).find(u => u !== currentUid);
                        const info = (d.info && d.info[otherUid]) || {};
                        const ult = d.ultimoMensaje || {};
                        lastMsgInfo = {
                            nombre: info.nombre || 'Usuario',
                            texto: ult.texto || (ult.tieneCancion ? 'Te compartió una canción' : 'Nuevo mensaje')
                        };
                    }
                });

                if (total > lastUnread && lastUnread > 0 && lastMsgInfo) {
                    const chatView = $('chat-view');
                    const usernameEl = $('chat-username');
                    let isChatOpen = false;
                    
                    if (chatView && chatView.classList.contains('visible') && usernameEl) {
                        const activeName = (usernameEl.textContent || '').trim().toLowerCase();
                        if (activeName && lastMsgInfo.nombre.toLowerCase() === activeName) {
                            isChatOpen = true;
                        }
                    }

                    if (!isChatOpen) {
                        var bridge = window.NativeBridge || window.AndroidBridge;
                        if (bridge && typeof bridge.avisarMensajeNuevo === 'function') {
                            try {
                                bridge.avisarMensajeNuevo(lastMsgInfo.nombre, lastMsgInfo.texto);
                            } catch(e) { console.warn('Error enviando notificación nativa:', e); }
                        }
                    }
                }

                paintBadge(total);

                if (total > 0) markOpenConversationRead();
            }, err => {
                console.warn('[MSG-NOTIF] Listener falló:', err && err.code);
                computeAndPaintBadge();
            });
    }

    async function markOpenConversationRead() {
        const chatView = $('chat-view');
        if (!chatView || !chatView.classList.contains('visible')) return;
        if (!currentUid) return;

        const usernameEl = $('chat-username');
        if (!usernameEl) return;
        const activeName = (usernameEl.textContent || '').trim().toLowerCase();
        if (!activeName) return;

        try {
            const snap = await firebase.firestore()
                .collection('conversaciones')
                .where('participantes', 'array-contains', currentUid)
                .get();

            const tasks = [];
            snap.forEach(doc => {
                const d = doc.data() || {};
                const otherUid = (d.participantes || []).find(u => u !== currentUid);
                if (!otherUid) return;
                const info = (d.info && d.info[otherUid]) || {};
                const name = (info.nombre || '').trim().toLowerCase();
                const noLeidos = (d.noLeidos && d.noLeidos[currentUid]) || 0;
                if (name === activeName && noLeidos > 0) {
                    tasks.push(
                        doc.ref.update({ ['noLeidos.' + currentUid]: 0 })
                            .catch(() => {})
                    );
                }
            });

            if (tasks.length) {
                await Promise.all(tasks);
            }
        } catch (e) {
            // silencioso
        }
    }

    function watchViews() {
        const chatView = $('chat-view');
        if (chatView && chatView.dataset.badgeWatch !== '1') {
            chatView.dataset.badgeWatch = '1';
            const obs = new MutationObserver(() => {
                if (chatView.classList.contains('visible')) {
                    clearTimeout(badgeDebounce);
                    badgeDebounce = setTimeout(markOpenConversationRead, 250);
                }
            });
            obs.observe(chatView, { attributes: true, attributeFilter: ['class'] });
        }

        const mensajesView = $('mensajes-view');
        if (mensajesView && mensajesView.dataset.badgeWatch !== '1') {
            mensajesView.dataset.badgeWatch = '1';
            const obs = new MutationObserver(() => {
                if (mensajesView.classList.contains('visible')) {
                    computeAndPaintBadge();
                }
            });
            obs.observe(mensajesView, { attributes: true, attributeFilter: ['class'] });
        }

        const submenu = $('submenu');
        if (submenu && submenu.dataset.badgeWatch !== '1') {
            submenu.dataset.badgeWatch = '1';
            const obs = new MutationObserver(() => {
                if (submenu.classList.contains('visible')) {
                    computeAndPaintBadge();
                }
            });
            obs.observe(submenu, { attributes: true, attributeFilter: ['class'] });
        }
    }

    function init() {
        if (typeof firebase === 'undefined' || !firebase.auth) {
            setTimeout(init, 300);
            return;
        }

        firebase.auth().onAuthStateChanged(user => {
            currentUid = user ? user.uid : null;
            if (user) {
                listenBadge();
                computeAndPaintBadge();
            } else {
                if (unsubBadge) { unsubBadge(); unsubBadge = null; }
                paintBadge(0);
            }
        });

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                computeAndPaintBadge();
            }
        });

        window.addEventListener('focus', () => computeAndPaintBadge());

        watchViews();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

/* ============================================================
   27. ELIMINAR / LIMPIAR CONVERSACIONES (long-press 2s)
   ============================================================ */
(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const LONG_PRESS_MS = 2000;

    let longPressTimer   = null;
    let suppressNextClick = false;

    let activeMenu = null;
    let selectionMode = false;
    const selectedConvIds = new Set();

    let assignTimer = null;

    function haptic(ms) {
        if (navigator.vibrate) { try { navigator.vibrate(ms || 15); } catch (_) {} }
    }
    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    const style = document.createElement('style');
    style.id = 'conv-clean-styles';
    style.textContent = `
        .conv-menu-backdrop {
            position: fixed; inset: 0;
            background: rgba(0,0,0,0.72);
            z-index: 10500;
            display: flex; align-items: center; justify-content: center;
            padding: 20px;
            opacity: 0; visibility: hidden;
            transition: opacity 0.2s ease, visibility 0.2s ease;
            backdrop-filter: blur(3px);
        }
        .conv-menu-backdrop.visible { opacity: 1; visibility: visible; }

        .conv-menu {
            width: 100%; max-width: 340px;
            background: #141414;
            border: 1px solid #262626;
            border-radius: 16px;
            overflow: hidden;
            transform: scale(0.94);
            transition: transform 0.25s cubic-bezier(0.22,1,0.36,1);
        }
        .conv-menu-backdrop.visible .conv-menu { transform: scale(1); }

        .conv-menu-title {
            padding: 16px 18px 10px;
            font-size: 12.5px; font-weight: 800;
            letter-spacing: 1.4px;
            text-transform: uppercase;
            color: #ff2a2a;
            text-align: center;
            border-bottom: 1px solid #1f1f1f;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .conv-menu-btn {
            display: flex; align-items: center; gap: 12px;
            width: 100%; padding: 16px 18px;
            background: none; border: none;
            color: #ffffff; font-family: inherit;
            font-size: 15px; font-weight: 700;
            text-align: left; cursor: pointer;
            border-bottom: 1px solid #1f1f1f;
        }
        .conv-menu-btn:last-child { border-bottom: none; }
        .conv-menu-btn:active { background: #1f1f1f; }
        .conv-menu-btn.danger { color: #ff5757; }
        .conv-menu-btn svg { flex-shrink: 0; }
        .conv-menu-cancel {
            display: block; width: 100%;
            padding: 14px 18px;
            background: #1a1a1a; border: none;
            color: #b3b3b3; font-family: inherit;
            font-size: 14px; font-weight: 700;
            cursor: pointer;
        }
        .conv-menu-cancel:active { background: #262626; }

        .msg-row.selecting { padding-left: 52px !important; }
        .msg-row .msg-row-select {
            position: absolute; left: 14px; top: 50%;
            transform: translateY(-50%);
            width: 22px; height: 22px;
            border-radius: 50%;
            border: 2px solid #555;
            background: transparent;
            display: flex; align-items: center; justify-content: center;
            pointer-events: none;
            box-sizing: border-box;
            transition: background 0.15s ease, border-color 0.15s ease;
        }
        .msg-row.msg-row-selected { background: rgba(255,42,42,0.10) !important; }
        .msg-row.msg-row-selected .msg-row-select {
            background: #ff2a2a; border-color: #ff2a2a;
        }
        .msg-row.msg-row-selected .msg-row-select::after {
            content: '';
            width: 10px; height: 6px;
            border-left: 2px solid #fff;
            border-bottom: 2px solid #fff;
            transform: rotate(-45deg) translate(1px, -1px);
        }
        .msg-row.selecting { cursor: pointer; }

        .conv-clean-bar {
            position: absolute;
            left: 0; right: 0; bottom: 0;
            background: #141414;
            border-top: 1px solid #262626;
            padding: 12px 16px;
            display: flex; gap: 10px;
            align-items: center;
            z-index: 55;
            transform: translateY(110%);
            transition: transform 0.3s cubic-bezier(0.22,1,0.36,1);
            box-shadow: 0 -8px 26px rgba(0,0,0,0.7);
        }
        .conv-clean-bar.visible { transform: translateY(0); }

        .conv-clean-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .conv-clean-count { font-size: 14px; font-weight: 800; color: #ffffff; }
        .conv-clean-hint  { font-size: 11.5px; color: #999999; }

        .conv-clean-btn {
            flex-shrink: 0;
            border: none; border-radius: 50px;
            padding: 12px 18px;
            font-family: inherit;
            font-size: 13px; font-weight: 800;
            cursor: pointer;
            white-space: nowrap;
        }
        .conv-clean-btn.cancel  { background: #262626; color: #ffffff; }
        .conv-clean-btn.confirm { background: #ff2a2a; color: #ffffff; box-shadow: 0 6px 18px rgba(255,42,42,0.35); }
        .conv-clean-btn.confirm:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }
        .conv-clean-btn:active:not(:disabled) { transform: scale(0.95); }

        .conv-confirm-box {
            width: 100%; max-width: 340px;
            background: #141414;
            border: 1px solid #262626;
            border-radius: 16px;
            padding: 22px 20px 18px;
            text-align: center;
            transform: scale(0.94);
            transition: transform 0.25s cubic-bezier(0.22,1,0.36,1);
        }
        .conv-menu-backdrop.visible .conv-confirm-box { transform: scale(1); }
        .conv-confirm-title { font-size: 17px; font-weight: 800; color: #ffffff; margin-bottom: 8px; }
        .conv-confirm-sub { font-size: 13.5px; color: #b3b3b3; line-height: 1.4; margin-bottom: 18px; }
        .conv-confirm-actions { display: flex; gap: 10px; }
        .conv-confirm-actions button {
            flex: 1; border: none;
            border-radius: 50px;
            padding: 13px 16px;
            font-family: inherit;
            font-size: 14px; font-weight: 800;
            cursor: pointer;
        }
        .conv-confirm-actions .no  { background: #262626; color: #ffffff; }
        .conv-confirm-actions .yes { background: #ff2a2a; color: #ffffff; box-shadow: 0 6px 18px rgba(255,42,42,0.35); }
        .conv-confirm-actions button:active { transform: scale(0.96); }
    `;
    if (!document.getElementById('conv-clean-styles')) document.head.appendChild(style);

    async function assignConvIdsToRows() {
        const user = firebase.auth().currentUser;
        if (!user) return;
        const list = $('msg-list');
        if (!list) return;
        const rows = Array.from(list.querySelectorAll('.msg-row'));
        if (!rows.length) return;

        try {
            const snap = await firebase.firestore()
                .collection('conversaciones')
                .where('participantes', 'array-contains', user.uid)
                .get();

            const convs = [];
            snap.forEach(doc => {
                const d = doc.data() || {};
                const otherUid = (d.participantes || []).find(u => u !== user.uid);
                if (!otherUid) return;
                const info = (d.info && d.info[otherUid]) || {};
                const ult  = d.ultimoMensaje || {};
                const fecha = ult.fecha && typeof ult.fecha.toDate === 'function'
                    ? ult.fecha.toDate() : null;
                convs.push({
                    id: doc.id,
                    otherUid,
                    otherName: info.nombre || 'Usuario',
                    fecha
                });
            });
            convs.sort((a, b) =>
                (b.fecha ? b.fecha.getTime() : 0) - (a.fecha ? a.fecha.getTime() : 0)
            );

            const used = new Set();
            rows.forEach(row => {
                const nameEl = row.querySelector('.msg-row-name');
                const name = (nameEl ? nameEl.textContent : '').trim().toLowerCase();
                let match = convs.find(c =>
                    !used.has(c.id) &&
                    (c.otherName || '').trim().toLowerCase() === name
                );
                if (!match) match = convs.find(c => !used.has(c.id));
                if (match) {
                    used.add(match.id);
                    row.dataset.convId   = match.id;
                    row.dataset.otherUid = match.otherUid;
                    row.dataset.otherName = match.otherName;
                }
            });
        } catch (e) {
            console.warn('[CONV-CLEAN] No se pudieron mapear conversaciones:', e);
        }
    }
    function scheduleAssign() {
        if (assignTimer) clearTimeout(assignTimer);
        assignTimer = setTimeout(assignConvIdsToRows, 120);
    }

    function closeMenu() {
        if (activeMenu && activeMenu.parentNode) activeMenu.parentNode.removeChild(activeMenu);
        activeMenu = null;
    }

    function showConvMenu(row, onDeleteSingle, onCleanMode) {
        closeMenu();
        const otherName = row.dataset.otherName || 'esta conversación';

        const backdrop = document.createElement('div');
        backdrop.className = 'conv-menu-backdrop';
        backdrop.innerHTML = `
            <div class="conv-menu" role="dialog" aria-modal="true">
                <div class="conv-menu-title">${escapeHtml(otherName)}</div>
                <button type="button" class="conv-menu-btn danger" data-action="delete">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
                         stroke="currentColor" stroke-width="2"
                         stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                    <span>Eliminar</span>
                </button>
                <button type="button" class="conv-menu-btn" data-action="clean">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
                         stroke="currentColor" stroke-width="2"
                         stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <line x1="10" y1="11" x2="10" y2="17"/>
                        <line x1="14" y1="11" x2="14" y2="17"/>
                        <line x1="3" y1="3" x2="21" y2="21"/>
                    </svg>
                    <span>Limpiar tu ventana</span>
                </button>
                <button type="button" class="conv-menu-cancel" data-action="cancel">Cancelar</button>
            </div>
        `;
        document.body.appendChild(backdrop);
        activeMenu = backdrop;
        requestAnimationFrame(() => backdrop.classList.add('visible'));

        backdrop.addEventListener('click', (e) => {
            const t = e.target.closest('[data-action]');
            if (!t) {
                if (e.target === backdrop) closeMenu();
                return;
            }
            const action = t.dataset.action;
            closeMenu();
            if (action === 'delete') onDeleteSingle();
            else if (action === 'clean') onCleanMode();
        });
    }

    function showConfirm(title, message, onYes) {
        closeMenu();
        const backdrop = document.createElement('div');
        backdrop.className = 'conv-menu-backdrop';
        backdrop.innerHTML = `
            <div class="conv-confirm-box" role="dialog" aria-modal="true">
                <div class="conv-confirm-title">${escapeHtml(title)}</div>
                <div class="conv-confirm-sub">${escapeHtml(message)}</div>
                <div class="conv-confirm-actions">
                    <button type="button" class="no"  data-action="no">Cancelar</button>
                    <button type="button" class="yes" data-action="yes">Eliminar</button>
                </div>
            </div>
        `;
        document.body.appendChild(backdrop);
        activeMenu = backdrop;
        requestAnimationFrame(() => backdrop.classList.add('visible'));

        backdrop.addEventListener('click', (e) => {
            const t = e.target.closest('[data-action]');
            if (!t) {
                if (e.target === backdrop) closeMenu();
                return;
            }
            const action = t.dataset.action;
            closeMenu();
            if (action === 'yes') { try { onYes(); } catch (_) {} }
        });
    }

    async function deleteConversations(convIds) {
        const tasks = convIds.map(id => (async () => {
            try {
                const ref = firebase.firestore().collection('conversaciones').doc(id);
                try {
                    const msgs = await ref.collection('mensajes').limit(500).get();
                    if (!msgs.empty) {
                        const batch = firebase.firestore().batch();
                        msgs.forEach(m => batch.delete(m.ref));
                        await batch.commit();
                    }
                } catch (e) { }
                await ref.delete();
            } catch (e) {
                console.warn('[CONV-CLEAN] Error al eliminar', id, e);
            }
        })());
        await Promise.all(tasks);
    }

    function enterSelectionMode() {
        const view = $('mensajes-view');
        const list = $('msg-list');
        if (!view || !list) return;
        selectionMode = true;
        selectedConvIds.clear();
        suppressNextClick = true;

        list.querySelectorAll('.msg-row').forEach(row => {
            row.classList.add('selecting');
            row.classList.remove('msg-row-selected');
            if (!row.querySelector('.msg-row-select')) {
                const check = document.createElement('span');
                check.className = 'msg-row-select';
                row.insertBefore(check, row.firstChild);
            }
        });

        addCleanBar();
        updateSelectionUI();
    }

    function exitSelectionMode() {
        selectionMode = false;
        selectedConvIds.clear();
        const list = $('msg-list');
        if (list) {
            list.querySelectorAll('.msg-row').forEach(row => {
                row.classList.remove('selecting', 'msg-row-selected');
                const c = row.querySelector('.msg-row-select');
                if (c) c.remove();
            });
        }
        removeCleanBar();
    }

    function addCleanBar() {
        removeCleanBar();
        const view = $('mensajes-view');
        if (!view) return;
        const bar = document.createElement('div');
        bar.className = 'conv-clean-bar';
        bar.id = 'conv-clean-bar';
        bar.innerHTML = `
            <div class="conv-clean-info">
                <div class="conv-clean-count" id="conv-clean-count">0 seleccionadas</div>
                <div class="conv-clean-hint">Toca para seleccionar</div>
            </div>
            <button type="button" class="conv-clean-btn cancel"  id="conv-clean-cancel">Cancelar</button>
            <button type="button" class="conv-clean-btn confirm" id="conv-clean-confirm" disabled>Eliminar</button>
        `;
        view.appendChild(bar);
        requestAnimationFrame(() => bar.classList.add('visible'));

        bar.querySelector('#conv-clean-cancel').addEventListener('click', () => {
            exitSelectionMode();
        });
        bar.querySelector('#conv-clean-confirm').addEventListener('click', () => {
            if (!selectedConvIds.size) return;
            const n = selectedConvIds.size;
            const ids = Array.from(selectedConvIds);
            showConfirm(
                '¿Eliminar conversaciones?',
                `Se eliminarán ${n} ${n === 1 ? 'conversación' : 'conversaciones'}. Esta acción no se puede deshacer.`,
                async () => {
                    exitSelectionMode();
                    await deleteConversations(ids);
                    const list = $('msg-list');
                    if (list) {
                        list.querySelectorAll('.msg-row').forEach(r => {
                            if (ids.includes(r.dataset.convId)) r.remove();
                        });
                    }
                    setTimeout(assignConvIdsToRows, 500);
                }
            );
        });
    }
    function removeCleanBar() {
        const bar = $('conv-clean-bar');
        if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
    }

    function updateSelectionUI() {
        const count   = $('conv-clean-count');
        const confirm = $('conv-clean-confirm');
        const n = selectedConvIds.size;
        if (count)   count.textContent = n + (n === 1 ? ' seleccionada' : ' seleccionadas');
        if (confirm) confirm.disabled = n === 0;
    }

    function toggleRowSelection(row, id) {
        if (selectedConvIds.has(id)) {
            selectedConvIds.delete(id);
            row.classList.remove('msg-row-selected');
        } else {
            selectedConvIds.add(id);
            row.classList.add('msg-row-selected');
        }
        updateSelectionUI();
        haptic(8);
    }

    function handleRowClickCapture(e) {
        const row = e.target.closest('.msg-row');
        if (!row) return;

        if (suppressNextClick) {
            e.stopPropagation();
            e.preventDefault();
            suppressNextClick = false;
            return;
        }
        if (selectionMode) {
            e.stopPropagation();
            e.preventDefault();
            const id = row.dataset.convId;
            if (id) {
                toggleRowSelection(row, id);
            } else {
                assignConvIdsToRows().then(() => {
                    const newId = row.dataset.convId;
                    if (newId) toggleRowSelection(row, newId);
                });
            }
        }
    }

    function onPointerDown(e) {
        if (selectionMode) return;
        const row = e.target.closest('.msg-row');
        if (!row) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;

        const startX = e.clientX, startY = e.clientY;

        if (longPressTimer) clearTimeout(longPressTimer);
        longPressTimer = setTimeout(async () => {
            longPressTimer = null;
            if (!row.dataset.convId) await assignConvIdsToRows();
            const convId   = row.dataset.convId;
            const otherUid = row.dataset.otherUid;
            if (!convId) return;

            haptic(25);
            suppressNextClick = true;

            showConvMenu(
                row,
                () => {
                    const name = row.dataset.otherName || 'esta conversación';
                    showConfirm(
                        '¿Eliminar conversación?',
                        `Se eliminará la conversación con ${name}. Esta acción no se puede deshacer.`,
                        async () => {
                            await deleteConversations([convId]);
                            if (row.parentNode) row.remove();
                            setTimeout(assignConvIdsToRows, 500);
                        }
                    );
                },
                () => { enterSelectionMode(); }
            );
        }, LONG_PRESS_MS);

        function moveHandler(ev) {
            if (Math.abs(ev.clientX - startX) > 10 ||
                Math.abs(ev.clientY - startY) > 10) {
                cancelLongPress();
                cleanup();
            }
        }
        function upHandler() { cancelLongPress(); cleanup(); }
        function cleanup() {
            document.removeEventListener('pointermove', moveHandler);
            document.removeEventListener('pointerup', upHandler);
            document.removeEventListener('pointercancel', upHandler);
        }
        document.addEventListener('pointermove', moveHandler);
        document.addEventListener('pointerup', upHandler);
        document.addEventListener('pointercancel', upHandler);
    }

    function cancelLongPress() {
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    }

    function observeMsgList() {
        const list = $('msg-list');
        if (!list) { setTimeout(observeMsgList, 300); return; }
        if (list.dataset.convCleanReady === '1') return;
        list.dataset.convCleanReady = '1';

        list.addEventListener('pointerdown', onPointerDown, true);
        list.addEventListener('click',       handleRowClickCapture, true);

        const obs = new MutationObserver((muts) => {
            let changed = false;
            muts.forEach(m => {
                m.addedNodes.forEach(n => {
                    if (n.nodeType !== 1) return;
                    if (n.classList && n.classList.contains('msg-row')) changed = true;
                    else if (n.querySelectorAll && n.querySelectorAll('.msg-row').length) changed = true;
                });
            });
            if (changed) {
                if (selectionMode) {
                    list.querySelectorAll('.msg-row').forEach(row => {
                        if (!row.classList.contains('selecting')) {
                            row.classList.add('selecting');
                            if (!row.querySelector('.msg-row-select')) {
                                const check = document.createElement('span');
                                check.className = 'msg-row-select';
                                row.insertBefore(check, row.firstChild);
                            }
                        }
                    });
                }
                scheduleAssign();
            }
        });
        obs.observe(list, { childList: true, subtree: true });

        const view = $('mensajes-view');
        if (view && view.dataset.convCleanView !== '1') {
            view.dataset.convCleanView = '1';
            const obsV = new MutationObserver(() => {
                if (view.classList.contains('visible')) {
                    scheduleAssign();
                } else if (selectionMode) {
                    exitSelectionMode();
                }
            });
            obsV.observe(view, { attributes: true, attributeFilter: ['class'] });
        }

        setTimeout(assignConvIdsToRows, 200);
    }

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (activeMenu) {
            e.stopPropagation(); e.preventDefault();
            closeMenu();
            return;
        }
        if (selectionMode) {
            e.stopPropagation(); e.preventDefault();
            exitSelectionMode();
        }
    }, true);

    function init() {
        if (typeof firebase === 'undefined' || !firebase.auth) {
            setTimeout(init, 300);
            return;
        }
        observeMsgList();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

/* ============================================================
   28. TOKEN FCM → Guardar en Firestore
   ============================================================ */
(function () {
    'use strict';

    window.recibirTokenFCM = async function (token) {
        if (!token) return;
        const user = firebase.auth().currentUser;
        if (!user) {
            window.__pendingFCMToken = token;
            return;
        }
        try {
            await firebase.firestore()
                .collection('historial_usuarios')
                .doc(user.uid)
                .set({ fcmToken: token }, { merge: true });
            console.log('✅ Token FCM guardado en Firestore');
        } catch (e) {
            console.warn('⚠️ No se pudo guardar el token FCM:', e);
        }
    };

    firebase.auth().onAuthStateChanged(user => {
        if (user && window.__pendingFCMToken) {
            window.recibirTokenFCM(window.__pendingFCMToken);
            window.__pendingFCMToken = null;
        }
    });
})();

/* ============================================================
   29. EDITAR / PERSONALIZAR NOMBRE DE USUARIO
   ============================================================ */
(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);

    let usersCacheForNames = null;
    let usersLoadingPromise = null;
    let currentName = '';
    let checkToken = 0;

    function normalizeName(str) {
        return String(str || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function validateName(name) {
        const trimmed = String(name || '').trim();
        if (!trimmed)                       return { ok: false, msg: 'Escribe un nombre.' };
        if (trimmed.length < 3)             return { ok: false, msg: 'Mínimo 3 caracteres.' };
        if (trimmed.length > 30)            return { ok: false, msg: 'Máximo 30 caracteres.' };
        const validRegex = /^[\p{L}\p{N}\s._\-]+$/u;
        if (!validRegex.test(trimmed)) {
            return { ok: false, msg: 'Solo letras, números, espacios, . _ -' };
        }
        return { ok: true, value: trimmed };
    }

    async function loadAllUsersForNames() {
        if (usersCacheForNames) return usersCacheForNames;
        if (usersLoadingPromise) return usersLoadingPromise;
        usersLoadingPromise = (async () => {
            const snap = await firebase.firestore()
                .collection('historial_usuarios').limit(1500).get();
            const users = [];
            snap.forEach(doc => {
                const d = doc.data() || {};
                const nombre = d.nombre || d.name || d.displayName || '';
                const nombreLower = d.nombre_lower || normalizeName(nombre);
                users.push({ uid: doc.id, nombre, nombreLower });
            });
            usersCacheForNames = users;
            return users;
        })().catch(err => { usersLoadingPromise = null; throw err; });
        return usersLoadingPromise;
    }

    async function isNameAvailable(name) {
        const user = firebase.auth().currentUser;
        if (!user) return false;
        const target = normalizeName(name);
        if (!target) return false;

        try {
            const snap = await firebase.firestore()
                .collection('historial_usuarios')
                .where('nombre_lower', '==', target)
                .limit(5)
                .get();
            let taken = false;
            snap.forEach(doc => { if (doc.id !== user.uid) taken = true; });
            if (taken) return false;
            if (!snap.empty) return true;
        } catch (e) { }

        try {
            const users = await loadAllUsersForNames();
            for (const u of users) {
                if (u.uid === user.uid) continue;
                const cmp = u.nombreLower || normalizeName(u.nombre);
                if (cmp === target) return false;
            }
        } catch (e) { }

        return true;
    }

    function updateStatus(msg, type) {
        const status = $('name-modal-status');
        if (!status) return;
        status.textContent = msg || '';
        status.classList.remove('ok', 'error', 'checking');
        if (type === 'ok')            status.classList.add('ok');
        else if (type === 'error')    status.classList.add('error');
        else if (type === 'checking') status.classList.add('checking');
    }
    function setSaveEnabled(enabled) {
        const btn = $('name-modal-confirm');
        if (btn) btn.disabled = !enabled;
    }

    async function checkAndValidate(name) {
        const token = ++checkToken;
        const validation = validateName(name);
        if (!validation.ok) {
            updateStatus(validation.msg, 'error');
            setSaveEnabled(false);
            return;
        }
        const trimmed = validation.value;
        if (normalizeName(trimmed) === normalizeName(currentName)) {
            updateStatus('Es tu nombre actual.', 'error');
            setSaveEnabled(false);
            return;
        }
        updateStatus('Comprobando disponibilidad…', 'checking');
        setSaveEnabled(false);
        try {
            const available = await isNameAvailable(trimmed);
            if (token !== checkToken) return;
            if (!available) {
                updateStatus('❌ Ese nombre no está disponible.', 'error');
                setSaveEnabled(false);
            } else {
                updateStatus('✅ Nombre disponible.', 'ok');
                setSaveEnabled(true);
            }
        } catch (e) {
            updateStatus('Error al verificar. Intenta de nuevo.', 'error');
            setSaveEnabled(false);
        }
    }

    function openModal() {
        const modal = $('name-modal');
        const input = $('name-modal-input');
        if (!modal || !input) return;
        const user = firebase.auth().currentUser;
        if (!user) return;

        const nombreEl = $('submenu-user-name');
        currentName = (nombreEl ? nombreEl.textContent : '').trim() || '';
        if (!currentName || currentName === 'Cargando usuario...') {
            currentName = user.displayName || (user.email ? user.email.split('@')[0] : '') || '';
        }

        input.value = currentName;
        updateStatus('', '');
        setSaveEnabled(false);

        modal.classList.add('visible');
        modal.setAttribute('aria-hidden', 'false');
        setTimeout(() => { input.focus(); input.select(); }, 180);
    }

    function closeModal() {
        const modal = $('name-modal');
        if (!modal) return;
        modal.classList.remove('visible');
        modal.setAttribute('aria-hidden', 'true');
        setSaveEnabled(false);
        updateStatus('', '');
    }

    async function saveName() {
        const user = firebase.auth().currentUser;
        if (!user) return;
        const input = $('name-modal-input');
        const confirmBtn = $('name-modal-confirm');
        if (!input) return;

        const validation = validateName(input.value);
        if (!validation.ok) {
            updateStatus(validation.msg, 'error');
            return;
        }
        const newName = validation.value;

        if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = 'Guardando…'; }
        updateStatus('Guardando…', 'checking');

        try {
            const nombreLower = normalizeName(newName);

            const available = await isNameAvailable(newName);
            if (!available) {
                updateStatus('❌ Ese nombre no está disponible.', 'error');
                if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'Guardar'; }
                return;
            }

            try {
                await user.updateProfile({ displayName: newName });
            } catch (e) { console.warn('No se pudo actualizar displayName:', e); }

            await firebase.firestore()
                .collection('historial_usuarios')
                .doc(user.uid)
                .set({ nombre: newName, nombre_lower: nombreLower }, { merge: true });

            try {
                const convSnap = await firebase.firestore()
                    .collection('conversaciones')
                    .where('participantes', 'array-contains', user.uid)
                    .get();
                const tasks = [];
                convSnap.forEach(doc => {
                    tasks.push(
                        doc.ref.update({ ['info.' + user.uid + '.nombre']: newName })
                            .catch(() => {})
                    );
                });
                if (tasks.length) await Promise.all(tasks);
            } catch (e) { console.warn('No se pudieron actualizar conversaciones:', e); }

            applyNewNameEverywhere(newName);

            usersCacheForNames = null;
            usersLoadingPromise = null;
            try { loadAllUsersForNames(); } catch (_) {}

            updateStatus('✅ Nombre actualizado.', 'ok');
            setTimeout(closeModal, 900);

        } catch (e) {
            console.error('Error al guardar nombre:', e);
            updateStatus('Error al guardar. Intenta de nuevo.', 'error');
        } finally {
            if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'Guardar'; }
        }
    }

    function applyNewNameEverywhere(newName) {
        const sideEl = $('submenu-user-name');
        if (sideEl) sideEl.textContent = newName;

        const modalInput = $('name-modal-input');
        if (modalInput) modalInput.value = newName;

        currentName = newName;
    }

    function init() {
        if (typeof firebase === 'undefined' || !firebase.auth) { setTimeout(init, 300); return; }

        const link     = $('edit-name-link');
        const modal    = $('name-modal');
        const input    = $('name-modal-input');
        const closeBtn = $('name-modal-close');
        const cancel   = $('name-modal-cancel');
        const backdrop = $('name-modal-backdrop');
        const confirm  = $('name-modal-confirm');
        if (!modal || !input || !confirm) { setTimeout(init, 300); return; }

        if (link && link.dataset.editNameReady !== '1') {
            link.dataset.editNameReady = '1';
            link.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const sm = $('submenu');
                const so = $('submenu-overlay');
                if (sm) sm.classList.remove('visible');
                if (so) so.classList.remove('visible');
                setTimeout(openModal, 120);
            });
        }
        if (closeBtn && closeBtn.dataset.editNameReady !== '1') {
            closeBtn.dataset.editNameReady = '1';
            closeBtn.addEventListener('click', closeModal);
        }
        if (cancel && cancel.dataset.editNameReady !== '1') {
            cancel.dataset.editNameReady = '1';
            cancel.addEventListener('click', closeModal);
        }
        if (backdrop && backdrop.dataset.editNameReady !== '1') {
            backdrop.dataset.editNameReady = '1';
            backdrop.addEventListener('click', closeModal);
        }
        if (confirm && confirm.dataset.editNameReady !== '1') {
            confirm.dataset.editNameReady = '1';
            confirm.addEventListener('click', saveName);
        }
        if (input.dataset.editNameReady !== '1') {
            input.dataset.editNameReady = '1';
            let deb = null;
            input.addEventListener('input', () => {
                if (deb) clearTimeout(deb);
                const val = input.value;
                deb = setTimeout(() => checkAndValidate(val), 320);
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!confirm.disabled) saveName();
                }
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('visible')) {
                e.stopPropagation();
                closeModal();
            }
        }, true);

        loadAllUsersForNames().catch(() => {});
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

/* ============================================================
   30. ESTADO "VISTO" EN MENSAJES
   ============================================================ */
(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);

    let currentConvId    = null;
    let currentOtherUid  = null;
    let unsubSeen        = null;
    let chatDomObserver  = null;
    let lastMessagesData = [];
    let isMarking        = false;
    let applyTimer       = null;

    function normalizeName(s) {
        return String(s || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
    }

    function makeConvId(a, b) {
        return [a, b].sort().join('__');
    }

    async function findUidByName(name) {
        if (!name) return null;
        try {
            const snap = await firebase.firestore()
                .collection('historial_usuarios').limit(1500).get();
            const target = normalizeName(name);
            for (const doc of snap.docs) {
                const d = doc.data() || {};
                const n = normalizeName(d.nombre || d.name || d.displayName || '');
                if (n && n === target) return doc.id;
            }
        } catch (e) { console.warn('[VISTO] Error buscando usuario:', e); }
        return null;
    }

    async function markOthersAsSeen() {
        const user = firebase.auth().currentUser;
        if (!user || !currentConvId || isMarking) return;
        isMarking = true;
        try {
            const msgsRef = firebase.firestore()
                .collection('conversaciones').doc(currentConvId)
                .collection('mensajes');
            const snap = await msgsRef.get();
            if (snap.empty) { isMarking = false; return; }

            const batch = firebase.firestore().batch();
            let count = 0;
            snap.forEach(doc => {
                const d = doc.data() || {};
                if (d.de !== user.uid && d.visto !== true) {
                    batch.update(doc.ref, { visto: true });
                    count++;
                }
            });
            if (count > 0) {
                await batch.commit();
                console.log('[VISTO] ' + count + ' mensajes marcados como vistos');
            }
        } catch (e) {
            console.warn('[VISTO] Error al marcar como visto:', e);
        } finally {
            isMarking = false;
        }
    }

    function applySeenMarks() {
        const container = $('chat-messages');
        const user = firebase.auth().currentUser;
        if (!container || !user) return;

        const outRows = Array.from(container.querySelectorAll('.chat-row--out'));
        if (!outRows.length) return;

        const myMsgs = lastMessagesData.filter(m => m.de === user.uid);

        const total = Math.min(outRows.length, myMsgs.length);
        for (let i = 0; i < total; i++) {
            const row = outRows[outRows.length - 1 - i];
            const msg = myMsgs[myMsgs.length - 1 - i];
            if (!row || !msg) continue;

            const bubble = row.querySelector('.chat-bubble');
            if (!bubble) continue;

            const txtEl = bubble.querySelector('.chat-bubble-text');
            const bubbleText = (txtEl ? txtEl.textContent : '').trim();
            const msgText = (msg.texto || '').trim();
            const bubbleHasSong = !!bubble.querySelector('.chat-bubble-song');
            const msgHasSong = !!(msg.cancion && msg.cancion.audioUrl);

            const textMatches = !bubbleText && !msgText ? true : bubbleText === msgText;
            const songMatches = bubbleHasSong === msgHasSong;

            if (!textMatches && !songMatches) continue;

            let mark = bubble.querySelector('.chat-seen-mark');
            if (msg.visto === true) {
                if (!mark) {
                    mark = document.createElement('div');
                    mark.className = 'chat-seen-mark';
                    bubble.appendChild(mark);
                }
                mark.textContent = '✓✓ Visto';
            } else {
                if (mark) mark.remove();
            }
        }
    }

    function scheduleApplySeenMarks(delay) {
        if (applyTimer) clearTimeout(applyTimer);
        applyTimer = setTimeout(() => {
            applyTimer = null;
            applySeenMarks();
        }, delay || 60);
    }

    function listenMessagesForSeen() {
        if (unsubSeen) { unsubSeen(); unsubSeen = null; }
        if (!currentConvId) return;

        unsubSeen = firebase.firestore()
            .collection('conversaciones').doc(currentConvId)
            .collection('mensajes')
            .orderBy('fecha', 'asc')
            .onSnapshot(snap => {
                const user = firebase.auth().currentUser;
                if (!user) return;

                const arr = [];
                const toMark = [];

                snap.forEach(doc => {
                    const d = doc.data() || {};
                    arr.push({
                        id: doc.id,
                        de: d.de,
                        texto: d.texto || '',
                        cancion: d.cancion || null,
                        visto: d.visto === true
                    });
                    if (d.de !== user.uid && d.visto !== true) {
                        toMark.push(doc.ref);
                    }
                });

                lastMessagesData = arr;

                scheduleApplySeenMarks(50);
                scheduleApplySeenMarks(250);

                if (toMark.length > 0) {
                    const batch = firebase.firestore().batch();
                    toMark.forEach(ref => batch.update(ref, { visto: true }));
                    batch.commit().catch(() => {});
                }
            }, err => {
                console.warn('[VISTO] Listener error:', err);
            });
    }

    function observeChatDom() {
        const container = $('chat-messages');
        if (!container || chatDomObserver) return;

        chatDomObserver = new MutationObserver(() => {
            if (!currentConvId) return;
            scheduleApplySeenMarks(60);
        });
        chatDomObserver.observe(container, { childList: true, subtree: true });
    }

    function watchChatView() {
        const chatView = $('chat-view');
        if (!chatView) { setTimeout(watchChatView, 300); return; }
        if (chatView.dataset.seenWatch === '1') return;
        chatView.dataset.seenWatch = '1';

        let lastVisible = false;

        const obs = new MutationObserver(async () => {
            const visible = chatView.classList.contains('visible');
            if (visible === lastVisible) return;
            lastVisible = visible;

            if (visible) {
                const user = firebase.auth().currentUser;
                if (!user) return;

                const nameEl = $('chat-username');
                const otherName = (nameEl ? nameEl.textContent : '').trim();
                if (!otherName || otherName === 'Usuario') return;

                const uid = await findUidByName(otherName);
                if (!uid) return;

                currentOtherUid = uid;
                currentConvId = makeConvId(user.uid, uid);

                console.log('[VISTO] Chat abierto con "' + otherName + '" → convId:', currentConvId);

                await markOthersAsSeen();
                listenMessagesForSeen();
                observeChatDom();

                scheduleApplySeenMarks(200);
                scheduleApplySeenMarks(600);
                scheduleApplySeenMarks(1200);

            } else {
                if (unsubSeen) { unsubSeen(); unsubSeen = null; }
                currentConvId = null;
                currentOtherUid = null;
                lastMessagesData = [];
            }
        });
        obs.observe(chatView, { attributes: true, attributeFilter: ['class'] });
    }

    function init() {
        if (typeof firebase === 'undefined' || !firebase.auth) {
            setTimeout(init, 300);
            return;
        }
        watchChatView();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

/* ============================================================
   31. CHAT ESTILO WHATSAPP / MESSENGER
   ============================================================ */
(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);

    let autoScroll = true;
    let chatObserver = null;
    let isBound = false;

    function isNearBottom(el, threshold) {
        if (!el) return true;
        const t = typeof threshold === 'number' ? threshold : 100;
        return (el.scrollHeight - el.scrollTop - el.clientHeight) <= t;
    }

    function scrollToBottom() {
        const scroll = $('chat-scroll');
        if (!scroll) return;
        try {
            scroll.scrollTop = scroll.scrollHeight;
        } catch (_) {}
    }

    function forceScrollWithRetries() {
        scrollToBottom();
        requestAnimationFrame(() => {
            scrollToBottom();
            requestAnimationFrame(scrollToBottom);
        });
        setTimeout(scrollToBottom, 50);
        setTimeout(scrollToBottom, 150);
        setTimeout(scrollToBottom, 350);
        setTimeout(scrollToBottom, 600);
    }

    function bindScrollListener() {
        const scroll = $('chat-scroll');
        if (!scroll || scroll.dataset.waScroll === '1') return;
        scroll.dataset.waScroll = '1';
        scroll.addEventListener('scroll', () => {
            autoScroll = isNearBottom(scroll, 120);
        }, { passive: true });
    }

    function bindMessagesObserver() {
        const container = $('chat-messages');
        if (!container || chatObserver) return;

        chatObserver = new MutationObserver(() => {
            const view = $('chat-view');
            if (!view || !view.classList.contains('visible')) return;
            if (!autoScroll) return;
            forceScrollWithRetries();
        });
        chatObserver.observe(container, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    function bindImageLoader() {
        const container = $('chat-messages');
        if (!container || container.dataset.waImgs === '1') return;
        container.dataset.waImgs = '1';

        container.addEventListener('load', (e) => {
            if (e.target && e.target.tagName === 'IMG' && autoScroll) {
                scrollToBottom();
            }
        }, true);
    }

    function bindViewportResize() {
        const handler = () => {
            if (autoScroll) setTimeout(scrollToBottom, 80);
        };
        window.addEventListener('resize', handler);
        if (window.visualViewport) {
            try { window.visualViewport.addEventListener('resize', handler); } catch (_) {}
        }
    }

    function bindComposer() {
        const btn = $('chat-send');
        if (btn && btn.dataset.waSend !== '1') {
            btn.dataset.waSend = '1';
            btn.addEventListener('click', () => {
                autoScroll = true;
                setTimeout(scrollToBottom, 60);
                setTimeout(scrollToBottom, 200);
                setTimeout(scrollToBottom, 450);
            });
        }
        const input = $('chat-input');
        if (input && input.dataset.waSend !== '1') {
            input.dataset.waSend = '1';
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    autoScroll = true;
                    setTimeout(scrollToBottom, 60);
                    setTimeout(scrollToBottom, 200);
                    setTimeout(scrollToBottom, 450);
                }
            });
        }
    }

    function watchChatView() {
        const view = $('chat-view');
        if (!view) { setTimeout(watchChatView, 300); return; }
        if (view.dataset.waView === '1') return;
        view.dataset.waView = '1';

        let lastVisible = false;
        const obs = new MutationObserver(() => {
            const visible = view.classList.contains('visible');
            if (visible === lastVisible) return;
            lastVisible = visible;

            if (visible) {
                autoScroll = true;
                bindScrollListener();
                bindMessagesObserver();
                bindImageLoader();
                bindComposer();
                forceScrollWithRetries();
            } else {
                autoScroll = true;
            }
        });
        obs.observe(view, { attributes: true, attributeFilter: ['class'] });
    }

    function init() {
        if (isBound) return;
        isBound = true;
        watchChatView();
        bindViewportResize();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

/* ============================================================
   32. PRIVACIDAD DEL CORREO
   ============================================================ */
(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);

    let privacyCache = new Map();
    let cacheLoading = null;
    let privacidadActual = false;

    async function cargarCachePrivacidad(force) {
        if (!force && privacyCache.size > 0) return privacyCache;
        if (cacheLoading && !force) return cacheLoading;
        cacheLoading = (async () => {
            try {
                const snap = await firebase.firestore()
                    .collection('historial_usuarios').limit(2000).get();
                privacyCache = new Map();
                snap.forEach(doc => {
                    const d = doc.data() || {};
                    const email = (d.email || '').toLowerCase();
                    if (email) {
                        privacyCache.set(email, {
                            uid: doc.id,
                            privado: d.email_privado === true
                        });
                    }
                });
            } catch (e) {
                console.warn('[PRIVACIDAD] Error cargando cache:', e);
            } finally {
                cacheLoading = null;
            }
            return privacyCache;
        })();
        return cacheLoading;
    }

    function ocultarEmailsPrivados(root) {
        if (!root) return;

        root.querySelectorAll('.share-user-row').forEach(row => {
            const sub = row.querySelector('.share-user-sub');
            if (!sub) return;
            const original = sub.textContent || '';
            const textoNorm = original.toLowerCase();

            let modificado = original;
            privacyCache.forEach((info, email) => {
                if (info.privado && email && textoNorm.includes(email)) {
                    modificado = modificado.replace(new RegExp(email, 'gi'), '🔒 Correo privado');
                }
            });
            if (modificado !== original) {
                sub.innerHTML = modificado
                    .replace(/🔒 Correo privado/g, '<span class="email-hidden-badge">🔒 Correo privado</span>');
            }
        });

        root.querySelectorAll('.newmsg-row').forEach(row => {
            const emailEl = row.querySelector('.newmsg-row-email');
            if (!emailEl) return;
            const texto = (emailEl.textContent || '').trim().toLowerCase();
            if (!texto) return;
            const info = privacyCache.get(texto);
            if (info && info.privado) {
                emailEl.innerHTML = '<span class="email-hidden-badge">🔒 Correo privado</span>';
            }
        });
    }

    function aplicarFiltroEnVistas() {
        const shareResults = $('share-modal-results');
        if (shareResults) ocultarEmailsPrivados(shareResults);
        const shareRecent = $('share-modal-recent');
        if (shareRecent) ocultarEmailsPrivados(shareRecent);
        const newmsgList = $('newmsg-list');
        if (newmsgList) ocultarEmailsPrivados(newmsgList);
    }

    function observarBuscadores() {
        const shareResults = $('share-modal-results');
        if (shareResults && shareResults.dataset.privObs !== '1') {
            shareResults.dataset.privObs = '1';
            const obs = new MutationObserver(() => ocultarEmailsPrivados(shareResults));
            obs.observe(shareResults, { childList: true, subtree: true });
        }
        const shareRecent = $('share-modal-recent');
        if (shareRecent && shareRecent.dataset.privObs !== '1') {
            shareRecent.dataset.privObs = '1';
            const obs = new MutationObserver(() => ocultarEmailsPrivados(shareRecent));
            obs.observe(shareRecent, { childList: true, subtree: true });
        }
        const newmsgList = $('newmsg-list');
        if (newmsgList && newmsgList.dataset.privObs !== '1') {
            newmsgList.dataset.privObs = '1';
            const obs = new MutationObserver(() => ocultarEmailsPrivados(newmsgList));
            obs.observe(newmsgList, { childList: true, subtree: true });
        }
    }

    function inyectarBloquePrivacidad() {
        const modal = $('name-modal');
        if (!modal) return false;
        const box = modal.querySelector('.mp-modal-box');
        if (!box) return false;
        if (box.querySelector('.name-email-privacy')) return true;

        const bloque = document.createElement('div');
        bloque.className = 'name-email-privacy';
        bloque.innerHTML = `
            <span class="name-email-privacy-label">Privacidad del correo</span>
            <div class="name-email-privacy-options">
                <button type="button" class="name-email-privacy-btn" data-value="publico">Público</button>
                <button type="button" class="name-email-privacy-btn" data-value="privado">Privado</button>
            </div>
            <span class="name-email-privacy-hint">
                Público: otros verán tu correo · Privado: otros no verán tu correo.
            </span>
        `;

        const status = box.querySelector('#name-modal-status');
        const actions = box.querySelector('.mp-modal-actions');
        if (status) {
            box.insertBefore(bloque, status);
        } else if (actions) {
            box.insertBefore(bloque, actions);
        } else {
            box.appendChild(bloque);
        }

        bloque.querySelectorAll('.name-email-privacy-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const value = btn.dataset.value;
                const esPrivado = value === 'privado';
                if (esPrivado === privacidadActual) return;
                setBotonActivo(esPrivado);
                await guardarPrivacidad(esPrivado);
            });
        });

        return true;
    }

    function setBotonActivo(esPrivado) {
        privacidadActual = esPrivado;
        const modal = $('name-modal');
        if (!modal) return;
        modal.querySelectorAll('.name-email-privacy-btn').forEach(btn => {
            const val = btn.dataset.value;
            const active = (val === 'privado' && esPrivado) || (val === 'publico' && !esPrivado);
            btn.classList.toggle('active', active);
        });
    }

    async function cargarPrivacidadActual() {
        const user = firebase.auth().currentUser;
        if (!user) return false;
        try {
            const doc = await firebase.firestore()
                .collection('historial_usuarios').doc(user.uid).get();
            const d = doc.exists ? (doc.data() || {}) : {};
            privacidadActual = d.email_privado === true;
        } catch (e) {
            console.warn('[PRIVACIDAD] Error leyendo:', e);
            privacidadActual = false;
        }
        setBotonActivo(privacidadActual);
        return privacidadActual;
    }

    async function guardarPrivacidad(esPrivado) {
        const user = firebase.auth().currentUser;
        if (!user) return;
        try {
            await firebase.firestore()
                .collection('historial_usuarios').doc(user.uid)
                .set({ email_privado: !!esPrivado }, { merge: true });
            console.log('✅ [PRIVACIDAD] Guardado: email_privado =', esPrivado);

            await cargarCachePrivacidad(true);
            aplicarFiltroEnVistas();

            const status = $('name-modal-status');
            if (status) {
                status.textContent = esPrivado
                    ? '🔒 Correo ahora es privado'
                    : '🌐 Correo ahora es público';
                status.classList.remove('error');
                status.classList.add('ok');
                setTimeout(() => {
                    if (status.textContent.includes('Correo ahora')) {
                        status.textContent = '';
                        status.classList.remove('ok');
                    }
                }, 1800);
            }
        } catch (e) {
            console.warn('[PRIVACIDAD] Error guardando:', e);
            const status = $('name-modal-status');
            if (status) {
                status.textContent = 'No se pudo guardar la privacidad.';
                status.classList.remove('ok');
                status.classList.add('error');
            }
        }
    }

    function observarModal() {
        const modal = $('name-modal');
        if (!modal) { setTimeout(observarModal, 300); return; }
        if (modal.dataset.privWatch === '1') return;
        modal.dataset.privWatch = '1';

        const obs = new MutationObserver(async () => {
            if (modal.classList.contains('visible')) {
                inyectarBloquePrivacidad();
                await cargarCachePrivacidad(false);
                await cargarPrivacidadActual();
                aplicarFiltroEnVistas();
            }
        });
        obs.observe(modal, { attributes: true, attributeFilter: ['class'] });
    }

    function observarVistasBuscadores() {
        const shareModal = $('share-modal');
        if (shareModal && shareModal.dataset.privWatchView !== '1') {
            shareModal.dataset.privWatchView = '1';
            const obs = new MutationObserver(async () => {
                if (shareModal.classList.contains('visible')) {
                    await cargarCachePrivacidad(false);
                    observarBuscadores();
                    setTimeout(aplicarFiltroEnVistas, 150);
                    setTimeout(aplicarFiltroEnVistas, 500);
                }
            });
            obs.observe(shareModal, { attributes: true, attributeFilter: ['class'] });
        }
        const newmsgView = $('newmsg-view');
        if (newmsgView && newmsgView.dataset.privWatchView !== '1') {
            newmsgView.dataset.privWatchView = '1';
            const obs = new MutationObserver(async () => {
                if (newmsgView.classList.contains('visible')) {
                    await cargarCachePrivacidad(false);
                    observarBuscadores();
                    setTimeout(aplicarFiltroEnVistas, 150);
                    setTimeout(aplicarFiltroEnVistas, 500);
                }
            });
            obs.observe(newmsgView, { attributes: true, attributeFilter: ['class'] });
        }
    }

    function init() {
        if (typeof firebase === 'undefined' || !firebase.auth) {
            setTimeout(init, 300);
            return;
        }

        firebase.auth().onAuthStateChanged(user => {
            if (user) {
                cargarCachePrivacidad(true).catch(() => {});
                observarModal();
                observarVistasBuscadores();
            } else {
                privacyCache = new Map();
                privacidadActual = false;
            }
        });

        if (firebase.auth().currentUser) {
            cargarCachePrivacidad(true).catch(() => {});
            observarModal();
            observarVistasBuscadores();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

/* ============================================================
   33. BÚSQUEDA POR GÉNERO Y PLAYLISTS PÚBLICAS
   ============================================================ */
(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);

    let publicPlaylistsCache = null;
    let cachePromise = null;
    let searchObserver = null;
    let debounceTimer = null;
    let lastRenderedQ = '';

    let genreMapFromFirestore = new Map();
    let genreMapLoading = null;
    let genreMapLoadedOnce = false;

    function normalizeStr(s) {
        return String(s || '').toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');
    }

    function getItemTitle(item) {
        return item.querySelector('.item-title')?.textContent.trim() || '';
    }
    function getItemSubtitle(item) {
        return item.querySelector('.item-subtitle')?.textContent.trim() || '';
    }
    function getItemCover(item) {
        return item.querySelector('.thumbnail img')?.src || '';
    }

    function getGenreFromDom(item) {
        const sub = item.querySelector('.item-subtitle')?.textContent || '';
        const idx = sub.indexOf('·');
        if (idx === -1) return '';
        const genre = sub.slice(idx + 1).trim();
        if (!genre) return '';
        const lower = genre.toLowerCase();
        if (lower === 'subido' || lower === 'subidos') return '';
        return genre;
    }

    function getItemGenre(item) {
        const fromDom = getGenreFromDom(item);
        if (fromDom) return fromDom;

        if (genreMapFromFirestore.size > 0) {
            const title = getItemTitle(item);
            const key = normalizeStr(title);
            if (key && genreMapFromFirestore.has(key)) {
                return genreMapFromFirestore.get(key);
            }
        }
        return '';
    }

    async function cargarGenerosDesdeFirestore(force) {
        if (!force && genreMapLoadedOnce) return genreMapFromFirestore;
        if (genreMapLoading && !force) return genreMapLoading;

        genreMapLoading = (async () => {
            const map = new Map();

            function pickGenre(d) {
                return d.genero || d['género'] || d.genre ||
                       d.categoria || d.category || d.tipo || '';
            }

            try {
                const snap = await firebase.firestore()
                    .collection('canciones_usuarios').limit(500).get();
                snap.forEach(doc => {
                    const d = doc.data() || {};
                    const titulo = d.titulo || '';
                    const genero = pickGenre(d);
                    if (titulo && genero) {
                        map.set(normalizeStr(titulo), String(genero).trim());
                    }
                });
            } catch (e) {
                console.warn('[BUSCADOR-GÉNERO] canciones_usuarios:', e);
            }

            try {
                const snap = await firebase.firestore()
                    .collectionGroup('canciones').limit(500).get();
                snap.forEach(doc => {
                    const d = doc.data() || {};
                    if (d.origen && d.origen !== 'dropbox') return;
                    const titulo = d.titulo || '';
                    const genero = pickGenre(d);
                    if (titulo && genero) {
                        map.set(normalizeStr(titulo), String(genero).trim());
                    }
                });
            } catch (e) {
                console.warn('[BUSCADOR-GÉNERO] collectionGroup canciones:', e);
            }

            genreMapFromFirestore = map;
            genreMapLoadedOnce = true;
            genreMapLoading = null;
            console.log('[BUSCADOR-GÉNERO] Géneros cargados:', map.size);
            return map;
        })();

        return genreMapLoading;
    }

    async function cargarPlaylistsPublicas(force) {
        if (!force && publicPlaylistsCache) return publicPlaylistsCache;
        if (cachePromise && !force) return cachePromise;
        cachePromise = (async () => {
            try {
                const snap = await firebase.firestore()
                    .collection('mis_playlists')
                    .where('privada', '==', false)
                    .limit(300)
                    .get();
                const list = [];
                snap.forEach(doc => {
                    const d = doc.data() || {};
                    list.push({
                        id: doc.id,
                        uid: d.uid || '',
                        nombre: d.nombre || 'Playlist',
                        canciones: Array.isArray(d.canciones) ? d.canciones : []
                    });
                });
                publicPlaylistsCache = list;
            } catch (e) {
                console.warn('[BUSCADOR] Error cargando playlists públicas:', e);
                publicPlaylistsCache = [];
            } finally {
                cachePromise = null;
            }
            return publicPlaylistsCache;
        })();
        return cachePromise;
    }

    function buildSongRow(item) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'search-row';

        const thumb = document.createElement('div');
        thumb.className = 'search-row-thumb';
        const cover = getItemCover(item);
        if (cover) {
            const img = document.createElement('img');
            img.src = cover;
            img.alt = getItemTitle(item);
            img.loading = 'lazy';
            thumb.appendChild(img);
        }
        btn.appendChild(thumb);

        const info = document.createElement('div');
        info.className = 'search-row-info';

        const title = document.createElement('span');
        title.className = 'search-row-title';
        title.textContent = getItemTitle(item);
        info.appendChild(title);

        const sub = document.createElement('span');
        sub.className = 'search-row-sub';
        sub.textContent = getItemSubtitle(item);
        info.appendChild(sub);

        btn.appendChild(info);

        const play = document.createElement('span');
        play.className = 'search-row-play';
        play.textContent = '▶';
        btn.appendChild(play);

        btn.addEventListener('click', () => {
            if (navigator.vibrate) { try { navigator.vibrate(10); } catch (_) {} }
            item.click();
            const input = $('search-input');
            if (input) input.value = '';
            const sr = $('search-results');
            if (sr) { sr.innerHTML = ''; sr.style.display = 'none'; }
            const sc = $('search-container');
            if (sc) sc.classList.remove('visible');
            const hv = $('home-view');
            if (hv) hv.style.display = '';
            document.querySelectorAll('#playlist .playlist-item').forEach(it => {
                it.style.display = window.__showAllSongs ? 'flex' : 'none';
            });
        });

        return btn;
    }

    function buildGenreSection(qNorm, qRaw) {
        const items = Array.from(document.querySelectorAll('#playlist .playlist-item'));

        const byGenre = new Map();
        items.forEach(item => {
            const genre = getItemGenre(item);
            if (!genre) return;
            if (!normalizeStr(genre).includes(qNorm)) return;
            const key = normalizeStr(genre);
            if (!byGenre.has(key)) {
                byGenre.set(key, { name: genre, items: [] });
            }
            byGenre.get(key).items.push(item);
        });

        if (!byGenre.size) return null;

        const sec = document.createElement('section');
        sec.className = 'search-section search-section--genres';

        const h = document.createElement('h3');
        h.className = 'search-section-title';
        h.textContent = 'Canciones del género "' + qRaw + '"';
        sec.appendChild(h);

        byGenre.forEach(g => {
            if (byGenre.size > 1) {
                const sub = document.createElement('div');
                sub.className = 'search-section-title';
                sub.style.fontSize = '14px';
                sub.style.marginTop = '6px';
                sub.style.color = '#ff2a2a';
                sub.textContent = '🎵 ' + g.name + ' (' + g.items.length + ')';
                sec.appendChild(sub);
            }

            g.items.forEach(item => {
                sec.appendChild(buildSongRow(item));
            });
        });

        return sec;
    }

    function buildPublicPlaylistSection(qNorm, playlists) {
        if (!playlists || !playlists.length) return null;
        const currentUid = firebase.auth().currentUser?.uid || '';

        const filtered = playlists.filter(pl => normalizeStr(pl.nombre).includes(qNorm));
        if (!filtered.length) return null;

        const sec = document.createElement('section');
        sec.className = 'search-section search-section--public-playlists';

        const h = document.createElement('h3');
        h.className = 'search-section-title';
        h.textContent = 'Playlists públicas';
        sec.appendChild(h);

        filtered.forEach(pl => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'search-row';

            const thumb = document.createElement('div');
            thumb.className = 'search-row-thumb';
            const firstSong = pl.canciones[0];
            let cover = '';
            if (firstSong) {
                const localIt = Array.from(document.querySelectorAll('#playlist .playlist-item'))
                    .find(it => getItemTitle(it) === firstSong.titulo);
                if (localIt) cover = getItemCover(localIt);
                if (!cover && firstSong.portada) cover = firstSong.portada;
            }
            if (cover) {
                const img = document.createElement('img');
                img.src = cover;
                img.alt = pl.nombre;
                img.loading = 'lazy';
                thumb.appendChild(img);
            }
            btn.appendChild(thumb);

            const info = document.createElement('div');
            info.className = 'search-row-info';

            const name = document.createElement('span');
            name.className = 'search-row-title';
            name.textContent = pl.nombre;
            info.appendChild(name);

            const sub = document.createElement('span');
            sub.className = 'search-row-sub';
            const n = pl.canciones.length;
            sub.textContent = (pl.uid === currentUid ? 'Tu playlist · ' : 'Pública · ') +
                n + (n === 1 ? ' canción' : ' canciones');
            info.appendChild(sub);

            btn.appendChild(info);

            const play = document.createElement('span');
            play.className = 'search-row-play';
            play.textContent = '▶';
            btn.appendChild(play);

            btn.addEventListener('click', () => {
                if (navigator.vibrate) { try { navigator.vibrate(10); } catch (_) {} }
                const plView = {
                    id: pl.id,
                    nombre: pl.nombre,
                    canciones: pl.canciones.map(c => {
                        const localIt = Array.from(document.querySelectorAll('#playlist .playlist-item'))
                            .find(it => getItemTitle(it) === c.titulo);
                        return {
                            titulo: c.titulo,
                            portada: (localIt && getItemCover(localIt)) || c.portada || '',
                            subtitulo: (localIt && localIt.querySelector('.item-subtitle')?.textContent.trim()) || c.subtitulo || ''
                        };
                    }),
                    isOwner: pl.uid === currentUid,
                    esMiPlaylist: pl.uid === currentUid,
                    privada: false,
                    esPublica: true
                };
                const input = $('search-input');
                if (input) input.value = '';
                const sr = $('search-results');
                if (sr) { sr.innerHTML = ''; sr.style.display = 'none'; }
                const sc = $('search-container');
                if (sc) sc.classList.remove('visible');
                const hv = $('home-view');
                if (hv) hv.style.display = '';
                document.querySelectorAll('#playlist .playlist-item').forEach(it => {
                    it.style.display = window.__showAllSongs ? 'flex' : 'none';
                });
                if (typeof window.__openPlaylistView === 'function') {
                    window.__openPlaylistView(plView);
                }
            });

            sec.appendChild(btn);
        });

        return sec;
    }

    async function addExtraSections(q) {
        const container = $('search-results');
        if (!container || !q) return;

        const qNorm = normalizeStr(q);
        if (!qNorm) return;

        const existing = container.querySelector(
            '.search-section--genres, .search-section--public-playlists'
        );
        if (existing && lastRenderedQ === q) return;

        container.querySelectorAll(
            '.search-section--genres, .search-section--public-playlists'
        ).forEach(el => el.remove());

        await Promise.all([
            cargarGenerosDesdeFirestore(false).catch(() => {}),
            cargarPlaylistsPublicas(false).catch(() => {})
        ]);

        const genreSec = buildGenreSection(qNorm, q);
        const plSec = buildPublicPlaylistSection(qNorm, publicPlaylistsCache || []);

        if (genreSec || plSec) {
            const emptyEl = container.querySelector('.search-empty');
            if (emptyEl) emptyEl.remove();
        }

        if (genreSec) container.appendChild(genreSec);
        if (plSec) container.appendChild(plSec);

        if (genreSec || plSec) {
            container.style.display = 'block';
        }

        lastRenderedQ = q;
    }

    function schedule(q) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            debounceTimer = null;
            addExtraSections(q).catch(() => {});
        }, 260);
    }

    function init() {
        if (typeof firebase === 'undefined' || !firebase.auth) { setTimeout(init, 300); return; }
        const container = $('search-results');
        const input = $('search-input');
        if (!container || !input) { setTimeout(init, 300); return; }

        cargarGenerosDesdeFirestore(false).catch(() => {});
        cargarPlaylistsPublicas().catch(() => {});

        if (!window.__genreRefreshHook) {
            window.__genreRefreshHook = true;
            input.addEventListener('focus', () => {
                cargarGenerosDesdeFirestore(true).catch(() => {});
            });
        }

        if (!searchObserver) {
            searchObserver = new MutationObserver(() => {
                const q = (input.value || '').trim();
                if (!q) {
                    lastRenderedQ = '';
                    return;
                }
                schedule(q);
            });
            searchObserver.observe(container, { childList: true, subtree: false });
        }

        if (input.dataset.genreSearchReady !== '1') {
            input.dataset.genreSearchReady = '1';
            input.addEventListener('input', () => {
                const q = (input.value || '').trim();
                if (!q) lastRenderedQ = '';
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

/* ============================================================
   34. SISTEMA DE RECOMENDACIONES PERSONALIZADAS
   ============================================================ */
(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);

    let refreshTimer = null;

    function getItemTitle(item) {
        return item.querySelector('.item-title')?.textContent.trim() || '';
    }
    function getItemCover(item) {
        return item.querySelector('.thumbnail img')?.src || '';
    }
    function getItemSubtitle(item) {
        return item.querySelector('.item-subtitle')?.textContent.trim() || '';
    }
    function parseParts(item) {
        const sub = getItemSubtitle(item);
        const idx = sub.indexOf('·');
        if (idx === -1) return { artist: sub, genre: '' };
        return {
            artist: sub.slice(0, idx).trim(),
            genre: sub.slice(idx + 1).trim()
        };
    }
    function getAllItems() {
        return Array.from(document.querySelectorAll('#playlist .playlist-item'));
    }

    function buildProfile() {
        const user = firebase.auth().currentUser;
        if (!user) return null;

        const historial = (typeof window.__getHistorialCache === 'function')
            ? (window.__getHistorialCache() || []) : [];
        const playlists = (typeof window.__getPlaylistsCache === 'function')
            ? (window.__getPlaylistsCache() || []) : [];

        const playedTitles = new Set();
        historial.forEach(h => { if (h && h.titulo) playedTitles.add(h.titulo); });
        playlists.forEach(pl => pl.canciones.forEach(c => {
            if (c && c.titulo) playedTitles.add(c.titulo);
        }));

        const allItems = getAllItems();
        const genreCounts = new Map();
        const artistCounts = new Map();

        playedTitles.forEach(title => {
            const item = allItems.find(it => getItemTitle(it) === title);
            if (!item) return;
            const parts = parseParts(item);
            if (parts.genre && parts.genre.toLowerCase() !== 'subido') {
                genreCounts.set(parts.genre, (genreCounts.get(parts.genre) || 0) + 1);
            }
            if (parts.artist) {
                artistCounts.set(parts.artist, (artistCounts.get(parts.artist) || 0) + 1);
            }
        });

        return { playedTitles, genreCounts, artistCounts };
    }

    function scoreSongs(profile) {
        const allItems = getAllItems();
        const scored = [];

        allItems.forEach(item => {
            const title = getItemTitle(item);
            if (profile.playedTitles.has(title)) return;

            const parts = parseParts(item);
            let score = 0;

            if (parts.genre && profile.genreCounts.has(parts.genre)) {
                score += profile.genreCounts.get(parts.genre) * 3;
            }
            if (parts.artist && profile.artistCounts.has(parts.artist)) {
                score += profile.artistCounts.get(parts.artist) * 5;
            }
            if (parts.artist) {
                profile.artistCounts.forEach((count, artist) => {
                    if (artist === parts.artist) return;
                    const n1 = artist.toLowerCase();
                    const n2 = parts.artist.toLowerCase();
                    if (n1 && n2 && (n1.includes(n2) || n2.includes(n1))) {
                        score += count * 2;
                    }
                });
            }

            if (score > 0) {
                score += Math.random() * 0.5;
                scored.push({ item, score });
            }
        });

        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, 12).map(s => s.item);
    }

    function ensureSection() {
        let sec = $('sec-recommended');
        if (sec) return sec;
        const homeView = $('home-view');
        if (!homeView) return null;

        sec = document.createElement('section');
        sec.className = 'home-section';
        sec.id = 'sec-recommended';

        const h = document.createElement('h2');
        h.className = 'home-section-title';
        h.textContent = 'Recomendado para ti';
        sec.appendChild(h);

        const carousel = document.createElement('div');
        carousel.className = 'home-carousel';
        carousel.id = 'carousel-recommended';
        sec.appendChild(carousel);

        if (homeView.firstChild) {
            homeView.insertBefore(sec, homeView.firstChild);
        } else {
            homeView.appendChild(sec);
        }
        return sec;
    }

    function makeSongCard(item) {
        const title = getItemTitle(item);
        const cover = getItemCover(item);
        const sub = getItemSubtitle(item);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'home-card';
        btn.setAttribute('aria-label', title);

        const thumb = document.createElement('div');
        thumb.className = 'home-card-thumb';
        if (cover) {
            const img = document.createElement('img');
            img.src = cover; img.alt = title; img.loading = 'lazy';
            thumb.appendChild(img);
        }
        btn.appendChild(thumb);

        const t = document.createElement('span');
        t.className = 'home-card-title';
        t.textContent = title;
        btn.appendChild(t);

        if (sub) {
            const s = document.createElement('span');
            s.className = 'home-card-sub';
            s.textContent = sub;
            btn.appendChild(s);
        }

        btn.addEventListener('click', () => item.click());
        return btn;
    }

    function render() {
        const sec = ensureSection();
        if (!sec) return;
        const carousel = sec.querySelector('#carousel-recommended');
        if (!carousel) return;

        const profile = buildProfile();
        if (!profile || profile.playedTitles.size < 2) {
            sec.style.display = 'none';
            return;
        }

        const recommended = scoreSongs(profile);
        if (!recommended.length) {
            sec.style.display = 'none';
            return;
        }

        carousel.innerHTML = '';
        recommended.forEach(item => carousel.appendChild(makeSongCard(item)));
        sec.style.display = '';
    }

    function init() {
        if (typeof firebase === 'undefined' || !firebase.auth) { setTimeout(init, 300); return; }

        let tries = 0;
        (function loop() {
            tries++;
            const homeView = $('home-view');
            const items = document.querySelectorAll('#playlist .playlist-item');
            if (homeView && items.length > 0) {
                render();
                return;
            }
            if (tries < 40) setTimeout(loop, 250);
        })();

        const audio = document.getElementById('audio-player');
        if (audio && audio.dataset.recReady !== '1') {
            audio.dataset.recReady = '1';
            audio.addEventListener('ended', () => {
                setTimeout(render, 2000);
            });
        }

        if (refreshTimer) clearInterval(refreshTimer);
        refreshTimer = setInterval(() => {
            const view = $('home-view');
            if (view && view.offsetParent !== null) {
                render();
            }
        }, 60000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

/* ============================================================
   35. ELIMINAR PLAYLIST DESDE "EDITAR"
   ============================================================ */
(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);

    let deleteBtn = null;
    let confirmBackdrop = null;

    function getCurrentPlaylist() {
        return window.__currentOpenPlaylist || null;
    }

    function canDelete(pl) {
        if (!pl) return false;
        return pl.esMiPlaylist === true && !!pl.id;
    }

    async function deletePlaylistFromFirestore(pl) {
        if (!pl || !pl.id) throw new Error('Playlist sin id');

        try {
            await firebase.firestore().collection('mis_playlists').doc(pl.id).delete();
        } catch (e) { console.warn('[DEL] mis_playlists:', e); }

        try {
            const user = firebase.auth().currentUser;
            if (user) {
                const snap = await firebase.firestore()
                    .collection('playlists_compartidas')
                    .where('de', '==', user.uid)
                    .where('playlistId', '==', pl.id)
                    .get();
                if (!snap.empty) {
                    const batch = firebase.firestore().batch();
                    snap.forEach(d => batch.delete(d.ref));
                    await batch.commit();
                }
            }
        } catch (e) { console.warn('[DEL] compartidas:', e); }
    }

    function showConfirm(message, onYes) {
        if (confirmBackdrop) return;
        confirmBackdrop = document.createElement('div');
        confirmBackdrop.className = 'conv-menu-backdrop';
        confirmBackdrop.innerHTML = `
            <div class="conv-confirm-box" role="dialog" aria-modal="true">
                <div class="conv-confirm-title">¿Eliminar playlist?</div>
                <div class="conv-confirm-sub"></div>
                <div class="conv-confirm-actions">
                    <button type="button" class="no" data-action="no">Cancelar</button>
                    <button type="button" class="yes" data-action="yes">Eliminar</button>
                </div>
            </div>
        `;
        const subEl = confirmBackdrop.querySelector('.conv-confirm-sub');
        if (subEl) subEl.textContent = message;

        document.body.appendChild(confirmBackdrop);
        requestAnimationFrame(() => confirmBackdrop.classList.add('visible'));

        confirmBackdrop.addEventListener('click', (e) => {
            const t = e.target.closest('[data-action]');
            if (!t) {
                if (e.target === confirmBackdrop) closeConfirm();
                return;
            }
            const action = t.dataset.action;
            closeConfirm();
            if (action === 'yes') { try { onYes(); } catch (_) {} }
        });
    }

    function closeConfirm() {
        if (!confirmBackdrop) return;
        confirmBackdrop.classList.remove('visible');
        const el = confirmBackdrop;
        confirmBackdrop = null;
        setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 250);
    }

    function injectDeleteButton() {
        const view = $('playlist-view');
        if (!view) return false;
        const footer = view.querySelector('.pv-footer');
        if (!footer) return false;
        if (footer.querySelector('#pv-delete-playlist')) return true;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'pv-delete-playlist';
        btn.className = 'pv-delete-playlist';
        btn.textContent = 'Eliminar playlist';

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const pl = getCurrentPlaylist();
            if (!pl || !canDelete(pl)) return;
            if (navigator.vibrate) { try { navigator.vibrate(15); } catch (_) {} }
            showConfirm(
                'Se eliminará la playlist "' + (pl.nombre || '') +
                '" y todos sus elementos. Esta acción no se puede deshacer.',
                async () => {
                    try {
                        await deletePlaylistFromFirestore(pl);
                        view.classList.remove('visible', 'edit-mode');
                        view.setAttribute('aria-hidden', 'true');
                        window.__currentOpenPlaylist = null;
                        if (typeof window.__buildListenAgain === 'function') {
                            try { window.__buildListenAgain(); } catch (_) {}
                        }
                        let toast = document.getElementById('omega-toast');
                        if (!toast) {
                            toast = document.createElement('div');
                            toast.id = 'omega-toast';
                            document.body.appendChild(toast);
                        }
                        toast.textContent = '✓ Playlist eliminada';
                        toast.classList.remove('visible');
                        void toast.offsetWidth;
                        toast.classList.add('visible');
                        clearTimeout(toast._omegaModeTimer);
                        toast._omegaModeTimer = setTimeout(() => {
                            toast.classList.remove('visible');
                        }, 1800);
                    } catch (err) {
                        console.error('Error eliminando playlist:', err);
                        alert('No se pudo eliminar la playlist.');
                    }
                }
            );
        });

        footer.appendChild(btn);
        deleteBtn = btn;
        return true;
    }

    function removeDeleteButton() {
        if (deleteBtn && deleteBtn.parentNode) {
            deleteBtn.parentNode.removeChild(deleteBtn);
        }
        deleteBtn = null;
    }

    function updateVisibility() {
        const view = $('playlist-view');
        if (!view) return;
        const isEdit = view.classList.contains('edit-mode');
        const isVisible = view.classList.contains('visible');
        const pl = getCurrentPlaylist();

        if (isEdit && isVisible && canDelete(pl)) {
            injectDeleteButton();
        } else {
            removeDeleteButton();
        }
    }

    function init() {
        if (typeof firebase === 'undefined' || !firebase.auth) { setTimeout(init, 300); return; }
        const view = $('playlist-view');
        if (!view) { setTimeout(init, 300); return; }
        if (view.dataset.delWatch === '1') return;
        view.dataset.delWatch = '1';

        const obs = new MutationObserver(() => updateVisibility());
        obs.observe(view, { attributes: true, attributeFilter: ['class'] });

        const footer = view.querySelector('.pv-footer');
        if (footer) {
            const obsF = new MutationObserver(() => updateVisibility());
            obsF.observe(footer, { childList: true });
        }

        setTimeout(updateVisibility, 300);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

/* ============================================================
   36. COLABORADORES EN EL REPRODUCTOR FULLSCREEN
   ------------------------------------------------------------
   ✅ CORREGIDO: ahora lee el campo "colaboradores" (array) desde
      historial_usuarios/{uid}/canciones/{songId}.
   ✅ Fallback: si no hay datos en Firestore, usa el parseo de texto.
   ✅ Si el colaborador coincide con un artista de la playlist,
      usa su portada y abre su perfil al tocarlo.
   ============================================================ */
(function () {
    'use strict';

    const COLLAB_SPLIT = /\s+(?:ft\.?|feat\.?|featuring|con|&)\s+/i;
    let currentSignature = '';
    let containerEl = null;
    let lastActiveItem = null;

    /* ---------- Cache de colaboradores desde Firestore ---------- */
    // Map< tituloNormalizado, [ "Sain Nt", "Artista 2", ... ] >
    let collabsFromFirestore = new Map();
    let firestoreLoadedForUid = null;
    let firestoreLoadPromise = null;

    function $(id) { return document.getElementById(id); }

    function norm(s) {
        if (typeof normalizeStr === 'function') return normalizeStr(s);
        return String(s || '').toLowerCase().normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
    }

    function getItemTitle(item) {
        return item ? (item.querySelector('.item-title')?.textContent.trim() || '') : '';
    }
    function getItemSubtitle(item) {
        return item ? (item.querySelector('.item-subtitle')?.textContent.trim() || '') : '';
    }
    function getItemCover(item) {
        if (!item) return '';
        const img = item.querySelector('.thumbnail img');
        return img ? (img.getAttribute('src') || '') : '';
    }

    function getItemArtists(item) {
        const sub = getItemSubtitle(item);
        const idx = sub.indexOf('·');
        const namePart = (idx === -1 ? sub : sub.slice(0, idx)).trim();
        if (!namePart) return [];
        const parts = namePart.split(COLLAB_SPLIT).map(s => s.trim()).filter(Boolean);
        return parts.length ? parts : [namePart];
    }

    /* ============================================================
       CARGA DESDE FIRESTORE
       historial_usuarios/{uid}/canciones/{songId}
       campo: colaboradores (array de strings)
       ============================================================ */
    async function cargarColaboradoresDesdeFirestore(force) {
        const user = (typeof firebase !== 'undefined' && firebase.auth)
            ? firebase.auth().currentUser : null;
        if (!user) return collabsFromFirestore;

        if (!force && firestoreLoadedForUid === user.uid) return collabsFromFirestore;
        if (firestoreLoadPromise && !force) return firestoreLoadPromise;

        firestoreLoadPromise = (async () => {
            const map = new Map();
            try {
                const snap = await firebase.firestore()
                    .collection('historial_usuarios')
                    .doc(user.uid)
                    .collection('canciones')
                    .get();

                snap.forEach(doc => {
                    const d = doc.data() || {};

                    // Nombre del documento de canción (puede variar según la app de origen)
                    const titulo = d.titulo || d.title || d.nombre || d.name || '';

                    // Campo principal: colaboradores (array de strings)
                    const raw = d.colaboradores;
                    const colaboradores = Array.isArray(raw)
                        ? raw.map(c => String(c == null ? '' : c).trim()).filter(Boolean)
                        : [];

                    if (titulo && colaboradores.length) {
                        map.set(norm(titulo), colaboradores);
                    }
                });

                collabsFromFirestore = map;
                firestoreLoadedForUid = user.uid;
                console.log('[COLLAB-FS] Colaboradores cargados:', map.size);
            } catch (e) {
                console.warn('[COLLAB-FS] Error cargando colaboradores:', e);
            } finally {
                firestoreLoadPromise = null;
            }
            return map;
        })();

        return firestoreLoadPromise;
    }

    function getCollaboratorsFromFirestore(item) {
        if (!item) return null;
        const title = getItemTitle(item);
        if (!title) return null;
        const key = norm(title);
        if (!key) return null;
        const arr = collabsFromFirestore.get(key);
        if (Array.isArray(arr) && arr.length) return arr.slice();
        return null;
    }

    /* ============================================================
       FALLBACK: parseo por texto (solo si no hay datos en Firestore)
       ============================================================ */
    function extractCollaboratorsFromText(item) {
        if (!item) return [];
        const sub = getItemSubtitle(item);
        const title = getItemTitle(item);

        const subIdx = sub.indexOf('·');
        const subNames = (subIdx === -1 ? sub : sub.slice(0, subIdx)).trim();
        const subArtists = subNames
            ? subNames.split(COLLAB_SPLIT).map(s => s.trim()).filter(Boolean)
            : [];
        const mainArtist = subArtists[0] || '';

        const candidates = [];
        subArtists.slice(1).forEach(n => candidates.push(n));

        if (COLLAB_SPLIT.test(title)) {
            const titleParts = title.split(COLLAB_SPLIT).map(s => s.trim()).filter(Boolean);
            titleParts.slice(1).forEach(n => candidates.push(n));
        }

        const nMain = norm(mainArtist);
        const seen = new Set();
        const result = [];
        candidates.forEach(name => {
            const n = norm(name);
            if (!n || n === nMain || seen.has(n)) return;
            seen.add(n);
            result.push(name);
        });
        return result;
    }

    /* ============================================================
       EXTRACCIÓN PRINCIPAL
       1) Firestore → campo "colaboradores"
       2) Fallback → parseo de texto
       ============================================================ */
    function extractCollaborators(item) {
        if (!item) return [];
        const fromFs = getCollaboratorsFromFirestore(item);
        if (fromFs && fromFs.length) return fromFs;
        return extractCollaboratorsFromText(item);
    }

    /* ---------- Matching contra artistas ya presentes en la playlist ---------- */
    function findArtistItem(name) {
        const target = norm(name);
        if (!target) return null;
        const pl = $('playlist');
        if (!pl) return null;
        const items = pl.querySelectorAll('.playlist-item');
        for (const it of items) {
            const artists = getItemArtists(it);
            for (const a of artists) {
                if (norm(a) === target) {
                    return { item: it, cover: getItemCover(it), name: a };
                }
            }
        }
        return null;
    }

    function buildSignature(item) {
        if (!item) return '';
        const fsColabs = getCollaboratorsFromFirestore(item);
        const fsKey = fsColabs ? fsColabs.join('|') : '';
        return getItemTitle(item) + '||' + getItemSubtitle(item) + '||' + fsKey;
    }

    function getActiveItem() {
        const pl = $('playlist');
        return pl ? pl.querySelector('.playlist-item.active') : null;
    }

    function ensureContainer() {
        if (containerEl && containerEl.isConnected) return containerEl;
        const fsPlayer = $('fs-player');
        if (!fsPlayer) return null;

        containerEl = document.createElement('div');
        containerEl.className = 'fs-collabs';
        containerEl.id = 'fs-collabs';
        containerEl.setAttribute('aria-hidden', 'true');
        fsPlayer.appendChild(containerEl);
        return containerEl;
    }

    function clearCollaborators() {
        if (containerEl) {
            containerEl.innerHTML = '';
            containerEl.classList.remove('visible');
            containerEl.setAttribute('aria-hidden', 'true');
        }
    }

    function renderCollaborators() {
        const item = getActiveItem();
        if (!item) { clearCollaborators(); lastActiveItem = null; return; }

        const sig = buildSignature(item);
        const itemChanged = item !== lastActiveItem;
        if (sig === currentSignature && !itemChanged) return;

        currentSignature = sig;
        lastActiveItem = item;

        const candidates = extractCollaborators(item);
        if (!candidates.length) { clearCollaborators(); return; }

        const found = candidates.map(name => {
            const artist = findArtistItem(name);
            if (artist) return artist;
            return { item: null, cover: '', name: name };
        });

        const box = ensureContainer();
        if (!box) return;

        box.innerHTML = '';
        box.setAttribute('aria-hidden', 'false');
        box.classList.add('visible');

        const label = document.createElement('div');
        label.className = 'fs-collabs-label';
        label.textContent = found.length === 1 ? 'Colaborador' : 'Colaboradores';
        box.appendChild(label);

        const row = document.createElement('div');
        row.className = 'fs-collabs-row';
        box.appendChild(row);

        found.forEach((artist, i) => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'fs-collab';
            card.style.setProperty('--delay', (i * 90) + 'ms');
            card.setAttribute('aria-label', 'Ver perfil de ' + artist.name);

            const av = document.createElement('div');
            av.className = 'fs-collab-avatar';
            if (artist.cover) {
                const img = document.createElement('img');
                img.src = artist.cover;
                img.alt = artist.name;
                img.loading = 'lazy';
                av.appendChild(img);
            } else {
                av.textContent = (artist.name.trim()[0] || '?').toUpperCase();
            }
            card.appendChild(av);

            const nameEl = document.createElement('span');
            nameEl.className = 'fs-collab-name';
            nameEl.textContent = artist.name;
            card.appendChild(nameEl);

            card.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (navigator.vibrate) { try { navigator.vibrate(12); } catch (_) {} }
                // Solo abrimos perfil si el colaborador existe como artista en la playlist
                if (artist.item && typeof window.__openArtistProfile === 'function') {
                    const fsPlayer = $('fs-player');
                    if (fsPlayer) {
                        fsPlayer.classList.remove('visible');
                        fsPlayer.setAttribute('aria-hidden', 'true');
                    }
                    setTimeout(() => window.__openArtistProfile(artist.name), 80);
                }
            });

            row.appendChild(card);
        });
    }

    /* ---------- Wrapper async: asegura que Firestore esté cargado antes de pintar ---------- */
    async function renderCollaboratorsAsync() {
        await cargarColaboradoresDesdeFirestore(false).catch(() => {});
        renderCollaborators();
    }

    function watchFullscreen() {
        const fsPlayer = $('fs-player');
        if (!fsPlayer) { setTimeout(watchFullscreen, 300); return; }
        if (fsPlayer.dataset.collabWatch === '1') return;
        fsPlayer.dataset.collabWatch = '1';

        let lastVisible = false;
        const obs = new MutationObserver(() => {
            const visible = fsPlayer.classList.contains('visible');
            if (visible === lastVisible) return;
            lastVisible = visible;
            if (visible) {
                currentSignature = '';
                lastActiveItem = null;
                setTimeout(() => renderCollaboratorsAsync(), 120);
                setTimeout(() => renderCollaboratorsAsync(), 400);
                setTimeout(() => renderCollaboratorsAsync(), 800);
            } else {
                clearCollaborators();
            }
        });
        obs.observe(fsPlayer, { attributes: true, attributeFilter: ['class'] });
    }

    function watchPlayerTitle() {
        const titleEl = document.getElementById('player-title');
        if (!titleEl) { setTimeout(watchPlayerTitle, 300); return; }
        if (titleEl.dataset.collabWatch === '1') return;
        titleEl.dataset.collabWatch = '1';
        const obs = new MutationObserver(() => {
            const fsPlayer = $('fs-player');
            if (fsPlayer && fsPlayer.classList.contains('visible')) {
                currentSignature = '';
                setTimeout(() => renderCollaboratorsAsync(), 120);
            }
        });
        obs.observe(titleEl, { childList: true, characterData: true, subtree: true });
    }

    function watchPlaylist() {
        const pl = $('playlist');
        if (!pl) { setTimeout(watchPlaylist, 300); return; }
        if (pl.dataset.collabWatch === '1') return;
        pl.dataset.collabWatch = '1';
        const obs = new MutationObserver(() => {
            const fsPlayer = $('fs-player');
            if (fsPlayer && fsPlayer.classList.contains('visible')) {
                setTimeout(() => renderCollaboratorsAsync(), 80);
            }
        });
        obs.observe(pl, { subtree: true, attributes: true, attributeFilter: ['class'] });
    }

    function boot() {
        // Cargar la primera vez y recargar al cambiar de usuario
        if (typeof firebase !== 'undefined' && firebase.auth) {
            firebase.auth().onAuthStateChanged(user => {
                if (user) {
                    cargarColaboradoresDesdeFirestore(true).catch(() => {});
                } else {
                    collabsFromFirestore = new Map();
                    firestoreLoadedForUid = null;
                }
            });
        }
        watchFullscreen();
        watchPlayerTitle();
        watchPlaylist();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
/* ============================================================
   37. CONEXIÓN DE LA BARRA DE NAVEGACIÓN INFERIOR
   ============================================================ */
(function () {
    'use strict';

    function init() {
        const bnMensajes = document.getElementById('bn-mensajes');
        const bnBeats = document.getElementById('bn-beatsmusic');
        const bnPlaylists = document.getElementById('bn-playlists');

        if (bnMensajes && bnMensajes.dataset.bnReady !== '1') {
            bnMensajes.dataset.bnReady = '1';
            bnMensajes.addEventListener('click', () => {
                if (navigator.vibrate) { try { navigator.vibrate(12); } catch (_) {} }
                const link = document.getElementById('mensajes-link');
                if (link) link.click();
            });
        }

        if (bnBeats && bnBeats.dataset.bnReady !== '1') {
            bnBeats.dataset.bnReady = '1';
            bnBeats.addEventListener('click', () => {
                if (navigator.vibrate) { try { navigator.vibrate(12); } catch (_) {} }
                const searchInput = document.getElementById('search-input');
                if (searchInput) { searchInput.value = ''; searchInput.dispatchEvent(new Event('input')); }
                const sc = document.getElementById('search-container');
                if (sc) sc.classList.remove('visible');
                const playlist = document.getElementById('playlist');
                if (playlist) { try { playlist.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) { playlist.scrollTop = 0; } }
                ['playlist-view', 'artist-profile', 'album-view', 'mi-playlist-view',
                 'mensajes-view', 'chat-view', 'newmsg-view'].forEach(id => {
                    const v = document.getElementById(id);
                    if (v && v.classList.contains('visible')) {
                        v.classList.remove('visible');
                        v.setAttribute('aria-hidden', 'true');
                    }
                });
                const homeView = document.getElementById('home-view');
                if (homeView) homeView.style.display = '';
                const sr = document.getElementById('search-results');
                if (sr) { sr.innerHTML = ''; sr.style.display = 'none'; }
            });
        }

        if (bnPlaylists && bnPlaylists.dataset.bnReady !== '1') {
            bnPlaylists.dataset.bnReady = '1';
            bnPlaylists.addEventListener('click', () => {
                if (navigator.vibrate) { try { navigator.vibrate(12); } catch (_) {} }
                const link = document.getElementById('mi-playlist-link');
                if (link) link.click();
            });
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

/* ============================================================
   38. DESCARGAS OFFLINE CON INDEXEDDB + ESTADO DEL BOTÓN #fs-like
   ============================================================ */
(function () {
    'use strict';

    const DB_NAME = 'OmegaBeatsOffline';
    const DB_VERSION = 1;
    const STORE_NAME = 'canciones';

    function normId(str) {
        return String(str || '').toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '_');
    }

    /* ---------- INDEXEDDB ---------- */
    let dbPromise = null;
    function openDB() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        return dbPromise;
    }
    async function dbPut(rec) {
        const db = await openDB();
        return new Promise((res, rej) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(rec);
            tx.oncomplete = () => res();
            tx.onerror = () => rej(tx.error);
        });
    }
    async function dbGet(id) {
        const db = await openDB();
        return new Promise((res, rej) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const r = tx.objectStore(STORE_NAME).get(id);
            r.onsuccess = () => res(r.result);
            r.onerror = () => rej(r.error);
        });
    }
    async function dbDelete(id) {
        const db = await openDB();
        return new Promise((res, rej) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).delete(id);
            tx.oncomplete = () => res();
            tx.onerror = () => rej(tx.error);
        });
    }

    /* ---------- DESCARGA ---------- */
    async function downloadSong(song) {
        if (!song || !song.titulo || !song.audioUrl) throw new Error('Datos incompletos');
        const id = normId(song.titulo);
        const audioResp = await fetch(song.audioUrl, { mode: 'cors' });
        if (!audioResp.ok) throw new Error('HTTP ' + audioResp.status);
        const audioBlob = await audioResp.blob();
        let portadaBlob = null;
        if (song.portada && !song.portada.startsWith('blob:')) {
            try {
                const pResp = await fetch(song.portada, { mode: 'cors' });
                if (pResp.ok) portadaBlob = await pResp.blob();
            } catch (_) {}
        }
        const rec = {
            id,
            titulo: song.titulo,
            portada: portadaBlob,
            audio: audioBlob,
            urlOriginal: song.audioUrl,
            tamaño: audioBlob.size + (portadaBlob ? portadaBlob.size : 0),
            fechaDescarga: Date.now()
        };
        await dbPut(rec);
        return rec;
    }
    async function isDownloaded(titulo) {
        const rec = await dbGet(normId(titulo));
        return !!rec;
    }
    async function deleteDownload(titulo) {
        await dbDelete(normId(titulo));
        revokeBlob(titulo);
    }

    /* ---------- BLOB URLS ---------- */
    const blobCache = new Map();
    async function getBlobUrl(titulo) {
        const id = normId(titulo);
        if (blobCache.has(id)) return blobCache.get(id);
        const rec = await dbGet(id);
        if (!rec || !rec.audio) return null;
        const url = URL.createObjectURL(rec.audio);
        blobCache.set(id, url);
        return url;
    }
    function revokeBlob(titulo) {
        const id = normId(titulo);
        if (blobCache.has(id)) {
            try { URL.revokeObjectURL(blobCache.get(id)); } catch (_) {}
            blobCache.delete(id);
        }
    }

    /* ---------- APLICAR BLOB LOCAL A ITEMS ---------- */
    async function applyLocalSrcToItem(item) {
        if (!item) return;
        const titulo = item.querySelector('.item-title')?.textContent.trim() || '';
        if (!titulo) return;
        const url = await getBlobUrl(titulo);
        if (url) {
            if (!item.dataset.remoteSrc) item.dataset.remoteSrc = item.dataset.src || '';
            item.dataset.src = url;
            item.dataset.offline = '1';
        }
    }
    async function applyLocalSrcToAll() {
        const items = document.querySelectorAll('#playlist .playlist-item');
        for (const it of items) await applyLocalSrcToItem(it);
    }
    function findItemByTitle(titulo) {
        const n = normId(titulo);
        for (const it of document.querySelectorAll('#playlist .playlist-item')) {
            const t = it.querySelector('.item-title')?.textContent.trim() || '';
            if (normId(t) === n) return it;
        }
        return null;
    }

    /* ---------- DATOS DE LA CANCIÓN ACTIVA ---------- */
    function getActiveItem() {
        return document.querySelector('#playlist .playlist-item.active');
    }
    function getActiveSongData() {
        const it = getActiveItem();
        if (!it) return null;
        const titulo = it.querySelector('.item-title')?.textContent.trim() || '';
        if (!titulo) return null;
        return {
            titulo,
            audioUrl: it.dataset.remoteSrc || it.dataset.src || '',
            portada: it.querySelector('.thumbnail img')?.src || '',
            subtitulo: it.querySelector('.item-subtitle')?.textContent.trim() || ''
        };
    }

    /* ---------- PLAYLISTS QUE CONTIENEN LA CANCIÓN ---------- */
    async function getPlaylistsContaining(titulo) {
        const user = firebase.auth().currentUser;
        if (!user || !titulo) return [];
        try {
            const snap = await firebase.firestore().collection('mis_playlists')
                .where('uid', '==', user.uid).get();
            const out = [];
            snap.forEach(doc => {
                const d = doc.data() || {};
                const canciones = Array.isArray(d.canciones) ? d.canciones : [];
                if (canciones.some(c => c.titulo === titulo)) {
                    out.push({ id: doc.id, nombre: d.nombre || 'Playlist', canciones });
                }
            });
            return out;
        } catch (e) { return []; }
    }

    /* ---------- BOTÓN #fs-like ---------- */
    const fsLikeBtn = document.getElementById('fs-like');

    async function updateFsLikeButton() {
        if (!fsLikeBtn) return;
        const song = getActiveSongData();
        const span = fsLikeBtn.querySelector('span');
        if (!song) {
            fsLikeBtn.classList.remove('downloaded', 'processing');
            if (span) span.textContent = 'Me Gusta';
            return;
        }
        const downloaded = await isDownloaded(song.titulo);
        if (downloaded) {
            fsLikeBtn.classList.add('downloaded');
            fsLikeBtn.classList.remove('processing');
            if (span) span.textContent = 'En tu playlist';
        } else {
            fsLikeBtn.classList.remove('downloaded', 'processing');
            if (span) span.textContent = 'Me Gusta';
        }
    }

    /* ---------- MODAL: ELEGIR PLAYLIST PARA ELIMINAR ---------- */
    function showRemovePickerModal(playlists, titulo, onPick) {
        const backdrop = document.createElement('div');
        backdrop.className = 'mp-modal visible';
        backdrop.innerHTML = `
            <div class="mp-modal-backdrop"></div>
            <div class="mp-modal-box" role="dialog" aria-modal="true">
                <div class="mp-modal-header">
                    <h2 class="mp-modal-title">¿De cuál playlist eliminar?</h2>
                    <button class="mp-modal-close" type="button" aria-label="Cerrar">&times;</button>
                </div>
                <div class="mp-add-list" id="remove-pl-list"></div>
                <p class="mp-modal-status" id="remove-pl-status"></p>
            </div>
        `;
        document.body.appendChild(backdrop);

        const list   = backdrop.querySelector('#remove-pl-list');
        const status = backdrop.querySelector('#remove-pl-status');

        playlists.forEach(pl => {
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'mp-add-row';
            const n = pl.canciones.length;
            row.innerHTML = `
                <div class="mp-add-row-thumb"></div>
                <div class="mp-add-row-info">
                    <span class="mp-add-row-name"></span>
                    <span class="mp-add-row-sub">${n} ${n === 1 ? 'canción' : 'canciones'}</span>
                </div>
            `;
            row.querySelector('.mp-add-row-name').textContent = pl.nombre;
            row.addEventListener('click', async () => {
                row.disabled = true;
                status.textContent = 'Eliminando…';
                status.classList.remove('ok');
                try {
                    await onPick(pl);
                    status.textContent = '✓ Eliminada';
                    status.classList.add('ok');
                    setTimeout(() => backdrop.remove(), 650);
                } catch (e) {
                    status.textContent = 'Error: ' + (e.message || 'intenta de nuevo');
                    row.disabled = false;
                }
            });
            list.appendChild(row);
        });

        const close = () => backdrop.remove();
        backdrop.querySelector('.mp-modal-close').addEventListener('click', close);
        backdrop.querySelector('.mp-modal-backdrop').addEventListener('click', close);
    }

    /* ---------- ACCIÓN: ELIMINAR ---------- */
    async function handleRemoveFlow() {
        const song = getActiveSongData();
        if (!song) return;

        const playlists = await getPlaylistsContaining(song.titulo);
        if (!playlists.length) {
            await deleteDownload(song.titulo);
            const it = getActiveItem();
            if (it && it.dataset.remoteSrc) {
                it.dataset.src = it.dataset.remoteSrc;
                delete it.dataset.remoteSrc;
                delete it.dataset.offline;
            }
            await updateFsLikeButton();
            return;
        }

        showRemovePickerModal(playlists, song.titulo, async (pl) => {
            const nuevas = pl.canciones.filter(c => c.titulo !== song.titulo);
            await firebase.firestore().collection('mis_playlists').doc(pl.id)
                .update({ canciones: nuevas });

            const otras = await getPlaylistsContaining(song.titulo);
            if (otras.length === 0) {
                await deleteDownload(song.titulo);
                const it = getActiveItem();
                if (it && it.dataset.remoteSrc) {
                    it.dataset.src = it.dataset.remoteSrc;
                    delete it.dataset.remoteSrc;
                    delete it.dataset.offline;
                }
            }
            await updateFsLikeButton();
        });
    }

    /* ---------- OBSERVER: éxito al agregar → descargar ---------- */
    function watchAddModalStatus() {
        const statusEl = document.getElementById('mp-add-status');
        if (!statusEl || statusEl.dataset.offlineWatched === '1') return;
        statusEl.dataset.offlineWatched = '1';

        let lastText = '';
        const obs = new MutationObserver(async () => {
            const txt = (statusEl.textContent || '').trim();
            if (txt === lastText) return;
            lastText = txt;

            const ok = txt.startsWith('✓ Añadida a') || txt === 'Ya está en esta playlist';
            if (!ok) return;

            const song = getActiveSongData();
            if (!song || !song.audioUrl) return;

            if (fsLikeBtn) {
                fsLikeBtn.classList.add('processing');
                const s = fsLikeBtn.querySelector('span');
                if (s) s.textContent = 'Descargando…';
            }

            try {
                await downloadSong(song);
                await applyLocalSrcToItem(getActiveItem());
            } catch (err) {
                console.warn('[OFFLINE] Error al descargar:', err);
            }
            await updateFsLikeButton();
        });
        obs.observe(statusEl, { childList: true, characterData: true, subtree: true });
    }

    /* ---------- HOOK: click en #fs-like ---------- */
    function hookFsLike() {
        if (!fsLikeBtn || fsLikeBtn.dataset.offlineHooked === '1') return;
        fsLikeBtn.dataset.offlineHooked = '1';

        fsLikeBtn.addEventListener('click', async (e) => {
            const song = getActiveSongData();
            if (!song) return;
            const downloaded = await isDownloaded(song.titulo);
            if (downloaded) {
                e.stopImmediatePropagation();
                e.preventDefault();
                e.stopPropagation();
                await handleRemoveFlow();
            }
        }, true);
    }

    /* ---------- OBSERVER: cambio de canción activa ---------- */
    function watchActiveSong() {
        const playlist = document.getElementById('playlist');
        if (!playlist || playlist.dataset.offlineActiveWatcher === '1') return;
        playlist.dataset.offlineActiveWatcher = '1';
        const obs = new MutationObserver(() => updateFsLikeButton());
        obs.observe(playlist, { subtree: true, attributes: true, attributeFilter: ['class'] });
    }

    /* ---------- OBSERVER: nuevos items en la playlist ---------- */
    function watchPlaylistItems() {
        const playlist = document.getElementById('playlist');
        if (!playlist || playlist.dataset.offlineItemsWatcher === '1') return;
        playlist.dataset.offlineItemsWatcher = '1';
        const obs = new MutationObserver((muts) => {
            muts.forEach(m => {
                m.addedNodes.forEach(n => {
                    if (n.nodeType !== 1) return;
                    if (n.classList && n.classList.contains('playlist-item')) {
                        applyLocalSrcToItem(n);
                    } else if (n.querySelectorAll) {
                        n.querySelectorAll('.playlist-item').forEach(applyLocalSrcToItem);
                    }
                });
            });
        });
        obs.observe(playlist, { childList: true, subtree: true });
    }

    /* ---------- EDICIÓN EN "MI PLAYLIST" (botón ×) ---------- */
    const pendingDeletes = new Set();

    function watchEditRemove() {
        const view = document.getElementById('playlist-view');
        if (!view || view.dataset.offlineEditWatcher === '1') return;
        view.dataset.offlineEditWatcher = '1';

        const obs = new MutationObserver(() => {
            if (!view.classList.contains('edit-mode')) return;
            view.querySelectorAll('.pv-row-remove').forEach(btn => {
                if (btn.dataset.offlineHooked === '1') return;
                btn.dataset.offlineHooked = '1';
                btn.addEventListener('click', () => {
                    const row = btn.closest('.pv-row');
                    const titulo = row?.dataset.title;
                    if (titulo) pendingDeletes.add(titulo);
                }, true);
            });
        });
        obs.observe(view, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

        const saveBtn = document.getElementById('pv-save');
        if (saveBtn && saveBtn.dataset.offlineEditSave !== '1') {
            saveBtn.dataset.offlineEditSave = '1';
            saveBtn.addEventListener('click', () => {
                if (!pendingDeletes.size) return;
                setTimeout(async () => {
                    for (const titulo of Array.from(pendingDeletes)) {
                        try {
                            const otras = await getPlaylistsContaining(titulo);
                            if (otras.length === 0) {
                                await deleteDownload(titulo);
                                const it = findItemByTitle(titulo);
                                if (it && it.dataset.remoteSrc) {
                                    it.dataset.src = it.dataset.remoteSrc;
                                    delete it.dataset.remoteSrc;
                                    delete it.dataset.offline;
                                }
                            }
                        } catch (_) {}
                    }
                    pendingDeletes.clear();
                    await updateFsLikeButton();
                }, 1600);
            });
        }

        const cancelBtn = document.getElementById('pv-cancel');
        if (cancelBtn && cancelBtn.dataset.offlineEditCancel !== '1') {
            cancelBtn.dataset.offlineEditCancel = '1';
            cancelBtn.addEventListener('click', () => pendingDeletes.clear());
        }
    }

    /* ---------- INICIALIZACIÓN ---------- */
    async function boot() {
        if (typeof firebase === 'undefined' || !firebase.auth) {
            setTimeout(boot, 300);
            return;
        }

        firebase.auth().onAuthStateChanged(async (user) => {
            if (!user) return;
            let tries = 0;
            while (document.querySelectorAll('#playlist .playlist-item').length === 0 && tries < 40) {
                await new Promise(r => setTimeout(r, 200));
                tries++;
            }
            await applyLocalSrcToAll();
            await updateFsLikeButton();
        });

        hookFsLike();
        watchAddModalStatus();
        watchActiveSong();
        watchPlaylistItems();
        watchEditRemove();

        const fsPlayer = document.getElementById('fs-player');
        if (fsPlayer && fsPlayer.dataset.offlineFsWatcher !== '1') {
            fsPlayer.dataset.offlineFsWatcher = '1';
            const obsFS = new MutationObserver(() => {
                if (fsPlayer.classList.contains('visible')) updateFsLikeButton();
            });
            obsFS.observe(fsPlayer, { attributes: true, attributeFilter: ['class'] });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
