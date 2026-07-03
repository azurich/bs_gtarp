const INVITE_TOKEN = new URLSearchParams(location.search).get('invite') || '';

/* ── Turnstile (CAPTCHA) — rendu explicite sur le formulaire visible ──
   Piloté par /api/config : si la clé de site est nulle (dev sans clés),
   aucun widget n'est rendu et les formulaires marchent normalement. */
let _cfSiteKey = undefined;   // undefined = pas encore lu ; null = désactivé
let _cfScriptP = null;
let cfLoginId = null, cfRegId = null;

async function cfConfig() {
  if (_cfSiteKey !== undefined) return _cfSiteKey;
  try { const c = await api('/turnstile'); _cfSiteKey = c.turnstile || null; }
  catch (e) { _cfSiteKey = null; }
  return _cfSiteKey;
}
function cfLoadScript() {
  if (_cfScriptP) return _cfScriptP;
  _cfScriptP = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true; s.defer = true;
    s.onload = () => res(); s.onerror = () => rej(new Error('turnstile'));
    document.head.appendChild(s);
  });
  return _cfScriptP;
}
async function cfRender(containerId) {
  const key = await cfConfig();
  if (!key) return null;                       // désactivé → pas de widget
  try {
    await cfLoadScript();
    if (!window.turnstile) return null;
    return await new Promise(res => {
      window.turnstile.ready(() =>
        res(window.turnstile.render('#' + containerId, { sitekey: key, theme: 'dark' })));
    });
  } catch (e) { return null; }
}
function cfToken(id) {
  try { return (id != null && window.turnstile) ? window.turnstile.getResponse(id) : ''; }
  catch (e) { return ''; }
}
function cfReset(id) {
  try { if (id != null && window.turnstile) window.turnstile.reset(id); } catch (e) {}
}

(async () => {
  const u = await getMe();
  if (u) {
    if (u.admin) { location.href = '/admin'; return; }
    // HUB connecté
    $('hubUser').textContent = (u.rp && u.rp.prenom) ? u.rp.prenom : u.username;
    refreshNavBal();
    $('portalHub').classList.remove('hidden');
  } else if (INVITE_TOKEN) {
    // Inscription via invitation
    try {
      const inv = await api('/invite/' + INVITE_TOKEN);
      $('inviteBanner').textContent = `Invitation valide · ${fmt(inv.credits)} Crédits Club offerts`;
      $('registerSection').classList.remove('hidden');
      cfRender('regCaptcha').then(id => { cfRegId = id; });
    } catch (e) {
      toast(e.message, 4000, 'error');
      $('portalLogin').classList.remove('hidden');
    }
  } else {
    // Connexion
    $('portalLogin').classList.remove('hidden');
    cfRender('loginCaptcha').then(id => { cfLoginId = id; });
    const pass = $('loginPass');
    if (pass) pass.addEventListener('keydown', e => { if (e.key === 'Enter') doPortalLogin(); });
    const code = $('loginCode');
    if (code) code.addEventListener('keydown', e => { if (e.key === 'Enter') submitLoginCode(); });
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
})();

function showJoinInfo() { $('joinModal').classList.remove('hidden'); }
function closeJoinModal() { $('joinModal').classList.add('hidden'); }

async function doPortalLogin() {
  $('loginErr').textContent = '';
  try {
    const r = await doLogin($('loginUser').value.trim(), $('loginPass').value, undefined, cfToken(cfLoginId));
    if (r && r.need2fa) { open2faModal(); return; }     // 2FA requise → pop-up code
    location.href = r.admin ? '/admin' : '/';           // recharge sur le hub
  } catch (e) { $('loginErr').textContent = e.message; cfReset(cfLoginId); }
}

function open2faModal() {
  $('login2faErr').textContent = '';
  $('loginCode').value = '';
  $('login2faModal').classList.remove('hidden');
  setTimeout(() => { const c = $('loginCode'); if (c) c.focus(); }, 50);
}
function close2faModal() { $('login2faModal').classList.add('hidden'); }

async function submitLoginCode() {
  $('login2faErr').textContent = '';
  try {
    const r = await doLogin($('loginUser').value.trim(), $('loginPass').value, $('loginCode').value.trim());
    if (r && r.need2fa) { $('login2faErr').textContent = 'Entre le code à 6 chiffres.'; return; }
    location.href = r.admin ? '/admin' : '/';
  } catch (e) { $('login2faErr').textContent = e.message; }
}

async function submitRegister() {
  $('regErr').textContent = '';
  try {
    const d = await api('/register', 'POST', {
      user: $('regUser').value.trim(), pass: $('regPass').value, invite: INVITE_TOKEN,
      nom: $('regNom').value, prenom: $('regPrenom').value,
      phone: $('regPhone').value, discord: $('regDiscord').value,
      cfToken: cfToken(cfRegId),
    });
    TOKEN = d.token; localStorage.setItem('ns_token', TOKEN); USER = d.user;
    // Étape 2FA optionnelle avant d'arriver au hub
    $('registerSection').classList.add('hidden');
    $('regTwofa').classList.remove('hidden');
  } catch (e) { $('regErr').textContent = e.message; cfReset(cfRegId); }
}

function startRegTwofa() {
  $('regTwofaChoice').classList.add('hidden');
  mount2FASetup($('regTwofaBox'), () => location.href = '/');
}
