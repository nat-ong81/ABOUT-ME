// Runs before first paint so a chosen light or dark theme never flashes.
(function () {
  try {
    var t = JSON.parse(localStorage.getItem('iom.theme'));
    if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  } catch (e) { /* default theme */ }
})();
