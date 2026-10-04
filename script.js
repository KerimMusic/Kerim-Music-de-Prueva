/* ============================================================
   43. AL ELIMINAR UNA PLAYLIST, BORRAR SUS DESCARGAS OFFLINE
   ------------------------------------------------------------
   Cuando el usuario confirma "Eliminar playlist":
     - Espera a que Firestore borre la playlist.
     - Recorre las canciones de esa playlist.
     - Si la canción ya NO está en ninguna otra playlist del usuario,
       elimina su descarga de IndexedDB (misma BD que la sección 38).
     - Reset del ítem en el DOM para que use el src remoto.
   No modifica la sección 35 (borrado de playlist) ni la 38 (descargas).
   ============================================================ */
(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);

    const DB_NAME    = 'OmegaBeatsOffline';
    const DB_VERSION = 1;
    const STORE_NAME = 'canciones';

    function normId(str) {
        return String(str || '').toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '_');
    }

    /* ---------- IndexedDB (misma BD que la sección 38) ---------- */
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
            req.onerror   = () => reject(req.error);
        });
        return dbPromise;
    }
    async function dbGet(id) {
        const db = await openDB();
        return new Promise((res, rej) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const r  = tx.objectStore(STORE_NAME).get(id);
            r.onsuccess = () => res(r.result);
            r.onerror   = () => rej(r.error);
        });
    }
    async function dbDelete(id) {
        const db = await openDB();
        return new Promise((res, rej) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).delete(id);
            tx.oncomplete = () => res();
            tx.onerror    = () => rej(tx.error);
        });
    }
    async function isDownloaded(titulo) {
        const rec = await dbGet(normId(titulo));
        return !!rec;
    }
    async function deleteDownload(titulo) {
        await dbDelete(normId(titulo));
    }

    /* ---------- Firestore ---------- */
    async function playlistExistsInFirestore(playlistId) {
        if (!playlistId) return false;
        try {
            const doc = await firebase.firestore()
                .collection('mis_playlists').doc(playlistId).get();
            return doc.exists;
        } catch (e) {
            return false;
        }
    }

    async function esperarBorradoEnFirestore(playlistId, maxMs) {
        const limite = Date.now() + (maxMs || 6000);
        while (Date.now() < limite) {
            const existe = await playlistExistsInFirestore(playlistId);
            if (!existe) return true;
            await new Promise(r => setTimeout(r, 200));
        }
        return false;
    }

    async function getPlaylistsContaining(titulo) {
        const user = firebase.auth().currentUser;
        if (!user || !titulo) return [];
        try {
            const snap = await firebase.firestore()
                .collection('mis_playlists')
                .where('uid', '==', user.uid)
                .get();
            const out = [];
            snap.forEach(doc => {
                const d = doc.data() || {};
                const canciones = Array.isArray(d.canciones) ? d.canciones : [];
                if (canciones.some(c => c.titulo === titulo)) out.push(doc.id);
            });
            return out;
        } catch (e) {
            return [];
        }
    }

    /* ---------- Utilidades DOM ---------- */
    function findItemByTitle(titulo) {
        const target = normId(titulo);
        for (const it of document.querySelectorAll('#playlist .playlist-item')) {
            const t = it.querySelector('.item-title')?.textContent.trim() || '';
            if (normId(t) === target) return it;
        }
        return null;
    }

    function resetItemToRemote(item) {
        if (!item) return;
        if (item.dataset.remoteSrc) {
            item.dataset.src = item.dataset.remoteSrc;
            delete item.dataset.remoteSrc;
        }
        delete item.dataset.offline;
    }

    /* ---------- Lógica principal ---------- */
    async function cleanupDownloadsForPlaylist(playlist) {
        if (!playlist || !Array.isArray(playlist.canciones) || !playlist.canciones.length) return 0;

        // Aseguramos que la playlist ya no existe en Firestore
        if (playlist.id) {
            const borrado = await esperarBorradoEnFirestore(playlist.id, 6000);
            if (!borrado) {
                console.warn('[DELETE-PL-DL] Timeout esperando borrado en Firestore. Continuando igual…');
            }
        }

        const titulosUnicos = [];
        const vistos = new Set();
        playlist.canciones.forEach(c => {
            const t = (c && c.titulo) || '';
            if (!t) return;
            const key = normId(t);
            if (vistos.has(key)) return;
            vistos.add(key);
            titulosUnicos.push(t);
        });

        let eliminadas = 0;
        for (const titulo of titulosUnicos) {
            const descargada = await isDownloaded(titulo);
            if (!descargada) continue;

            // ¿Sigue en alguna otra playlist del usuario?
            const otras = await getPlaylistsContaining(titulo);
            const sigueEnOtra = otras.some(id => id !== playlist.id);
            if (sigueEnOtra) continue;

            await deleteDownload(titulo);
            eliminadas++;

            // Reset DOM para que use el src remoto
            const item = findItemByTitle(titulo);
            resetItemToRemote(item);
        }

        console.log('[DELETE-PL-DL] Playlist:', playlist.nombre || playlist.id,
                    '· descargas eliminadas:', eliminadas, 'de', titulosUnicos.length);
        return eliminadas;
    }

    window.__cleanupPlaylistDownloads = cleanupDownloadsForPlaylist;

    /* ---------- Hook: confirmación "Eliminar playlist" ---------- */
    function hookConfirmModal() {
        if (document.body.dataset.dlConfirmHook === '1') return;
        document.body.dataset.dlConfirmHook = '1';

        document.body.addEventListener('click', (e) => {
            const t = e.target.closest('[data-action="yes"]');
            if (!t) return;

            const modal = t.closest('.conv-menu-backdrop');
            if (!modal) return;

            const titulo = modal.querySelector('.conv-confirm-title');
            if (!titulo) return;
            const tituloTexto = (titulo.textContent || '').trim();
            if (!tituloTexto.includes('Eliminar playlist')) return;

            // Snapshot AHORA (window.__currentOpenPlaylist aún está set)
            const pl = window.__currentOpenPlaylist;
            if (!pl || !Array.isArray(pl.canciones) || !pl.canciones.length) return;

            const snapshot = {
                id: pl.id || '',
                nombre: pl.nombre || '',
                canciones: pl.canciones.slice()
            };

            // Ejecutamos en paralelo al borrado de la sección 35
            cleanupDownloadsForPlaylist(snapshot).catch(err => {
                console.warn('[DELETE-PL-DL] Error:', err);
            });
        }, true);
    }

    /* ---------- Init ---------- */
    function init() {
        if (typeof firebase === 'undefined' || !firebase.auth) {
            setTimeout(init, 300);
            return;
        }
        hookConfirmModal();

        [500, 1500, 3000].forEach(ms => setTimeout(hookConfirmModal, ms));
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
