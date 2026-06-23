/* BlackState — UI partagée de configuration 2FA (TOTP).
   Dépend de auth.js (api, esc, toast, $) et de qrcode.min.js (global `qrcode`).
   mount2FASetup(box, onDone) : génère un secret, affiche le QR + la clé,
   demande un code à 6 chiffres et active la 2FA. */
async function mount2FASetup(box, onDone) {
  box.innerHTML = '<p class="twofa-loading">Préparation…</p>';
  let d;
  try { d = await api('/2fa/setup', 'POST'); }
  catch (e) { box.innerHTML = '<p class="form-err">' + esc(e.message) + '</p>'; return; }

  let qrImg = '';
  try {
    const qr = qrcode(0, 'M'); qr.addData(d.uri); qr.make();
    qrImg = '<img class="twofa-qr" src="' + qr.createDataURL(6, 3) + '" alt="QR code 2FA">';
  } catch (e) { qrImg = '<p class="hint">QR indisponible — utilise la clé ci-dessous.</p>'; }

  box.innerHTML =
      '<ol class="twofa-steps">'
    +   '<li>Scanne ce QR code dans <b>Google Authenticator</b> (ou Authy, Microsoft Authenticator).</li>'
    +   '<li>Ou saisis la clé à la main : <code class="twofa-secret">' + esc(d.secret) + '</code></li>'
    +   '<li>Entre le code à 6 chiffres affiché par l\'application :</li>'
    + '</ol>'
    + '<div class="twofa-qrwrap">' + qrImg + '</div>'
    + '<div class="twofa-confirm">'
    +   '<input id="twofaCode" inputmode="numeric" maxlength="6" placeholder="000000" autocomplete="one-time-code">'
    +   '<button class="btn" id="twofaConfirmBtn">Activer</button>'
    + '</div>'
    + '<div id="twofaErr" class="form-err"></div>';

  const confirm = async () => {
    $('twofaErr').textContent = '';
    try {
      await api('/2fa/enable', 'POST', { code: $('twofaCode').value.trim() });
      toast('Double authentification activée ✓', 3500);
      if (onDone) onDone();
    } catch (e) { $('twofaErr').textContent = e.message; }
  };
  $('twofaConfirmBtn').onclick = confirm;
  const ci = $('twofaCode');
  if (ci) { ci.addEventListener('keydown', e => { if (e.key === 'Enter') confirm(); }); ci.focus(); }
}
