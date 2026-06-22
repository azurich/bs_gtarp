(async () => {
  const u = await requireAuth(); if (!u) return;
  renderShell();
  $('pName').textContent = u.username;
  $('pStats').innerHTML =
    [['Solde',u.credit],['Misé',u.stats.wagered],['Gagné',u.stats.won],
     ['Parties',u.stats.played],['Meilleur gain',u.stats.biggest],['Niveau',u.level]]
    .map(([k,v]) => `<div class="stat"><div class="lbl">${k}</div><div class="val">${fmt(v)}</div></div>`).join('');
  $('pNom').value = u.rp?.nom || ''; $('pPrenom').value = u.rp?.prenom || '';
  $('pPhone').value = u.rp?.phone || ''; $('pDiscord').value = u.rp?.discord || '';
})();
async function saveProfile() {
  $('pErr').textContent = '';
  try {
    await api('/profile', 'POST', { nom:$('pNom').value, prenom:$('pPrenom').value,
      phone:$('pPhone').value, discord:$('pDiscord').value });
    toast('Profil enregistré');
  } catch (e) { $('pErr').textContent = e.message; }
}
