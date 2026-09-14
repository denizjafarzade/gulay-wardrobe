/* Data layer for Gülay's Wardrobe.
   Everything — items, photos, planner, songs, chat — lives on the server
   (see public/config.js for where), not on the phone, so her device's
   storage is barely touched. Add ?local=1 to force old-style on-device
   IndexedDB storage instead (kept only as an offline-debugging fallback). */

(function () {
  const API_BASE = (window.WARDROBE_CONFIG && window.WARDROBE_CONFIG.apiBase) || '';
  const forceLocal = new URLSearchParams(location.search).has('local');

  function apiUrl(path) {
    return API_BASE + path;
  }
  // Server responses carry relative paths like "/uploads/xyz.jpg" — when the
  // app is loaded from a different origin than the API (the native app shell
  // vs. your hosted server), those need the server's origin stitched on.
  function absolutize(url) {
    if (!url || !API_BASE || /^https?:\/\/|^data:/.test(url)) return url;
    return API_BASE + url;
  }
  function absolutizeItem(item) {
    if (item && item.photo) item.photo = absolutize(item.photo);
    return item;
  }
  function absolutizeSong(song) {
    if (song && song.url) song.url = absolutize(song.url);
    return song;
  }

  /* ---------------- remote store (Express server) ---------------- */
  const RemoteStore = {
    mode: 'server',
    async listItems() {
      const items = await (await fetch(apiUrl('/api/items'))).json();
      return items.map(absolutizeItem);
    },
    async addItem({ file, name, category, color, store, notes, price }) {
      const fd = new FormData();
      fd.append('photo', file);
      fd.append('name', name);
      fd.append('category', category);
      fd.append('color', color);
      fd.append('store', store);
      fd.append('notes', notes);
      if (price) fd.append('price', price);
      const res = await fetch(apiUrl('/api/items'), { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Upload failed');
      return absolutizeItem(await res.json());
    },
    async updateItem(id, patch) {
      const res = await fetch(apiUrl('/api/items/' + id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error('Update failed');
      return absolutizeItem(await res.json());
    },
    async deleteItem(id) {
      await fetch(apiUrl('/api/items/' + id), { method: 'DELETE' });
    },
    async listOutfits() {
      return (await fetch(apiUrl('/api/outfits'))).json();
    },
    async addOutfit({ name, itemIds }) {
      const res = await fetch(apiUrl('/api/outfits'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, itemIds }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Could not save the look');
      return res.json();
    },
    async deleteOutfit(id) {
      await fetch(apiUrl('/api/outfits/' + id), { method: 'DELETE' });
    },

    // ----- store links + virtual try-on (server-only features) -----
    supportsLinks: true,
    async scrape(url) {
      const res = await fetch(apiUrl('/api/scrape'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Could not read that link');
      const data = await res.json();
      if (data.image) data.image = absolutize(data.image);
      return data;
    },
    async addItemFromUrl(payload) {
      const res = await fetch(apiUrl('/api/items/from-url'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Could not import that product');
      return absolutizeItem(await res.json());
    },
    async getProfile() {
      const data = await (await fetch(apiUrl('/api/profile'))).json();
      data.photos = (data.photos || []).map((p) => ({ ...p, photo: absolutize(p.photo) }));
      return data;
    },
    async saveProfileSlot(slot, file) {
      const fd = new FormData();
      fd.append('photo', file);
      const res = await fetch(apiUrl('/api/profile/' + slot), { method: 'POST', body: fd });
      if (!res.ok) throw new Error((await res.json()).error || 'Could not save the photo');
      const data = await res.json();
      data.photos = (data.photos || []).map((p) => ({ ...p, photo: absolutize(p.photo) }));
      return data;
    },
    async deleteProfileSlot(slot) {
      const res = await fetch(apiUrl('/api/profile/' + slot), { method: 'DELETE' });
      const data = await res.json();
      data.photos = (data.photos || []).map((p) => ({ ...p, photo: absolutize(p.photo) }));
      return data;
    },
    async tryonStatus() {
      return (await fetch(apiUrl('/api/tryon/status'))).json();
    },
    async tryOn(itemIds, instructions) {
      const res = await fetch(apiUrl('/api/tryon'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: [].concat(itemIds), instructions: instructions || '' }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Try-on failed');
      const data = await res.json();
      if (data.image) data.image = absolutize(data.image);
      return data;
    },

    // ----- planner (what to wear + reminders, by date) -----
    async listPlanner() {
      return (await fetch(apiUrl('/api/planner'))).json();
    },
    async savePlanDay(date, { outfitId, note, remindAt }) {
      const res = await fetch(apiUrl('/api/planner/' + date), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outfitId, note, remindAt }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Could not save that day');
      return res.json();
    },
    async deletePlanDay(date) {
      await fetch(apiUrl('/api/planner/' + date), { method: 'DELETE' });
    },

    // ----- countdowns -----
    async listCountdowns() {
      return (await fetch(apiUrl('/api/countdowns'))).json();
    },
    async addCountdown({ label, date, icon }) {
      const res = await fetch(apiUrl('/api/countdowns'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, date, icon }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Could not add that countdown');
      return res.json();
    },
    async pinCountdown(id) {
      const res = await fetch(apiUrl('/api/countdowns/' + id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned: true }),
      });
      return res.json();
    },
    async deleteCountdown(id) {
      await fetch(apiUrl('/api/countdowns/' + id), { method: 'DELETE' });
    },

    // ----- wardrobe/life helper chatbot: multiple threads, memory lives on the server -----
    async askChat(question, threadId) {
      const res = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, threadId }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Could not answer that');
      return res.json();
    },
    async listChatThreads() {
      return (await fetch(apiUrl('/api/chat/threads'))).json();
    },
    async createChatThread() {
      const res = await fetch(apiUrl('/api/chat/threads'), { method: 'POST' });
      return res.json();
    },
    async getChatThread(id) {
      const res = await fetch(apiUrl('/api/chat/threads/' + id));
      if (!res.ok) throw new Error('Chat not found');
      return res.json();
    },
    async deleteChatThread(id) {
      await fetch(apiUrl('/api/chat/threads/' + id), { method: 'DELETE' });
    },
    async appendChatThreadMessages(id, entries) {
      await fetch(apiUrl(`/api/chat/threads/${id}/messages`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      });
    },

    // ----- music -----
    async listSongs() {
      const songs = await (await fetch(apiUrl('/api/songs'))).json();
      return songs.map(absolutizeSong);
    },
    async addSong({ file, title, artist }) {
      const fd = new FormData();
      fd.append('audio', file);
      if (title) fd.append('title', title);
      if (artist) fd.append('artist', artist);
      const res = await fetch(apiUrl('/api/songs'), { method: 'POST', body: fd });
      if (!res.ok) throw new Error((await res.json()).error || 'Could not add that song');
      return absolutizeSong(await res.json());
    },
    async deleteSong(id) {
      await fetch(apiUrl('/api/songs/' + id), { method: 'DELETE' });
    },
  };

  /* ---------------- local store (on-device IndexedDB) ---------------- */
  const DB_NAME = 'gulay-wardrobe';
  const DB_VERSION = 6;
  let dbPromise = null;
  const photoUrls = new Map(); // item id -> object URL for this session

  function openDb() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('items')) db.createObjectStore('items', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('outfits')) db.createObjectStore('outfits', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('planner')) db.createObjectStore('planner', { keyPath: 'date' });
          if (!db.objectStoreNames.contains('countdowns')) db.createObjectStore('countdowns', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('songs')) db.createObjectStore('songs', { keyPath: 'id' });
          if (db.objectStoreNames.contains('chatHistory')) db.deleteObjectStore('chatHistory'); // superseded by chatThreads
          if (!db.objectStoreNames.contains('chatThreads')) db.createObjectStore('chatThreads', { keyPath: 'id' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  }

  function tx(storeName, mode, fn) {
    return openDb().then(
      (db) =>
        new Promise((resolve, reject) => {
          const t = db.transaction(storeName, mode);
          const result = fn(t.objectStore(storeName));
          t.oncomplete = () => resolve(result && 'result' in result ? result.result : undefined);
          t.onerror = () => reject(t.error);
        })
    );
  }

  function getAll(storeName) {
    return openDb().then(
      (db) =>
        new Promise((resolve, reject) => {
          const req = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        })
    );
  }

  function newId() {
    return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
  }

  function withPhotoUrl(record) {
    const { photoBlob, ...item } = record;
    if (photoBlob) {
      if (!photoUrls.has(item.id)) photoUrls.set(item.id, URL.createObjectURL(photoBlob));
      item.photo = photoUrls.get(item.id);
    }
    return item;
  }

  const audioUrls = new Map(); // song id -> object URL for this session
  function withAudioUrl(record) {
    const { audioBlob, ...song } = record;
    if (audioBlob) {
      if (!audioUrls.has(song.id)) audioUrls.set(song.id, URL.createObjectURL(audioBlob));
      song.url = audioUrls.get(song.id);
    }
    return song;
  }

  const LocalStore = {
    mode: 'device',
    async listItems() {
      const records = await getAll('items');
      records.sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1));
      return records.map(withPhotoUrl);
    },
    async addItem({ file, name, category, color, store, notes, price }) {
      const record = {
        id: newId(),
        name: (name || '').trim() || 'Untitled piece',
        category: category || 'Tops',
        color: (color || '').trim(),
        store: (store || '').trim(),
        notes: (notes || '').trim(),
        price: price ? Number(price) || 0 : 0,
        favorite: false,
        addedAt: new Date().toISOString(),
        photoBlob: file,
      };
      await tx('items', 'readwrite', (s) => s.put(record));
      return withPhotoUrl(record);
    },
    async updateItem(id, patch) {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const t = db.transaction('items', 'readwrite');
        const s = t.objectStore('items');
        const getReq = s.get(id);
        getReq.onsuccess = () => {
          const record = getReq.result;
          if (!record) return reject(new Error('Not found'));
          const editable = ['name', 'category', 'color', 'store', 'notes', 'favorite', 'price'];
          for (const key of editable) if (key in patch) record[key] = key === 'price' ? Number(patch[key]) || 0 : patch[key];
          s.put(record);
          t.oncomplete = () => resolve(withPhotoUrl(record));
        };
        t.onerror = () => reject(t.error);
      });
    },
    async deleteItem(id) {
      if (photoUrls.has(id)) {
        URL.revokeObjectURL(photoUrls.get(id));
        photoUrls.delete(id);
      }
      await tx('items', 'readwrite', (s) => s.delete(id));
      // drop the piece from saved outfits, delete outfits left empty
      const outfits = await getAll('outfits');
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const t = db.transaction('outfits', 'readwrite');
        const s = t.objectStore('outfits');
        for (const o of outfits) {
          const remaining = o.itemIds.filter((x) => x !== id);
          if (remaining.length === 0) s.delete(o.id);
          else if (remaining.length !== o.itemIds.length) s.put({ ...o, itemIds: remaining });
        }
        t.oncomplete = resolve;
        t.onerror = () => reject(t.error);
      });
    },
    async listOutfits() {
      const outfits = await getAll('outfits');
      outfits.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      return outfits;
    },
    async addOutfit({ name, itemIds }) {
      const outfit = {
        id: newId(),
        name: (name || '').trim() || 'Untitled look',
        itemIds: [...itemIds],
        createdAt: new Date().toISOString(),
      };
      await tx('outfits', 'readwrite', (s) => s.put(outfit));
      return outfit;
    },
    async deleteOutfit(id) {
      await tx('outfits', 'readwrite', (s) => s.delete(id));
    },

    // ----- planner (on-device: no AI briefing text, just the plan itself) -----
    async listPlanner() {
      return getAll('planner');
    },
    async savePlanDay(date, { outfitId, note, remindAt }) {
      note = (note || '').trim();
      if (!outfitId && !note) {
        await tx('planner', 'readwrite', (s) => s.delete(date));
        return { removed: true };
      }
      const entry = { date, outfitId: outfitId || null, note, remindAt: /^\d{2}:\d{2}$/.test(remindAt) ? remindAt : null, briefing: null, updatedAt: new Date().toISOString() };
      await tx('planner', 'readwrite', (s) => s.put(entry));
      return entry;
    },
    async deletePlanDay(date) {
      await tx('planner', 'readwrite', (s) => s.delete(date));
    },

    // ----- countdowns (fully on-device, no AI needed) -----
    async listCountdowns() {
      const rows = await getAll('countdowns');
      rows.sort((a, b) => (a.date < b.date ? -1 : 1));
      return rows;
    },
    async addCountdown({ label, date, icon }) {
      const existing = await getAll('countdowns');
      const countdown = {
        id: newId(),
        label: (label || '').trim().slice(0, 60),
        date,
        icon: ['birthday', 'school', 'travel', 'event', 'custom'].includes(icon) ? icon : 'event',
        pinned: existing.length === 0,
        createdAt: new Date().toISOString(),
      };
      await tx('countdowns', 'readwrite', (s) => s.put(countdown));
      return countdown;
    },
    async pinCountdown(id) {
      const rows = await getAll('countdowns');
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const t = db.transaction('countdowns', 'readwrite');
        const s = t.objectStore('countdowns');
        for (const row of rows) s.put({ ...row, pinned: row.id === id });
        t.oncomplete = () => resolve({ ok: true });
        t.onerror = () => reject(t.error);
      });
    },
    async deleteCountdown(id) {
      const rows = await getAll('countdowns');
      const wasPinned = rows.find((c) => c.id === id && c.pinned);
      await tx('countdowns', 'readwrite', (s) => s.delete(id));
      const remaining = rows.filter((c) => c.id !== id);
      if (wasPinned && remaining.length) await this.pinCountdown(remaining[0].id);
    },

    // ----- chatbot needs a backend for AI answers, but threads still work offline -----
    async askChat() {
      throw new Error('The assistant needs the online version.');
    },
    async listChatThreads() {
      const rows = await getAll('chatThreads');
      rows.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
      return rows.map((t) => ({ id: t.id, title: t.title, updatedAt: t.updatedAt, messageCount: t.messages.length }));
    },
    async createChatThread() {
      const thread = {
        id: newId(),
        title: 'New chat',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [],
      };
      await tx('chatThreads', 'readwrite', (s) => s.put(thread));
      return thread;
    },
    async getChatThread(id) {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const req = db.transaction('chatThreads', 'readonly').objectStore('chatThreads').get(id);
        req.onsuccess = () => (req.result ? resolve(req.result) : reject(new Error('Chat not found')));
        req.onerror = () => reject(req.error);
      });
    },
    async deleteChatThread(id) {
      await tx('chatThreads', 'readwrite', (s) => s.delete(id));
    },
    async appendChatThreadMessages(id, entries) {
      const thread = await this.getChatThread(id).catch(() => null);
      if (!thread) return;
      for (const e of entries) thread.messages.push({ role: e.role, text: e.text, at: new Date().toISOString() });
      thread.updatedAt = new Date().toISOString();
      await tx('chatThreads', 'readwrite', (s) => s.put(thread));
    },

    // ----- music (fully on-device: songs stored as blobs) -----
    async listSongs() {
      const rows = await getAll('songs');
      rows.sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1));
      return rows.map(withAudioUrl);
    },
    async addSong({ file, title, artist }) {
      const fallbackTitle = file.name ? file.name.replace(/\.[^.]+$/, '') : 'Untitled song';
      const record = {
        id: newId(),
        title: (title || '').trim() || fallbackTitle,
        artist: (artist || '').trim(),
        addedAt: new Date().toISOString(),
        audioBlob: file,
      };
      await tx('songs', 'readwrite', (s) => s.put(record));
      return withAudioUrl(record);
    },
    async deleteSong(id) {
      if (audioUrls.has(id)) {
        URL.revokeObjectURL(audioUrls.get(id));
        audioUrls.delete(id);
      }
      await tx('songs', 'readwrite', (s) => s.delete(id));
    },

    // Link import + try-on need a backend; not available in pure on-device mode.
    supportsLinks: false,
    async scrape() {
      throw new Error('Adding from a link needs the online version.');
    },
    async addItemFromUrl() {
      throw new Error('Adding from a link needs the online version.');
    },
    async getProfile() {
      return { photos: [], slots: [] };
    },
    async saveProfileSlot() {
      throw new Error('Try-on needs the online version.');
    },
    async deleteProfileSlot() {
      return { photos: [] };
    },
    async tryonStatus() {
      return { configured: false, hasModelPhoto: false, profileCount: 0, profileSlots: [] };
    },
    async tryOn() {
      throw new Error('Try-on needs the online version.');
    },
  };

  window.wardrobeStore = forceLocal ? LocalStore : RemoteStore;
})();
