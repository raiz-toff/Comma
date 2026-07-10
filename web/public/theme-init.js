/* Sync theme before paint — reads localStorage key comma-theme (F3). */
(function () {
  var key = 'comma-theme';
  var allowed = { light: 1, dark: 1, auto: 1 };
  var raw;
  try {
    raw = localStorage.getItem(key);
  } catch (e) {
    raw = null;
  }
  var theme = raw && allowed[raw] ? raw : 'auto';
  document.documentElement.setAttribute('data-theme', theme);
})();
