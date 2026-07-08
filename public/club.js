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
    hubInit();
  } else if (INVITE_TOKEN) {
    // Inscription via invitation
    try {
      const inv = await api('/invite/' + INVITE_TOKEN);
      $('inviteBanner').textContent = `Invitation valide · ${fmt(inv.credits)} Crédits Club offerts`;
      $('registerSection').classList.remove('hidden');
      cfRender('regCaptcha').then(id => { cfRegId = id; });
      initRegisterValidation();
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

/* ── Carrousel du hub connecté ── */
let hubIndex = 0, hubTiles = [], hubDragged = false;
function hubRender() {
  if (!hubTiles.length) return;
  const car = $('hubCarousel');
  const cw = car.clientWidth, ch = car.clientHeight;
  const tw = hubTiles[0].offsetWidth, th = hubTiles[0].offsetHeight;
  // positions en pixels ENTIERS -> tuiles nettes (pas de sous-pixel = pas de flou)
  const baseLeft = Math.round((cw - tw) / 2), baseTop = Math.round((ch - th) / 2);
  const spacing = tw * 0.72;
  hubTiles.forEach((t, i) => {
    const d = i - hubIndex, ad = Math.abs(d);
    t.style.left = baseLeft + 'px';
    t.style.top = baseTop + 'px';
    t.style.transform = `translateX(${Math.round(d * spacing)}px) scale(${ad === 0 ? 1 : 0.78})`;
    t.style.opacity = ad === 0 ? '1' : ad === 1 ? '0.5' : '0';
    t.style.zIndex = String(10 - ad);
    t.style.pointerEvents = ad <= 1 ? 'auto' : 'none';
    t.classList.toggle('is-center', ad === 0);
    t.setAttribute('aria-current', ad === 0 ? 'true' : 'false');
  });
}
function hubSlide(dir) {
  hubIndex = Math.max(0, Math.min(hubTiles.length - 1, hubIndex + dir));
  hubRender();
}
function hubEnter() {
  const t = hubTiles[hubIndex]; if (!t) return;
  if (t.dataset.locked) { toast('Bientôt…', 2600, 'info'); return; }
  location.href = t.dataset.go;
}
function hubInit() {
  const track = $('hubTrack'); if (!track) return;
  hubTiles = [...track.querySelectorAll('.hub-tile')];
  hubIndex = 1;   // Profil (tuile du milieu) centré par défaut
  const activate = i => { if (hubDragged) { hubDragged = false; return; } if (i === hubIndex) hubEnter(); else { hubIndex = i; hubRender(); } };
  hubTiles.forEach((t, i) => {
    t.addEventListener('click', () => activate(i));
    t.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(i); } });
  });
  const car = $('hubCarousel');
  car.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { hubSlide(-1); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { hubSlide(1); e.preventDefault(); }
  });
  let x0 = null;
  const down = x => { x0 = x; hubDragged = false; };
  const up = x => { if (x0 == null) return; const dx = x - x0; x0 = null; if (Math.abs(dx) > 40) { hubDragged = true; hubSlide(dx < 0 ? 1 : -1); } };
  car.addEventListener('pointerdown', e => down(e.clientX));
  car.addEventListener('pointerup', e => up(e.clientX));
  car.addEventListener('touchstart', e => down(e.touches[0].clientX), { passive: true });
  car.addEventListener('touchend', e => up(e.changedTouches[0].clientX), { passive: true });
  window.addEventListener('resize', hubRender);
  requestAnimationFrame(hubRender);
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

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

/* ── Inscription : validation live ── */
function validUserClient(u) { return /^[A-Za-z0-9_-]{3,20}$/.test(u); }

function regFieldOk(id, valid, msg) {
  const inp = $(id); if (!inp) return valid;
  const filled = inp.value.trim() !== '';
  inp.classList.toggle('valid', valid);
  inp.classList.toggle('invalid', !valid && filled);
  const m = $(id + 'Msg');
  if (m) m.textContent = (!valid && filled) ? msg : '';
  return valid;
}

function renderPwMeter(res, pass) {
  const bar = $('regPassBar');
  if (bar) {
    bar.style.width = (pass ? (res.score / 6 * 100) : 0) + '%';
    bar.dataset.level = pass ? res.label : '';
  }
  const lbl = $('regPassLabel');
  if (lbl) lbl.textContent = pass ? ('Force : ' + res.label) : '';
  const list = $('regPassChecklist');
  if (list) list.querySelectorAll('li').forEach(li => {
    li.classList.toggle('ok', !!res.rules[li.dataset.rule]);
  });
  // notName n'est pas dans la checklist (règle croisée) → message dédié
  const msg = $('regPassMsg');
  if (msg) msg.textContent = (pass && !res.rules.notName) ? 'Le mot de passe ne doit pas contenir ton pseudo.' : '';
}

function refreshRegisterState() {
  const user = $('regUser').value.trim();
  const pass = $('regPass').value;
  const okUser    = regFieldOk('regUser', validUserClient(user), 'Pseudo : 3–20 caractères (lettres, chiffres, _ ou -).');
  const okNom     = regFieldOk('regNom', $('regNom').value.trim() !== '', 'Champ requis.');
  const okPrenom  = regFieldOk('regPrenom', $('regPrenom').value.trim() !== '', 'Champ requis.');
  const okDiscord = regFieldOk('regDiscord', $('regDiscord').value.trim() !== '', 'Champ requis.');
  const res = Password.checkPassword(pass, user);
  renderPwMeter(res, pass);
  const okAll = okUser && okNom && okPrenom && okDiscord && res.ok;
  const btn = $('regSubmit'); if (btn) btn.disabled = !okAll;
  return okAll;
}

function initRegisterValidation() {
  ['regUser', 'regPass', 'regNom', 'regPrenom', 'regDiscord'].forEach(id => {
    const el = $(id); if (el) el.addEventListener('input', refreshRegisterState);
  });
  refreshRegisterState();
}

async function submitRegister() {
  $('regErr').textContent = '';
  if (!refreshRegisterState()) { $('regErr').textContent = 'Complète les champs en rouge.'; return; }
  try {
    const d = await api('/register', 'POST', {
      user: $('regUser').value.trim(), pass: $('regPass').value, invite: INVITE_TOKEN,
      nom: $('regNom').value, prenom: $('regPrenom').value,
      phone: $('regPhone').value, discord: $('regDiscord').value,
      cfToken: cfToken(cfRegId),
    });
    TOKEN = d.token; localStorage.setItem('bs_token', TOKEN); USER = d.user;
    // Étape 2FA optionnelle avant d'arriver au hub
    $('registerSection').classList.add('hidden');
    $('regTwofa').classList.remove('hidden');
  } catch (e) { $('regErr').textContent = e.message; cfReset(cfRegId); }
}

function startRegTwofa() {
  $('regTwofaChoice').classList.add('hidden');
  mount2FASetup($('regTwofaBox'), () => location.href = '/');
}
