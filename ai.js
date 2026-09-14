/* Virtual try-on for Gülay's Wardrobe.
   Generates one photorealistic image of the person wearing a whole outfit
   (multiple garments) and following free-text styling instructions.

   Primary engine: Google Gemini 3 Pro Image ("Nano Banana Pro") via the
   Interactions API — Google's flagship image model, far more accurate than
   2.5 Flash Image at rendering exact garment patterns/logos/text and at
   multi-image composition + instruction following. Set GEMINI_API_KEY to
   enable it (same key as before; only the model + endpoint changed).

   Fallback: Replicate IDM-VTON (single garment, no instructions). Set
   REPLICATE_API_TOKEN to use it if you don't have a Gemini key. */

const fs = require('fs');
const path = require('path');

function activeProvider() {
  if (process.env.TRYON_PROVIDER) return process.env.TRYON_PROVIDER;
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.REPLICATE_API_TOKEN) return 'replicate';
  return 'gemini'; // default target (unconfigured until a key is added)
}

function isConfigured() {
  const p = activeProvider();
  if (p === 'gemini') return !!process.env.GEMINI_API_KEY;
  if (p === 'replicate') return !!process.env.REPLICATE_API_TOKEN;
  return false;
}

/* Turn a local /uploads path or absolute URL into a data URI the models accept. */
function toDataUri(imageRef, uploadsDir) {
  if (/^data:/.test(imageRef)) return imageRef;
  if (/^https?:\/\//.test(imageRef)) return imageRef; // replicate accepts URLs directly
  const rel = imageRef.replace(/^\/uploads\//, '');
  const abs = path.join(uploadsDir, path.basename(rel));
  const buf = fs.readFileSync(abs);
  const ext = path.extname(abs).slice(1).toLowerCase();
  const mime = ext === 'png' ? 'image/png'
    : ext === 'webp' ? 'image/webp'
    : ext === 'gif' ? 'image/gif'
    : 'image/jpeg';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

function dataUriToImageInput(dataUri) {
  const m = dataUri.match(/^data:([^;]+);base64,(.*)$/s);
  if (!m) throw new Error('Bad image data');
  return { type: 'image', mime_type: m[1], data: m[2] };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- Gemini 2.5 Flash Image ---------------- */
function buildLookPrompt(garments, instructions, personCount = 1) {
  const lines = garments.map((g, idx) => {
    const desc = [g.color, g.name].filter(Boolean).join(' ');
    const brand = g.store ? ` (${g.store})` : '';
    const hint = ACCESSORY_HINT[g.category] ? ` — ${ACCESSORY_HINT[g.category]}` : '';
    return `  ${idx + 1}. ${g.category} — ${desc}${brand}${hint}`;
  });
  const personLine =
    personCount > 1
      ? `The FIRST ${personCount} images are the SAME real person photographed from different angles (face, upper body, full body, sides).`
      : 'The image BEFORE this text is the real person.';
  return [
    'You are performing a virtual try-on EDIT of a real person.',
    '',
    personLine,
    'Study them and keep this EXACT same person: the same face and facial features, the same skin tone,',
    'the same hair, the same body shape. Do NOT replace them with a different model, and do NOT change',
    'their gender, age, face, or body. The result must be unmistakably this same person.',
    '',
    'The images AFTER this text are the items to put on the person, in this order:',
    ...lines,
    'Take ONLY the item from each of those images. They may be shown on other models, on a mannequin, or laid flat —',
    'ignore any other person, body, face or background in them and use ONLY the item itself, matching its real',
    'colour, pattern, texture, cut and length.',
    '',
    'STRICT RULES:',
    '- Dress the person in EXACTLY these items and nothing else. Do NOT add or invent any extra clothing,',
    '  layer, jacket, hat, bag, jewellery or accessory that is not in the provided images.',
    '- Jewellery and accessories MUST be shown clearly and worn correctly: a necklace around the neck, a bracelet',
    '  or watch on the wrist, earrings on the ears, a belt at the waist, a bag held or on the shoulder.',
    '- For any body area a provided garment does not cover, keep the person naturally dressed as in their photos.',
    '- Keep the person\'s identity and gender identical. Produce a clean, photorealistic, full-body result',
    '  (head to feet, shoes visible) on a simple, flattering background with even lighting.',
    '',
    `User styling notes: "${(instructions || '').trim() || 'a natural, elegant standing pose, facing the camera'}".`,
    'Follow them (including any requested pose or camera angle), but never break the rules above.',
    '',
    'Output only the single photorealistic photograph of this same person wearing exactly these items.',
  ].join('\n');
}

// Where each accessory-ish category should sit, to nudge the model to render it.
const ACCESSORY_HINT = {
  Accessories: 'worn on the body (necklace on the neck, bracelet/watch on the wrist, earrings on the ears, belt at the waist)',
  Bags: 'held in the hand or on the shoulder',
  Shoes: 'on the feet',
};

/* Shared low-level caller for Google's Interactions API image models, with
   retry-on-transient-overload. Returns a data: URI of the produced image. */
async function interactionsImageRequest(model, input, { maxAttempts = 4, imageSize = '1K' } = {}) {
  const key = process.env.GEMINI_API_KEY;
  const requestBody = JSON.stringify({
    model,
    input,
    response_format: { type: 'image', mime_type: 'image/jpeg', aspect_ratio: '3:4', image_size: imageSize },
  });

  let json, res;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: requestBody,
    });
    json = await res.json();
    if (res.ok) break;
    const msg = (json.error && json.error.message) || '';
    const transient = res.status === 503 || /high demand|overloaded|try again later|unavailable|deadline/i.test(msg);
    if (transient && attempt < maxAttempts) {
      await sleep(1500 * attempt);
      continue;
    }
    break;
  }

  if (!res.ok) {
    const msg = (json.error && json.error.message) || 'Gemini request failed.';
    if (/quota|billing|limit: 0/i.test(msg)) {
      throw new Error(
        "Gemini's image model needs billing enabled on your Google project (it isn't free). " +
          'Turn on billing at aistudio.google.com, then try again.'
      );
    }
    if (/API key|permission|unauthenticated|invalid/i.test(msg)) {
      throw new Error('That Gemini API key was rejected — double-check it at aistudio.google.com/apikey.');
    }
    if (/high demand|overloaded|try again later|unavailable|deadline/i.test(msg)) {
      throw new Error('Google\'s image model is busy right now — give it a moment and try again.');
    }
    throw new Error(msg);
  }
  const steps = json.steps || [];
  const outContent = steps.flatMap((s) => (s.content || []));
  const imgOut = outContent.find((c) => c.type === 'image');
  if (!imgOut || !imgOut.data) {
    const text = outContent.filter((c) => c.type === 'text').map((c) => c.text).filter(Boolean).join(' ');
    throw new Error(text ? 'The AI declined: ' + text.slice(0, 160) : 'The AI returned no image.');
  }
  return `data:${imgOut.mime_type || 'image/jpeg'};base64,${imgOut.data}`;
}

async function geminiGenerateLook({ personDataUris, garments, uploadsDir, instructions }) {
  const model = process.env.GEMINI_MODEL || 'gemini-3-pro-image';
  // Person images FIRST (anchor identity from every angle), then instructions, then garments.
  const input = [];
  for (const p of personDataUris) input.push(dataUriToImageInput(p));
  input.push({ type: 'text', text: buildLookPrompt(garments, instructions, personDataUris.length) });
  for (const g of garments) input.push(dataUriToImageInput(toDataUri(g.photo, uploadsDir)));
  return interactionsImageRequest(model, input, { imageSize: process.env.GEMINI_IMAGE_SIZE || '1K' });
}

/* ---------------- clean up a closet photo onto a white background ----------------
   Runs once when a new piece is added. Uses the fast Flash image model (not
   Pro) since this is a much simpler single-image edit than a full try-on, and
   speed matters more than maximum fidelity here. Bounded to 2 attempts so a
   slow/failing request never holds up adding a piece for long. */
async function whiteBackgroundPhoto(photoDataUri) {
  const model = process.env.GEMINI_BG_MODEL || 'gemini-3.1-flash-image';
  const input = [
    dataUriToImageInput(photoDataUri),
    {
      type: 'text',
      text: [
        'This is a photo of a single clothing item, shoe, bag or accessory for a wardrobe catalog.',
        'Edit ONLY the background: replace it with a clean, pure white, evenly lit studio background.',
        'Do NOT change the item itself in any way — keep its exact color, pattern, shape, texture, logos and text identical.',
        'Do not add any model, mannequin, shadow drama, or props. Center the item. Output only the edited photo.',
      ].join(' '),
    },
  ];
  return interactionsImageRequest(model, input, { maxAttempts: 2, imageSize: '1K' });
}

/* ---------------- Replicate IDM-VTON (single garment fallback) ---------------- */
async function replicateSingle({ personDataUri, garment, uploadsDir }) {
  const token = process.env.REPLICATE_API_TOKEN;
  const CATEGORY_MAP = { Tops: 'upper_body', Outerwear: 'upper_body', Dresses: 'dresses', Bottoms: 'lower_body' };
  const input = {
    human_img: personDataUri,
    garm_img: toDataUri(garment.photo, uploadsDir),
    garment_des: [garment.color, garment.name].filter(Boolean).join(' ') || 'garment',
    category: CATEGORY_MAP[garment.category] || 'upper_body',
  };
  const create = await fetch('https://api.replicate.com/v1/models/cuuupid/idm-vton/predictions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'wait' },
    body: JSON.stringify({ input }),
  });
  let prediction = await create.json();
  if (!create.ok) throw new Error(prediction.detail || 'Try-on request failed.');
  const started = Date.now();
  while (['starting', 'processing'].includes(prediction.status)) {
    if (Date.now() - started > 120000) throw new Error('Try-on timed out.');
    await sleep(2000);
    prediction = await (await fetch(prediction.urls.get, { headers: { Authorization: `Bearer ${token}` } })).json();
  }
  if (prediction.status !== 'succeeded') throw new Error(prediction.error || 'The try-on could not be generated.');
  return Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
}

/* ---------------- public entry point ----------------
   Returns either a data: URI (Gemini) or a remote URL (Replicate). */
async function generateLook({ personImageRefs, personImageRef, garments, instructions, uploadsDir }) {
  if (!isConfigured()) throw new Error('Virtual try-on is not set up yet (missing API key).');
  if (!garments || !garments.length) throw new Error('Choose at least one piece.');
  const refs = (personImageRefs && personImageRefs.length ? personImageRefs : [personImageRef]).filter(Boolean);
  if (!refs.length) throw new Error('Add photos of the person first.');
  const personDataUris = refs.map((r) => toDataUri(r, uploadsDir));
  const provider = activeProvider();

  if (provider === 'gemini') {
    // Google's Interactions API can time out ("deadline expired") on very
    // heavy multi-image requests. The caller sorts refs with the most
    // identity-critical angles first (face/waist/full), so capping here
    // keeps the important ones and trims the rest to stay reliable.
    const maxPersonPhotos = Number(process.env.GEMINI_MAX_PERSON_PHOTOS) || 3;
    return geminiGenerateLook({ personDataUris: personDataUris.slice(0, maxPersonPhotos), garments, uploadsDir, instructions });
  }
  if (provider === 'replicate') {
    // IDM-VTON handles one person image + one garment; use the first of each.
    const order = ['Dresses', 'Tops', 'Outerwear', 'Bottoms'];
    const garment = garments.slice().sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category))[0] || garments[0];
    return replicateSingle({ personDataUri: personDataUris[0], garment, uploadsDir });
  }
  throw new Error('Unknown try-on provider: ' + provider);
}

/* ---------------- shared text generation (cheap model) ----------------
   Gemini 3.x models "think" before answering and that eats into
   maxOutputTokens — ask for generous headroom (the thinking tokens are not
   part of the visible reply) or short replies come back empty/truncated. */
async function generateText(prompt, { maxOutputTokens = 700, temperature = 0.7, systemInstruction } = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Gemini is not configured.');
  const model = process.env.GEMINI_TEXT_MODEL || 'gemini-3.6-flash';
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    // A capped thinkingBudget keeps this fast model from occasionally
    // spending its whole token budget "thinking" and returning a
    // truncated (or empty) visible reply — see MAX_TOKENS handling below.
    generationConfig: { maxOutputTokens, temperature, thinkingConfig: { thinkingBudget: 128 } },
  };
  if (systemInstruction) body.systemInstruction = { parts: [{ text: systemInstruction }] };
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );
  const json = await res.json();
  if (!res.ok) throw new Error((json.error && json.error.message) || 'Text request failed.');
  const cand = json.candidates && json.candidates[0];
  // MAX_TOKENS can leave a non-empty but mid-sentence-cut reply — treat that
  // as a failure too rather than showing a truncated answer.
  if (cand && cand.finishReason === 'MAX_TOKENS') throw new Error('Ran out of room to answer — try a shorter question.');
  const text = ((cand && cand.content && cand.content.parts) || []).map((p) => p.text).filter(Boolean).join(' ').trim();
  if (!text) throw new Error('No text returned.');
  return text;
}

/* ---------------- daily planner briefing ----------------
   A short, warm 1-2 sentence note for the Home "Today" card, the local
   notification body, and the home-screen widget — built from whatever she put
   in the planner for that day. */
async function generateDailyBriefing({ date, outfitName, items, note }) {
  const weekday = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });
  const outfitLine = outfitName
    ? `Planned outfit: "${outfitName}"${items && items.length ? ' (' + items.map((i) => i.name).join(', ') + ')' : ''}.`
    : 'No outfit picked for today yet.';
  const noteLine = note ? `Her note for the day: "${note}".` : '';
  const prompt = [
    `Write a short, warm, upbeat good-morning message for a young woman named Gülay for ${weekday}.`,
    outfitLine,
    noteLine,
    'One or two short sentences, plain text only (no markdown, no quotes around it, no emoji), friendly and',
    'encouraging, like a sweet note from a partner. If she has a note/task for the day, gently remind her of it.',
    'Keep it under 220 characters.',
  ].filter(Boolean).join('\n');
  return generateText(prompt, { maxOutputTokens: 1000, temperature: 0.9 });
}

/* ---------------- personal helper chatbot ----------------
   A general assistant that lives in the app — plans and calendar questions
   ("what am I wearing Friday?"), closet/spending questions ("how many
   dresses do I have?"), styling chat, general conversation, in Azerbaijani,
   Turkish, or English. Music playback commands ("play X") are handled
   locally in app.js before this is ever called, so this never needs to
   deal with those. */
async function answerCalendarQuestion({ question, todayDate, plannerSummary, closetSummary, history }) {
  const systemInstruction = [
    "You are Gülay's personal helper, built into her app. The app also happens to manage her wardrobe,",
    "but you are her general assistant, not just a wardrobe bot — happy to help with anything, wardrobe or not.",
    `Today's date is ${todayDate}.`,
    "You can chat about anything she brings up — her schedule, her closet, styling advice, or just talking.",
    'For facts about her planner or her closet, answer only from the data below and never invent dates,',
    "outfits, events, or items that aren't there — say plainly if something isn't planned or tracked yet.",
    'For everything else (opinions, advice, general conversation), just be genuinely helpful and warm.',
    'Always reply in the same language she just wrote in. She may write in Azerbaijani, Turkish, or English',
    '(or mix them) — match her language naturally, the way a bilingual friend would, without commenting on it.',
    'The conversation so far is included below — remember what she already told you earlier in it and stay',
    'consistent with it (e.g. if she mentioned a preference or corrected you, keep that in mind for later answers).',
    'Keep answers short and conversational (1-4 sentences), plain text, no markdown, no emoji.',
    '',
    'HER PLANNER:',
    plannerSummary || '(nothing planned yet)',
    '',
    'HER CLOSET:',
    closetSummary || '(empty so far)',
  ].join('\n');
  const historyLines = (history || [])
    .slice(-24)
    .map((h) => `${h.role === 'user' ? 'Gülay' : 'Assistant'}: ${h.text}`)
    .join('\n');
  const prompt = [historyLines, `Gülay: ${question}`].filter(Boolean).join('\n');
  return generateText(prompt, { maxOutputTokens: 900, temperature: 0.6, systemInstruction });
}

module.exports = {
  generateLook,
  generateDailyBriefing,
  answerCalendarQuestion,
  whiteBackgroundPhoto,
  isConfigured,
  activeProvider,
  get provider() {
    return activeProvider();
  },
};
