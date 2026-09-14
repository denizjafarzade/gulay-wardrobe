// Renders the app icon + splash source images into assets/ (used by @capacitor/assets).
const sharp = require('sharp');
const fs = require('fs');

fs.mkdirSync('assets', { recursive: true });

const icon = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#d99aa5"/>
      <stop offset="0.55" stop-color="#b96e7d"/>
      <stop offset="1" stop-color="#9d5265"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e8cf9a"/>
      <stop offset="1" stop-color="#c9a86a"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <circle cx="512" cy="512" r="368" fill="none" stroke="url(#gold)" stroke-width="10" opacity="0.85"/>
  <circle cx="512" cy="512" r="340" fill="none" stroke="#fffdfb" stroke-width="3" opacity="0.35"/>
  <text x="512" y="700" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-weight="bold" font-size="520" fill="#fffdfb">G</text>
  <text x="512" y="880" text-anchor="middle" font-family="Georgia, serif" font-size="58" letter-spacing="26" fill="#f6e3d2">WARDROBE</text>
</svg>`;

const splash = (dark) => `
<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732">
  <rect width="2732" height="2732" fill="${dark ? '#43303a' : '#faf5f0'}"/>
  <circle cx="1366" cy="1300" r="330" fill="none" stroke="#c9a86a" stroke-width="8" opacity="0.8"/>
  <text x="1366" y="1470" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-weight="bold" font-size="460" fill="${dark ? '#f2dad8' : '#a95f6e'}">G</text>
</svg>`;

(async () => {
  await sharp(Buffer.from(icon)).png().toFile('assets/icon-only.png');
  await sharp(Buffer.from(icon)).png().toFile('assets/icon-foreground.png');
  await sharp(Buffer.from(splash(false))).png().toFile('assets/splash.png');
  await sharp(Buffer.from(splash(true))).png().toFile('assets/splash-dark.png');
  console.log('icon + splash sources written to assets/');
})();
