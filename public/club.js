const INVITE_TOKEN = new URLSearchParams(location.search).get('invite') || '';
(async () => {
  const u = await getMe();
  renderShell();
  if (typeof lucide !== 'undefined') lucide.createIcons();
  if (u) {                                   // déjà connecté
    if (u.admin) { location.href = '/admin'; return; }
    return;                                   // reste sur la vitrine
  }
  if (INVITE_TOKEN) {
    try {
      const inv = await api('/invite/' + INVITE_TOKEN);
      $('registerSection').classList.remove('hidden');
      $('inviteBanner').textContent = `Invitation valide · ${fmt(inv.credits)} crédits offerts`;
    } catch (e) { toast(e.message, 4000); }
  }
})();

async function submitRegister() {
  $('regErr').textContent = '';
  try {
    const d = await api('/register', 'POST', {
      user: $('regUser').value.trim(), pass: $('regPass').value, invite: INVITE_TOKEN,
      nom: $('regNom').value, prenom: $('regPrenom').value,
      phone: $('regPhone').value, discord: $('regDiscord').value,
    });
    TOKEN = d.token; localStorage.setItem('ns_token', TOKEN); USER = d.user;
    location.href = '/casino';
  } catch (e) { $('regErr').textContent = e.message; }
}
