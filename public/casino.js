/* ============================================================
   BlackState Casino — logique jeux uniquement.
   Auth/API partagés : core/auth.js (TOKEN, USER, $, api, fmt, esc, toast, openModal, closeModal, confirmModal, logout)
   Shell partagé    : core/shell.js (renderShell)
============================================================ */
let GAME_RTP = 0.70;   // reçu du serveur via /api/config

/* ── Animations ───────────────────────────────────────────── */
function initAnimations(root) {
  const target = root || document;
  target.querySelectorAll('[data-delay]').forEach(el => {
    el.style.animationDelay = (parseInt(el.dataset.delay || 0) * 80) + 'ms';
  });
}

function countUp(el, target, duration = 600) {
  if (!el) return;
  const start = parseInt(el.textContent.replace(/[\s,]/g, '')) || 0;
  const diff = target - start;
  if (diff === 0) return;
  const startTime = performance.now();
  function step(now) {
    const p = Math.min(1, (now - startTime) / duration);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(start + diff * ease).toLocaleString('fr-FR');
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function shakeEl(el) {
  if (!el) return;
  el.classList.remove('shake-x');
  void el.offsetWidth;
  el.classList.add('shake-x');
  setTimeout(() => el.classList.remove('shake-x'), 500);
}

/* ── XP / Niveaux ─────────────────────────────────────────── */
const MAX_LEVEL = 100, XP_K = 100;
const levelThreshold = n => XP_K * (n - 1) * (n - 1);   // doit matcher le serveur
const LEVEL_TITLES = ['Débutant', 'Novice', 'Joueur', 'Habitué', 'Vétéran', 'Expert', 'Pro', 'Shark', 'Légende', 'VIP'];
const levelTitle = lvl => LEVEL_TITLES[Math.min(LEVEL_TITLES.length - 1, Math.floor((lvl - 1) / 10))] || '';

/* ── helpers UI ───────────────────────────────────────────── */
function refreshBal() { if (USER) { const el = $('balVal'); if (el) el.textContent = fmt(USER.credit); } if (typeof refreshNavBal === 'function') refreshNavBal(); }
function flashBal(win) {
  const b = $('balBox');
  if (!b) return;
  b.classList.remove('flash-win','flash-lose');
  void b.offsetWidth;
  b.classList.add(win ? 'flash-win' : 'flash-lose');
  if (!win) shakeEl(b);
  setTimeout(() => b.classList.remove('flash-win','flash-lose'), 600);
}
function setBalance(b, win, xp, level) {
  const prevLevel = (USER && USER.level) || 1;
  if (USER) USER.credit = b;
  const el = $('balVal');
  if (el) countUp(el, Math.floor(b), 500);
  if (win !== undefined) flashBal(win);
  if (xp != null) updateXP(xp, level || 1);
  if (typeof refreshNavBal === 'function') refreshNavBal();
  // Bonus de palier (récompense tous les 10 niveaux)
  if (level && level > prevLevel) {
    for (let l = prevLevel + 1; l <= level; l++) {
      if (l % 10 === 0) toast('Niveau ' + l + ' atteint — bonus +' + fmt((l / 10) * 1000) + ' Crédits Club !', 4500);
    }
  }
}
function int(id) { const n = Math.floor(+$(id).value); return Number.isFinite(n) && n > 0 ? n : 0; }
function qbet(id, op) { const el = $(id); let v = Math.floor(+el.value) || 0; if (op === 'half') v = Math.max(1, Math.floor(v/2)); else if (op === 'double') v *= 2; else if (op === 'max') v = Math.floor(USER ? USER.credit : 0); el.value = Math.max(1, v); }

/* ── XP sidebar ───────────────────────────────────────────── */
function updateXP(xp, level) {
  if (USER) { USER.xp = xp; USER.level = level; }
  const lvlEl = $('xpLevel');
  if (lvlEl) lvlEl.textContent = level;
  const cur  = levelThreshold(level);
  const next = level >= MAX_LEVEL ? cur : levelThreshold(level + 1);
  const pct  = level >= MAX_LEVEL ? 100 : Math.min(100, Math.max(0, ((xp - cur) / (next - cur)) * 100));
  const fillEl = $('xpFill');
  if (fillEl) fillEl.style.width = pct + '%';
}

/* ── Confettis ────────────────────────────────────────────── */
let _confAF = null;
function launchConfetti(label) {
  const ov  = $('winOverlay'), cvs = $('confettiCanvas'), ctx = cvs.getContext('2d');
  $('winLabel').textContent = label;
  ov.classList.remove('hidden');
  cvs.width = innerWidth; cvs.height = innerHeight;
  const COLORS = ['#7c3aed','#a855f7','#c9a3ff','#e9d5ff','#c4b5fd','#ffffff'];
  const pts = Array.from({length: 160}, () => ({
    x: Math.random() * cvs.width, y: -20 - Math.random() * cvs.height * 0.6,
    w: 6 + Math.random() * 10, h: 3 + Math.random() * 5,
    vx: (Math.random() - 0.5) * 5, vy: 2 + Math.random() * 5,
    rot: Math.random() * 360, rv: (Math.random() - 0.5) * 8,
    color: COLORS[Math.random() * COLORS.length | 0], alpha: 1,
  }));
  let frames = 0;
  function frame() {
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    let alive = false;
    pts.forEach(p => {
      p.x += p.vx; p.y += p.vy + frames * 0.02; p.rot += p.rv; p.vy += 0.04;
      p.alpha = Math.max(0, 1 - (p.y / (cvs.height * 1.1)));
      if (p.y < cvs.height + 20) alive = true;
      ctx.save(); ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y); ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    frames++;
    if (alive && frames < 240) _confAF = requestAnimationFrame(frame);
    else { ov.classList.add('hidden'); ov.classList.remove('mega'); }
  }
  if (_confAF) cancelAnimationFrame(_confAF);
  _confAF = requestAnimationFrame(frame);
  setTimeout(() => { if (_confAF) cancelAnimationFrame(_confAF); ov.classList.add('hidden'); ov.classList.remove('mega'); }, 5000);
}

function checkBigWin(bet, gain) {
  if (!gain || gain <= 0 || !bet) return;
  if (gain >= bet * 20) launchConfetti('MEGA WIN\n+' + fmt(gain) + ' 🪙');
  else if (gain >= bet * 5) launchConfetti('BIG WIN\n+' + fmt(gain) + ' 🪙');
}

/* ── Moteur d'effets gradués (point d'entrée unique) ───────── */
const FX = ['fx-lose','fx-partial','fx-win-s','fx-win-m','fx-win-big','fx-win-mega'];
function gameResult({ machine, bet, gain, balance, xp, level, push }) {
  const key = push ? 'push' : (window.Tiers ? Tiers.pickTier(gain, bet) : 'lose');
  const isWin = key.indexOf('win') === 0;
  setBalance(balance, key === 'push' ? undefined : isWin, xp, level);
  if (machine) {
    const res = machine.querySelector('.machine-result');
    if (res) {
      if (isWin)            { res.dataset.state = 'win';     res.textContent = '+' + fmt(gain) + ' · ×' + (gain / bet).toFixed(2); }
      else if (key === 'partial') { res.dataset.state = 'lose'; res.textContent = '−' + fmt(bet - gain); }
      else if (key === 'push')    { res.dataset.state = 'neutral'; res.textContent = 'Mise rendue'; }
      else                  { res.dataset.state = 'lose';    res.textContent = 'Perdu'; }
    }
    machine.classList.remove(...FX);
    void machine.offsetWidth;
    if (key !== 'push') machine.classList.add('fx-' + key);
  }
  if (key === 'win-big')  launchConfetti('BIG WIN\n+' + fmt(gain));
  if (key === 'win-mega') { const ov = $('winOverlay'); if (ov) ov.classList.add('mega'); launchConfetti('MEGA WIN\n+' + fmt(gain)); }
  if (isWin) toast('+' + fmt(gain), 1800, 'success');
}

/* ── Navigation ──────────────────────────────────────────── */
function switchTab(v) {
  if (v === 'blackjack' || v === 'mines') { toast('Bientôt disponible', 2600, 'info'); return; }
  if (v !== 'mines' && minesActive) {
    openModal(
      'Partie en cours',
      '<p>Vous avez une partie de Mines active. Quitter abandonnera votre mise.</p>',
      () => { minesActive = false; $('minesCash').classList.add('hidden'); $('minesStart').classList.remove('hidden'); buildMinesGrid(); _doTab(v); }
    );
    return;
  }
  if (v !== 'plinko' && pkAnim) { cancelAnimationFrame(pkAnim); pkAnim = null; pkBall = null; pkTrail = []; $('plinkoBtn').disabled = false; }
  _doTab(v);
}
function _doTab(v) {
  document.querySelectorAll('.nav-item[data-v]').forEach(t => t.classList.toggle('active', t.dataset.v === v));
  document.querySelectorAll('.view').forEach(x => x.classList.remove('active'));
  const activeView = $('view-' + v);
  if (activeView) activeView.classList.add('active');
  initAnimations(activeView);
  if (v === 'home')    renderHome();
  if (v === 'plinko')  { initPlinkoCanvas(); drawPlinko(); }
  if (v === 'wheel')   renderWheel();
  if (v === 'dice')    diceUpdate();
  if (v === 'levels')  renderLevels();
  if (v === 'history') loadHistory();
}

const GAME_LABEL = { slots:'Slots', blackjack:'Blackjack', mines:'Démineur', plinko:'Plinko', wheel:'Roue', dice:'Dice' };

async function renderHome() {
  if (!USER) return;
  $('homeUser').textContent = (USER.rp && USER.rp.prenom) ? USER.rp.prenom : USER.username;
  // Niveau / XP
  const lvl = USER.level || 1, xp = USER.xp || 0;
  updateXP(xp, lvl);                                   // remplit #xpLevel + #xpFill
  const titleEl = $('homeTitle'); if (titleEl) titleEl.textContent = levelTitle(lvl);
  const metaEl = $('homeXpMeta');
  if (metaEl) {
    metaEl.textContent = (lvl >= MAX_LEVEL)
      ? 'Niveau maximum atteint'
      : (fmt(Math.max(0, levelThreshold(lvl + 1) - xp)) + ' XP avant Niveau ' + (lvl + 1));
  }
  countUp($('homeBal'), Math.floor(USER.credit));
  // Bandeau stats
  const st = USER.stats || {};
  countUp($('homePlayed'), st.played || 0, 400);
  countUp($('homeWagered'), Math.floor(st.wagered || 0));
  countUp($('homeBest'), Math.floor(st.biggest || 0));
  const net = (st.won || 0) - (st.wagered || 0);
  const netEl = $('homeNet');
  if (netEl) {
    netEl.style.color = net >= 0 ? 'var(--green)' : 'var(--red)';
    netEl.textContent = (net >= 0 ? '+' : '-') + Math.abs(Math.floor(net)).toLocaleString('fr-FR');
  }
  renderWinsFeed();
  leaderType = null;          // tirage aléatoire du classement à chaque venue
  renderLeaderboard();
}

async function renderWinsFeed() {
  const wrap = $('homeWinsFeed'); if (!wrap) return;
  try {
    const wins = (await api('/biggest-wins')).wins || [];
    if (!wins.length) { wrap.innerHTML = '<p class="home-empty">Aucun gros gain récent — soyez le premier&nbsp;!</p>'; return; }
    wrap.innerHTML = wins.map(w =>
      '<div class="win-row">'
      + '<span class="win-game">' + esc(GAME_LABEL[w.game] || w.game) + '</span>'
      + '<span class="win-name">' + esc(w.name) + '</span>'
      + '<span class="win-amt">+' + fmt(w.gain) + '<span class="bs-coin"></span></span>'
      + '</div>'
    ).join('');
  } catch (e) { wrap.innerHTML = '<p class="home-empty">Impossible de charger les gains.</p>'; }
}

let leaderType = null;
const LB_META = {
  level: { col: 'Niveau', podium: p => 'Niv. ' + p.value, cell: p => 'Niv. ' + p.value },
  won:   { col: 'Gains',  podium: p => fmt(p.value) + ' <span class="podium-coin">🪙</span>', cell: p => fmt(p.value) },
  lost:  { col: 'Perdu',  podium: p => fmt(p.value) + ' <span class="podium-coin">🪙</span>', cell: p => fmt(p.value) },
};
function setLeaderType(t) { leaderType = t; renderLeaderboard(); }

async function renderLeaderboard() {
  if (!leaderType) leaderType = ['level', 'won', 'lost'][Math.floor(Math.random() * 3)];
  const meta = LB_META[leaderType] || LB_META.won;
  document.querySelectorAll('.lb-chip').forEach(c => c.classList.toggle('active', c.dataset.lb === leaderType));
  const wrap = $('homeLeaderWrap');
  // pas de spinner au changement de classement : on garde l'affichage courant
  // jusqu'à l'arrivée des nouvelles données (le spinner initial est dans le HTML)
  try {
    const top = (await api('/leaderboard?type=' + leaderType)).top || [];
    if (!top.length) { if (wrap) wrap.innerHTML = '<p class="home-empty">Aucun joueur pour l\'instant.</p>'; return; }

    const ranked = top.slice(0, 3).map((p, i) => ({ ...p, rank: i + 1 }));
    const visualIdx = [1, 0, 2]; // 2e gauche, 1er centre, 3e droite
    let podiumHtml = '<div class="podium">';
    visualIdx.forEach(idx => {
      const p = ranked[idx]; if (!p) return;
      const isMine = p.name === USER.username;
      podiumHtml += '<div class="podium-place p' + p.rank + (isMine ? ' is-me' : '') + '">'
        + (p.rank === 1 ? '<div class="podium-crown">♛</div>' : '')
        + '<div class="podium-name">' + esc(p.name) + '</div>'
        + '<div class="podium-won">' + meta.podium(p) + '</div>'
        + '<div class="podium-block"><span>' + p.rank + '</span></div>'
        + '</div>';
    });
    podiumHtml += '</div>';

    let tableHtml = '';
    if (top.length > 3) {
      tableHtml = '<table class="leader-table"><thead><tr><th>#</th><th>Joueur</th><th>Nv.</th><th>' + meta.col + '</th></tr></thead><tbody>';
      top.slice(3).forEach((p, i) => {
        const isMine = p.name === USER.username;
        tableHtml += '<tr' + (isMine ? ' class="is-me-row"' : '') + '>'
          + '<td>' + (i + 4) + '</td>'
          + '<td>' + esc(p.name) + (isMine ? ' <span style="color:var(--v-300)">(vous)</span>' : '') + '</td>'
          + '<td style="color:var(--tx-3)">' + (p.level || 1) + '</td>'
          + '<td style="color:var(--accent-2);font-family:var(--num);font-variant-numeric:tabular-nums">' + meta.cell(p) + '</td>'
          + '</tr>';
      });
      tableHtml += '</tbody></table>';
    }
    if (wrap) wrap.innerHTML = podiumHtml + tableHtml;
  } catch (e) {
    if (wrap) wrap.innerHTML = '<p class="home-empty">Impossible de charger le classement.</p>';
  }
}

/* ── Niveaux & récompenses ────────────────────────────────── */
function renderLevels() {
  if (!USER) return;
  const lvl = USER.level || 1, xp = USER.xp || 0;
  const cur = $('levelsCurrent');
  if (cur) {
    const nextM = (Math.floor(lvl / 10) + 1) * 10;
    cur.innerHTML =
      '<div class="lvc-badge">Niveau <b>' + lvl + '</b> · ' + esc(levelTitle(lvl)) + '</div>'
      + (lvl < MAX_LEVEL
          ? '<div class="lvc-next">Prochain bonus : <b>Niveau ' + nextM + '</b> → +' + fmt((nextM / 10) * 1000) + ' Crédits Club</div>'
          : '<div class="lvc-next">Niveau maximum atteint 🏆</div>');
  }
  const tbl = $('levelsTable');
  if (tbl) {
    let html = '';
    const nextM = (Math.floor(lvl / 10) + 1) * 10;
    for (let m = 10; m <= 100; m += 10) {
      const reached = lvl >= m;
      const isNext = !reached && m === nextM;
      html += '<div class="lvl-tier' + (reached ? ' reached' : '') + (isNext ? ' next' : '') + '">'
        + '<div class="lvt-lvl">Niveau ' + m + '</div>'
        + '<div class="lvt-rew">+' + fmt((m / 10) * 1000) + '</div>'
        + '<div class="lvt-lbl">' + (reached ? 'Débloqué' : 'Crédits Club') + '</div>'
        + '</div>';
    }
    tbl.innerHTML = html;
  }
}

/* ── Historique des mises ─────────────────────────────────── */
const GAME_ICON_H = { slots:'🎰', blackjack:'🃏', mines:'💣', plinko:'🪙', wheel:'🎡', dice:'🎲' };
async function loadHistory() {
  $('historyTable').innerHTML = '<tr><td colspan="5" class="loading-cell"><span class="spinner"></span></td></tr>';
  try {
    const d = await api('/history');
    let rows = '<tr><th>Jeu</th><th>Heure</th><th>Mise</th><th>Gain</th><th>Net</th></tr>';
    if (!d.history.length) {
      rows += '<tr><td colspan="5" style="color:var(--dim);text-align:center;padding:20px">Aucune partie jouée pour l\'instant.</td></tr>';
    }
    d.history.forEach(h => {
      const net = h.gain - h.bet;
      const col = net > 0 ? 'var(--green)' : net < 0 ? 'var(--red)' : 'var(--dim)';
      const dt  = new Date(h.ts).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
      const ico = GAME_ICON_H[h.game] || '🎮';
      rows += '<tr>'
        + '<td>' + ico + ' ' + esc(h.game) + '</td>'
        + '<td class="log-time">' + dt + '</td>'
        + '<td style="color:var(--dim)">' + fmt(h.bet) + '</td>'
        + '<td>' + fmt(h.gain) + '</td>'
        + '<td style="color:' + col + ';font-weight:700">' + (net >= 0 ? '+' : '') + fmt(net) + '</td>'
        + '</tr>';
    });
    $('historyTable').innerHTML = rows;
  } catch (e) {}
}

/* ══════════════════ SLOTS ══════════════════════════════ */
const SYM = ['🍒', '🔔', '💎', '7️⃣', '🍋', '⭐'];
/* symboles dessinés (SVG) — remplacent les emoji */
const SLOT_SVG = {
  gem: '<svg viewBox="0 0 512 512" fill="currentColor"><path fill="currentColor" d="M92.906 94.813l60.438 79.75 78.125-79.75H92.905zm189.25 0L359.25 173.5l58.688-78.688H282.155zm-25.344.843l-84.718 86.47H341.53l-84.717-86.47zm177.907 7.906l-58.626 78.563H494.53l-59.81-78.563zm-358.064.75l-57.78 77.813h116.78l-59-77.813zm-58.5 96.5L226.562 429.22 143.344 200.81H18.156zm145.063 0l93.593 256.844 93.593-256.844H163.22zm207.06 0L287.064 429.22 495.469 200.81H370.28z"/></svg>',
  clover: '<svg viewBox="0 0 512 512" fill="currentColor"><path fill="currentColor" d="M229.3 23.6c-1.3 0-2.7.1-4 .11-21.2 1.03-40.7 8.51-49.7 18.54-11.2 12.51-16.6 46.14-3.2 82.45 12.4 33.6 39.5 69.4 88.1 94.3 13.5-37.3 17.4-100.3 16.6-148.56l18-.28c.7 46.64-1.9 105.94-15.2 147.94 34.2-16.5 64.8-32.9 86.4-54.7 24.7-24.9 38.9-56.5 35.9-107.03-.2-3.85-3-8.72-9.4-13.57-6.3-4.85-15.9-9.24-27-11.93-22.1-5.37-50.1-3.97-72.2 8.76l-5.2 2.97-4.7-3.59c-12.9-9.73-31.7-14.93-50.4-15.39h-4zM89.18 161.3c-2.71 0-5.42.1-8.14.3-20.35 1.6-44.06 16.8-52.99 39.1s-5.33 52.4 32.32 88.2l3.13 3-.36 4.3c-3.69 43.4.54 71.8 8.13 88.8 7.59 17.1 17.53 23.3 29.03 25.3 11.4 1.9 25-1.3 36.8-6.9 11.8-5.5 21.8-13.6 25.2-18v-.1c35-44.4 51.2-90.1 70-136.8-80.2 46.4-112.6 41.3-142.88 45.7l-2.58-17.8c35.26-5.1 60.76 2.2 145.56-48.9-44.9-31.9-91.1-65.2-140.52-66.2zM394 218.6c-3.8.1-7.7.4-11.7.8-27.2 2.8-56.1 12.8-84.2 19.5 36 45.6 60.9 84 103.5 112.4l-10 15c-44.6-29.8-70.5-68.5-104.2-111.6-6.4 32.2-11.2 64.7-9.3 93.9 2.2 35 13.4 64.8 42.4 86.7 16.8 12.7 30.4 18 41 18.8 10.6.8 18.8-2.4 26.7-8.9 15.6-13 27.6-40.5 36.4-67.7l1.2-3.6 3.5-1.7c40.1-19.4 55-41.5 58.1-62.1 3.1-20.7-6.1-41.6-19.4-57.6-21.9-26.4-45.5-34.1-71.5-33.9zm-138.4 17.6c-40.8 91.8-22.5 168.6-3 252.2l17.6-4c-19.5-83.8-36.6-154.2 1.8-240.8z"/></svg>',
  cherry: '<svg viewBox="0 0 512 512" fill="currentColor"><path fill="currentColor" d="M278.814 35.137c-3.87 29.372 2.21 62.917 23.563 91.277 24.7 32.807 70.077 59.506 146.49 64.467-10.864-53.306-31.943-84.387-60.87-107.415-23.07-18.367-51.784-31.734-84.02-45.96 29.838 36.785 60.63 73.392 105.382 92.694l-7.13 16.527c-55.713-24.03-90.292-70.698-123.416-111.59zM259.2 46.79c-42.613 88.792-88.927 175.71-147.975 257.08-1.967-1.61-3.77-3.225-5.454-4.725-4.98-4.436-9.11-7.99-15.42-10.407-2.338-.896-4.675-1.33-7.02-1.326-7.035.01-14.15 3.948-21.65 11.11-10 9.553-18.946 24.412-23.893 37.62-14.318 38.227 4.955 80.574 43.186 94.89 38.23 14.32 80.582-4.952 94.9-43.178 4.94-13.187 8.024-30.42 6.8-44.243-.61-6.91-2.283-12.897-4.786-17.208-2.503-4.31-5.532-7.033-10.21-8.627-4.466-1.52-10.517-1.707-17.765-1.85-6.83-.133-14.742-.297-22.97-3.064 53.342-73.767 96.236-151.695 135.23-230.99-7.14 56.593-14.18 114.543-29.91 170.29-7.03-.83-12.847-3.195-17.887-5.144-6.222-2.407-11.337-4.285-18.094-4.336-10.013-.077-17.4 6.766-23.415 19.216-5.06 10.48-8.094 24.21-8.93 36.708 3.11.388 6.3 1.027 9.544 2.132 8.872 3.023 15.68 9.234 19.973 16.627 4.293 7.394 6.374 15.88 7.15 24.662.775 8.75.267 17.862-1.156 26.727 11.08 6.646 24.062 10.47 37.967 10.47 40.825 0 73.725-32.898 73.725-73.718 0-14.08-3.156-31.3-9.15-43.817-2.997-6.257-6.663-11.276-10.52-14.435-3.856-3.16-7.648-4.648-12.59-4.5-4.713.142-10.445 2.09-17.282 4.498-3.142 1.107-6.54 2.286-10.188 3.25 11.84-43.77 18.6-88.247 24.276-131.803C263.302 95.443 258.402 70.4 259.2 46.79zm46.732 110.605c1.617 5.452 3.26 10.96 4.945 16.554 20.44 67.845 45.324 144.313 68.207 195.255-4.537.18-8.715-.204-12.46-.52-6.65-.564-12.083-.93-18.583.917-9.63 2.738-14.8 11.38-17.075 25.017-2.275 13.638-.524 30.894 3.437 44.43 11.464 39.178 52.28 61.515 91.463 50.052 39.182-11.464 61.52-52.276 50.057-91.454-3.955-13.514-11.82-29.155-21.086-39.484-4.634-5.164-9.564-8.953-14.152-10.902-2.295-.975-4.456-1.554-6.63-1.698-2.177-.143-4.368.15-6.718.915-4.485 1.458-9.44 4.937-15.324 9.168-4.337 3.118-9.218 6.61-15.076 9.29-21.51-47.232-46.358-122.123-66.762-189.375-9.007-5.556-17.075-11.646-24.242-18.168z"/></svg>',
  star: '<svg viewBox="0 0 512 512" fill="currentColor"><path fill="currentColor" d="M256 38.013c-22.458 0-66.472 110.3-84.64 123.502-18.17 13.2-136.674 20.975-143.614 42.334-6.94 21.358 84.362 97.303 91.302 118.662 6.94 21.36-22.286 136.465-4.116 149.665 18.17 13.2 118.61-50.164 141.068-50.164 22.458 0 122.9 63.365 141.068 50.164 18.17-13.2-11.056-128.306-4.116-149.665 6.94-21.36 98.242-97.304 91.302-118.663-6.94-21.36-125.444-29.134-143.613-42.335-18.168-13.2-62.182-123.502-84.64-123.502z"/></svg>',
  lemon: '<svg viewBox="0 0 512 512" fill="currentColor"><path fill="currentColor" d="M372.155 22.74c-2.383.006-4.78.023-7.188.048-96.615 1.006-212.449 16.343-293.129 48.299 53.634 30.517 147.245 69.92 225.258 63.623 105.888-13.769 130.213-63.196 166.272-101.89-80.543 35.402-188.935 68.295-277.344 47.288l4.16-17.513c73.994 17.581 169.091-7.127 245.187-37.719-19.444-1.475-40.736-2.204-63.216-2.137zm116.047 10.769c-39.292 35.566-65.02 103.045-189.024 119.088l-.209.027-.213.018c-61.286 5.007-128.03-14.881-181.385-38.34C27.258 195.335-3.358 324.769 46.178 423.278c-7.19 15.133-14.1 55.714-5.344 61.455 9.907 6.497 56.377 9.562 100.434-16.152 266.975 22.149 381.075-197.096 334.31-373.64 8.996-17.539 16.994-48.322 12.623-61.432zm-48.096 205.65l17.713 3.207c-2.711 14.97-3.485 18.941-11.979 35.942l-16.103-8.045c8.295-16.605 7.624-15.945 10.369-31.104zm-35.526 1.266l17.248 5.146c-3.966 13.29-4.674 15.182-15.61 32.938l-15.327-9.44c10.918-17.725 9.683-15.218 13.69-28.644zm17.729 53.422l16.557 7.062c-8.988 21.07-21.13 37.16-39.688 52.98l-11.676-13.699c17.009-14.499 26.767-27.494 34.807-46.343zm-46.104 1.103l15.397 9.324c-2.623 4.33-8.042 11.385-14.457 19.522-6.415 8.136-13.293 16.513-17.988 21.48l-13.08-12.365c3.706-3.92 10.693-12.345 16.931-20.258 6.239-7.913 12.26-16.156 13.197-17.703zm-43.068 50.4l12.639 12.815c-9.895 9.759-20.094 15.268-35.375 24.004l-8.934-15.627c15.413-8.811 23.773-13.403 31.67-21.191zm35.586 17.608l11.492 13.854c-9.585 7.95-22.44 17.369-37.342 25.14l-8.324-15.96c13.363-6.97 25.313-15.684 34.174-23.034zm-88.23 15.025l5.69 17.077-17.878 5.96-5.691-17.078zm-41.774 14.329l5.309 17.199c-16.105 4.971-22.016 7.66-42.565 7.85l-.166-18c19.248-.178 20.64-1.87 37.422-7.05zm69.85 7.666l7.642 16.296c-15.603 7.318-36.356 15.454-56.24 19.31l-3.426-17.67c17.473-3.389 37.378-11.067 52.024-17.936zm-91.68 29.017l4.77 17.358c-11.888 3.267-22 2.141-35.957 1.748l.507-17.993c14.53.41 22.439 1.152 30.68-1.113z"/></svg>',
};
const SLOT_MAP = { '💎':['gem','sym-gem'], '🔔':['clover','sym-clover'], '🍒':['cherry','sym-cherry'], '⭐':['star','sym-star'], '🍋':['lemon','sym-lemon'] };
function slotSymbolHTML(emoji) {
  if (emoji === '7️⃣') return '<span class="slot-sym sym-seven"><svg viewBox="0 0 100 100"><text x="50" y="62" text-anchor="middle" font-family="Cormorant Garamond,Georgia,serif" font-weight="700" font-size="86" fill="currentColor">7</text></svg></span>';
  const m = SLOT_MAP[emoji];
  if (!m) return '<span class="slot-sym">' + emoji + '</span>';
  return '<span class="slot-sym ' + m[1] + '">' + SLOT_SVG[m[0]] + '</span>';
}
function renderPaytable() {
  const p = $('slotPaytable'); if (!p) return;
  const rows = [['7️⃣','20×'],['💎','8×'],['🔔','3×'],['🍒','2×'],['⭐','1.75×'],['🍋','1.25×']];
  p.innerHTML = rows.map(r =>
    '<span class="pt">' + slotSymbolHTML(r[0]) + slotSymbolHTML(r[0]) + slotSymbolHTML(r[0]) + '<b>' + r[1] + '</b></span>'
  ).join('')
  + '<span class="pt"><span class="pt-label">Paire</span><b>1.5×</b></span>';
}
function initSlots() {
  ['🍒','🔔','💎'].forEach((s, i) => { const r = $('r'+i); if (r) r.innerHTML = slotSymbolHTML(s); });
  renderPaytable();
}
let slotSpinning = false;
async function spin() {
  if (slotSpinning) return;
  const bet = int('slotBet'); if (!bet) return toast('Mise invalide', 2800, 'error');
  slotSpinning = true;
  $('slotBtn').disabled = true;
  const reels = [0,1,2].map(i => $('r'+i));
  reels.forEach(r => { r.classList.add('spin'); r.classList.remove('hit'); });
  { const res = $('slotResult'); if (res) { res.dataset.state = 'idle'; res.textContent = ''; } }
  const tick = setInterval(() => reels.forEach(r => { if (r.classList.contains('spin')) r.innerHTML = slotSymbolHTML(SYM[Math.random()*SYM.length|0]); }), 70);
  let d;
  try { d = await api('/play/slots', 'POST', { bet }); }
  catch (e) { clearInterval(tick); reels.forEach(r => r.classList.remove('spin')); slotSpinning = false; $('slotBtn').disabled = false; return toast(e.message, 4000, 'error'); }
  /* arrêt en cascade des 3 rouleaux pour le suspense */
  const stops = [600, 850, 1100];
  stops.forEach((delay, i) => setTimeout(() => {
    reels[i].classList.remove('spin');
    reels[i].innerHTML = slotSymbolHTML(d.reels[i]);
  }, delay));
  setTimeout(() => {
    clearInterval(tick);
    const machine = $('view-slots').querySelector('.machine');
    if (d.gain > 0) reels.forEach(r => r.classList.add('hit'));
    gameResult({ machine, bet, gain: d.gain, balance: d.balance, xp: d.xp, level: d.level });
    slotSpinning = false; $('slotBtn').disabled = false;
  }, 1180);
}

/* ══════════════════ BLACKJACK ══════════════════════════ */
let bjCurrentBet = 0;
function renderCard(c) {
  const d = document.createElement('div');
  if (c.back) { d.className = 'pcard back'; return d; }
  d.className = 'pcard ' + (c.c === 'red' ? 'red' : '');
  d.setAttribute('data-c', c.r);
  d.innerHTML = '<div class="r">' + c.r + '</div><div class="s">' + c.s + '</div>';
  return d;
}
function bjRender(d) {
  const dc = $('dealerCards'); dc.innerHTML = ''; d.dealer.forEach(c => dc.appendChild(renderCard(c)));
  const pc = $('playerCards'); pc.innerHTML = ''; d.player.forEach(c => pc.appendChild(renderCard(c)));
  $('playerScore').textContent = d.playerScore;
  $('dealerScore').textContent = d.dealerScore;
}
function bjFinish(d) {
  $('bjActions').classList.add('hidden'); $('bjBetRow').classList.remove('hidden');
  setBalance(d.balance, d.outcome === 'win', d.xp, d.level);
  const m = $('bjMsg');
  if (d.outcome === 'win')  { m.className = 'msg win';  m.textContent = 'Gagné ! ' + d.playerScore + ' vs ' + d.dealerScore + '  +' + fmt(d.gain) + ' 🪙'; checkBigWin(bjCurrentBet, d.gain); }
  else if (d.outcome === 'push') { m.className = 'msg info'; m.textContent = 'Égalité — mise rendue.'; }
  else { m.className = 'msg lose'; m.textContent = (d.playerScore > 21 ? 'Buste ! ' : 'Perdu. ') + d.playerScore + ' vs ' + d.dealerScore; }
}
async function bjDeal() {
  const bet = int('bjBet'); if (!bet) return toast('Mise invalide', 2800, 'error');
  $('bjDealBtn').disabled = true;
  bjCurrentBet = bet;
  let d; try { d = await api('/bj/deal', 'POST', { bet }); } catch (e) { $('bjDealBtn').disabled = false; return toast(e.message, 4000, 'error'); }
  $('bjBetRow').classList.add('hidden'); $('bjActions').classList.remove('hidden'); $('bjMsg').textContent = '';
  setBalance(d.balance, undefined, d.xp, d.level); bjRender(d); $('bjDealBtn').disabled = false;
  if (d.outcome) bjFinish(d);
}
async function bjHit()   { let d; try { d = await api('/bj/hit',   'POST'); } catch (e) { return toast(e.message, 4000, 'error'); } bjRender(d); if (d.outcome) bjFinish(d); }
async function bjStand() { let d; try { d = await api('/bj/stand', 'POST'); } catch (e) { return toast(e.message, 4000, 'error'); } bjRender(d); bjFinish(d); }

/* ══════════════════ MINES ══════════════════════════════ */
let minesActive = false, minesCurrentBet = 0;
const MINE_GEM  = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 3h12l4 6-10 12L2 9z"/><path d="M6 3 4 9h16l-2-6zM2 9h20" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1"/></svg>';
const MINE_BOMB = '<svg viewBox="0 0 24 24"><circle cx="11" cy="14.5" r="7" fill="currentColor"/><path d="M16.5 6.5 19 4m0 0h-2.6M19 4v2.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="8.5" cy="12" r="1.6" fill="#fff" opacity=".4"/></svg>';
function buildMinesGrid() { const g = $('minesGrid'); if (!g) return; g.innerHTML = ''; for (let i = 0; i < 25; i++) { const c = document.createElement('div'); c.className = 'cell'; c.dataset.i = i; c.onclick = () => minesPick(i); g.appendChild(c); } }
function minesCell(i) { return document.querySelector('.cell[data-i="' + i + '"]'); }
function revealBombs(bombs) { bombs.forEach(j => { const c = minesCell(j); if (c && !c.classList.contains('gem')) { c.classList.add('bomb','done'); c.innerHTML = MINE_BOMB; } }); }

async function minesStartGame() {
  const bet = int('minesBet'); if (!bet) return toast('Mise invalide', 2800, 'error');
  const bombs = +$('minesCount').value;
  let d; try { d = await api('/mines/start', 'POST', { bet, bombs }); } catch (e) { return toast(e.message, 4000, 'error'); }
  buildMinesGrid(); minesActive = true; minesCurrentBet = bet;
  $('minesStart').classList.add('hidden'); $('minesCash').classList.remove('hidden'); $('minesMsg').textContent = '';
  $('minesMult').textContent = '1.00×'; $('minesPot').textContent = '0'; $('minesGems').textContent = '0';
  setBalance(d.balance, undefined, d.xp, d.level);
}
async function minesPick(i) {
  if (!minesActive) return;
  const cell = minesCell(i); if (cell.classList.contains('done')) return;
  let d; try { d = await api('/mines/pick', 'POST', { i }); } catch (e) { return toast(e.message, 4000, 'error'); }
  cell.classList.add('done');
  if (d.result === 'bomb') {
    cell.classList.add('bomb'); cell.innerHTML = MINE_BOMB; revealBombs(d.bombs); shakeEl($('minesGrid')); minesActive = false;
    $('minesCash').classList.add('hidden'); $('minesStart').classList.remove('hidden');
    setBalance(d.balance, false, d.xp, d.level);
    const m = $('minesMsg'); m.className = 'msg lose'; m.textContent = '💥 Bombe ! Mise perdue.';
    return;
  }
  cell.classList.add('gem'); cell.innerHTML = MINE_GEM;
  $('minesMult').textContent = d.mult.toFixed(2) + '×'; $('minesPot').textContent = fmt(d.pot);
  $('minesGems').textContent = (+$('minesGems').textContent) + 1;
  setBalance(d.balance, undefined, d.xp, d.level);
  if (d.cashedOut) {
    revealBombs(d.bombs); minesActive = false;
    $('minesCash').classList.add('hidden'); $('minesStart').classList.remove('hidden');
    flashBal(true);
    const m = $('minesMsg'); m.className = 'msg win'; m.textContent = 'Tout déminé ! +' + fmt(d.gain) + ' 🪙';
    checkBigWin(minesCurrentBet, d.gain);
  }
}
async function minesCashout() {
  if (!minesActive) return;
  let d; try { d = await api('/mines/cashout', 'POST'); } catch (e) { return toast(e.message, 4000, 'error'); }
  revealBombs(d.bombs); minesActive = false;
  $('minesCash').classList.add('hidden'); $('minesStart').classList.remove('hidden');
  setBalance(d.balance, true, d.xp, d.level);
  const m = $('minesMsg'); m.className = 'msg win'; m.textContent = 'Encaissé +' + fmt(d.gain) + ' 🪙';
  checkBigWin(minesCurrentBet, d.gain);
}

/* ══════════════════ PLINKO ══════════════════════════════ */
const PK = $('plinkoCanvas'), PCX = PK ? PK.getContext('2d') : null, PK_ROWS = 12;
/* valeurs par défaut, écrasées par /api/config (source de vérité = games.ts) */
let PK_MULT = {
  low:  [4.26,2.13,1.38,1.06,0.75,0.59,0.53,0.59,0.75,1.06,1.38,2.13,4.26],
  med:  [21.32,7.46,3.41,1.92,0.85,0.32,0,0.32,0.85,1.92,3.41,7.46,21.32],
  high: [70.4,25.6,9.6,1.92,0,0,0,0,0,1.92,9.6,25.6,70.4],
};
let pkBall = null, pkAnim = null, pkHighlight = -1, PK_DPR = 1, pkTrail = [];
let PK_W = 440, PK_H = 360;
function initPlinkoCanvas() {
  if (!PK) return;
  PK_DPR = window.devicePixelRatio || 1;
  /* Le plateau a été renommé .game-board -> .machine-board lors de la refonte :
     on dimensionne le canvas depuis la largeur (définie) du plateau, hauteur dérivée. */
  const board = PK.closest('.machine-board') || PK.parentElement;
  const availW = (board && board.clientWidth > 40) ? board.clientWidth : (PK.parentElement?.clientWidth || 440);
  const maxH = Math.round(window.innerHeight * 0.6);
  let w = Math.max(280, Math.min(availW, 600));
  let h = Math.round(w * 0.82);
  if (h > maxH) { h = maxH; w = Math.min(w, Math.round(h / 0.82)); }
  PK_W = w; PK_H = h;
  PK.style.width  = PK_W + 'px';
  PK.style.height = PK_H + 'px';
  PK.width  = Math.round(PK_W * PK_DPR);
  PK.height = Math.round(PK_H * PK_DPR);
  PCX.setTransform(PK_DPR, 0, 0, PK_DPR, 0, 0);
}
function pkGeom() {
  const w = PK_W, h = PK_H;
  const padX = Math.max(22, w * 0.075), topY = Math.max(22, h * 0.08);
  const binH = Math.max(26, h * 0.1), binY = h - binH - 6;
  const spacing = (w - 2 * padX) / PK_ROWS, cx = w / 2;
  return { w, h, padX, topY, binY, binH, spacing, cx };
}
function pkX(level, rights) { const g = pkGeom(); return g.cx + (2*rights - level)*g.spacing/2; }
function roundRect(x, y, w, h, r) { PCX.beginPath(); PCX.moveTo(x+r,y); PCX.arcTo(x+w,y,x+w,y+h,r); PCX.arcTo(x+w,y+h,x,y+h,r); PCX.arcTo(x,y+h,x,y,r); PCX.arcTo(x,y,x+w,y,r); PCX.closePath(); }
function pkBinColor(m) {
  if (m >= 5)   return ['rgba(255,60,120,.85)', 'rgba(180,20,70,.85)'];
  if (m >= 1.5) return ['rgba(168,85,247,.85)', 'rgba(109,40,217,.8)'];
  if (m >= 0.9) return ['rgba(124,58,237,.7)',  'rgba(70,30,150,.7)'];
  return ['rgba(60,55,90,.7)', 'rgba(35,30,55,.7)'];
}
function drawPlinko() {
  if (!PK || !PCX) return;
  const g = pkGeom(), mult = PK_MULT[$('plinkoRisk').value || 'med'];
  const pegR  = Math.max(1.8, g.spacing * 0.085);
  const ballR = Math.max(4.5, g.spacing * 0.22);
  PCX.clearRect(0, 0, g.w, g.h);
  for (let l = 1; l <= PK_ROWS; l++) for (let s = 0; s <= l; s++) {
    const x = g.cx + (2*s-l)*g.spacing/2, y = g.topY + (l/PK_ROWS)*(g.binY - g.topY - g.spacing*0.4);
    PCX.beginPath(); PCX.fillStyle = 'rgba(124,58,237,.85)'; PCX.shadowColor = 'rgba(168,85,247,.5)'; PCX.shadowBlur = 3;
    PCX.arc(x, y, pegR, 0, 7); PCX.fill(); PCX.shadowBlur = 0;
  }
  const bw = g.spacing, fs = Math.min(13, Math.max(8, g.spacing * 0.34));
  for (let b = 0; b <= PK_ROWS; b++) {
    const x = g.cx + (2*b-PK_ROWS)*g.spacing/2, m = mult[b], on = b === pkHighlight;
    const [c1, c2] = pkBinColor(m);
    const grad = PCX.createLinearGradient(0, g.binY, 0, g.binY + g.binH);
    if (on) { grad.addColorStop(0, '#c4b5fd'); grad.addColorStop(1, '#7c3aed'); }
    else    { grad.addColorStop(0, c1); grad.addColorStop(1, c2); }
    PCX.fillStyle = grad;
    PCX.strokeStyle = 'rgba(0,0,0,.25)'; PCX.lineWidth = 1;
    roundRect(x - bw/2 + 1.5, g.binY, bw - 3, g.binH, Math.min(7, bw*0.18)); PCX.fill(); PCX.stroke();
    PCX.fillStyle = '#fff'; PCX.font = '700 ' + fs + 'px Inter, system-ui, sans-serif';
    PCX.textAlign = 'center'; PCX.textBaseline = 'middle';
    PCX.fillText(m + '×', x, g.binY + g.binH/2);
  }
  for (let i = 0; i < pkTrail.length; i++) {
    const t = pkTrail[i], a = (i + 1) / pkTrail.length;
    PCX.beginPath(); PCX.fillStyle = 'rgba(168,85,247,' + (a * 0.35) + ')';
    PCX.arc(t.x, t.y, ballR * a * 0.8, 0, 7); PCX.fill();
  }
  if (pkBall) {
    PCX.beginPath(); PCX.fillStyle = '#ede9fe'; PCX.shadowColor = '#a855f7'; PCX.shadowBlur = 20;
    PCX.arc(pkBall.x, pkBall.y, ballR, 0, 7); PCX.fill();
    PCX.fillStyle = '#7c3aed'; PCX.beginPath(); PCX.arc(pkBall.x, pkBall.y, ballR*0.6, 0, 7); PCX.fill();
    PCX.shadowBlur = 0;
  }
}
function shuffleArr(a) { for (let i = a.length-1; i > 0; i--) { const j = Math.random()*(i+1)|0; [a[i],a[j]]=[a[j],a[i]]; } return a; }
async function plinkoDrop() {
  if (pkAnim) return;
  const bet = int('plinkoBet'); if (!bet) return toast('Mise invalide', 2800, 'error');
  const risk = $('plinkoRisk').value;
  let d; try { d = await api('/play/plinko', 'POST', { bet, risk }); } catch (e) { return toast(e.message, 4000, 'error'); }
  { const res = $('plinkoResult'); if (res) { res.dataset.state = 'idle'; res.textContent = ''; } } pkHighlight = -1;
  const target = d.bin, steps = []; for (let i = 0; i < target; i++) steps.push(1); while (steps.length < PK_ROWS) steps.push(0); shuffleArr(steps);
  const g = pkGeom(); const span = g.binY - g.topY - g.spacing*0.4;
  let t0 = performance.now(), dur = 1300; pkBall = { x: g.cx, y: g.topY }; pkTrail = []; $('plinkoBtn').disabled = true;
  function frame(now) {
    const p = Math.min(1, (now-t0)/dur), lf = p*PK_ROWS, li = Math.floor(lf), frac = lf-li;
    let rDone = 0; for (let i = 0; i < li; i++) rDone += steps[i];
    const nextR = li < PK_ROWS ? steps[li] : 0;
    const x0 = pkX(li, rDone), x1 = pkX(li+1, rDone+nextR);
    const y0 = g.topY+(li/PK_ROWS)*span, y1 = g.topY+((li+1)/PK_ROWS)*span;
    pkBall.x = x0+(x1-x0)*frac; pkBall.y = y0+(y1-y0)*frac+Math.sin(frac*Math.PI)*6;
    pkTrail.push({ x: pkBall.x, y: pkBall.y }); if (pkTrail.length > 12) pkTrail.shift();
    drawPlinko();
    if (p < 1) pkAnim = requestAnimationFrame(frame);
    else {
      pkBall.x = pkX(PK_ROWS, target); pkBall.y = g.binY-4; pkHighlight = target; pkTrail = []; drawPlinko(); pkAnim = null; pkBall = null; $('plinkoBtn').disabled = false;
      const machine = $('view-plinko').querySelector('.machine');
      gameResult({ machine, bet, gain: d.gain, balance: d.balance, xp: d.xp, level: d.level });
    }
  }
  pkAnim = requestAnimationFrame(frame);
}

/* ══════════════════ WHEEL ═══════════════════════════════ */
/* défaut écrasé par /api/config (source de vérité = games.ts) */
let WHEEL = {
  low:  [0.5, 1.5, 0.7, 2, 0.5, 1.5, 0.9, 3, 0.5, 1.5, 0.7, 2, 0.5, 1.5, 0.9, 3],
  med:  [0, 1.5, 0, 2, 0, 1.5, 0, 5, 0, 1.5, 0, 2, 0, 1.5, 0, 15],
  high: [0, 0, 2, 0, 0, 5, 0, 0, 0, 0, 5, 0, 0, 2, 0, 50],
};
let wheelSpinning = false, wheelRot = 0, wheelRiskBuilt = '';
function wheelRisk() { const s = $('wheelRisk'); return (s && WHEEL[s.value]) ? s.value : 'med'; }
function wheelColor(m) {
  return m === 0 ? '#1c1430' : m < 1 ? '#3a3550'
    : m >= 50 ? '#a855f7' : m >= 10 ? '#ff2e88' : m >= 5 ? '#d6209e'
    : m >= 3 ? '#7b2ff7' : m >= 2 ? '#23e0d6' : '#2a8fa0';
}
function renderWheel() {
  const risk = wheelRisk();
  const segs = WHEEL[risk];
  const g = $('wheelG'); if (!g) return;
  const cx = 160, cy = 160, r = 150, n = segs.length, seg = 360 / n; let html = '';
  for (let i = 0; i < n; i++) {
    const a0 = i * seg * Math.PI / 180, a1 = (i + 1) * seg * Math.PI / 180;
    const x0 = cx + r * Math.sin(a0), y0 = cy - r * Math.cos(a0), x1 = cx + r * Math.sin(a1), y1 = cy - r * Math.cos(a1);
    html += '<path d="M' + cx + ' ' + cy + ' L' + x0.toFixed(2) + ' ' + y0.toFixed(2) + ' A' + r + ' ' + r + ' 0 0 1 ' + x1.toFixed(2) + ' ' + y1.toFixed(2) + ' Z" fill="' + wheelColor(segs[i]) + '" stroke="rgba(0,0,0,.4)" stroke-width="1"/>';
    const am = i * seg + seg / 2, rad = am * Math.PI / 180, lx = cx + 106 * Math.sin(rad), ly = cy - 106 * Math.cos(rad);
    html += '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" fill="#fff" font-family="Inter, system-ui, sans-serif" font-size="15" text-anchor="middle" dominant-baseline="middle" transform="rotate(' + am.toFixed(1) + ' ' + lx.toFixed(1) + ' ' + ly.toFixed(1) + ')">' + (segs[i] === 0 ? '✕' : segs[i] + '×') + '</text>';
  }
  html += '<circle cx="160" cy="160" r="150" fill="none" stroke="rgba(168,85,247,.55)" stroke-width="3"/>';
  g.innerHTML = html; g.style.transform = 'rotate(' + wheelRot + 'deg)'; wheelRiskBuilt = risk;
}
async function wheelSpin() {
  if (wheelSpinning) return;
  const bet = int('wBet'); if (!bet) return toast('Mise invalide', 2800, 'error');
  const risk = wheelRisk();
  if (wheelRiskBuilt !== risk) renderWheel();
  wheelSpinning = true; $('wBtn').disabled = true;
  const rs = $('wheelRisk'); if (rs) rs.disabled = true;
  let d;
  try { d = await api('/play/wheel', 'POST', { bet, risk }); }
  catch (e) { wheelSpinning = false; $('wBtn').disabled = false; if (rs) rs.disabled = false; return toast(e.message, 4000, 'error'); }
  { const res = $('wResult'); if (res) { res.dataset.state = 'idle'; res.textContent = ''; } }
  const n = WHEEL[risk].length, seg = 360 / n, mid = d.index * seg + seg / 2, jitter = (Math.random() - .5) * (seg * .6);
  const base = Math.ceil(wheelRot / 360) * 360; wheelRot = base + 360 * 6 - mid + jitter;
  $('wheelG').style.transform = 'rotate(' + wheelRot + 'deg)';
  setTimeout(() => {
    wheelSpinning = false; $('wBtn').disabled = false; if (rs) rs.disabled = false;
    const machine = $('view-wheel').querySelector('.machine');
    gameResult({ machine, bet, gain: d.gain, balance: d.balance, xp: d.xp, level: d.level });
  }, 4700);
}

/* ══════════════════ DICE ═══════════════════════════════ */
let diceRolling = false;
function diceUpdate() {
  const c = Math.max(2, Math.min(95, +$('diceSlider').value));
  $('diceChanceLbl').textContent = c+'%';
  const eff = (100/c)*GAME_RTP;
  $('diceMult').textContent = eff.toFixed(2)+'×';
  const bet = Math.floor(+$('diceBet').value)||0; $('dicePot').textContent = fmt(bet*eff);
  document.documentElement.style.setProperty('--win', c+'%'); $('diceMarker').style.left = c+'%';
}
async function diceRoll() {
  if (diceRolling) return;
  const bet = int('diceBet'); if (!bet) return toast('Mise invalide', 2800, 'error');
  const chance = Math.max(2, Math.min(95, +$('diceSlider').value));
  let d; try { d = await api('/play/dice', 'POST', { bet, chance }); } catch (e) { return toast(e.message, 4000, 'error'); }
  diceRolling = true; $('diceBtn').disabled = true;
  { const res = $('diceResultMsg'); if (res) { res.dataset.state = 'idle'; res.textContent = ''; } }
  const dot = $('diceDot'), res = $('diceResult'); res.className = 'dice-result'; res.textContent = '…'; dot.style.left = d.roll.toFixed(2)+'%';
  setTimeout(() => {
    diceRolling = false; $('diceBtn').disabled = false;
    res.textContent = d.roll.toFixed(2); res.className = 'dice-result '+(d.win?'win':'lose');
    const machine = $('view-dice').querySelector('.machine');
    gameResult({ machine, bet, gain: d.gain, balance: d.balance, xp: d.xp, level: d.level });
  }, 850);
}

/* ══════════════════ BOOT ══════════════════════════════ */
(async () => {
  const u = await requireAuth();        // redirige vers / si non connecté
  if (!u) return;
  if (u.admin) { location.href = '/admin'; return; }
  if (typeof lucide !== 'undefined') lucide.createIcons();
  if (typeof applyGameIcons === 'function') applyGameIcons();
  refreshBal(); updateXP(u.xp || 0, u.level || 1);
  buildMinesGrid(); initSlots();
  try { const cfg = await api('/config'); GAME_RTP = cfg.rtp ?? 0.70;
        if (cfg.plinko) PK_MULT = cfg.plinko; if (cfg.wheel) WHEEL = cfg.wheel; } catch (e) {}
  switchTab('home');

  initAnimations();
  const riskSel = $('plinkoRisk'); if (riskSel) riskSel.addEventListener('change', () => drawPlinko());
  renderWheel();
  const wRiskSel = $('wheelRisk'); if (wRiskSel) wRiskSel.addEventListener('change', () => renderWheel());
  let _pkResizeT;
  window.addEventListener('resize', () => {
    clearTimeout(_pkResizeT);
    _pkResizeT = setTimeout(() => {
      if (!pkAnim && $('view-plinko') && $('view-plinko').classList.contains('active')) { initPlinkoCanvas(); drawPlinko(); }
    }, 150);
  });
})();
