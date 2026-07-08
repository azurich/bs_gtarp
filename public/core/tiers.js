/* BlackState — paliers de résultat (logique pure, sans DOM).
   Décide le palier à partir du résultat NET (gain vs mise) et du flag `top`
   (le gain a-t-il atteint le multiplicateur maximal du jeu ?). */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Tiers = api;
})(typeof self !== 'undefined' ? self : this, function () {
  var BIG_MULT = 5, MEGA_MULT = 10, JACKPOT_MIN_MULT = 10;
  function pickTier(gain, bet, isTop) {
    if (!(bet > 0)) return 'lose';
    if (gain <= 0)    return 'lose';
    if (gain < bet)   return 'partial';
    if (gain === bet) return 'push';
    var mult = gain / bet;
    if (isTop && mult >= JACKPOT_MIN_MULT) return 'jackpot';
    if (mult > MEGA_MULT) return 'mega-win';
    if (mult > BIG_MULT)  return 'big-win';
    return 'win';
  }
  return {
    pickTier: pickTier,
    BIG_MULT: BIG_MULT, MEGA_MULT: MEGA_MULT, JACKPOT_MIN_MULT: JACKPOT_MIN_MULT,
  };
});
