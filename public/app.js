/* ======================= Gülay's Wardrobe ======================= */

const CATEGORIES = ['Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Shoes', 'Bags', 'Accessories'];
const STUDIO_ORDER = ['Outerwear', 'Dresses', 'Tops', 'Bottoms', 'Shoes', 'Bags', 'Accessories'];
const CATEGORY_ICONS = {
  Tops: 'catTop', Bottoms: 'catBottom', Dresses: 'catDress', Outerwear: 'catOuterwear',
  Shoes: 'catShoes', Bags: 'catBag', Accessories: 'catAccessory',
};

const state = {
  items: [],
  outfits: [],
  filter: 'All',
  search: '',
  // studio: per-category { index, on }
  modalItemId: null,
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

/* ---------------- icon hydration (static HTML uses data-icon, no emoji anywhere) ---------------- */
function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    if (el.querySelector('svg.icon')) return; // already hydrated
    el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon));
  });
}
hydrateIcons();

/* ---------------- data store (server or on-device, see store.js) ---------------- */
const store = window.wardrobeStore;

/* ---------------- toast ---------------- */
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

/* ---------------- wardrobe intro ---------------- */
function playIntro() {
  const intro = $('#intro');
  document.body.style.overflow = 'hidden';
  intro.classList.add('opening');
  setTimeout(() => intro.classList.add('zooming'), 1750);
  setTimeout(() => {
    intro.classList.add('gone');
    intro.classList.remove('opening', 'zooming');
    document.body.style.overflow = '';
  }, 2650);
}

/* ---------------- navigation ---------------- */
let navBusy = false;

function switchPage(page) {
  $$('.page').forEach((p) => p.classList.remove('active'));
  $('#page-' + page).classList.add('active');
  $$('.nav-link').forEach((b) => b.classList.toggle('active', b.dataset.page === page));
  moveUnderline();
  window.scrollTo({ top: 0 });
  if (page === 'studio') renderStudio();
  if (page === 'home') { observeReveals(); renderTodayCard(); }
  if (page === 'planner') renderPlanner();
  if (page === 'chat') setTimeout(() => $('#chatInput').focus(), 300);
}

let pendingNav = null;

function goTo(page) {
  const current = $('.page.active');
  if (current && current.id === 'page-' + page) return switchPage(page);
  if (navBusy) {
    pendingNav = page;
    return;
  }
  navBusy = true;
  const intro = $('#intro');
  intro.classList.remove('gone');
  intro.classList.add('quick');
  // let the open state apply, then swing the doors shut
  setTimeout(() => {
    intro.classList.add('shut');
    setTimeout(() => {
      switchPage(page);
      intro.classList.remove('shut'); // doors swing open onto the new page
      setTimeout(() => {
        intro.classList.add('gone');
        intro.classList.remove('quick');
        navBusy = false;
        if (pendingNav) {
          const next = pendingNav;
          pendingNav = null;
          goTo(next);
        }
      }, 440);
    }, 440);
  }, 30);
}

function moveUnderline() {
  const active = $('.nav-link.active');
  const underline = $('#navUnderline');
  if (!active) return;
  underline.style.left = active.offsetLeft + 10 + 'px';
  underline.style.width = active.offsetWidth - 20 + 'px';
}

$$('.nav-link').forEach((btn) => btn.addEventListener('click', () => { goTo(btn.dataset.page); closeNavDrawer(); }));

/* ---------------- mobile nav drawer (hamburger, slides in left-to-right) ---------------- */
function openNavDrawer() {
  const backdrop = $('#navDrawerBackdrop');
  backdrop.hidden = false;
  void backdrop.offsetWidth; // force reflow so the transition actually animates
  backdrop.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeNavDrawer() {
  const backdrop = $('#navDrawerBackdrop');
  if (backdrop.hidden) return;
  backdrop.classList.remove('open');
  document.body.style.overflow = '';
  setTimeout(() => { backdrop.hidden = true; }, 320);
}
$('#hamburgerBtn').addEventListener('click', openNavDrawer);
$('#navDrawerClose').addEventListener('click', closeNavDrawer);
$('#navDrawerBackdrop').addEventListener('click', (e) => {
  if (e.target === $('#navDrawerBackdrop')) closeNavDrawer();
});

document.addEventListener('click', (e) => {
  const studioGo = e.target.closest('[data-studiotab-goto]');
  if (studioGo) { setStudioTab(studioGo.dataset.studiotabGoto); return; }
  const go = e.target.closest('[data-goto]');
  if (!go) return;
  if (go.dataset.goto === 'add') { openAddModal(); return; }
  if (go.dataset.filter === 'favorites') state.filter = '♥';
  goTo(go.dataset.goto);
  if (go.dataset.goto === 'closet') renderCloset();
});

window.addEventListener('resize', moveUnderline);

/* ---------------- sparkles ---------------- */
(function sparkles() {
  const field = $('#sparkleField');
  const glyphs = ['sparkle', 'heartOutline', 'star'];
  for (let i = 0; i < 16; i++) {
    const s = document.createElement('span');
    s.className = 'sparkle';
    s.innerHTML = icon(glyphs[i % glyphs.length]);
    s.style.left = Math.random() * 100 + 'vw';
    s.style.bottom = '-30px';
    s.style.color = i % 3 === 0 ? '#c9a86a' : '#c98a94';
    s.style.width = s.style.height = 10 + Math.random() * 12 + 'px';
    s.style.animationDuration = 14 + Math.random() * 18 + 's';
    s.style.animationDelay = -Math.random() * 20 + 's';
    field.appendChild(s);
  }
})();

/* ---------------- home ---------------- */
function renderHome() {
  $('#statPieces').textContent = state.items.length;
  $('#statLooks').textContent = state.outfits.length;
  $('#statFavs').textContent = state.items.filter((i) => i.favorite).length;
  renderCountdowns();
}

/* ---------------- scroll reveals ---------------- */
const revealObserver = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        revealObserver.unobserve(e.target);
      }
    }
  },
  { threshold: 0.15 }
);
function observeReveals() {
  $$('.reveal:not(.in)').forEach((el) => revealObserver.observe(el));
}

/* ---------------- closet ---------------- */
function renderChips() {
  const counts = { All: state.items.length, '♥': state.items.filter((i) => i.favorite).length };
  for (const c of CATEGORIES) counts[c] = state.items.filter((i) => i.category === c).length;
  const chips = ['All', '♥', ...CATEGORIES.filter((c) => counts[c] > 0)];
  $('#categoryChips').innerHTML = chips
    .map((c) => `<button class="chip ${state.filter === c ? 'active' : ''}" data-chip="${c}">${c === '♥' ? icon('heartFilled') + ' Favorites' : c}</button>`)
    .join('');
  $$('#categoryChips .chip').forEach((chip) =>
    chip.addEventListener('click', () => {
      state.filter = chip.dataset.chip;
      renderCloset();
    })
  );
}

function filteredItems() {
  let items = state.items;
  if (state.filter === '♥') items = items.filter((i) => i.favorite);
  else if (state.filter !== 'All') items = items.filter((i) => i.category === state.filter);
  const q = state.search.trim().toLowerCase();
  if (q) {
    items = items.filter((i) =>
      [i.name, i.category, i.color, i.store, i.notes].join(' ').toLowerCase().includes(q)
    );
  }
  return items;
}

function renderCloset() {
  renderChips();
  const grid = $('#closetGrid');
  const items = filteredItems();
  $('#closetEmpty').hidden = state.items.length > 0;
  grid.innerHTML = items
    .map(
      (item, i) => `
    <article class="card" data-id="${item.id}" style="animation-delay:${Math.min(i * 0.05, 0.6)}s">
      <div class="card-photo">
        <img src="${item.photo}" alt="${esc(item.name)}" loading="lazy" />
        <button class="card-fav ${item.favorite ? 'faved' : ''}" data-fav="${item.id}" title="Favorite">${icon(item.favorite ? 'heartFilled' : 'heartOutline')}</button>
        ${item.price ? `<span class="card-price">${formatPrice(item.price)}</span>` : ''}
      </div>
      <div class="card-body">
        <div class="card-name">${esc(item.name)}</div>
        <div class="card-meta">
          <span>${icon(CATEGORY_ICONS[item.category])} ${item.category}</span>
          ${item.store ? `<span class="dot"></span><span>${esc(item.store)}</span>` : ''}
        </div>
      </div>
    </article>`
    )
    .join('');
  if (state.items.length > 0 && items.length === 0) {
    grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--plum-soft);padding:40px 0;">Nothing matches — try another filter</p>`;
  }

  $$('#closetGrid .card').forEach((card) =>
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-fav]')) return;
      openModal(card.dataset.id);
    })
  );
  $$('#closetGrid [data-fav]').forEach((btn) =>
    btn.addEventListener('click', () => toggleFavorite(btn.dataset.fav))
  );
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

async function toggleFavorite(id) {
  const item = state.items.find((i) => i.id === id);
  if (!item) return;
  item.favorite = !item.favorite;
  renderCloset();
  renderHome();
  if (state.modalItemId === id) fillModal(item);
  await store.updateItem(id, { favorite: item.favorite });
}

$('#searchInput').addEventListener('input', (e) => {
  state.search = e.target.value;
  renderCloset();
});

/* ---------------- modal (doubles as a lightbox: prev/next through the closet) ---------------- */
function openModal(id) {
  const item = state.items.find((i) => i.id === id);
  if (!item) return;
  // snapshot the currently-filtered list so prev/next browse the same set she's looking at
  state.modalList = filteredItems().map((i) => i.id);
  showModalItem(id);
  $('#modalBackdrop').hidden = false;
  document.body.style.overflow = 'hidden';
}

function showModalItem(id) {
  const item = state.items.find((i) => i.id === id);
  if (!item) return;
  state.modalItemId = id;
  fillModal(item);
  // reset any previous try-on result
  $('#modalTryon').hidden = true;
  $('#tryonResult').innerHTML = '';
  $('#modalTryonBtn').style.display = store.supportsLinks ? '' : 'none';
  const idx = state.modalList.indexOf(id);
  $('#modalPrevBtn').disabled = idx <= 0;
  $('#modalNextBtn').disabled = idx === -1 || idx >= state.modalList.length - 1;
}

function stepModal(delta) {
  const idx = state.modalList.indexOf(state.modalItemId);
  const nextIdx = idx + delta;
  if (nextIdx < 0 || nextIdx >= state.modalList.length) return;
  showModalItem(state.modalList[nextIdx]);
}
$('#modalPrevBtn').addEventListener('click', () => stepModal(-1));
$('#modalNextBtn').addEventListener('click', () => stepModal(1));

function fillModal(item) {
  $('#modalPhoto').src = item.photo;
  $('#modalName').textContent = item.name;
  const meta = [item.category, item.color, item.store].filter(Boolean).join('  ·  ');
  $('#modalMeta').textContent = meta;
  const priceEl = $('#modalPrice');
  priceEl.hidden = !item.price;
  if (item.price) priceEl.innerHTML = `${icon('price')} ${formatPrice(item.price)}`;
  $('#modalNotes').textContent = item.notes || '';
  $('#modalFav').innerHTML = item.favorite ? `${icon('heartFilled')} Favorited` : `${icon('heartOutline')} Favorite`;
}

function formatPrice(n) {
  return '$' + Number(n).toFixed(Number(n) % 1 === 0 ? 0 : 2);
}

function closeModal() {
  $('#modalBackdrop').hidden = true;
  state.modalItemId = null;
  document.body.style.overflow = '';
}

$('#modalClose').addEventListener('click', closeModal);
$('#modalBackdrop').addEventListener('click', (e) => {
  if (e.target === $('#modalBackdrop')) closeModal();
});
document.addEventListener('keydown', (e) => {
  if ($('#modalBackdrop').hidden) return;
  if (e.key === 'Escape') closeModal();
  else if (e.key === 'ArrowLeft') stepModal(-1);
  else if (e.key === 'ArrowRight') stepModal(1);
});
$('#modalFav').addEventListener('click', () => {
  if (state.modalItemId) toggleFavorite(state.modalItemId);
});
$('#modalDelete').addEventListener('click', async () => {
  const item = state.items.find((i) => i.id === state.modalItemId);
  if (!item) return;
  if (!confirm(`Remove "${item.name}" from your closet?`)) return;
  await store.deleteItem(item.id);
  state.items = state.items.filter((i) => i.id !== item.id);
  state.outfits = await store.listOutfits();
  state.look.selected.delete(item.id);
  closeModal();
  renderAll();
  toast('Removed from your closet');
});

/* ---------------- virtual try-on ---------------- */
state.tryon = { configured: false, hasModelPhoto: false, profileCount: 0 };

async function refreshTryonStatus() {
  try {
    state.tryon = await store.tryonStatus();
  } catch {
    state.tryon = { configured: false, hasModelPhoto: false, profileCount: 0 };
  }
  const btn = $('#modelPhotoBtn');
  const label = $('#modelPhotoLabel');
  if (!store.supportsLinks) {
    if (btn) btn.style.display = 'none';
    return;
  }
  if (btn) btn.classList.toggle('set', state.tryon.hasModelPhoto);
  if (label) {
    const n = state.tryon.profileCount || 0;
    label.textContent = n > 0 ? `Gülay's photos (${n})` : "Add Gülay's photos";
  }
  const tryBtn = $('#modalTryonBtn');
  if (tryBtn) tryBtn.style.display = store.supportsLinks ? '' : 'none';
}

/* ----- first-time photo profile onboarding ----- */
const PROFILE_STEPS = [
  { slot: 'face',  icon: 'personFace', label: 'Your face',    hint: 'Look straight at the camera, good light, hair back.', required: true },
  { slot: 'waist', icon: 'catTop',     label: 'Head to waist', hint: 'Facing forward, from your head down to your waist.', required: true },
  { slot: 'full',  icon: 'personFull', label: 'Full body',     hint: 'Head to toe, standing straight, facing forward.', required: true },
  { slot: 'left',  icon: 'turnLeft',   label: 'Left side',     hint: 'Turn to your left — full body from the side.' },
  { slot: 'right', icon: 'turnRight',  label: 'Right side',    hint: 'Turn to your right — full body from the side.' },
  { slot: 'pose',  icon: 'personPose', label: 'A pose',        hint: 'Stand however feels like you — relaxed, hand on hip…' },
];
let profilePhotos = []; // [{slot, photo}]

function profilePhotoOf(slot) {
  const p = profilePhotos.find((x) => x.slot === slot);
  return p && p.photo;
}

function renderOnboard() {
  $('#onboardSteps').innerHTML = PROFILE_STEPS.map((step) => {
    const photo = profilePhotoOf(step.slot);
    const filled = !!photo;
    const front = `
      <span class="shot-emoji">${icon(step.icon, 'icon-xl')}</span>
      <span class="shot-label">${step.label}</span>
      <span class="shot-hint">${step.hint}</span>
      ${step.required ? '' : '<span class="shot-opt">optional</span>'}`;
    const done = `
      <span class="shot-check">${icon('check')}</span>
      <img src="${photo}" alt="${esc(step.label)}" />
      <button type="button" class="shot-redo" data-redo="${step.slot}">Retake</button>`;
    return `
      <label class="shot ${filled ? 'filled' : ''}" data-slot="${step.slot}">
        <input type="file" accept="image/*" capture="user" hidden />
        ${filled ? done : front}
      </label>`;
  }).join('');

  $$('#onboardSteps .shot').forEach((shot) => {
    const input = shot.querySelector('input[type=file]');
    input.addEventListener('change', () => {
      if (input.files[0]) captureSlot(shot.dataset.slot, input.files[0]);
      input.value = '';
    });
  });
  $$('#onboardSteps [data-redo]').forEach((btn) =>
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      btn.closest('.shot').querySelector('input[type=file]').click();
    })
  );
  const n = profilePhotos.length;
  $('#onboardProgress').textContent = n === 0 ? 'No photos yet' : `${n} photo${n === 1 ? '' : 's'} added`;
}

async function captureSlot(slot, file) {
  try {
    const res = await store.saveProfileSlot(slot, file);
    profilePhotos = res.photos || [];
    renderOnboard();
    await refreshTryonStatus();
    toast('Photo saved');
  } catch (err) {
    toast(err.message || 'Could not save the photo');
  }
}

let onboardMandatory = false;

async function openOnboard(mandatory) {
  if (!store.supportsLinks) { toast('Adding photos needs the online version.'); return; }
  try {
    profilePhotos = (await store.getProfile()).photos || [];
  } catch { profilePhotos = []; }
  onboardMandatory = !!mandatory;
  $('#onboardClose').hidden = onboardMandatory;
  $('#onboardSub').textContent = onboardMandatory
    ? 'Add your face, head-to-waist and full-body photos to get started — these stay saved for every look you create.'
    : 'The more angles you add, the more the looks will really look like you.';
  renderOnboard();
  $('#onboardBackdrop').hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeOnboard() {
  $('#onboardBackdrop').hidden = true;
  document.body.style.overflow = '';
}
function requiredPhotosMissing() {
  return PROFILE_STEPS.filter((s) => s.required).some((s) => !profilePhotoOf(s.slot));
}

$('#modelPhotoBtn').addEventListener('click', () => openOnboard(false));
$('#onboardClose').addEventListener('click', closeOnboard);
$('#onboardDone').addEventListener('click', () => {
  if (onboardMandatory && requiredPhotosMissing()) {
    toast('Add your face, waist and full-body photos first');
    return;
  }
  closeOnboard();
});
$('#onboardBackdrop').addEventListener('click', (e) => {
  if (onboardMandatory) return; // can't dismiss the first-run setup by tapping outside
  if (e.target === $('#onboardBackdrop')) closeOnboard();
});

$('#modalTryonBtn').addEventListener('click', async () => {
  const item = state.items.find((i) => i.id === state.modalItemId);
  if (!item) return;
  const panel = $('#modalTryon');
  const result = $('#tryonResult');
  panel.hidden = false;

  if (!state.tryon.hasModelPhoto) {
    result.innerHTML = `<div class="tryon-error">Add photos of Gülay first — use the photos button in the Studio.</div>`;
    return;
  }
  if (!state.tryon.configured) {
    result.innerHTML = `<div class="tryon-error">Virtual try-on isn't switched on yet — a Gemini API key is needed (see the setup notes).</div>`;
    return;
  }

  const btn = $('#modalTryonBtn');
  btn.disabled = true;
  result.innerHTML = `<div class="tryon-loading"><div class="tryon-spinner"></div><span>Dressing Gülay in this piece…<br/><small>this can take up to a minute</small></span></div>`;
  try {
    const { image } = await store.tryOn(item.id);
    result.innerHTML = `<img src="${image}" alt="Gülay wearing ${esc(item.name)}" />`;
  } catch (err) {
    result.innerHTML = `<div class="tryon-error">${esc(err.message || 'Try-on failed. Try again in a moment.')}</div>`;
  } finally {
    btn.disabled = false;
  }
});

/* ---------------- add form ---------------- */
const photoInput = $('#photoInput');
const dropzone = $('#dropzone');
let pendingFile = null;
let scrapedImageUrl = null; // set when a piece was fetched from a store link

photoInput.addEventListener('change', () => setPendingFile(photoInput.files[0]));

/* ----- add from a store link ----- */
if (!store.supportsLinks) $('#linkImport').style.display = 'none';

async function fetchFromLink() {
  const url = $('#linkInput').value.trim();
  const statusEl = $('#linkStatus');
  if (!url) return;
  const btn = $('#linkFetch');
  btn.disabled = true;
  statusEl.hidden = false;
  statusEl.className = 'link-status busy';
  statusEl.textContent = 'Reading the product';
  try {
    const data = await store.scrape(url);
    // preview the remote image and prefill the form
    scrapedImageUrl = data.image;
    pendingFile = null;
    const preview = $('#photoPreview');
    preview.src = data.image;
    preview.hidden = false;
    $('#dropzoneInner').style.display = 'none';
    if (data.name) $('#fName').value = data.name;
    if (data.brand) $('#fStore').value = data.brand;
    if (data.price) {
      const priceLine = `Price: ${data.price}${data.currency ? ' ' + data.currency : ''}`;
      $('#fNotes').value = $('#fNotes').value ? $('#fNotes').value + '\n' + priceLine : priceLine;
    }
    $('#fCategory').value = guessCategory(data.name);
    statusEl.className = 'link-status';
    statusEl.textContent = 'Got it — check the details below and add it';
  } catch (err) {
    statusEl.className = 'link-status error';
    statusEl.textContent = err.message || 'Could not read that link.';
  } finally {
    btn.disabled = false;
  }
}

function guessCategory(name = '') {
  const n = name.toLowerCase();
  const map = [
    ['Dresses', /dress|gown|frock/],
    ['Outerwear', /coat|jacket|blazer|cardigan|trench|parka|puffer/],
    ['Bottoms', /jean|trouser|pant|skirt|short|legging/],
    ['Shoes', /shoe|heel|boot|sneaker|sandal|loafer|flat/],
    ['Bags', /bag|tote|clutch|backpack|purse/],
    ['Accessories', /scarf|belt|hat|glove|jewel|necklace|earring|sunglass/],
  ];
  for (const [cat, re] of map) if (re.test(n)) return cat;
  return 'Tops';
}

$('#linkFetch').addEventListener('click', fetchFromLink);
$('#linkInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); fetchFromLink(); }
});

['dragover', 'dragenter'].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  })
);
['dragleave', 'drop'].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
  })
);
dropzone.addEventListener('drop', (e) => {
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) setPendingFile(file);
});

function setPendingFile(file) {
  if (!file) return;
  pendingFile = file;
  scrapedImageUrl = null;
  const preview = $('#photoPreview');
  preview.src = URL.createObjectURL(file);
  preview.hidden = false;
  $('#dropzoneInner').style.display = 'none';
}

$('#addForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!pendingFile && !scrapedImageUrl) {
    toast('Add a photo or paste a link first');
    dropzone.style.animation = 'none';
    void dropzone.offsetWidth;
    dropzone.style.animation = 'heartPop 0.4s var(--ease)';
    return;
  }
  const btn = $('#addSubmit');
  btn.disabled = true;
  btn.textContent = 'Adding…';
  try {
    const fields = {
      name: $('#fName').value,
      category: $('#fCategory').value,
      color: $('#fColor').value,
      store: $('#fStore').value,
      notes: $('#fNotes').value,
      price: $('#fPrice').value,
    };
    const item = scrapedImageUrl
      ? await store.addItemFromUrl({ imageUrl: scrapedImageUrl, url: $('#linkInput').value.trim(), ...fields })
      : await store.addItem({ file: pendingFile, ...fields });
    state.items.unshift(item);
    resetAddForm();
    closeAddModal();
    state.filter = 'All';
    state.search = '';
    $('#searchInput').value = '';
    renderAll();
    if ($('.page.active').id !== 'page-closet') goTo('closet');
    toast(`"${item.name}" is in your closet`);
  } catch (err) {
    toast('Hmm, that didn\'t work — try again?');
  } finally {
    btn.disabled = false;
    btn.innerHTML = icon('sparkle') + 'Add to my closet';
  }
});

function resetAddForm() {
  $('#addForm').reset();
  pendingFile = null;
  scrapedImageUrl = null;
  $('#linkInput').value = '';
  $('#linkStatus').hidden = true;
  $('#photoPreview').hidden = true;
  $('#photoPreview').src = '';
  $('#dropzoneInner').style.display = '';
  $('#moreDetails').hidden = true;
  $('#moreDetailsToggle').innerHTML = icon('plus') + 'More details (color, store, price, notes)';
}

/* ---------------- studio tabs (Create / Saved Looks) ---------------- */
state.studioTab = 'create';
function setStudioTab(tab) {
  state.studioTab = tab;
  $$('#studioTabs .tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.studiotab === tab));
  $('#panel-create').hidden = tab !== 'create';
  $('#panel-saved').hidden = tab !== 'saved';
  if (tab === 'saved') renderLooks();
}
$$('#studioTabs .tab-btn').forEach((btn) => btn.addEventListener('click', () => setStudioTab(btn.dataset.studiotab)));

/* ---------------- add-piece modal ---------------- */
function openAddModal() {
  $('#addBackdrop').hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeAddModal() {
  $('#addBackdrop').hidden = true;
  document.body.style.overflow = '';
}
$('#addFab').addEventListener('click', openAddModal);
$('#emptyAddBtn').addEventListener('click', openAddModal);
$('#addModalClose').addEventListener('click', closeAddModal);
$('#addBackdrop').addEventListener('click', (e) => { if (e.target === $('#addBackdrop')) closeAddModal(); });
$('#moreDetailsToggle').addEventListener('click', () => {
  const more = $('#moreDetails');
  more.hidden = !more.hidden;
  $('#moreDetailsToggle').innerHTML = more.hidden
    ? icon('plus') + 'More details (color, store, price, notes)'
    : icon('x') + 'Hide details';
});

/* ---------------- studio ---------------- */
state.look = { selected: new Set(), instructions: '', touched: false, result: null };

function studioCategories() {
  return STUDIO_ORDER.filter((c) => state.items.some((i) => i.category === c));
}

function pruneSelection() {
  const ids = new Set(state.items.map((i) => i.id));
  for (const id of [...state.look.selected]) if (!ids.has(id)) state.look.selected.delete(id);
}

// Sensible default: one piece per category (skip Outerwear; skip a dress when separates exist).
function autoSelectLook() {
  state.look.selected = new Set();
  const cats = studioCategories();
  const hasSeparates = cats.includes('Tops') || cats.includes('Bottoms');
  for (const c of cats) {
    if (c === 'Outerwear') continue;
    if (c === 'Dresses' && hasSeparates) continue;
    const first = state.items.find((i) => i.category === c);
    if (first) state.look.selected.add(first.id);
  }
}

function renderStudio() {
  const hasItems = state.items.length > 0;
  $('#studioEmpty').hidden = hasItems;
  $('#studioWrap').style.display = hasItems ? '' : 'none';
  if (!hasItems) return;

  pruneSelection();
  if (!state.look.touched) autoSelectLook();

  $('#piecesList').innerHTML = studioCategories()
    .map((c, idx) => {
      const items = state.items.filter((i) => i.category === c);
      const chips = items
        .map((it) => {
          const sel = state.look.selected.has(it.id) ? 'selected' : '';
          return `
            <div class="piece-chip ${sel}" data-pick="${it.id}" title="${esc(it.name)}">
              <span class="pc-check">${icon('check')}</span>
              <img src="${it.photo}" alt="${esc(it.name)}" loading="lazy" />
              <div class="pc-name">${esc(it.name)}</div>
            </div>`;
        })
        .join('');
      return `
        <div class="cat-group" style="animation-delay:${idx * 0.05}s">
          <div class="cat-group-title">${icon(CATEGORY_ICONS[c])} ${c}</div>
          <div class="piece-strip">${chips}</div>
        </div>`;
    })
    .join('');

  $$('#piecesList [data-pick]').forEach((chip) =>
    chip.addEventListener('click', () => {
      const id = chip.dataset.pick;
      state.look.touched = true;
      if (state.look.selected.has(id)) state.look.selected.delete(id);
      else state.look.selected.add(id);
      chip.classList.toggle('selected');
    })
  );

  $('#lookInstr').value = state.look.instructions;
  renderLookCanvas();
}

function renderLookCanvas() {
  const canvas = $('#lookCanvas');
  const actions = $('#lookResultActions');
  if (state.look.result) {
    canvas.innerHTML = `<img src="${state.look.result}" alt="Gülay wearing the look" />`;
    actions.hidden = false;
    $('#downloadLook').href = state.look.result;
  } else {
    canvas.innerHTML = `<div class="look-placeholder"><span class="lp-icon">${icon('mirror', 'icon-xl')}</span><p>Gülay wearing your look<br/>will appear here</p></div>`;
    actions.hidden = true;
  }
}

async function generateLook() {
  const ids = [...state.look.selected];
  if (ids.length === 0) { toast('Pick at least one piece'); return; }
  if (!store.supportsLinks) { toast('Generating looks needs the online version.'); return; }
  if (!state.tryon.hasModelPhoto) {
    toast('Add a photo of Gülay first — use the photos button above.');
    return;
  }
  const canvas = $('#lookCanvas');
  if (!state.tryon.configured) {
    canvas.innerHTML = `<div class="look-placeholder"><span class="lp-icon">${icon('key', 'icon-xl')}</span><p>Virtual try-on isn't switched on yet.<br/>Add a Gemini API key to bring it to life.</p></div>`;
    $('#lookResultActions').hidden = true;
    return;
  }
  state.look.instructions = $('#lookInstr').value;
  const btn = $('#generateBtn');
  btn.disabled = true;
  const overlay = document.createElement('div');
  overlay.className = 'look-loading';
  overlay.innerHTML = `<div class="look-spinner"></div><span>Dressing Gülay in your look…<br/><small>this can take up to a minute</small></span>`;
  canvas.appendChild(overlay);
  canvas.scrollIntoView({ behavior: 'smooth', block: 'center' });
  try {
    const { image } = await store.tryOn(ids, state.look.instructions);
    state.look.result = image;
    renderLookCanvas();
    canvas.scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast('Here she is');
  } catch (err) {
    overlay.remove();
    toast(err.message || 'Could not generate the look.');
  } finally {
    btn.disabled = false;
  }
}

$('#generateBtn').addEventListener('click', generateLook);
$('#regenLook').addEventListener('click', generateLook);
$('#lookInstr').addEventListener('input', (e) => { state.look.instructions = e.target.value; });

$('#shuffleBtn').addEventListener('click', () => {
  const cats = studioCategories();
  state.look.selected = new Set();
  const dressPick = cats.includes('Dresses') && Math.random() < 0.5;
  for (const c of cats) {
    if (c === 'Outerwear') continue;
    if (dressPick && (c === 'Tops' || c === 'Bottoms')) continue;
    if (!dressPick && c === 'Dresses') continue;
    const items = state.items.filter((i) => i.category === c);
    if (items.length) state.look.selected.add(items[Math.floor(Math.random() * items.length)].id);
  }
  state.look.touched = true;
  renderStudio();
  toast('A little inspiration for you');
});

$('#saveLookBtn').addEventListener('click', async () => {
  const itemIds = [...state.look.selected];
  if (itemIds.length === 0) {
    toast('Pick at least one piece first');
    return;
  }
  const name = $('#lookName').value.trim() || suggestLookName();
  try {
    const outfit = await store.addOutfit({ name, itemIds });
    state.outfits.unshift(outfit);
    $('#lookName').value = '';
    renderHome();
    renderLooks();
    toast(`"${outfit.name}" saved to your looks`);
  } catch (err) {
    toast(err.message);
  }
});

function suggestLookName() {
  const moods = ['Dreamy', 'Golden hour', 'Soft evening', 'City stroll', 'Sunday', 'Date night', 'Effortless', 'Rosy'];
  const nouns = ['look', 'mood', 'moment', 'ensemble', 'vibe'];
  return `${moods[Math.floor(Math.random() * moods.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]}`;
}

/* ---------------- looks ---------------- */
function renderLooks() {
  const grid = $('#looksGrid');
  $('#looksEmpty').hidden = state.outfits.length > 0;
  grid.innerHTML = state.outfits
    .map((o, idx) => {
      const items = o.itemIds.map((id) => state.items.find((i) => i.id === id)).filter(Boolean);
      const date = new Date(o.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      return `
      <article class="look-card" style="animation-delay:${Math.min(idx * 0.06, 0.5)}s">
        <div class="look-collage">${items.slice(0, 6).map((i) => `<img src="${i.photo}" alt="${esc(i.name)}" loading="lazy" />`).join('')}</div>
        <div class="look-name">${esc(o.name)}</div>
        <div class="look-date">${date} · ${items.length} piece${items.length === 1 ? '' : 's'}</div>
        <div class="look-actions">
          <button class="btn btn-ghost" data-openlook="${o.id}">Open in Studio</button>
          <button class="btn btn-danger" data-dellook="${o.id}">Delete</button>
        </div>
      </article>`;
    })
    .join('');

  $$('[data-openlook]').forEach((b) =>
    b.addEventListener('click', () => openLookInStudio(b.dataset.openlook))
  );
  $$('[data-dellook]').forEach((b) =>
    b.addEventListener('click', async () => {
      const o = state.outfits.find((x) => x.id === b.dataset.dellook);
      if (!confirm(`Delete the look "${o.name}"?`)) return;
      await store.deleteOutfit(o.id);
      state.outfits = state.outfits.filter((x) => x.id !== o.id);
      renderHome();
      renderLooks();
      toast('Look deleted');
    })
  );
}

function openLookInStudio(id) {
  const outfit = state.outfits.find((o) => o.id === id);
  if (!outfit) return;
  state.look.selected = new Set(outfit.itemIds.filter((iid) => state.items.some((i) => i.id === iid)));
  state.look.touched = true;
  state.look.result = null;
  setStudioTab('create');
  goTo('studio');
  toast(`Styling "${outfit.name}"`);
}

/* ---------------- local notifications (native only, no-op on web) ---------------- */
function nativePlugin(name) {
  if (!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())) return null;
  return (window.Capacitor.Plugins && window.Capacitor.Plugins[name]) || null;
}
function notifIdForDate(dateStr) {
  let h = 0;
  for (const ch of dateStr) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 2147483647;
}
async function scheduleReminder(dateStr, timeHHMM, title, body) {
  const LN = nativePlugin('LocalNotifications');
  if (!LN) return;
  try {
    const perm = await LN.checkPermissions();
    if (perm.display !== 'granted') {
      const req = await LN.requestPermissions();
      if (req.display !== 'granted') return;
    }
    const id = notifIdForDate(dateStr);
    await LN.cancel({ notifications: [{ id }] }).catch(() => {});
    const [h, m] = (timeHHMM || '08:00').split(':').map(Number);
    const at = new Date(dateStr + 'T00:00:00');
    at.setHours(h, m, 0, 0);
    if (at.getTime() <= Date.now()) return; // don't schedule something in the past
    await LN.schedule({ notifications: [{ id, title, body, schedule: { at } }] });
  } catch {}
}
async function cancelReminder(dateStr) {
  const LN = nativePlugin('LocalNotifications');
  if (!LN) return;
  try { await LN.cancel({ notifications: [{ id: notifIdForDate(dateStr) }] }); } catch {}
}

// Deep link from a notification tap or a home-screen widget tap → jump to the Planner.
(function setupDeepLinks() {
  const CapApp = nativePlugin('App');
  if (CapApp && CapApp.addListener) {
    CapApp.addListener('appUrlOpen', (data) => {
      if (data && /planner/.test(data.url || '')) goTo('planner');
    });
  }
  const LN = nativePlugin('LocalNotifications');
  if (LN && LN.addListener) {
    LN.addListener('localNotificationActionPerformed', () => goTo('planner'));
  }
})();

/* ---------------- home-screen widget sync (native only, no-op on web) ---------------- */
async function syncWidget() {
  const WB = nativePlugin('WidgetBridge');
  if (!WB) return;
  const entry = planFor(todayStr());
  const outfit = entry && entry.outfitId ? state.outfits.find((o) => o.id === entry.outfitId) : null;
  const pinned = state.countdowns.find((c) => c.pinned);
  try {
    await WB.setToday({
      date: todayStr(),
      outfitName: (outfit && outfit.name) || '',
      note: (entry && entry.note) || '',
      briefing: (entry && entry.briefing) || '',
      countdownLabel: (pinned && pinned.label) || '',
      countdownDays: pinned ? String(daysUntil(pinned.date)) : '',
    });
  } catch {}
}

/* ---------------- planner ---------------- */
state.planner = []; // [{date, outfitId, note, remindAt, briefing}]
state.calMonth = new Date(); // day-of-month is ignored, only year/month matter
state.dayOutfitPick = null;

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function dateStr(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function planFor(ds) {
  return state.planner.find((p) => p.date === ds);
}
function outfitThumb(entry) {
  if (!entry || !entry.outfitId) return null;
  const outfit = state.outfits.find((o) => o.id === entry.outfitId);
  if (!outfit) return null;
  const item = outfit.itemIds.map((id) => state.items.find((i) => i.id === id)).find(Boolean);
  return item ? item.photo : null;
}

async function refreshPlanner() {
  try { state.planner = await store.listPlanner(); } catch { state.planner = []; }
}

function renderTodayCard() {
  const card = $('#todayCard');
  if (!card) return;
  const ds = todayStr();
  $('#todayDate').textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const entry = planFor(ds);
  const body = $('#todayBody');
  if (!entry) {
    body.innerHTML = `<span class="today-icon">${icon('planner')}</span><p class="today-text">Nothing planned for today yet — tap to add an outfit or a note</p>`;
    return;
  }
  const thumb = outfitThumb(entry);
  const outfit = entry.outfitId ? state.outfits.find((o) => o.id === entry.outfitId) : null;
  const lines = [];
  if (entry.briefing) {
    lines.push(esc(entry.briefing));
  } else {
    if (outfit) lines.push(`Wearing: <strong>${esc(outfit.name)}</strong>`);
    if (entry.note) lines.push(esc(entry.note));
    if (!lines.length) lines.push('A day off from planning');
  }
  body.innerHTML = `${thumb ? `<img class="today-thumb" src="${thumb}" alt="" />` : `<span class="today-icon">${icon('sparkle')}</span>`}<p class="today-text">${lines.join('<br/>')}</p>`;
}

function renderPlanner() {
  renderCountdowns();
  const monthStart = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth(), 1);
  $('#calMonthLabel').textContent = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  $('#calWeekdays').innerHTML = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => `<span>${d}</span>`).join('');

  const firstWeekday = (monthStart.getDay() + 6) % 7; // Monday = 0
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - firstWeekday);
  const todayDs = todayStr();

  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const ds = dateStr(d);
    const entry = planFor(ds);
    const inMonth = d.getMonth() === monthStart.getMonth();
    const thumb = outfitThumb(entry);
    cells.push(`
      <button class="cal-cell ${inMonth ? '' : 'dim'} ${ds === todayDs ? 'today' : ''} ${entry ? 'planned' : ''}" data-day="${ds}">
        <span class="cal-daynum">${d.getDate()}</span>
        ${thumb ? `<img class="cal-thumb" src="${thumb}" alt="" />` : entry ? '<span class="cal-dot"></span>' : ''}
      </button>`);
    if (i === 41 && d.getMonth() === monthStart.getMonth() && d.getDate() < 7) break; // trim a trailing empty week when possible
  }
  $('#calGrid').innerHTML = cells.join('');
  $$('#calGrid [data-day]').forEach((cell) => cell.addEventListener('click', () => openDaySheet(cell.dataset.day)));
}

$('#calPrev').addEventListener('click', () => {
  state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() - 1, 1);
  renderPlanner();
});
$('#calNext').addEventListener('click', () => {
  state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() + 1, 1);
  renderPlanner();
});
$('#calTodayBtn').addEventListener('click', () => {
  state.calMonth = new Date();
  renderPlanner();
});

let openDayDs = null;
function openDaySheet(ds) {
  openDayDs = ds;
  const entry = planFor(ds);
  state.dayOutfitPick = entry ? entry.outfitId : null;
  const d = new Date(ds + 'T12:00:00');
  $('#dayModalDate').textContent = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const briefing = $('#dayBriefing');
  if (entry && entry.briefing) { briefing.hidden = false; briefing.textContent = entry.briefing; }
  else briefing.hidden = true;
  $('#dayNote').value = (entry && entry.note) || '';
  $('#dayRemind').value = (entry && entry.remindAt) || '08:00';
  $('#dayRemindOn').checked = !!(entry && entry.remindAt);
  renderDayOutfitPicker();
  $('#dayBackdrop').hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeDaySheet() {
  $('#dayBackdrop').hidden = true;
  document.body.style.overflow = '';
  openDayDs = null;
}
function renderDayOutfitPicker() {
  const wrap = $('#dayOutfitPicker');
  if (!state.outfits.length) {
    wrap.innerHTML = `<p class="day-empty-hint">No saved looks yet — style one in the Studio first</p>`;
    return;
  }
  wrap.innerHTML = state.outfits.map((o) => {
    const item = o.itemIds.map((id) => state.items.find((i) => i.id === id)).find(Boolean);
    const sel = state.dayOutfitPick === o.id ? 'selected' : '';
    return `
      <div class="day-outfit-chip ${sel}" data-outfitpick="${o.id}">
        ${item ? `<img src="${item.photo}" alt="" />` : ''}
        <span>${esc(o.name)}</span>
      </div>`;
  }).join('');
  $$('#dayOutfitPicker [data-outfitpick]').forEach((chip) =>
    chip.addEventListener('click', () => {
      state.dayOutfitPick = state.dayOutfitPick === chip.dataset.outfitpick ? null : chip.dataset.outfitpick;
      renderDayOutfitPicker();
    })
  );
}
$('#dayModalClose').addEventListener('click', closeDaySheet);
$('#dayBackdrop').addEventListener('click', (e) => { if (e.target === $('#dayBackdrop')) closeDaySheet(); });

$('#daySaveBtn').addEventListener('click', async () => {
  if (!openDayDs) return;
  const note = $('#dayNote').value.trim();
  const remindOn = $('#dayRemindOn').checked;
  const remindAt = remindOn ? $('#dayRemind').value : null;
  const btn = $('#daySaveBtn');
  btn.disabled = true;
  try {
    const saved = await store.savePlanDay(openDayDs, { outfitId: state.dayOutfitPick, note, remindAt });
    state.planner = state.planner.filter((p) => p.date !== openDayDs);
    if (!saved.removed) state.planner.push(saved);
    if (remindAt) {
      const outfit = state.dayOutfitPick ? state.outfits.find((o) => o.id === state.dayOutfitPick) : null;
      const body = (saved && saved.briefing) || [outfit ? `Wearing: ${outfit.name}.` : '', note].filter(Boolean).join(' ') || 'Check your plan for today';
      await scheduleReminder(openDayDs, remindAt, "Gülay's Wardrobe", body);
    } else {
      await cancelReminder(openDayDs);
    }
    renderPlanner();
    renderTodayCard();
    syncWidget();
    closeDaySheet();
    toast('Day saved');
  } catch (err) {
    toast(err.message || 'Could not save that day');
  } finally {
    btn.disabled = false;
  }
});

$('#dayClearBtn').addEventListener('click', async () => {
  if (!openDayDs) return;
  await store.deletePlanDay(openDayDs);
  await cancelReminder(openDayDs);
  state.planner = state.planner.filter((p) => p.date !== openDayDs);
  renderPlanner();
  renderTodayCard();
  syncWidget();
  closeDaySheet();
  toast('Day cleared');
});

/* ---------------- chatbot (full-screen page, multiple threads, ChatGPT-style) ----------------
   Threads + their messages are stored server-side (or in IndexedDB
   on-device), same as the rest of the app's data — NOT localStorage, so
   it's the same conversations no matter which browser or device opens the
   app, and switching threads always shows that thread's real history. */
state.chat = { threads: [], activeId: null, history: [] };

function addChatMessage(role, text, pending) {
  const el = document.createElement('div');
  el.className = `chat-msg ${role}${pending ? ' pending' : ''}`;
  el.textContent = text;
  $('#chatMessages').appendChild(el);
  $('#chatMessages').scrollTop = $('#chatMessages').scrollHeight;
  return el;
}

function renderThreadList() {
  const list = $('#chatThreadList');
  list.innerHTML = state.chat.threads
    .map(
      (t) => `
      <div class="chat-thread-item ${t.id === state.chat.activeId ? 'active' : ''}" data-thread="${t.id}">
        <span class="ct-title">${esc(t.title)}</span>
        <button class="ct-del" data-threaddel="${t.id}" aria-label="Delete chat">${icon('x')}</button>
      </div>`
    )
    .join('');
  $$('#chatThreadList [data-thread]').forEach((el) =>
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-threaddel]')) return;
      switchThread(el.dataset.thread);
    })
  );
  $$('#chatThreadList [data-threaddel]').forEach((btn) =>
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteThread(btn.dataset.threaddel);
    })
  );
}

async function refreshThreadList() {
  try { state.chat.threads = await store.listChatThreads(); } catch { state.chat.threads = []; }
  renderThreadList();
}

function renderChatMessages() {
  const container = $('#chatMessages');
  container.innerHTML = '';
  if (!state.chat.history.length) {
    // a visual empty-state hint only — never stored, never a real message
    container.innerHTML = `<p class="chat-empty-hint">Type a message to start…</p>`;
    return;
  }
  for (const m of state.chat.history) addChatMessage(m.role, m.text);
}

async function switchThread(id) {
  state.chat.activeId = id;
  try {
    const thread = await store.getChatThread(id);
    state.chat.history = thread.messages;
  } catch {
    state.chat.history = [];
  }
  renderChatMessages();
  renderThreadList();
}

async function createNewChat() {
  const thread = await store.createChatThread();
  state.chat.threads.unshift({ id: thread.id, title: thread.title, updatedAt: thread.updatedAt, messageCount: thread.messages.length });
  await switchThread(thread.id);
  $('#chatInput').focus();
}

async function deleteThread(id) {
  if (!confirm('Delete this chat? This cannot be undone.')) return;
  await store.deleteChatThread(id);
  state.chat.threads = state.chat.threads.filter((t) => t.id !== id);
  if (state.chat.activeId === id) {
    if (state.chat.threads.length) await switchThread(state.chat.threads[0].id);
    else await createNewChat();
  } else {
    renderThreadList();
  }
}

async function initChat() {
  await refreshThreadList();
  if (state.chat.threads.length) await switchThread(state.chat.threads[0].id);
  else await createNewChat();
}
initChat();

async function logChatEntries(entries) {
  state.chat.history.push(...entries);
  try {
    await store.appendChatThreadMessages(state.chat.activeId, entries);
    await refreshThreadList(); // title may have just been set from the first message
  } catch {}
}

$('#chatNewBtn').addEventListener('click', createNewChat);

/* Lets the chatbot control the music player — but only songs already in her
   own library (added via upload). It never fetches anything from the web;
   it just searches state.music.songs and calls the same playSong()/etc.
   functions the mini-player buttons use. */
function findSongMatch(query) {
  const q = query.trim().toLowerCase();
  if (!q) return -1;
  let idx = state.music.songs.findIndex((s) => s.title.toLowerCase() === q);
  if (idx !== -1) return idx;
  idx = state.music.songs.findIndex((s) => s.title.toLowerCase().includes(q) || q.includes(s.title.toLowerCase()));
  if (idx !== -1) return idx;
  return state.music.songs.findIndex((s) => s.artist && (s.artist.toLowerCase().includes(q) || q.includes(s.artist.toLowerCase())));
}

// Returns the bot's reply text if this was a music command, or null if it wasn't one.
function tryHandleMusicCommand(question) {
  const q = question.trim();
  let m;
  if ((m = /^(?:play|put on|start playing)\s+(.+)$/i.exec(q))) {
    const query = m[1].replace(/^(the song|the track)\s+/i, '');
    const idx = findSongMatch(query);
    if (idx === -1) {
      return state.music.songs.length
        ? `I couldn't find "${query}" in your music library — add it first by tapping the music bar, then ask me again.`
        : "You haven't added any songs yet — tap the music bar at the bottom to add one, then ask me to play it.";
    }
    playSong(idx);
    return `Playing "${state.music.songs[idx].title}".`;
  }
  if (/^(pause|stop)( the music)?$/i.test(q)) {
    if (state.music.playing) audioEl.pause();
    return 'Paused.';
  }
  if (/^(resume|unpause|continue)( the music| playing)?$/i.test(q)) {
    togglePlay();
    return state.music.songs.length ? 'Resuming.' : "You haven't added any songs yet — tap the music bar to add one.";
  }
  if (/^(next|skip)( song| track)?$/i.test(q)) {
    if (!state.music.songs.length) return "You haven't added any songs yet.";
    nextSong();
    return `Now playing "${state.music.songs[state.music.index].title}".`;
  }
  if (/^(previous|back|last song)$/i.test(q)) {
    if (!state.music.songs.length) return "You haven't added any songs yet.";
    prevSong();
    return `Now playing "${state.music.songs[state.music.index].title}".`;
  }
  return null;
}

$('#chatForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = $('#chatInput');
  const question = input.value.trim();
  if (!question) return;
  input.value = '';
  $('.chat-empty-hint')?.remove();
  addChatMessage('user', question);

  const musicReply = tryHandleMusicCommand(question);
  if (musicReply !== null) {
    addChatMessage('bot', musicReply);
    // client-handled (never reaches the AI), so log it ourselves
    await logChatEntries([{ role: 'user', text: question }, { role: 'bot', text: musicReply }]);
    return;
  }

  const pendingEl = addChatMessage('bot', 'Thinking…', true);
  try {
    const { answer } = await store.askChat(question, state.chat.activeId);
    pendingEl.remove();
    addChatMessage('bot', answer);
    // the server already saved this exchange to the thread — just mirror it locally
    state.chat.history.push({ role: 'user', text: question }, { role: 'bot', text: answer });
    await refreshThreadList(); // title may have just been set from this first message
  } catch (err) {
    pendingEl.remove();
    addChatMessage('bot', err.message || 'Could not answer that right now.');
  }
});

/* ---------------- countdowns ---------------- */
state.countdowns = [];
const COUNTDOWN_ICONS = ['birthday', 'school', 'travel', 'event', 'custom'];
const COUNTDOWN_ICON_MAP = { birthday: 'gift', school: 'graduation', travel: 'plane', event: 'star', custom: 'pin' };
let cdSelectedIcon = 'event';

async function refreshCountdowns() {
  try { state.countdowns = await store.listCountdowns(); } catch { state.countdowns = []; }
}
function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.round((target - today) / 86400000);
}
function renderCountdowns() {
  const rows = $$('.countdown-row');
  if (!rows.length) return;
  const html = state.countdowns.length
    ? state.countdowns
        .map((c) => {
          const n = daysUntil(c.date);
          const dayLabel = n === 0 ? 'Today!' : n === 1 ? '1 day' : n < 0 ? `${Math.abs(n)}d ago` : `${n} days`;
          return `
            <div class="cd-card ${c.pinned ? 'pinned' : ''}" data-cdcard="${c.id}">
              <button class="cd-pin" data-cdpin="${c.id}" title="${c.pinned ? 'Pinned to widget' : 'Pin to widget'}">${icon(c.pinned ? 'heartFilled' : 'heartOutline')}</button>
              <button class="cd-del" data-cddel="${c.id}" aria-label="Delete">${icon('x')}</button>
              <span class="cd-icon">${icon(COUNTDOWN_ICON_MAP[c.icon] || 'star', 'icon-lg')}</span>
              <div class="cd-days">${dayLabel}</div>
              <div class="cd-label">${esc(c.label)}</div>
            </div>`;
        })
        .join('')
    : `<p class="day-empty-hint">No countdowns yet — add one to see it here.</p>`;
  for (const row of rows) row.innerHTML = html;

  $$('.countdown-row [data-cdpin]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      await store.pinCountdown(btn.dataset.cdpin);
      await refreshCountdowns();
      renderCountdowns();
      syncWidget();
    })
  );
  $$('.countdown-row [data-cddel]').forEach((btn) =>
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await store.deleteCountdown(btn.dataset.cddel);
      await refreshCountdowns();
      renderCountdowns();
      syncWidget();
    })
  );
}

function openCountdownModal() {
  cdSelectedIcon = 'event';
  $('#cdLabel').value = '';
  $('#cdDate').value = '';
  $('#cdIconPicker').innerHTML = COUNTDOWN_ICONS.map(
    (name) => `<button type="button" data-cdicon="${name}" class="${name === cdSelectedIcon ? 'selected' : ''}">${icon(COUNTDOWN_ICON_MAP[name])}</button>`
  ).join('');
  $$('#cdIconPicker [data-cdicon]').forEach((btn) =>
    btn.addEventListener('click', () => {
      cdSelectedIcon = btn.dataset.cdicon;
      $$('#cdIconPicker [data-cdicon]').forEach((b) => b.classList.toggle('selected', b.dataset.cdicon === cdSelectedIcon));
    })
  );
  $('#countdownBackdrop').hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeCountdownModal() {
  $('#countdownBackdrop').hidden = true;
  document.body.style.overflow = '';
}
$('#addCountdownBtn').addEventListener('click', openCountdownModal);
$('#addCountdownBtnHome').addEventListener('click', openCountdownModal);
$('#countdownModalClose').addEventListener('click', closeCountdownModal);
$('#countdownBackdrop').addEventListener('click', (e) => { if (e.target === $('#countdownBackdrop')) closeCountdownModal(); });
$('#cdSaveBtn').addEventListener('click', async () => {
  const label = $('#cdLabel').value.trim();
  const date = $('#cdDate').value;
  if (!label || !date) { toast('Add a name and a date'); return; }
  try {
    await store.addCountdown({ label, date, icon: cdSelectedIcon });
    await refreshCountdowns();
    renderCountdowns();
    syncWidget();
    closeCountdownModal();
    toast('Countdown added');
  } catch (err) {
    toast(err.message || 'Could not add that countdown');
  }
});

/* ---------------- music player ----------------
   HTML5 <audio> drives playback everywhere. On native iOS, MusicBridge (a
   small Capacitor plugin) mirrors state into MPNowPlayingInfoCenter and
   forwards MPRemoteCommandCenter taps (lock screen / Control Center) back
   here as events — see ios/App/App/MusicBridgePlugin.swift. */
state.music = { songs: [], index: -1, playing: false, shuffle: true };
const audioEl = $('#audioEl');

async function refreshMusic() {
  try { state.music.songs = await store.listSongs(); } catch { state.music.songs = []; }
  $('#miniPlayer').hidden = false;
  updatePlayerUI();
}

function renderSongList() {
  const list = $('#songList');
  if (!state.music.songs.length) {
    list.innerHTML = `<p class="day-empty-hint">No songs yet — add your favorites above.</p>`;
    return;
  }
  list.innerHTML = state.music.songs
    .map(
      (s, i) => `
      <div class="song-row ${i === state.music.index ? 'playing' : ''}" data-songrow="${i}">
        <span>${icon(i === state.music.index && state.music.playing ? 'pause' : 'play')}</span>
        <div class="sr-info">
          <div class="sr-title">${esc(s.title)}</div>
          ${s.artist ? `<div class="sr-artist">${esc(s.artist)}</div>` : ''}
        </div>
        <button class="sr-del" data-songdel="${s.id}" aria-label="Remove">${icon('trash')}</button>
      </div>`
    )
    .join('');
  $$('#songList [data-songrow]').forEach((row) =>
    row.addEventListener('click', (e) => {
      if (e.target.closest('[data-songdel]')) return;
      const i = Number(row.dataset.songrow);
      i === state.music.index ? togglePlay() : playSong(i);
    })
  );
  $$('#songList [data-songdel]').forEach((btn) =>
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await store.deleteSong(btn.dataset.songdel);
      if (state.music.songs[state.music.index]?.id === btn.dataset.songdel) stopPlayback();
      await refreshMusic();
    })
  );
}

function playSong(i) {
  const song = state.music.songs[i];
  if (!song) return;
  state.music.index = i;
  audioEl.src = song.url;
  audioEl.play().catch(() => {});
  state.music.playing = true;
  updatePlayerUI();
  notifyNowPlaying();
}
function togglePlay() {
  if (!state.music.songs.length) { openMusicModal(); return; }
  if (state.music.index === -1) {
    playSong(state.music.shuffle ? Math.floor(Math.random() * state.music.songs.length) : 0);
    return;
  }
  if (state.music.playing) audioEl.pause();
  else audioEl.play().catch(() => {});
}
function stopPlayback() {
  audioEl.pause();
  audioEl.removeAttribute('src');
  state.music.index = -1;
  state.music.playing = false;
  updatePlayerUI();
}
function nextSong() {
  if (!state.music.songs.length) return;
  const i = state.music.shuffle
    ? Math.floor(Math.random() * state.music.songs.length)
    : (state.music.index + 1) % state.music.songs.length;
  playSong(i);
}
function prevSong() {
  if (!state.music.songs.length) return;
  const i = state.music.shuffle
    ? Math.floor(Math.random() * state.music.songs.length)
    : (state.music.index - 1 + state.music.songs.length) % state.music.songs.length;
  playSong(i);
}
function updatePlayerUI() {
  const song = state.music.songs[state.music.index];
  if (!state.music.songs.length) {
    $('#mpTitle').textContent = 'Add your music';
    $('#mpArtist').textContent = 'Tap to get started';
  } else {
    $('#mpTitle').textContent = song ? song.title : 'Nothing playing — tap to browse';
    $('#mpArtist').textContent = (song && song.artist) || '';
  }
  $('#mpPlay').innerHTML = icon(state.music.playing ? 'pause' : (state.music.songs.length ? 'play' : 'plus'));
  renderSongList();
}
audioEl.addEventListener('play', () => { state.music.playing = true; updatePlayerUI(); notifyNowPlaying(); });
audioEl.addEventListener('pause', () => { state.music.playing = false; updatePlayerUI(); notifyNowPlaying(); });
audioEl.addEventListener('ended', () => nextSong());

$('#mpPlay').addEventListener('click', togglePlay);
$('#mpNext').addEventListener('click', nextSong);
$('#mpPrev').addEventListener('click', prevSong);
$('#miniPlayer').addEventListener('click', (e) => {
  if (e.target.closest('.mp-btn')) return;
  openMusicModal();
});

function openMusicModal() {
  $('#musicBackdrop').hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeMusicModal() {
  $('#musicBackdrop').hidden = true;
  document.body.style.overflow = '';
}
$('#musicModalClose').addEventListener('click', closeMusicModal);
$('#musicBackdrop').addEventListener('click', (e) => { if (e.target === $('#musicBackdrop')) closeMusicModal(); });

$('#musicDropzone').addEventListener('click', () => $('#musicFileInput').click());
$('#musicFileInput').addEventListener('change', async () => {
  const file = $('#musicFileInput').files[0];
  if (!file) return;
  try {
    await store.addSong({ file });
    await refreshMusic();
    toast('Song added');
  } catch (err) {
    toast(err.message || 'Could not add that song');
  } finally {
    $('#musicFileInput').value = '';
  }
});

/* ----- native lock-screen / Control Center bridge (no-op on web) ----- */
function notifyNowPlaying() {
  const MB = nativePlugin('MusicBridge');
  if (!MB) return;
  const song = state.music.songs[state.music.index];
  MB.nowPlaying({
    title: (song && song.title) || '',
    artist: (song && song.artist) || '',
    playing: state.music.playing,
  }).catch(() => {});
}
(function setupMusicRemote() {
  const MB = nativePlugin('MusicBridge');
  if (!MB || !MB.addListener) return;
  MB.addListener('remoteCommand', (data) => {
    if (data.command === 'play') togglePlay();
    else if (data.command === 'pause') togglePlay();
    else if (data.command === 'next') nextSong();
    else if (data.command === 'previous') prevSong();
  });
})();

/* ---------------- boot ---------------- */
function renderAll() {
  renderHome();
  renderCloset();
  renderStudio();
  renderLooks();
  renderTodayCard();
}

(async function init() {
  playIntro();
  try {
    [state.items, state.outfits] = await Promise.all([
      store.listItems(),
      store.listOutfits(),
    ]);
    await refreshPlanner();
    await refreshCountdowns();
  } catch {
    toast('Could not load your wardrobe');
  }
  renderAll();
  moveUnderline();
  observeReveals();
  await refreshMusic();
  syncWidget();
  await refreshTryonStatus();
  // First-ever visit with no photos → guide her through the mandatory photo setup after the intro.
  if (store.supportsLinks && !(state.tryon.profileCount > 0)) {
    setTimeout(() => openOnboard(true), 2800);
  }
})();
