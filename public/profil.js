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
  if (typeof lucide !== 'undefined') lucide.createIcons();
})();

async function saveProfile() {
  $('pErr').textContent = '';
  try {
    await api('/profile', 'POST', { nom: $('pNom').value, prenom: $('pPrenom').value,
      phone: $('pPhone').value, discord: $('pDiscord').value });
    toast('Profil enregistré ✓', 3500);
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
    toast('Mot de passe enregistré ✓', 3500);
  } catch (e) { err.textContent = e.message; }
}
