/* BlackState — noyau session/API partagé */
let TOKEN = localStorage.getItem('ns_token') || null;
let USER  = null;
const $ = id => document.getElementById(id);

async function api(path, method = 'GET', body) {
  const opt = { method, headers: {} };
  if (TOKEN) opt.headers['Authorization'] = 'Bearer ' + TOKEN;
  if (body)  { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  const res = await fetch('/api' + path, opt);
  let data = {}; try { data = await res.json(); } catch (e) {}
  if (res.status === 401 && path !== '/login') {
    TOKEN = null; USER = null; localStorage.removeItem('ns_token');
    if (location.pathname !== '/') { location.href = '/'; }
    throw new Error(data.error || 'Session expirée');
  }
  if (!res.ok) throw new Error(data.error || ('Erreur ' + res.status));
  return data;
}

function fmt(n) { return Math.floor(n).toLocaleString('fr-FR'); }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function toast(t, ms = 2800, type = 'success') {
  const el = $('toast'); if (!el) { console.log(t); return; }
  el.dataset.type = type;
  el.innerHTML = '<span class="toast-ic"></span><span class="toast-msg"></span>';
  el.querySelector('.toast-msg').textContent = t;
  el.classList.add('show');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), ms);
}

function togglePw(id, btn) {
  const inp = $(id); if (!inp) return;
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  btn.innerHTML = '<i data-lucide="' + (show ? 'eye-off' : 'eye') + '"></i>';
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

let _modalCb = null;
function openModal(title, bodyHtml, onConfirm) {
  $('modalTitle').textContent = title; $('modalBody').innerHTML = bodyHtml;
  _modalCb = onConfirm; $('modalOverlay').classList.remove('hidden');
}
function closeModal() { const o = $('modalOverlay'); if (o) o.classList.add('hidden'); _modalCb = null; }
function confirmModal() { const cb = _modalCb; closeModal(); if (cb) cb(); }

async function getMe() {
  if (!TOKEN) { USER = null; return null; }
  try { const d = await api('/me'); USER = d.user; return USER; }
  catch (e) { USER = null; return null; }
}
async function doLogin(user, pass, code) {
  const d = await api('/login', 'POST', code ? { user, pass, code } : { user, pass });
  if (d.totp && !d.token) return { need2fa: true };   // mot de passe OK → code 2FA requis
  TOKEN = d.token; localStorage.setItem('ns_token', TOKEN); USER = d.user;
  return USER;
}
async function logout() {
  try { await api('/logout', 'POST'); } catch (e) {}
  TOKEN = null; USER = null; localStorage.removeItem('ns_token');
  location.href = '/';
}
async function requireAuth() {
  const u = await getMe();
  if (!u) { location.href = '/'; return null; }
  return u;
}
async function requireAdmin() {
  const u = await getMe();
  if (!u || !u.admin) { location.href = '/'; return null; }
  return u;
}
