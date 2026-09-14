/* Points the app at your hosted server.
   Leave apiBase empty ('') for local web development and for the website —
   the app just uses relative paths to whatever server served the page.

   For the native iOS app, everything (photos, planner, songs — all of it)
   is stored on YOUR server, not on the phone, so fill this in once you've
   deployed server.js somewhere reachable over HTTPS:

     window.WARDROBE_CONFIG = { apiBase: 'https://wardrobe.yourdomain.com' };

   No trailing slash. See README-APPSTORE.md for hosting + deployment notes. */
window.WARDROBE_CONFIG = {
  apiBase: 'https://gulaywardrobe.com',
};
