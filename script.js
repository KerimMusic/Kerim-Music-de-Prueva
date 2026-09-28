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
   0.4. SISTEMA DE PLAYLISTS "TU PLAYLIST"
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
            nombre: 'Tu Playlist #' + idx,
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
   2. ANUNCIOS
   ============================================================ */
const ADS = [
  { id: 'ad9', url: 'https://www.dropbox.com/scl/fi/l41bs2ooxh6ccnewgnvd1/1785466259517.png?rlkey=czf0bcn58v0irh5qdfeg9tnef&st=pbd0d7v5&raw=1', title: 'Anuncio 9', category: 'ANUNCIO', music: 'https://www.dropbox.com/scl/fi/9tsc6vvge3ukcao3w8hiy/elimina-basura-spotyfi.mp3?rlkey=pogumn7wjmhepbtocb16km25w&st=3oh3m9tu&raw=1', isAd: true },
  { id: 'ad8', url: 'https://www.dropbox.com/scl/fi/zstw4ykjmjh3ljzejuwk5/Anuncio.png?rlkey=pumuamhvcw40nas5biyyrizvo&st=ku13lu66&raw=1', title: 'Anuncio 8', category: 'ANUNCIO', music: 'https://www.dropbox.com/scl/fi/63czt3npjdkz54trajxdf/Presentacion-de-isco-Dany-Zm.wav?rlkey=q7caesruijhiuiil7map3oecn&st=326tvf8c&raw=1', isAd: true },
  { id: 'ad7', url: 'https://www.dropbox.com/scl/fi/zstw4ykjmjh3ljzejuwk5/Anuncio.png?rlkey=pumuamhvcw40nas5biyyrizvo&st=ku13lu66&raw=1', title: 'Anuncio 7', category: 'ANUNCIO', music: 'https://www.dropbox.com/scl/fi/ymz00x4bk0arik8vapgnd/11-de-abril-de-2026.mp3?rlkey=hafgkwkgt6tgyrryodqz2c6fy&st=p5vsj82t&raw=1', isAd: true },
  { id: 'ad6b', url: 'https://www.dropbox.com/scl/fi/7myjpayd9cocf2of9srrj/Cris-Znchez.jpg?rlkey=eqarykexb089abzkacqgbarsl&st=l7cxp9cf&raw=1', title: 'Anuncio Cris', category: 'ANUNCIO', music: 'https://www.dropbox.com/scl/fi/w8ynapsg34o119wnye6el/Auncio-cris-sanches_.mp3?rlkey=pr73mrdydh12tzu1jyreb4pqo&st=u5ewfxwg&raw=1', isAd: true },
  { id: 'ad1', url: 'https://www.dropbox.com/scl/fi/zstw4ykjmjh3ljzejuwk5/Anuncio.png?rlkey=pumuamhvcw40nas5biyyrizvo&st=ku13lu66&raw=1', title: 'Anuncio 1', category: 'ANUNCIO', music: 'https://www.dropbox.com/scl/fi/z3fbqqzthhvvqt9275lc7/2-tema-grabados_1783188240865.mp3?rlkey=7v6ha18uxps052z43rty0d5jr&st=sam7gv97&raw=1', isAd: true },
  { id: 'ad2', url: 'https://www.dropbox.com/scl/fi/zstw4ykjmjh3ljzejuwk5/Anuncio.png?rlkey=pumuamhvcw40nas5biyyrizvo&st=ku13lu66&raw=1', title: 'Anuncio 2', category: 'ANUNCIO', music: 'https://www.dropbox.com/scl/fi/xgl19r2bd49n5cdup93f4/Escucha-sin-anusios_1783188103278.mp3?rlkey=00usrx9c68td9pkqw6o2x1qct&st=4ck7wlz8&raw=1', isAd: true },
  { id: 'ad3', url: '', title: 'Anuncio 3', category: 'ANUNCIO', music: '', video: 'https://www.dropbox.com/scl/fi/5hvqucrjyjotpjge1wpei/AQPEGQdoqPKVT4eHsCxScmq2Pgjwlze7l6aPYix_phWROLbabx1WiKmXH3GA8eDVa8AyecSArdrF9I_wbvUT5XaZ9cJVWSAHpGXci6nOD_T-Eg.mp4?rlkey=29tg1m9o3zgvlrgz1bskg7dzj&st=pmeqma9m&raw=1', isAd: true },
  { id: 'ad6', url: '', title: 'Anuncio 6', category: 'ANUNCIO', music: '', video: 'https://www.dropbox.com/scl/fi/n4nhc00dzenwsoj0t0mud/El-placoso-de-la-L.mp4?rlkey=tde69aczhy3rhxit16xyu3ewx&st=sf47qwl2&raw=1', isAd: true },
  { id: 'ad4', url: 'https://www.dropbox.com/scl/fi/zstw4ykjmjh3ljzejuwk5/Anuncio.png?rlkey=pumuamhvcw40nas5biyyrizvo&st=ku13lu66&raw=1', title: 'Anuncio 4', category: 'ANUNCIO', music: 'https://www.dropbox.com/scl/fi/vl4d6mwau9frvxmjm6wwn/Baner.mp3?rlkey=z8jezojlzlyt0i3qp16jrvid9&st=tdb7ne0h&raw=1', isAd: true }
];

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
   4. GESTOR DE ANUNCIOS
   ============================================================ */
(function () {
    'use strict';
    function init() {
        var audioPlayer = document.getElementById('audio-player');
        if (!audioPlayer) return;
        if (typeof ADS === 'undefined' || !Array.isArray(ADS) || !ADS.length) return;

        var BEATS_PER_AD = 6;
        var SKIP_DELAY = 5;
        var beatPlayCount = 0;
        var lastSrc = '';
        var isAdPlaying = false;
        var adIndex = 0;
        var adOnComplete = null;
        var currentAdMedia = null;
        var countdownInterval = null;
        var adTimeout = null;
        var originalPlay = audioPlayer.play.bind(audioPlayer);

        var overlay = document.createElement('div');
        overlay.id = 'ad-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.innerHTML =
            '<div class="ad-inner">' +
                '<div class="ad-label">ANUNCIO</div>' +
                '<div class="ad-media"></div>' +
                '<button class="ad-skip" type="button" disabled>' +
                    'Saltar anuncio (<span class="ad-countdown">' + SKIP_DELAY + '</span>)' +
                '</button>' +
            '</div>';
        document.body.appendChild(overlay);

        var adMedia = overlay.querySelector('.ad-media');
        var adSkip = overlay.querySelector('.ad-skip');

        audioPlayer.play = function () {
            if (isAdPlaying) return Promise.resolve();
            var src = audioPlayer.src;
            var isNewBeat = src && src !== lastSrc;
            if (isNewBeat) {
                lastSrc = src;
                if (beatPlayCount >= BEATS_PER_AD) {
                    beatPlayCount = 0;
                    showAd(function () { originalPlay().catch(function () {}); });
                    return Promise.resolve();
                }
                beatPlayCount++;
            }
            return originalPlay();
        };

        function showAd(onComplete) {
            if (isAdPlaying) return;
            isAdPlaying = true;
            adOnComplete = onComplete || null;
            try { audioPlayer.pause(); } catch (_) {}
            var ad = ADS[adIndex % ADS.length];
            adIndex = (adIndex + 1) % ADS.length;
            adMedia.innerHTML = '';
            if (currentAdMedia) {
                try { currentAdMedia.pause(); currentAdMedia.removeAttribute('src'); currentAdMedia.load(); } catch (_) {}
                currentAdMedia = null;
            }
            var mediaEl = null;
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
                if (ad.url) {
                    var img = document.createElement('img');
                    img.src = ad.url; img.alt = ad.title || 'Anuncio'; img.className = 'ad-cover';
                    adMedia.appendChild(img);
                }
                if (ad.music) {
                    mediaEl = document.createElement('audio');
                    mediaEl.src = ad.music; mediaEl.preload = 'auto';
                    adMedia.appendChild(mediaEl);
                }
            }
            currentAdMedia = mediaEl;
            overlay.classList.add('visible');
            overlay.setAttribute('aria-hidden', 'false');

            var remaining = SKIP_DELAY;
            adSkip.disabled = true;
            adSkip.innerHTML = 'Saltar anuncio (<span class="ad-countdown">' + remaining + '</span>)';

            if (countdownInterval) clearInterval(countdownInterval);
            countdownInterval = setInterval(function () {
                remaining--;
                var el = adSkip.querySelector('.ad-countdown');
                if (el) el.textContent = Math.max(0, remaining);
                if (remaining <= 0) {
                    clearInterval(countdownInterval);
                    countdownInterval = null;
                    adSkip.disabled = false;
                    adSkip.textContent = 'Saltar anuncio ✕';
                }
            }, 1000);

            if (mediaEl) {
                mediaEl.addEventListener('ended', endAd, { once: true });
                mediaEl.addEventListener('error', function () { adTimeout = setTimeout(endAd, 900); }, { once: true });
                var p = mediaEl.play();
                if (p && p.catch) {
                    p.catch(function () {
                        mediaEl.muted = true;
                        var p2 = mediaEl.play();
                        if (p2 && p2.catch) p2.catch(function () { adTimeout = setTimeout(endAd, 4000); });
                    });
                }
            } else {
                adTimeout = setTimeout(endAd, SKIP_DELAY * 1000);
            }
        }

        function endAd() {
            if (!isAdPlaying) return;
            isAdPlaying = false;
            if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
            if (adTimeout) { clearTimeout(adTimeout); adTimeout = null; }
            if (currentAdMedia) {
                try { currentAdMedia.pause(); currentAdMedia.removeAttribute('src'); currentAdMedia.load(); } catch (_) {}
                currentAdMedia = null;
            }
            adMedia.innerHTML = '';
            overlay.classList.remove('visible');
            overlay.setAttribute('aria-hidden', 'true');
            adSkip.disabled = true;
            adSkip.innerHTML = 'Saltar anuncio (<span class="ad-countdown">' + SKIP_DELAY + '</span>)';
            var cb = adOnComplete;
            adOnComplete = null;
            if (cb) { try { cb(); } catch (e) { console.warn(e); } }
        }

        adSkip.addEventListener('click', function () {
            if (adSkip.disabled) return;
            if (navigator.vibrate) { try { navigator.vibrate(12); } catch (_) {} }
            endAd();
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
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
   18. VISTA DE "TU PLAYLIST" (detalle + escuchar + EDITAR)
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
            pvTitle.textContent = pl.nombre || 'Tu Playlist';
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
        if (results) results.innerHTML = '<div class="search-empty"><div class="search-empty-sub">Cargando usuarios…</div></div>';
        modal.classList.add('visible');
        modal.setAttribute('aria-hidden', 'false');
        await cargarCompartidosDePlaylist(playlist);
        if (recentBox) renderSeguirCompartiendo(recentBox, onPickUser).catch(() => {});
        cargarUsuariosFirebase().then(users => {
            renderUserResults(filtrarUsuarios(users, ''), results, onPickUser, '');
        }).catch(err => {
            if (results) results.innerHTML = '<div class="search-empty"><div class="search-empty-title">Error</div><div class="search-empty-sub">No se pudieron cargar los usuarios.</div></div>';
        });
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
                const recentBox = $('share-modal-recent');
                if (usersCache) {
                    const q = ($('share-modal-input')?.value || '').trim();
                    renderUserResults(filtrarUsuarios(usersCache, q), results, onPickUser, q);
                }
                if (recentBox) renderSeguirCompartiendo(recentBox, onPickUser).catch(() => {});
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
            const recentBox = $('share-modal-recent');
            if (usersCache) {
                const q = ($('share-modal-input')?.value || '').trim();
                renderUserResults(filtrarUsuarios(usersCache, q), results, onPickUser, q);
            }
            if (recentBox) renderSeguirCompartiendo(recentBox, onPickUser).catch(() => {});
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
                if (recentBox) recentBox.style.display = q ? 'none' : '';
                if (!q) {
                    if (recentBox) renderSeguirCompartiendo(recentBox, onPickUser).catch(() => {});
                    cargarUsuariosFirebase().then(users => {
                        renderUserResults(filtrarUsuarios(users, ''), results, onPickUser, '');
                    }).catch(() => {});
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
   ------------------------------------------------------------
   Solo una ventana principal puede estar abierta a la vez.
   Cuando se abre una nueva (Playlist, Perfil de artista,
   Álbum o Mi Playlist), cualquier otra se cierra sola.
   - No interfiere con modales internos (share-modal,
     mp-create-modal, mp-add-modal), que siguen apilándose
     sobre su ventana padre.
   - Respeta el reset de scroll de la sección 21.
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
   ------------------------------------------------------------
   - Lee "mis_playlists" donde privada == false.
   - Aparecen SOLO en el reproductor (home), nunca dentro de
     "Mi Playlist" de otros usuarios (sección 20 sigue filtrando
     por uid == usuario actual).
   - El propietario conserva control total: al abrirla desde el
     reproductor, isOwner === true → puede editar y compartir.
   - Los demás usuarios solo pueden VER y REPRODUCIR: se les
     oculta el botón "Compartir". El botón "Editar" ya se oculta
     automáticamente desde la sección 18 cuando isOwner !== true.
   - No modifica ninguna sección existente.
   ============================================================ */
(function () {
    'use strict';

    let publicUnsubscribe = null;

    function $(id) { return document.getElementById(id); }

    /* -------- Crea (si no existe) la sección de públicas en el home -------- */
    function ensurePublicSection() {
        let sec = $('sec-public');
        if (sec) return { sec, carousel: $('carousel-public') };

        const homeView = $('home-view');
        if (!homeView) return null;

        // Plantilla: copiamos estructura y clases de una sección existente para conservar el estilo
        const template =
            $('sec-listen-again') || $('sec-shared') ||
            $('sec-artists')      || $('sec-top')    ||
            $('sec-maybe')        || $('sec-albums');

        sec = document.createElement('section');
        sec.id = 'sec-public';
        if (template && template.className) sec.className = template.className;
        sec.style.display = 'none';

        // Título
        const templateTitle = template
            ? template.querySelector('h1, h2, h3, [class*="section-title"], [class*="title"]')
            : null;
        const title = document.createElement(templateTitle ? templateTitle.tagName : 'h2');
        if (templateTitle && templateTitle.className) title.className = templateTitle.className;
        else title.className = 'home-section-title';
        title.textContent = 'Playlists públicas';
        sec.appendChild(title);

        // Carrusel
        const templateCarousel = template ? template.querySelector('[id^="carousel-"]') : null;
        const carousel = document.createElement('div');
        carousel.id = 'carousel-public';
        if (templateCarousel && templateCarousel.className) carousel.className = templateCarousel.className;
        sec.appendChild(carousel);

        // Insertar después de sec-shared si existe; si no, al final del home
        const sharedSec = $('sec-shared');
        if (sharedSec && sharedSec.parentNode === homeView) {
            homeView.insertBefore(sec, sharedSec.nextSibling);
        } else {
            homeView.appendChild(sec);
        }
        return { sec, carousel };
    }

    /* -------- Encuentra un item local en el reproductor por título -------- */
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

    /* -------- Abre una playlist pública en el detalle de playlist -------- */
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
            esMiPlaylist: isOwner,   // permite que el dueño vea el toggle de visibilidad al compartir
            privada: false,
            esPublica: true
        };
        if (typeof window.__openPlaylistView === 'function') {
            window.__openPlaylistView(plView);
        }
    }

    /* -------- Renderiza el carrusel de playlists públicas -------- */
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

            // Collage de portadas
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

            // Título
            const t = document.createElement('span');
            t.className = 'home-card-title';
            t.textContent = pl.nombre || 'Playlist';
            card.appendChild(t);

            // Subtítulo (indica si es del usuario o de otro)
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

    /* -------- Listener en tiempo real de todas las playlists públicas -------- */
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

    /* -------- Permisos: ocultar "Compartir" a quien no es propietario --------
       Solo afecta a playlists marcadas como esPublica. Las compartidas
       (sección 19) y las propias (sección 20) siguen funcionando igual. */
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

    /* -------- Init -------- */
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
