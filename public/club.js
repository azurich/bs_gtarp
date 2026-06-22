const INVITE_TOKEN = new URLSearchParams(location.search).get('invite') || '';

(async () => {
  const u = await getMe();
  if (u) {
    if (u.admin) { location.href = '/admin'; return; }
    // HUB connecté
    $('hubUser').textContent = u.username;
    refreshNavBal();
    $('portalHub').classList.remove('hidden');
  } else if (INVITE_TOKEN) {
    // Inscription via invitation
    try {
      const inv = await api('/invite/' + INVITE_TOKEN);
      $('inviteBanner').textContent = `Invitation valide · ${fmt(inv.credits)} crédits offerts`;
      $('registerSection').classList.remove('hidden');
    } catch (e) {
      toast(e.message, 4000);
      $('portalLogin').classList.remove('hidden');
    }
  } else {
    // Connexion
    $('portalLogin').classList.remove('hidden');
    const pass = $('loginPass');
    if (pass) pass.addEventListener('keydown', e => { if (e.key === 'Enter') doPortalLogin(); });
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
})();

function showJoinInfo() {
  // Popup placeholder — contenu à personnaliser plus tard
  openModal('Rejoindre le club',
    `<p class="club-text">Le BlackState Club est accessible <b>sur invitation uniquement</b>.</p>
     <p class="club-text" style="margin-top:10px">Pour obtenir une invitation, contactez un membre du club en RP… (à compléter).</p>`,
    null);
}

async function doPortalLogin() {
  $('loginErr').textContent = '';
  try {
    const u = await doLogin($('loginUser').value.trim(), $('loginPass').value);
    location.href = u.admin ? '/admin' : '/';   // recharge sur le hub
  } catch (e) { $('loginErr').textContent = e.message; }
}

async function submitRegister() {
  $('regErr').textContent = '';
  try {
    const d = await api('/register', 'POST', {
      user: $('regUser').value.trim(), pass: $('regPass').value, invite: INVITE_TOKEN,
      nom: $('regNom').value, prenom: $('regPrenom').value,
      phone: $('regPhone').value, discord: $('regDiscord').value,
    });
    TOKEN = d.token; localStorage.setItem('ns_token', TOKEN); USER = d.user;
    location.href = '/';   // arrive sur le hub
  } catch (e) { $('regErr').textContent = e.message; }
}
