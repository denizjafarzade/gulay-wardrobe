/* Line-icon set for Gülay's Wardrobe — no emoji anywhere in the UI.
   Each entry is the INNER svg markup (paths only); icon() wraps it in a
   24x24 <svg> using currentColor so icons inherit whatever text color
   they're placed in and can be sized/recolored purely with CSS. */
const ICONS = {
  home: '<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9a1 1 0 0 0 1 1h4v-6h2v6h4a1 1 0 0 0 1-1v-9"/>',
  closet: '<path d="M12 3v4"/><circle cx="12" cy="9" r="1.4"/><path d="M12 10 4 15v6h16v-6z"/><path d="M4 21V15M20 21V15"/>',
  hanger: '<circle cx="12" cy="4.2" r="1.4"/><path d="M12 5.6v2.2"/><path d="M12 7.8c0-1.4 2.4-1.4 2.4-3"/><path d="M12 7.8 3 15.5a1.3 1.3 0 0 0 .8 2.3h16.4a1.3 1.3 0 0 0 .8-2.3z"/><path d="M7 15.5h10"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  studio: '<circle cx="12" cy="9" r="6"/><path d="M8.5 13.5 5 21M15.5 13.5 19 21"/>',
  planner: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>',
  chat: '<path d="M4 5h16v11H9l-4 4v-4H4z"/><path d="M8 9h8M8 12.5h5"/>',
  hourglass: '<path d="M6 3h12M6 21h12"/><path d="M6 3c0 5 12 5 12 0M6 21c0-5 12-5 12 0"/>',
  heartOutline: '<path d="M12 20s-7-4.35-9.5-8.5C.8 8 2.2 4.5 5.8 4.1c2-.2 3.6.9 4.2 2.2.6-1.3 2.2-2.4 4.2-2.2 3.6.4 5 3.9 3.3 7.4C19 15.65 12 20 12 20z"/>',
  heartFilled: '<path fill="currentColor" stroke="none" d="M12 20s-7-4.35-9.5-8.5C.8 8 2.2 4.5 5.8 4.1c2-.2 3.6.9 4.2 2.2.6-1.3 2.2-2.4 4.2-2.2 3.6.4 5 3.9 3.3 7.4C19 15.65 12 20 12 20z"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  camera: '<path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13.5" r="3.3"/>',
  link: '<path d="M9 15l6-6"/><path d="M8.5 12 6 14.5a3 3 0 0 0 4.2 4.2L13 16"/><path d="M15.5 12 18 9.5a3 3 0 0 0-4.2-4.2L11 8"/>',
  mirror: '<path d="M12 3 6 9v6l6 6 6-6V9z"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="9" r="1.1" fill="currentColor" stroke="none"/><circle cx="9" cy="15" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="15" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/>',
  download: '<path d="M12 4v11"/><path d="M7.5 11.5 12 16l4.5-4.5"/><path d="M5 19h14"/>',
  refresh: '<path d="M4 4v5h5"/><path d="M20 20v-5h-5"/><path d="M5.5 15a7 7 0 0 0 12.6 2.1M18.5 9a7 7 0 0 0-12.6-2.1"/>',
  save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4"/><path d="M8 14h8v6H8z"/>',
  trash: '<path d="M5 7h14"/><path d="M9 7V5h6v2"/><path d="M7 7l1 13h8l1-13"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  chevronLeft: '<path d="M14.5 5 8 12l6.5 7"/>',
  chevronRight: '<path d="M9.5 5 16 12l-6.5 7"/>',
  check: '<path d="M4.5 12.5 9 17l10.5-10.5"/>',
  basket: '<path d="M4 9h16l-1.5 10a2 2 0 0 1-2 1.8H7.5a2 2 0 0 1-2-1.8z"/><path d="M8 9 12 3l4 6"/>',
  gift: '<rect x="4" y="9" width="16" height="11"/><path d="M4 9h16v4H4z" fill="currentColor" stroke="none" opacity=".15"/><path d="M12 9v11"/><path d="M8 9c-2 0-3-1.2-3-2.5S6 4 8 6c1.2 1.2 2 3 2 3M16 9c2 0 3-1.2 3-2.5S18 4 16 6c-1.2 1.2-2 3-2 3"/>',
  graduation: '<path d="M2 9l10-4 10 4-10 4z"/><path d="M6 11v4c0 1.4 2.7 3 6 3s6-1.6 6-3v-4"/><path d="M22 9v6"/>',
  plane: '<path d="M3 13l7-2 4-7 2 .5-2.3 6.8L20 10l1 2-6.3 2.7L13 20l-2-.5.8-5.3z"/>',
  star: '<path d="M12 3.5l2.5 5.6 6 .6-4.5 4 1.3 5.9L12 16.8l-5.3 2.8 1.3-5.9-4.5-4 6-.6z"/>',
  pin: '<path d="M12 21s6-5.7 6-10.5A6 6 0 0 0 6 10.5C6 15.3 12 21 12 21z"/><circle cx="12" cy="10.5" r="2"/>',
  musicNote: '<path d="M9 18V5l10-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  play: '<path d="M6 4.5v15l14-7.5z"/>',
  pause: '<path d="M6 4.5h4v15H6zM14 4.5h4v15h-4z"/>',
  skipNext: '<path d="M5 5v14l11-7z"/><path d="M18 5v14"/>',
  skipPrev: '<path d="M19 5v14L8 12z"/><path d="M6 5v14"/>',
  shuffle: '<path d="M4 6h3.5L16 18h4"/><path d="M17 5l3 1.5L17 8"/><path d="M4 18h3.5L11 13"/><path d="M17 16l3 1.5L17 19"/><path d="M11 9l1.5-2"/>',
  volume: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
  price: '<path d="M5 12 12 5h6a1 1 0 0 1 1 1v6l-7 7z"/><circle cx="15" cy="9" r="1.2"/>',
  catTop: '<path d="M9 4 5 7l1.5 3L8 9v11h8V9l1.5 1L19 7l-4-3-1.5 1.5a3 3 0 0 1-3 0z"/>',
  catBottom: '<path d="M7 4h10l1 16h-4l-2-9-2 9H6z"/>',
  catDress: '<path d="M10 4h4l1 3-1 1 3 12H7l3-12-1-1z"/>',
  catOuterwear: '<path d="M9 4 5 7l1.5 3L8 9v11h1V13l1 8h4l1-8v7h1V9l1.5-1L19 7l-4-3-1.5 1.5a3 3 0 0 1-3 0z"/>',
  catShoes: '<path d="M4 19h16v-2c-3 0-4-1-6-3l-3-4-2 1 1 3-3 1-3 2z"/>',
  catBag: '<path d="M7 9V7a5 5 0 0 1 10 0v2"/><rect x="4" y="9" width="16" height="11" rx="2"/>',
  catAccessory: '<circle cx="12" cy="14" r="5"/><circle cx="12" cy="14" r="2"/><path d="M9.5 9 8 4h8l-1.5 5"/>',
  personFace: '<circle cx="12" cy="12" r="8"/><path d="M9 11h.01M15 11h.01"/><path d="M9 15c1 1 5 1 6 0"/>',
  personFull: '<circle cx="12" cy="4.5" r="2.2"/><path d="M12 7v7"/><path d="M8 11l4-1 4 1"/><path d="M12 14l-3 7M12 14l3 7"/>',
  personPose: '<circle cx="13" cy="4.5" r="2.2"/><path d="M13 7v6"/><path d="M9 9l4-1.5 4.5 2.5"/><path d="M13 13l-4 7M13 13l1 8"/>',
  turnLeft: '<path d="M9 7 4 12l5 5"/><path d="M4 12h9a5 5 0 0 1 5 5v1"/>',
  turnRight: '<path d="M15 7l5 5-5 5"/><path d="M20 12h-9a5 5 0 0 0-5 5v1"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12 19 4"/><path d="M15 8l2.5 2.5M18 5l2 2"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
};

function icon(name, cls) {
  const inner = ICONS[name];
  if (!inner) return '';
  return `<svg class="icon${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

window.icon = icon;
