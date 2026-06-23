(async () => {
  const u = await requireAuth(); if (!u) return;
  $('pName').textContent = u.username;
  refreshNavBal();                       // remplit le solde Crédits Club ([data-credit])
  $('pStats').innerHTML =
    [['Misé', u.stats.wagered], ['Gagné', u.stats.won], ['Parties', u.stats.played],
     ['Meilleur gain', u.stats.biggest], ['Niveau', u.level]]
    .map(([k, v]) => `<div class="stat"><div class="lbl">${k}</div><div class="val">${fmt(v)}</div></div>`).join('');
  $('pNom').value = u.rp?.nom || ''; $('pPrenom').value = u.rp?.prenom || '';
  $('pPhone').value = u.rp?.phone || ''; $('pDiscord').value = u.rp?.discord || '';
  render2FA(!!u.totp);
  if (typeof lucide !== 'undefined') lucide.createIcons();
})();

function render2FA(enabled) {
  const box = $('twofaBox');
  if (enabled) {
    box.innerHTML =
      '<p class="twofa-on"><i data-lucide="shield-check"></i><span>La double authentification est <b>activée</b></span></p>'
      + '<button class="btn ghost" onclick="disable2FA()">Désactiver</button>';
  } else {
    box.innerHTML =
      '<p class="club-text" style="margin-top:0">Ajoute une couche de sécurité : un code à 6 chiffres généré par ton téléphone sera demandé à chaque connexion.</p>'
      + '<button class="btn" onclick="start2FA()">Activer la 2FA</button>';
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function start2FA() {
  mount2FASetup($('twofaBox'), () => render2FA(true));
}

function disable2FA() {
  const box = $('twofaBox');
  box.innerHTML =
    '<p class="club-text" style="margin-top:0">Confirme avec ton mot de passe pour désactiver la 2FA :</p>'
    + '<div class="twofa-confirm">'
    +   '<input id="dis2faPw" type="password" placeholder="Mot de passe" autocomplete="current-password">'
    +   '<button class="btn" id="dis2faBtn">Désactiver</button>'
    + '</div>'
    + '<button class="btn ghost" onclick="render2FA(true)">Annuler</button>'
    + '<div id="dis2faErr" class="form-err"></div>';
  const go = async () => {
    $('dis2faErr').textContent = '';
    try {
      await api('/2fa/disable', 'POST', { password: $('dis2faPw').value });
      toast('Double authentification désactivée', 3500);
      render2FA(false);
    } catch (e) { $('dis2faErr').textContent = e.message; }
  };
  $('dis2faBtn').onclick = go;
  const pw = $('dis2faPw');
  pw.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  pw.focus();
}

async function saveProfile() {
  $('pErr').textContent = '';
  try {
    await api('/profile', 'POST', { nom: $('pNom').value, prenom: $('pPrenom').value,
      phone: $('pPhone').value, discord: $('pDiscord').value });
    toast('Profil enregistré', 3500);
  } catch (e) { $('pErr').textContent = e.message; }
}

function togglePw(id, btn) {
  const inp = $(id);
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  btn.innerHTML = '<i data-lucide="' + (show ? 'eye-off' : 'eye') + '"></i>';
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function changePassword() {
  const err = $('pwErr'); err.textContent = '';
  const cur = $('pwCurrent').value, nw = $('pwNew').value, cf = $('pwConfirm').value;
  if (!cur)            { err.textContent = 'Saisis ton mot de passe actuel.'; return; }
  if (nw.length < 8)   { err.textContent = 'Le nouveau mot de passe doit faire au moins 8 caractères.'; return; }
  if (nw !== cf)       { err.textContent = 'Les deux nouveaux mots de passe ne correspondent pas.'; return; }
  try {
    await api('/password', 'POST', { current: cur, password: nw });
    $('pwCurrent').value = ''; $('pwNew').value = ''; $('pwConfirm').value = '';
    toast('Mot de passe enregistré', 3500);
  } catch (e) { err.textContent = e.message; }
}
