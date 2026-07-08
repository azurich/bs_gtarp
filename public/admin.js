/* BlackState — Admin page JS
   Depends on: auth.js ($ api fmt esc toast openModal closeModal confirmModal getMe logout requireAdmin)
               shell.js (renderShell)
*/

/* ── constantes admin ─────────────────────────────────────── */
const GAME_ICON = { slots:'🎰', blackjack:'🃏', mines:'💣', plinko:'🪙', wheel:'🎡', dice:'🎲' };
const MODAL_INPUT_STYLE = 'width:100%;padding:10px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:rgba(0,0,0,.4);color:#e2e8f0;font-size:16px;font-weight:600;outline:none';

/* ── helpers ──────────────────────────────────────────────── */
function _copyText(text) {
  // Fallback execCommand : marche aussi en HTTP/IP (où navigator.clipboard est absent)
  const fallback = () => {
    const el = document.createElement('textarea');
    el.value = text; el.style.position = 'fixed'; el.style.opacity = '0';
    document.body.appendChild(el); el.focus(); el.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(el);
    ok ? toast('Lien copié !') : toast('Copie impossible — sélectionne le lien manuellement', 4000, 'error');
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => toast('Lien copié !')).catch(fallback);
  } else {
    fallback();
  }
}

/* ── navigation onglets ───────────────────────────────────── */
function switchAdminTab(v) {
  document.querySelectorAll('.sidebar .nav-item').forEach(t => t.classList.toggle('active', t.dataset.v === v));
  document.querySelectorAll('.adm-view').forEach(x => x.classList.add('hidden'));
  $('at-' + v).classList.remove('hidden');
  if (v === 'players') renderAdminUsers();
  if (v === 'logs')    renderLogs();
  if (v === 'invites') renderInvites();
  if (v === 'games')   renderGameInfo();
}

/* ── joueurs ──────────────────────────────────────────────── */
let ADMIN_USERS = [];
let _userQuery = '';
let _userSort = { key: 'credit', dir: -1 };   // -1 = décroissant, 1 = croissant

async function renderAdminUsers() {
  try {
    const users = (await api('/admin/users')).users;
    ADMIN_USERS = users;
    const totalCredits = users.reduce((s, u) => s + u.credit, 0);
    const totalWagered = users.reduce((s, u) => s + u.wagered, 0);
    const nbPlayers    = users.filter(u => !u.admin).length;
    $('playerStats').innerHTML =
      '<div class="adm-stat-chip"><span class="val">' + nbPlayers + '</span><span class="lbl">Joueurs</span></div>'
    + '<div class="adm-stat-chip"><span class="val">' + fmt(totalCredits) + '</span><span class="lbl">Crédits Club en circulation</span></div>'
    + '<div class="adm-stat-chip"><span class="val">' + fmt(totalWagered) + '</span><span class="lbl">Total misé</span></div>';
    paintUsers();
  } catch (e) {}
}

function filterUsers(q) { _userQuery = (q || '').toLowerCase().trim(); paintUsers(); }

function sortUsers(key) {
  if (_userSort.key === key) _userSort.dir *= -1;
  else _userSort = { key: key, dir: key === 'name' ? 1 : -1 };   // texte ↑, nombres ↓ par défaut
  paintUsers();
}

function paintUsers() {
  const q = _userQuery;
  let list = ADMIN_USERS.filter(u => {
    if (!q) return true;
    return [(u.name || u.username), u.rp_nom, u.rp_prenom, u.discord].join(' ').toLowerCase().indexOf(q) !== -1;
  });
  const key = _userSort.key, dir = _userSort.dir;
  list = list.slice().sort((a, b) => {
    if (key === 'name') {
      const av = (a.name || a.username || '').toLowerCase(), bv = (b.name || b.username || '').toLowerCase();
      return av < bv ? -dir : av > bv ? dir : 0;
    }
    return ((a[key] || 0) - (b[key] || 0)) * dir;
  });

  const arrow = k => _userSort.key === k ? (_userSort.dir < 0 ? ' ▾' : ' ▴') : '';
  const th = (k, label) => '<th class="adm-sort' + (_userSort.key === k ? ' active' : '') + '" onclick="sortUsers(\'' + k + '\')">' + label + arrow(k) + '</th>';
  let rows = '<tr>'
    + th('name', 'Pseudo') + '<th>Joueur RP</th><th>Discord</th>'
    + th('credit', 'Crédits Club') + th('wagered', 'Misé') + th('level', 'Nv.')
    + '<th>Rôle</th><th>2FA</th><th>Actions</th></tr>';
  if (!list.length) rows += '<tr><td colspan="9" style="color:var(--dim);padding:18px">Aucun joueur trouvé.</td></tr>';
  list.forEach(u => {
    const n   = esc(u.name || u.username);
    const rpName = (u.rp_nom || u.rp_prenom)
      ? esc((u.rp_nom || '').toUpperCase()) + ' ' + esc(u.rp_prenom || '')
      : '<span style="color:var(--a-tx-dim)">—</span>';
    const discord = u.discord ? esc(u.discord) : '<span style="color:var(--a-tx-dim)">—</span>';
    const self = (u.name || u.username) === (USER && USER.username);
    rows += '<tr' + (u.blocked ? ' class="row-blocked"' : '') + '>'
      + '<td><b>' + n + '</b>' + (u.blocked ? ' <span class="up-status blocked">Bloqué</span>' : '') + '</td>'
      + '<td style="color:var(--a-tx-muted);font-size:.8rem">' + rpName + '</td>'
      + '<td style="color:var(--a-tx-muted);font-size:.8rem">' + discord + '</td>'
      + '<td style="color:var(--gold);font-family:var(--num);font-variant-numeric:tabular-nums;font-weight:700">' + fmt(u.credit) + '</td>'
      + '<td style="color:var(--a-tx-muted);font-family:var(--num);font-variant-numeric:tabular-nums">' + fmt(u.wagered) + '</td>'
      + '<td class="adm-lvl">' + (u.level || 1) + '</td>'
      + '<td>' + (u.admin ? '<span class="adminbadge">Admin</span>' : '<span style="color:var(--a-tx-dim)">Joueur</span>') + '</td>'
      + '<td>' + (u.totp ? '<span class="twofa-badge on">ON</span>' : '<span class="twofa-badge off">—</span>') + '</td>'
      + '<td><div class="adm-actions">'
      +   '<button class="btn sm" onclick="adminCredit(\'' + n + '\')">+ Crédits</button>'
      +   '<button class="btn sm adm-debit-btn" onclick="adminDebit(\'' + n + '\')">Retirer</button>'
      +   '<button class="btn-ic" onclick="adminResetPw(\'' + n + '\')" title="Réinitialiser le mot de passe"><i data-lucide="key-round"></i></button>'
      +   (u.totp
            ? '<button class="btn-ic" onclick="adminDisable2FA(\'' + n + '\')" title="Désactiver la 2FA"><i data-lucide="shield-off"></i></button>'
            : '<button class="btn-ic" disabled title="Aucune 2FA active"><i data-lucide="shield"></i></button>')
      +   (u.admin ? ''
            : (u.blocked
                ? '<button class="btn-ic ic-ok" onclick="adminBlock(\'' + n + '\',false)" title="Débloquer le compte"><i data-lucide="lock-open"></i></button>'
                : '<button class="btn-ic ic-warn" onclick="adminBlock(\'' + n + '\',true)" title="Bloquer le compte"><i data-lucide="ban"></i></button>'))
      +   (self ? '' : '<button class="btn-ic ic-danger" onclick="adminDelete(\'' + n + '\')" title="Supprimer le compte"><i data-lucide="trash-2"></i></button>')
      + '</div></td></tr>';
  });
  $('userTable').innerHTML = rows;
  if (typeof lucide !== 'undefined') lucide.createIcons();
  const c = $('userCount');
  if (c) c.textContent = list.length + (list.length !== ADMIN_USERS.length ? ' / ' + ADMIN_USERS.length : '') + (list.length > 1 ? ' joueurs' : ' joueur');
}

function adminCredit(u) {
  openModal(
    '+ Crédits — ' + esc(u),
    '<div class="field"><label>Montant à ajouter</label><input id="modalInput" type="number" min="1" value="1000" style="' + MODAL_INPUT_STYLE + '"></div>',
    async () => {
      const n = Math.floor(+$('modalInput').value);
      if (!n || n <= 0) return toast('Montant invalide', 3500, 'error');
      try {
        await api('/admin/credit', 'POST', { user: u, amount: n });
        toast('+ ' + fmt(n) + ' crédits ajoutés'); renderAdminUsers();
      } catch (e) { toast(e.message, 4000, 'error'); }
    }
  );
  setTimeout(() => { const i = $('modalInput'); if (i) i.focus(); }, 60);
}

function adminDebit(u) {
  openModal(
    'Retrait — ' + esc(u),
    '<div class="field"><label>Montant à retirer</label><input id="modalInput" type="number" min="1" value="500" style="' + MODAL_INPUT_STYLE + '"></div>'
    + '<p style="margin-top:8px;font-size:12px;color:var(--a-tx-muted)">Le solde ne descend pas en dessous de 0.</p>',
    async () => {
      const n = Math.floor(+$('modalInput').value);
      if (!n || n <= 0) return toast('Montant invalide', 3500, 'error');
      try {
        await api('/admin/credit', 'POST', { user: u, amount: -n });
        toast('− ' + fmt(n) + ' crédits retirés'); renderAdminUsers();
      } catch (e) { toast(e.message, 4000, 'error'); }
    }
  );
  setTimeout(() => { const i = $('modalInput'); if (i) i.focus(); }, 60);
}

function adminDelete(u) {
  openModal(
    'Supprimer « ' + esc(u) + ' » ?',
    '<p style="color:var(--dim);margin-top:6px;line-height:1.5">Cette action est irréversible. Le compte et toutes ses données seront supprimés.</p>',
    async () => {
      try { await api('/admin/delete', 'POST', { user: u }); toast('Compte supprimé'); renderAdminUsers(); }
      catch (e) { toast(e.message, 4000, 'error'); }
    }
  );
}

function genPw() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let s = ''; for (let i = 0; i < 10; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}

function adminResetPw(u) {
  openModal(
    'Réinitialiser le mot de passe — ' + esc(u),
    '<div class="field"><label>Nouveau mot de passe</label>'
    + '<input id="rpwInput" type="text" value="' + genPw() + '" style="' + MODAL_INPUT_STYLE + '"></div>'
    + '<p style="margin-top:8px;font-size:12px;color:var(--a-tx-muted);line-height:1.5">8 caractères minimum. Communique-le au joueur — ses sessions actives seront déconnectées.</p>',
    async () => {
      const pw = $('rpwInput').value;
      if (!pw || pw.length < 8) return toast('Mot de passe trop court (8 min)', 3500, 'error');
      try {
        await api('/admin/reset-password', 'POST', { user: u, password: pw });
        toast('Mot de passe réinitialisé pour ' + u);
      } catch (e) { toast(e.message, 4000, 'error'); }
    }
  );
  setTimeout(() => { const i = $('rpwInput'); if (i) i.select(); }, 60);
}

function adminBlock(u, blocked) {
  if (blocked) {
    openModal(
      'Bloquer « ' + esc(u) + ' » ?',
      '<p style="color:var(--dim);margin-top:6px;line-height:1.5">Le joueur sera <b>déconnecté immédiatement</b> et ne pourra plus se connecter jusqu\'au déblocage.</p>',
      async () => {
        try { await api('/admin/block', 'POST', { user: u, blocked: true }); toast('Compte bloqué'); renderAdminUsers(); }
        catch (e) { toast(e.message, 4000, 'error'); }
      }
    );
  } else {
    api('/admin/block', 'POST', { user: u, blocked: false })
      .then(() => { toast('Compte débloqué'); renderAdminUsers(); })
      .catch(e => toast(e.message, 4000, 'error'));
  }
}

function adminDisable2FA(u) {
  openModal(
    'Désactiver la 2FA de « ' + esc(u) + ' » ?',
    '<p style="color:var(--dim);margin-top:6px;line-height:1.5">À utiliser si le joueur a perdu l\'accès à son application d\'authentification. Il pourra se reconnecter sans code, puis réactiver la 2FA depuis son profil.</p>',
    async () => {
      try { await api('/admin/2fa-disable', 'POST', { user: u }); toast('2FA désactivée pour ' + u); renderAdminUsers(); }
      catch (e) { toast(e.message, 4000, 'error'); }
    }
  );
}

/* ── machines / RTP ───────────────────────────────────────── */
async function renderGameInfo() {
  const box = $('settingsBox'); if (!box) return;
  box.innerHTML = '<div class="loading-row"><span class="spinner"></span></div>';
  let d; try { d = await api('/admin/casino'); } catch (e) { box.innerHTML = '<p class="hint">Erreur de chargement.</p>'; return; }
  let jp; try { jp = await api('/admin/jackpot'); } catch (e) { jp = { armed: false, base: null }; }
  const f = n => fmt(Math.round(n));
  box.innerHTML =
      '<div class="rtp-banner">'
    +   '<div><div class="rtp-banner-lbl">Cagnotte actuelle</div><div class="rtp-banner-val gold">' + f(d.pool) + '</div></div>'
    +   '<div><div class="rtp-banner-lbl">Budget dispo (' + Math.round(d.reserve * 100) + '%)</div><div class="rtp-banner-val">' + f(d.budget) + '</div></div>'
    +   '<div><div class="rtp-banner-lbl">Marge maison réelle</div><div class="rtp-banner-val">' + Math.round(d.margin * 100) + '%</div></div>'
    + '</div>'
    + '<div class="cg-stats">'
    +   '<div class="cg-stat"><span class="cg-lbl">Total misé</span><span class="cg-val">' + f(d.wagered) + '</span></div>'
    +   '<div class="cg-stat"><span class="cg-lbl">Total payé aux joueurs</span><span class="cg-val">' + f(d.paid) + '</span></div>'
    +   '<div class="cg-stat"><span class="cg-lbl">RTP réel observé</span><span class="cg-val">' + Math.round(d.rtp * 100) + '%</span></div>'
    +   '<div class="cg-stat"><span class="cg-lbl">Réserve gardée</span><span class="cg-val">' + Math.round((1 - d.reserve) * 100) + '%</span></div>'
    + '</div>'
    + '<div class="cg-jackpot">'
    +   '<div class="cg-jp-head">Jackpot' + (jp.armed ? '<span class="cg-jp-armed">ARMÉ · ' + (jp.base === 'pool' ? 'GROS' : 'PETIT') + '</span>' : '') + '</div>'
    +   '<p class="hint">Force le prochain joueur (slots · roue · plinko · dé) à décrocher un gros gain « chanceux ».</p>'
    +   '<div class="cg-jp-cards">'
    +     '<div class="cg-jp-card' + (jp.armed && jp.base === 'pool' ? ' on' : '') + '">'
    +       '<div class="cg-jp-card-lbl">GROS</div>'
    +       '<div class="cg-jp-card-amt">' + f(0.30 * d.pool) + '–' + f(0.60 * d.pool) + '</div>'
    +       '<div class="cg-jp-card-sub">de la cagnotte</div>'
    +       '<button class="btn sm" onclick="armJackpot(\'pool\')">Armer GROS</button>'
    +     '</div>'
    +     '<div class="cg-jp-card' + (jp.armed && jp.base === 'budget' ? ' on' : '') + '">'
    +       '<div class="cg-jp-card-lbl">PETIT</div>'
    +       '<div class="cg-jp-card-amt">' + f(0.30 * d.budget) + '–' + f(0.60 * d.budget) + '</div>'
    +       '<div class="cg-jp-card-sub">du budget (part payable)</div>'
    +       '<button class="btn sm ghost" onclick="armJackpot(\'budget\')">Armer PETIT</button>'
    +     '</div>'
    +   '</div>'
    +   (jp.armed ? '<button class="btn ghost sm cg-jp-cancel" onclick="cancelJackpot()">Annuler le jackpot</button>' : '')
    + '</div>'
    + '<button class="btn ghost sm" onclick="resetCasino()" style="margin-top:18px">Réinitialiser la cagnotte</button>';
}

function resetCasino() {
  openModal(
    'Réinitialiser la cagnotte ?',
    '<p style="color:var(--dim);margin-top:6px;line-height:1.5">Remet le total misé, le total payé et la cagnotte à <b>0</b>. Les jeux repartent comme au premier jour : les gains seront impossibles le temps que la cagnotte se reconstitue.</p>',
    async () => {
      try { await api('/admin/casino/reset', 'POST'); toast('Cagnotte réinitialisée'); renderGameInfo(); }
      catch (e) { toast(e.message, 4000, 'error'); }
    }
  );
}

async function armJackpot(base) {
  try { await api('/admin/jackpot', 'POST', { base }); toast('Jackpot armé (' + (base === 'pool' ? 'GROS' : 'PETIT') + ')'); renderGameInfo(); }
  catch (e) { toast(e.message, 4000, 'error'); }
}
function cancelJackpot() {
  api('/admin/jackpot', 'DELETE').then(() => { toast('Jackpot annulé'); renderGameInfo(); }).catch(e => toast(e.message, 4000, 'error'));
}

/* ── logs ─────────────────────────────────────────────────── */
function logClass(t) { return {auth:'lt-auth',bet:'lt-bet',win:'lt-win',admin:'lt-admin'}[t]||'lt-sys'; }
function logLabel(t) { return {auth:'AUTH',bet:'MISE',win:'GAIN',admin:'ADMIN',bonus:'BONUS'}[t]||'SYS'; }
let LOGS_CACHE = [];

async function renderLogs() {
  const f = $('logFilter').value;
  try { LOGS_CACHE = (await api('/admin/logs?filter='+encodeURIComponent(f))).logs; } catch(e){ return; }
  let rows = '<tr><th>Heure</th><th>Type</th><th>Joueur</th><th>Détail</th><th>Montant</th></tr>';
  if (!LOGS_CACHE.length) rows += '<tr><td colspan="5" style="color:var(--dim)">Aucune entrée.</td></tr>';
  LOGS_CACHE.forEach(l => {
    const hh = new Date(l.ts).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});
    const amt = l.amount ? ((l.amount>0?'+':'')+fmt(l.amount)) : '';
    const col = l.amount>0?'var(--green)':l.amount<0?'var(--red)':'var(--dim)';
    rows += '<tr><td class="log-time">'+hh+'</td><td><span class="log-type '+logClass(l.type)+'">'+logLabel(l.type)+'</span></td><td>'+esc(l.username)+'</td><td>'+esc(l.msg)+'</td><td style="color:'+col+';font-weight:700">'+amt+'</td></tr>';
  });
  $('logTable').innerHTML = rows;
}

function clearLogs() {
  openModal(
    'Vider le journal ?',
    '<p style="color:var(--dim);margin-top:6px">Toutes les entrées seront supprimées définitivement.</p>',
    async () => { try { await api('/admin/logs','DELETE'); renderLogs(); toast('Journal vidé'); } catch(e){ toast(e.message, 4000, 'error'); } }
  );
}

function exportLogs() {
  let csv = 'date;type;joueur;detail;montant\n';
  LOGS_CACHE.forEach(l => { csv += new Date(l.ts).toISOString()+';'+l.type+';'+l.username+';"'+String(l.msg).replace(/"/g,'""')+'";'+l.amount+'\n'; });
  const blob = new Blob([csv],{type:'text/csv'}), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'blackstate_logs.csv'; a.click(); toast('Logs exportés');
}

/* ── invitations ──────────────────────────────────────────── */
let _lastInviteLink = '';

async function adminGenInvite() {
  const raw = $('inviteAmt').value.trim();
  const credits = Math.max(0, Math.floor(raw === '' ? 1000 : +raw));
  try {
    const d = await api('/admin/invite', 'POST', { credits });
    _lastInviteLink = location.origin + '/?invite=' + d.token;
    $('inviteLinkText').textContent = _lastInviteLink;
    $('inviteResult').classList.remove('hidden');
    renderInvites();
    toast('Lien généré !');
  } catch (e) { toast(e.message, 4000, 'error'); }
}

function copyInviteLink() {
  _copyText(_lastInviteLink);
}

function copyInviteByToken(token) {
  _copyText(location.origin + '/?invite=' + token);
}

async function deleteInvite(token) {
  openModal(
    'Supprimer ce lien ?',
    '<p style="color:var(--dim);margin-top:6px">Le lien sera retiré de la liste. S\'il n\'a pas été utilisé, il ne pourra plus servir à créer un compte.</p>',
    async () => {
      try { await api('/admin/invite/' + token, 'DELETE'); toast('Invitation supprimée'); renderInvites(); }
      catch (e) { toast(e.message, 4000, 'error'); }
    }
  );
}

async function renderInvites() {
  try {
    const { invites } = await api('/admin/invites');
    let rows = '<tr><th>Crédits</th><th>Statut</th><th>Joueur</th><th>Créé le</th><th>Par</th><th>Actions</th></tr>';
    if (!invites.length) rows += '<tr><td colspan="6" style="color:var(--dim)">Aucun lien généré.</td></tr>';
    invites.forEach(inv => {
      const dt  = new Date(inv.created).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
      const used = !!inv.used;
      rows += '<tr>'
        + '<td style="color:var(--gold);font-family:var(--num);font-variant-numeric:tabular-nums;font-weight:700">' + fmt(inv.credits) + '</td>'
        + '<td><span class="invite-tag ' + (used ? 'inv-used' : 'inv-ok') + '">' + (used ? 'Utilisé' : 'Disponible') + '</span></td>'
        + '<td>' + (inv.used_by ? esc(inv.used_by) : '—') + '</td>'
        + '<td class="log-time">' + dt + '</td>'
        + '<td style="color:var(--dim);font-size:13px">' + esc(inv.created_by) + '</td>'
        + '<td style="display:flex;gap:6px">'
        + (!used ? '<button class="btn sm ghost" onclick="copyInviteByToken(\'' + inv.token + '\')" title="Copier le lien"><i data-lucide="copy"></i></button>' : '')
        + '<button class="btn sm ghost adm-del-btn" onclick="deleteInvite(\'' + inv.token + '\')" title="Supprimer"><i data-lucide="trash-2"></i></button>'
        + '</td>'
        + '</tr>';
    });
    $('inviteTable').innerHTML = rows;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch (e) {}
}

/* ── système : export / import base ───────────────────────── */
async function exportDb() {
  try {
    const res = await fetch('/api/admin/export-db', { headers: { Authorization: 'Bearer ' + TOKEN } });
    if (!res.ok) throw new Error('refus');
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'blackstate-backup-' + new Date().toISOString().slice(0, 10) + '.db';
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Base exportée');
  } catch (e) { toast('Export impossible', 4000, 'error'); }
}

function importDb(input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  openModal('Importer cette base ?',
    '<p style="color:var(--red);font-weight:700">⚠ Action risquée</p>'
    + '<p style="color:var(--a-tx-muted);margin-top:8px;line-height:1.55">La base actuelle sera <b>remplacée</b> par « ' + esc(file.name) + ' » '
    + '(une sauvegarde <code>.bak</code> est créée automatiquement). Le serveur va <b>redémarrer</b> — patiente quelques secondes puis reconnecte-toi.</p>',
    async () => {
      try {
        const buf = await file.arrayBuffer();
        const res = await fetch('/api/admin/import-db', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/octet-stream' },
          body: buf,
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || 'Import refusé');
        toast('Base importée — redémarrage en cours…', 6000);
        setTimeout(() => location.reload(), 4500);
      } catch (e) { toast(e.message || 'Import impossible', 5000, 'error'); }
    });
}

/* ── bootstrap ────────────────────────────────────────────── */
(async () => {
  const u = await requireAdmin(); if (!u) return;
  const w = $('admWhoName'); if (w) w.textContent = u.username;
  switchAdminTab('players'); renderInvites(); renderLogs();
  if (typeof lucide !== 'undefined') lucide.createIcons();
})();
