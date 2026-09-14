const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Load a local .env file (so REPLICATE_API_TOKEN etc. can live in one place).
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
  }
} catch {}

const { scrapeProduct, downloadImage } = require('./scrape');
const ai = require('./ai');

const app = express();
const PORT = process.env.PORT || 4477;

const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');

for (const dir of [DATA_DIR, UPLOADS_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadDb() {
  try {
    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    if (!db.settings) db.settings = {};
    return db;
  } catch {
    return { items: [], outfits: [], settings: {} };
  }
}

function saveDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

let db = loadDb();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, crypto.randomUUID() + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, /^image\//.test(file.mimetype));
  },
});

const uploadAudio = multer({
  storage,
  limits: { fileSize: 40 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, /^audio\//.test(file.mimetype));
  },
});

app.use(express.json());
// The native iOS app loads from a different origin (capacitor://localhost)
// than this server, so its requests need CORS allowed. This is a private,
// single-user app with no cookie-based auth, so reflecting the request's
// own origin back is safe — there's nothing a cross-site request could steal.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use((req, res, next) => {
  if (req.method !== 'GET') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});
// The bundled mime-db doesn't know some newer extensions (.avif in
// particular), so it falls back to application/octet-stream — browsers
// tolerate that same-origin but silently refuse to render/play it as an
// <img>/<audio> source cross-origin (which the native app always is, since
// it loads from a different origin than the server). Force the right type.
const UPLOAD_MIME_TYPES = {
  '.avif': 'image/avif', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.gif': 'image/gif',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.aac': 'audio/aac',
};
app.use(
  '/uploads',
  express.static(UPLOADS_DIR, {
    setHeaders: (res, filePath) => {
      const type = UPLOAD_MIME_TYPES[path.extname(filePath).toLowerCase()];
      if (type) res.setHeader('Content-Type', type);
    },
  })
);
// The native app bundles its own copy of public/ (Capacitor's webDir) and
// only ever calls the /api/* and /uploads/* routes above — it never loads
// index.html/app.js from the server. So the public website below is optional:
// set SERVE_WEBSITE=false in .env on a server you don't want browsable
// (e.g. your production deploy) to turn it off and keep only the API live.
// Left on by default so `npm start` + a browser still works for local dev.
if (process.env.SERVE_WEBSITE !== 'false') {
  app.use(express.static(path.join(__dirname, 'public')));
}

// ---- Items ----
app.get('/api/items', (req, res) => {
  res.json(db.items);
});

// Best-effort: swap a closet photo's background for clean white. Never
// throws — on any failure (or no API key) the original photo is kept as-is.
async function whitenBackground(photoPath) {
  if (!ai.isConfigured()) return photoPath;
  try {
    const abs = path.join(UPLOADS_DIR, path.basename(photoPath));
    const buf = fs.readFileSync(abs);
    const ext = path.extname(abs).slice(1).toLowerCase();
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const dataUri = `data:${mime};base64,${buf.toString('base64')}`;
    const result = await ai.whiteBackgroundPhoto(dataUri);
    const newPath = await persistGenerated(result);
    fs.unlink(abs, () => {});
    return newPath;
  } catch {
    return photoPath; // keep the original — this is a nice-to-have, not required
  }
}

app.post('/api/items', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'A photo is required' });
  const { name, category, color, store, notes, price } = req.body;
  const item = {
    id: crypto.randomUUID(),
    name: (name || '').trim() || 'Untitled piece',
    category: category || 'Tops',
    color: (color || '').trim(),
    store: (store || '').trim(),
    notes: (notes || '').trim(),
    price: price ? Number(price) || 0 : 0,
    photo: '/uploads/' + req.file.filename,
    favorite: false,
    addedAt: new Date().toISOString(),
  };
  item.photo = await whitenBackground(item.photo);
  db.items.unshift(item);
  saveDb(db);
  res.status(201).json(item);
});

app.patch('/api/items/:id', (req, res) => {
  const item = db.items.find((i) => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  const editable = ['name', 'category', 'color', 'store', 'notes', 'favorite', 'price'];
  for (const key of editable) {
    if (key in req.body) item[key] = key === 'price' ? Number(req.body[key]) || 0 : req.body[key];
  }
  saveDb(db);
  res.json(item);
});

app.delete('/api/items/:id', (req, res) => {
  const idx = db.items.findIndex((i) => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const [removed] = db.items.splice(idx, 1);
  // Remove the photo file and drop the item from any saved outfits
  const photoPath = path.join(UPLOADS_DIR, path.basename(removed.photo));
  fs.unlink(photoPath, () => {});
  for (const outfit of db.outfits) {
    outfit.itemIds = outfit.itemIds.filter((id) => id !== removed.id);
  }
  db.outfits = db.outfits.filter((o) => o.itemIds.length > 0);
  saveDb(db);
  res.json({ ok: true });
});

// ---- Outfits ----
app.get('/api/outfits', (req, res) => {
  res.json(db.outfits);
});

app.post('/api/outfits', (req, res) => {
  const { name, itemIds } = req.body;
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return res.status(400).json({ error: 'Pick at least one piece' });
  }
  const valid = itemIds.filter((id) => db.items.some((i) => i.id === id));
  const outfit = {
    id: crypto.randomUUID(),
    name: (name || '').trim() || 'Untitled look',
    itemIds: valid,
    createdAt: new Date().toISOString(),
  };
  db.outfits.unshift(outfit);
  saveDb(db);
  res.status(201).json(outfit);
});

app.delete('/api/outfits/:id', (req, res) => {
  const idx = db.outfits.findIndex((o) => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  db.outfits.splice(idx, 1);
  for (const entry of db.planner || []) {
    if (entry.outfitId === req.params.id) { entry.outfitId = null; entry.briefing = null; }
  }
  saveDb(db);
  res.json({ ok: true });
});

// ---- Scrape a product from a store link ----
app.post('/api/scrape', async (req, res) => {
  const { url } = req.body || {};
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'A product link is required' });
  try {
    const data = await scrapeProduct(url);
    res.json(data);
  } catch (err) {
    res.status(422).json({ error: err.message || 'Could not read that link.' });
  }
});

// ---- Create an item from a scraped product (downloads the remote image locally) ----
app.post('/api/items/from-url', async (req, res) => {
  const { imageUrl, url, name, category, color, store, notes, price } = req.body || {};
  try {
    let remoteImage = imageUrl;
    let scraped = {};
    if (!remoteImage && url) {
      scraped = await scrapeProduct(url);
      remoteImage = scraped.image;
    }
    if (!remoteImage) return res.status(400).json({ error: 'No image to save' });
    const photo = await downloadImage(remoteImage, UPLOADS_DIR, path, fs, crypto);
    const item = {
      id: crypto.randomUUID(),
      name: (name || scraped.name || '').trim() || 'Untitled piece',
      category: category || 'Tops',
      color: (color || '').trim(),
      store: (store || scraped.brand || '').trim(),
      notes: (notes || '').trim(),
      price: price ? Number(price) || 0 : (Number(String(scraped.price || '').replace(/[^0-9.]/g, '')) || 0),
      sourceUrl: url || scraped.sourceUrl || '',
      photo,
      favorite: false,
      addedAt: new Date().toISOString(),
    };
    item.photo = await whitenBackground(item.photo);
    db.items.unshift(item);
    saveDb(db);
    res.status(201).json(item);
  } catch (err) {
    res.status(422).json({ error: err.message || 'Could not import that product.' });
  }
});

// ---- Gülay's photo profile (multi-angle references used for virtual try-on) ----
const PROFILE_SLOTS = ['face', 'waist', 'full', 'left', 'right', 'pose'];

function getProfile() {
  // migrate a legacy single modelPhoto into the profile the first time
  if (!Array.isArray(db.settings.modelPhotos)) {
    db.settings.modelPhotos = db.settings.modelPhoto ? [{ slot: 'full', photo: db.settings.modelPhoto }] : [];
  }
  return db.settings.modelPhotos;
}

function profilePhotoRefs() {
  // ordered so identity anchors (face, waist, full) come first
  const order = (s) => (PROFILE_SLOTS.indexOf(s) === -1 ? 99 : PROFILE_SLOTS.indexOf(s));
  return getProfile()
    .slice()
    .sort((a, b) => order(a.slot) - order(b.slot))
    .map((p) => p.photo);
}

app.get('/api/profile', (req, res) => {
  res.json({ photos: getProfile(), slots: PROFILE_SLOTS });
});

app.post('/api/profile/:slot', upload.single('photo'), (req, res) => {
  const slot = req.params.slot;
  if (!PROFILE_SLOTS.includes(slot)) return res.status(400).json({ error: 'Unknown photo slot' });
  if (!req.file) return res.status(400).json({ error: 'A photo is required' });
  const profile = getProfile();
  const existing = profile.find((p) => p.slot === slot);
  if (existing) {
    fs.unlink(path.join(UPLOADS_DIR, path.basename(existing.photo)), () => {});
    existing.photo = '/uploads/' + req.file.filename;
  } else {
    profile.push({ slot, photo: '/uploads/' + req.file.filename });
  }
  // keep the legacy field pointing at a sensible primary for any old code
  db.settings.modelPhoto = (profile.find((p) => p.slot === 'full') || profile.find((p) => p.slot === 'face') || profile[0]).photo;
  saveDb(db);
  res.json({ photos: profile });
});

app.delete('/api/profile/:slot', (req, res) => {
  const profile = getProfile();
  const idx = profile.findIndex((p) => p.slot === req.params.slot);
  if (idx !== -1) {
    fs.unlink(path.join(UPLOADS_DIR, path.basename(profile[idx].photo)), () => {});
    profile.splice(idx, 1);
    db.settings.modelPhoto = profile.length ? profile[0].photo : undefined;
    saveDb(db);
  }
  res.json({ photos: profile });
});

// ---- Virtual try-on: dress Gülay in a whole look ----
app.get('/api/tryon/status', (req, res) => {
  const profile = getProfile();
  res.json({
    configured: ai.isConfigured(),
    provider: ai.provider,
    hasModelPhoto: profile.length > 0,
    profileCount: profile.length,
    profileSlots: profile.map((p) => p.slot),
  });
});

// Persist a generated image (data: URI from Gemini, or remote URL from Replicate).
async function persistGenerated(imageRef) {
  if (imageRef.startsWith('data:')) {
    const m = imageRef.match(/^data:([^;]+);base64,(.*)$/s);
    if (!m) throw new Error('Bad image data');
    const ext = m[1].includes('png') ? '.png' : m[1].includes('webp') ? '.webp' : '.jpg';
    const filename = crypto.randomUUID() + ext;
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), Buffer.from(m[2], 'base64'));
    return '/uploads/' + filename;
  }
  return downloadImage(imageRef, UPLOADS_DIR, path, fs, crypto);
}

app.post('/api/tryon', async (req, res) => {
  const body = req.body || {};
  const ids = Array.isArray(body.itemIds) ? body.itemIds : body.itemId ? [body.itemId] : [];
  const garments = ids.map((id) => db.items.find((i) => i.id === id)).filter(Boolean);
  const personRefs = profilePhotoRefs();
  if (!garments.length) return res.status(400).json({ error: 'Choose at least one piece' });
  if (!personRefs.length) return res.status(400).json({ error: 'Add photos of Gülay first' });
  if (!ai.isConfigured()) {
    return res.status(503).json({ error: 'Virtual try-on is not set up yet — add a Gemini API key.' });
  }
  try {
    const result = await ai.generateLook({
      personImageRefs: personRefs,
      garments,
      instructions: typeof body.instructions === 'string' ? body.instructions : '',
      uploadsDir: UPLOADS_DIR,
    });
    const photo = await persistGenerated(result);
    res.json({ image: photo });
  } catch (err) {
    res.status(502).json({ error: err.message || 'Try-on failed.' });
  }
});

// ---- Planner: what to wear + reminders, by date ('YYYY-MM-DD') ----
if (!Array.isArray(db.planner)) db.planner = [];

function findPlanEntry(date) {
  return db.planner.find((p) => p.date === date);
}

app.get('/api/planner', (req, res) => {
  res.json(db.planner);
});

app.put('/api/planner/:date', async (req, res) => {
  const date = req.params.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Bad date' });
  const { outfitId, note, remindAt } = req.body || {};
  if (outfitId && !db.outfits.some((o) => o.id === outfitId)) {
    return res.status(400).json({ error: 'Unknown look' });
  }
  let entry = findPlanEntry(date);
  if (!entry) {
    entry = { id: crypto.randomUUID(), date, outfitId: null, note: '', remindAt: null, briefing: null };
    db.planner.push(entry);
  }
  const changed = entry.outfitId !== (outfitId || null) || entry.note !== (note || '').trim();
  entry.outfitId = outfitId || null;
  entry.note = (note || '').trim();
  entry.remindAt = /^\d{2}:\d{2}$/.test(remindAt) ? remindAt : null;
  entry.updatedAt = new Date().toISOString();
  if (!entry.outfitId && !entry.note) {
    // nothing left to plan for this day — drop the entry entirely
    db.planner = db.planner.filter((p) => p.date !== date);
    saveDb(db);
    return res.json({ removed: true });
  }
  if (changed) entry.briefing = null; // stale — refreshed lazily below
  saveDb(db);
  if (!entry.briefing && ai.isConfigured()) {
    try {
      const outfit = entry.outfitId ? db.outfits.find((o) => o.id === entry.outfitId) : null;
      const items = outfit ? outfit.itemIds.map((id) => db.items.find((i) => i.id === id)).filter(Boolean) : [];
      entry.briefing = await ai.generateDailyBriefing({ date, outfitName: outfit && outfit.name, items, note: entry.note });
      saveDb(db);
    } catch {
      // briefing is a nice-to-have; leave it null on failure
    }
  }
  res.json(entry);
});

app.delete('/api/planner/:date', (req, res) => {
  db.planner = db.planner.filter((p) => p.date !== req.params.date);
  saveDb(db);
  res.json({ ok: true });
});

// ---- Countdowns ("5 days until her birthday") ----
if (!Array.isArray(db.countdowns)) db.countdowns = [];

app.get('/api/countdowns', (req, res) => {
  res.json(db.countdowns);
});

app.post('/api/countdowns', (req, res) => {
  const { label, date, icon } = req.body || {};
  if (!label || !/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
    return res.status(400).json({ error: 'A label and date are required' });
  }
  const countdown = {
    id: crypto.randomUUID(),
    label: String(label).trim().slice(0, 60),
    date,
    icon: ['birthday', 'school', 'travel', 'event', 'custom'].includes(icon) ? icon : 'event',
    pinned: db.countdowns.length === 0, // first one becomes the widget's default
    createdAt: new Date().toISOString(),
  };
  db.countdowns.push(countdown);
  saveDb(db);
  res.status(201).json(countdown);
});

app.patch('/api/countdowns/:id', (req, res) => {
  const c = db.countdowns.find((x) => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  if (req.body.pinned) {
    for (const other of db.countdowns) other.pinned = false;
  }
  for (const key of ['label', 'date', 'icon', 'pinned']) {
    if (key in req.body) c[key] = req.body[key];
  }
  saveDb(db);
  res.json(c);
});

app.delete('/api/countdowns/:id', (req, res) => {
  const wasPinned = db.countdowns.find((c) => c.id === req.params.id && c.pinned);
  db.countdowns = db.countdowns.filter((c) => c.id !== req.params.id);
  if (wasPinned && db.countdowns.length) db.countdowns[0].pinned = true;
  saveDb(db);
  res.json({ ok: true });
});

// ---- Calendar chatbot: ask plain-language questions about the planner ----
function plannerSummaryText() {
  const days = (db.planner || [])
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((entry) => {
      const outfit = entry.outfitId ? db.outfits.find((o) => o.id === entry.outfitId) : null;
      const bits = [];
      if (outfit) bits.push(`outfit "${outfit.name}"`);
      if (entry.note) bits.push(`note: "${entry.note}"`);
      return bits.length ? `${entry.date}: ${bits.join(', ')}` : null;
    })
    .filter(Boolean);
  const countdowns = (db.countdowns || []).map((c) => `Countdown "${c.label}" on ${c.date}`);
  return [...days, ...countdowns].join('\n');
}

function closetSummaryText() {
  const byCat = {};
  let totalSpent = 0;
  for (const item of db.items) {
    byCat[item.category] = (byCat[item.category] || 0) + 1;
    totalSpent += Number(item.price) || 0;
  }
  const catLine = Object.entries(byCat).map(([c, n]) => `${c}: ${n}`).join(', ');
  const favs = db.items.filter((i) => i.favorite).map((i) => i.name);
  const lines = [
    `Total pieces: ${db.items.length}${catLine ? ' (' + catLine + ')' : ''}`,
    totalSpent > 0 ? `Total spent on tracked pieces: $${totalSpent.toFixed(2)}` : null,
    favs.length ? `Favorites: ${favs.join(', ')}` : null,
    `Saved looks: ${db.outfits.map((o) => o.name).join(', ') || '(none yet)'}`,
  ].filter(Boolean);
  return lines.join('\n');
}

// ---- Chat memory: multiple threads, ChatGPT-style, persisted server-side
// so it's the same conversations no matter which browser/device opens the
// app (unlike localStorage, which is stuck to one browser). Threads start
// completely empty — no auto bot greeting — she writes the first message. ----
if (!Array.isArray(db.chatThreads)) db.chatThreads = [];
// one-time migration from the old single flat-history shape
if (Array.isArray(db.chatHistory) && db.chatHistory.length && !db.chatThreads.length) {
  db.chatThreads.push({
    id: crypto.randomUUID(),
    title: threadTitleFrom(db.chatHistory) || 'Chat',
    createdAt: db.chatHistory[0].at || new Date().toISOString(),
    updatedAt: db.chatHistory[db.chatHistory.length - 1].at || new Date().toISOString(),
    messages: db.chatHistory,
  });
}
if ('chatHistory' in db) {
  delete db.chatHistory;
  saveDb(db);
}

function threadTitleFrom(messages) {
  const firstUser = messages.find((m) => m.role === 'user');
  if (!firstUser) return null;
  return firstUser.text.length > 48 ? firstUser.text.slice(0, 48) + '…' : firstUser.text;
}

function findThread(id) {
  return db.chatThreads.find((t) => t.id === id);
}

function newThread() {
  return {
    id: crypto.randomUUID(),
    title: 'New chat',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
  };
}

app.get('/api/chat/threads', (req, res) => {
  const list = db.chatThreads
    .slice()
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .map((t) => ({ id: t.id, title: t.title, updatedAt: t.updatedAt, messageCount: t.messages.length }));
  res.json(list);
});

app.post('/api/chat/threads', (req, res) => {
  const thread = newThread();
  db.chatThreads.unshift(thread);
  saveDb(db);
  res.status(201).json(thread);
});

app.get('/api/chat/threads/:id', (req, res) => {
  const thread = findThread(req.params.id);
  if (!thread) return res.status(404).json({ error: 'Not found' });
  res.json(thread);
});

app.delete('/api/chat/threads/:id', (req, res) => {
  db.chatThreads = db.chatThreads.filter((t) => t.id !== req.params.id);
  saveDb(db);
  res.json({ ok: true });
});

// Lets the client log exchanges it handled itself without calling the AI
// (e.g. music commands) so they still show up in that thread's history.
app.post('/api/chat/threads/:id/messages', (req, res) => {
  const thread = findThread(req.params.id);
  if (!thread) return res.status(404).json({ error: 'Not found' });
  const entries = Array.isArray(req.body && req.body.entries) ? req.body.entries : [];
  for (const e of entries) {
    if (e && typeof e.text === 'string' && (e.role === 'user' || e.role === 'bot')) {
      thread.messages.push({ role: e.role, text: e.text.slice(0, 2000), at: new Date().toISOString() });
    }
  }
  if (thread.title === 'New chat') thread.title = threadTitleFrom(thread.messages) || thread.title;
  thread.updatedAt = new Date().toISOString();
  thread.messages = thread.messages.slice(-300);
  saveDb(db);
  res.json({ ok: true });
});

app.post('/api/chat', async (req, res) => {
  const { question, threadId } = req.body || {};
  if (!question || typeof question !== 'string') return res.status(400).json({ error: 'A question is required' });
  const thread = threadId && findThread(threadId);
  if (!thread) return res.status(400).json({ error: 'Unknown chat — refresh and try again.' });
  if (!ai.isConfigured()) return res.status(503).json({ error: 'The assistant needs a Gemini API key.' });
  try {
    const answer = await ai.answerCalendarQuestion({
      question,
      todayDate: new Date().toISOString().slice(0, 10),
      plannerSummary: plannerSummaryText(),
      closetSummary: closetSummaryText(),
      history: thread.messages,
    });
    thread.messages.push({ role: 'user', text: question, at: new Date().toISOString() });
    thread.messages.push({ role: 'bot', text: answer, at: new Date().toISOString() });
    if (thread.title === 'New chat') thread.title = threadTitleFrom(thread.messages) || thread.title;
    thread.updatedAt = new Date().toISOString();
    thread.messages = thread.messages.slice(-300);
    saveDb(db);
    res.json({ answer });
  } catch (err) {
    res.status(502).json({ error: err.message || 'Could not answer that right now.' });
  }
});

// ---- Music: her own songs, played in-app ----
if (!Array.isArray(db.songs)) db.songs = [];

app.get('/api/songs', (req, res) => {
  res.json(db.songs);
});

app.post('/api/songs', uploadAudio.single('audio'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'An audio file is required' });
  const { title, artist } = req.body || {};
  const fallbackTitle = path.basename(req.file.originalname, path.extname(req.file.originalname));
  const song = {
    id: crypto.randomUUID(),
    title: (title || '').trim() || fallbackTitle || 'Untitled song',
    artist: (artist || '').trim(),
    url: '/uploads/' + req.file.filename,
    addedAt: new Date().toISOString(),
  };
  db.songs.push(song);
  saveDb(db);
  res.status(201).json(song);
});

app.delete('/api/songs/:id', (req, res) => {
  const idx = db.songs.findIndex((s) => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const [removed] = db.songs.splice(idx, 1);
  fs.unlink(path.join(UPLOADS_DIR, path.basename(removed.url)), () => {});
  saveDb(db);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Gülay's wardrobe is open at http://localhost:${PORT}`);
  console.log(`Virtual try-on: ${ai.isConfigured() ? 'ready (' + ai.provider + ')' : 'not configured'}`);
});
