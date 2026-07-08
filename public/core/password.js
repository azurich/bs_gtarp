/* BlackState — politique de mot de passe (logique pure, sans DOM).
   Source de vérité unique partagée par le front (checklist live) et le serveur
   (application). Même patron UMD que core/tiers.js. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Password = api;
})(typeof self !== 'undefined' ? self : this, function () {
  var MIN_LEN = 12, MAX_LEN = 128;

  function checkPassword(pw, pseudo) {
    pw = String(pw == null ? '' : pw);
    pseudo = String(pseudo == null ? '' : pseudo);
    var rules = {
      length : pw.length >= MIN_LEN && pw.length <= MAX_LEN,
      upper  : /[A-Z]/.test(pw),
      lower  : /[a-z]/.test(pw),
      digit  : /[0-9]/.test(pw),
      special: /[^A-Za-z0-9]/.test(pw),
      notName: pseudo.length < 3 || pw.toLowerCase().indexOf(pseudo.toLowerCase()) === -1,
    };
    var ok = rules.length && rules.upper && rules.lower && rules.digit && rules.special && rules.notName;
    var classes = (rules.upper ? 1 : 0) + (rules.lower ? 1 : 0) + (rules.digit ? 1 : 0) + (rules.special ? 1 : 0);
    var lenScore = pw.length >= 16 ? 2 : pw.length >= 12 ? 1 : 0;
    var score = classes + lenScore;                       // 0..6
    var label = score >= 6 ? 'Fort' : score >= 4 ? 'Moyen' : 'Faible';
    return { rules: rules, ok: ok, score: score, label: label };
  }

  function errorMessage(res) {
    if (res.ok) return null;
    var r = res.rules;
    if (!r.length)  return 'Mot de passe : entre 12 et 128 caractères.';
    if (!r.lower)   return 'Mot de passe : ajoute une minuscule.';
    if (!r.upper)   return 'Mot de passe : ajoute une majuscule.';
    if (!r.digit)   return 'Mot de passe : ajoute un chiffre.';
    if (!r.special) return 'Mot de passe : ajoute un caractère spécial.';
    if (!r.notName) return 'Le mot de passe ne doit pas contenir ton pseudo.';
    return 'Mot de passe invalide.';
  }

  return {
    checkPassword: checkPassword, errorMessage: errorMessage,
    MIN_LEN: MIN_LEN, MAX_LEN: MAX_LEN,
  };
});
