/* BlackState — Admin page JS
   Depends on: auth.js ($ api fmt esc toast openModal closeModal confirmModal getMe logout requireAdmin)
               shell.js (renderShell)
*/

/* ── constantes admin ─────────────────────────────────────── */
const GAME_ICON = { slots:'🎰', blackjack:'🃏', mines:'💣', plinko:'🪙', wheel:'🎡', dice:'🎲' };
const MODAL_INPUT_STYLE = 'width:100%;padding:10px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:rgba(0,0,0,.4);color:#e2e8f0;font-size:16px;font-weight:600;outline:none';

/* ── helpers ──────────────────────────────────────────────── */
function _copyText(text) {
  navigator.clipboard.writeText(text)
    .then(() => toast('Lien copié !'))
    .catch(() => {
      const el = document.createElement('textarea');
      el.value = text; document.body.appendChild(el); el.select();
      document.execCommand('copy'); document.body.removeChild(el);
      toast('Lien copié !');
    });
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
async function renderAdminUsers() {
  try {
    const users = (await api('/admin/users')).users;
    const totalCredits = users.reduce((s, u) => s + u.credit, 0);
    const totalWagered = users.reduce((s, u) => s + u.wagered, 0);
    const nbPlayers    = users.filter(u => !u.admin).length;
    $('playerStats').innerHTML =
      '<div class="adm-stat-chip"><span class="val">' + nbPlayers + '</span><span class="lbl">Joueurs</span></div>'
    + '<div class="adm-stat-chip"><span class="val">' + fmt(totalCredits) + '</span><span class="lbl">Crédits Club en circulation</span></div>'
    + '<div class="adm-stat-chip"><span class="val">' + fmt(totalWagered) + '</span><span class="lbl">Total misé</span></div>';
    let rows = '<tr><th>Pseudo</th><th>Joueur RP</th><th>Discord</th><th>Crédits Club</th><th>Misé</th><th>Nv.</th><th>Rôle</th><th>Actions</th></tr>';
    users.forEach(u => {
      const n   = esc(u.name || u.username);
      const rpName = (u.rp_nom || u.rp_prenom)
        ? esc((u.rp_nom || '').toUpperCase()) + ' ' + esc(u.rp_prenom || '')
        : '<span style="color:var(--a-tx-dim)">—</span>';
      const discord = u.discord ? esc(u.discord) : '<span style="color:var(--a-tx-dim)">—</span>';
      rows += '<tr>'
        + '<td><b>' + n + '</b></td>'
        + '<td style="color:var(--a-tx-muted);font-size:.8rem">' + rpName + '</td>'
        + '<td style="color:var(--a-tx-muted);font-size:.8rem">' + discord + '</td>'
        + '<td>' + fmt(u.credit) + '</td>'
        + '<td style="color:var(--a-tx-muted)">' + fmt(u.wagered) + '</td>'
        + '<td class="adm-lvl">' + (u.level || 1) + '</td>'
        + '<td>' + (u.admin ? '<span class="adminbadge">Admin</span>' : '<span style="color:var(--a-tx-dim)">Joueur</span>') + '</td>'
        + '<td style="display:flex;gap:6px;flex-wrap:wrap">'
        + '<button class="btn sm" onclick="adminCredit(\'' + esc(u.name || u.username) + '\')">+ Crédits</button>'
        + '<button class="btn sm adm-debit-btn" onclick="adminDebit(\'' + esc(u.name || u.username) + '\')">Retirer</button>'
        + ((u.name || u.username) !== (USER && USER.username) ? '<button class="btn sm ghost" onclick="adminDelete(\'' + esc(u.name || u.username) + '\')">Supprimer</button>' : '')
        + '</td></tr>';
    });
    $('userTable').innerHTML = rows;
  } catch (e) {}
}

function adminCredit(u) {
  openModal(
    '+ Crédits — ' + esc(u),
    '<div class="field"><label>Montant à ajouter</label><input id="modalInput" type="number" min="1" value="1000" style="' + MODAL_INPUT_STYLE + '"></div>',
    async () => {
      const n = Math.floor(+$('modalInput').value);
      if (!n || n <= 0) return toast('Montant invalide', 3500);
      try {
        await api('/admin/credit', 'POST', { user: u, amount: n });
        toast('+ ' + fmt(n) + ' crédits ajoutés'); renderAdminUsers();
      } catch (e) { toast(e.message, 4000); }
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
      if (!n || n <= 0) return toast('Montant invalide', 3500);
      try {
        await api('/admin/credit', 'POST', { user: u, amount: -n });
        toast('− ' + fmt(n) + ' crédits retirés'); renderAdminUsers();
      } catch (e) { toast(e.message, 4000); }
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
      catch (e) { toast(e.message); }
    }
  );
}

/* ── machines / RTP ───────────────────────────────────────── */
async function renderGameInfo() {
  const box = $('settingsBox'); if (!box) return;
  box.innerHTML = '<div class="loading-row"><span class="spinner"></span></div>';
  let d; try { d = await api('/admin/gameinfo'); } catch (e) { box.innerHTML = '<p class="hint">Erreur de chargement.</p>'; return; }
  const houseEdge = Math.round((1 - d.rtp) * 100);
  let h = '<div class="rtp-banner">'
    + '<div><div class="rtp-banner-lbl">RTP global (reversé aux joueurs)</div><div class="rtp-banner-val">' + Math.round(d.rtp*100) + '%</div></div>'
    + '<div><div class="rtp-banner-lbl">Marge maison</div><div class="rtp-banner-val gold">' + houseEdge + '%</div></div>'
    + '</div>';
  h += '<table class="rtp-table"><thead><tr><th>Machine</th><th>RTP</th><th>Marge</th><th>Détail</th></tr></thead><tbody>';
  d.games.forEach(g => {
    const icon = GAME_ICON[g.key] || '🎮';
    h += '<tr><td><b>' + icon + ' ' + esc(g.label) + '</b></td>'
      + '<td>' + Math.round(g.rtp*100) + '%</td>'
      + '<td style="color:var(--gold);font-weight:700">' + Math.round((1-g.rtp)*100) + '%</td>'
      + '<td style="color:var(--tx-3)">' + esc(g.note) + '</td></tr>';
  });
  h += '</tbody></table>';
  box.innerHTML = h;
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
    async () => { try { await api('/admin/logs','DELETE'); renderLogs(); toast('Journal vidé'); } catch(e){ toast(e.message); } }
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
  } catch (e) { toast(e.message); }
}

function copyInviteLink() {
  _copyText(_lastInviteLink);
}

function copyInviteByToken(token) {
  _copyText(location.origin + '/?invite=' + token);
}

async function revokeInvite(token) {
  openModal(
    'Révoquer ce lien ?',
    '<p style="color:var(--dim);margin-top:6px">Le joueur ne pourra plus l\'utiliser pour créer un compte.</p>',
    async () => {
      try { await api('/admin/invite/' + token, 'DELETE'); toast('Invitation révoquée'); renderInvites(); }
      catch (e) { toast(e.message); }
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
        + '<td style="color:var(--gold);font-family:var(--num);font-variant-numeric:tabular-nums;font-size:18px">' + fmt(inv.credits) + '</td>'
        + '<td><span class="invite-tag ' + (used ? 'inv-used' : 'inv-ok') + '">' + (used ? 'Utilisé' : 'Disponible') + '</span></td>'
        + '<td>' + (inv.used_by ? esc(inv.used_by) : '—') + '</td>'
        + '<td class="log-time">' + dt + '</td>'
        + '<td style="color:var(--dim);font-size:13px">' + esc(inv.created_by) + '</td>'
        + '<td>' + (!used
          ? '<button class="btn sm ghost" onclick="copyInviteByToken(\'' + inv.token + '\')" title="Copier le lien">📋</button>'
          + '<button class="btn sm ghost" onclick="revokeInvite(\'' + inv.token + '\')" title="Révoquer">✕</button>'
          : '') + '</td>'
        + '</tr>';
    });
    $('inviteTable').innerHTML = rows;
  } catch (e) {}
}

/* ── bootstrap ────────────────────────────────────────────── */
(async () => {
  const u = await requireAdmin(); if (!u) return;
  const w = $('admWhoName'); if (w) w.textContent = u.username;
  switchAdminTab('players'); renderInvites(); renderLogs();
  if (typeof lucide !== 'undefined') lucide.createIcons();
})();
