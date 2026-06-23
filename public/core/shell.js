/* BlackState — barre de navigation globale (injectée sur chaque page) */
function renderShell() {
  const mount = $('bs-shell'); if (!mount) return;
  const uni = document.body.dataset.universe || 'club';
  const link = (href, key, label) =>
    `<a class="bs-nav-link${uni===key?' active':''}" data-u="${key}" href="${href}">${label}</a>`;
  const right = USER
    ? `<div class="bs-user">
         <span class="bs-bal" id="navBal"><span class="bs-coin"></span>${fmt(USER.credit)}</span>
         <a class="bs-nav-link" href="/profil">${esc(USER.username)}</a>
         <button class="btn ghost sm" onclick="logout()">Déconnexion</button>
       </div>`
    : `<button class="btn sm" onclick="openLoginModal()">Se connecter</button>`;
  mount.innerHTML =
    `<header class="bs-nav">
       <a class="bs-logo" href="/">Black<span>State</span></a>
       <nav class="bs-nav-links">
         ${link('/','club','Club')}
         ${link('/casino','casino','Casino')}
         ${link('/fight','fight','Fight')}
       </nav>
       <div class="bs-nav-right">${right}</div>
     </header>`;
}

function refreshNavBal() {
  if (!USER) return;
  const txt = fmt(USER.credit);
  const nav = $('navBal'); if (nav) nav.innerHTML = '<span class="bs-coin"></span>' + txt;
  // éléments de solde "Crédits Club" (sidebar casino, hub portail, profil…)
  document.querySelectorAll('[data-credit]').forEach(e => { e.textContent = txt; });
}

function openLoginModal() {
  const s = 'width:100%;padding:11px 13px;margin-top:6px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:rgba(0,0,0,.4);color:#e8e6f3;font-size:16px;outline:none';
  openModal('Se connecter',
    `<label>Pseudo</label><input id="mLoginUser" style="${s}" autocomplete="username">
     <label style="display:block;margin-top:12px">Mot de passe</label>
     <input id="mLoginPass" type="password" style="${s}" autocomplete="current-password">
     <div id="mLoginErr" style="color:#f87171;font-size:.85rem;margin-top:10px;min-height:1em"></div>`,
    null);
  // remplace le bouton "Confirmer" par une connexion réelle
  const overlay = $('modalOverlay');
  const confirmBtn = overlay.querySelector('[data-modal-confirm]');
  if (confirmBtn) confirmBtn.onclick = submitLogin;
  setTimeout(() => { const i = $('mLoginPass'); if (i) i.addEventListener('keydown', e => { if (e.key === 'Enter') submitLogin(); }); }, 0);
}
async function submitLogin() {
  const err = $('mLoginErr'); if (err) err.textContent = '';
  try {
    const u = await doLogin($('mLoginUser').value.trim(), $('mLoginPass').value);
    closeModal();
    if (u && u.need2fa) { location.href = '/'; return; }   // 2FA → login en 2 temps sur le portail
    location.href = u.admin ? '/admin' : (location.pathname === '/' ? '/casino' : location.pathname);
  } catch (e) { if (err) err.textContent = e.message; }
}
