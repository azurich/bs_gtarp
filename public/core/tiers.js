/* BlackState — paliers de résultat (logique pure, sans DOM).
   Décide le palier à partir du résultat NET (gain vs mise). */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Tiers = api;
})(typeof self !== 'undefined' ? self : this, function () {
  function pickTier(gain, bet) {
    if (!(bet > 0)) return 'lose';
    if (gain <= 0)   return 'lose';
    if (gain < bet)  return 'partial';
    if (gain === bet) return 'push';
    if (gain <= 2 * bet)  return 'win-s';
    if (gain <= 5 * bet)  return 'win-m';
    if (gain <= 20 * bet) return 'win-big';
    return 'win-mega';
  }
  return { pickTier: pickTier };
});
