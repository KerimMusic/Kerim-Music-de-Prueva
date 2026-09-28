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
            repeatBtn = document.createElem
