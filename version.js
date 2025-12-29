/* Shared version constants (window + service worker)

   Keep version tags here so caching + icon filenames can be updated
   by changing a single value.
*/

(() => {
  const ICON_VERSION = "v3.0";

  // Expose on globalThis so it works in both Window and ServiceWorker contexts.
  globalThis.SANAHUIJARI_ICON_VERSION = ICON_VERSION;
})();
