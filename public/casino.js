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
const LEVEL_XP     = [0, 500, 2000, 5000, 10000, 20000, 35000, 55000, 80000, 110000];
const LEVEL_TITLES = ['Débutant', 'Novice', 'Joueur', 'Habitué', 'Vétéran', 'Expert', 'Pro', 'Shark', 'Légende', 'VIP'];

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
  if (USER) USER.credit = b;
  const el = $('balVal');
  if (el) countUp(el, Math.floor(b), 500);
  if (win !== undefined) flashBal(win);
  if (xp != null) updateXP(xp, level || 1);
  if (typeof refreshNavBal === 'function') refreshNavBal();
}
function int(id) { const n = Math.floor(+$(id).value); return Number.isFinite(n) && n > 0 ? n : 0; }
function qbet(id, op) { const el = $(id); let v = Math.floor(+el.value) || 0; if (op === 'half') v = Math.max(1, Math.floor(v/2)); else if (op === 'double') v *= 2; else if (op === 'max') v = Math.floor(USER ? USER.credit : 0); el.value = Math.max(1, v); }

/* ── XP sidebar ───────────────────────────────────────────── */
function updateXP(xp, level) {
  if (USER) { USER.xp = xp; USER.level = level; }
  const lvlEl = $('xpLevel');
  if (lvlEl) lvlEl.textContent = level;
  const cur  = LEVEL_XP[level - 1] || 0;
  const next = LEVEL_XP[level] != null ? LEVEL_XP[level] : LEVEL_XP[LEVEL_XP.length - 1];
  const pct  = level >= LEVEL_XP.length ? 100 : Math.min(100, ((xp - cur) / (next - cur)) * 100);
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
  const COLORS = ['#ff2e88','#ffc94d','#23e0d6','#7b2ff7','#2dff9e','#ff3b5c'];
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
    else ov.classList.add('hidden');
  }
  if (_confAF) cancelAnimationFrame(_confAF);
  _confAF = requestAnimationFrame(frame);
  setTimeout(() => { if (_confAF) cancelAnimationFrame(_confAF); ov.classList.add('hidden'); }, 5000);
}

function checkBigWin(bet, gain) {
  if (!gain || gain <= 0 || !bet) return;
  if (gain >= bet * 20) launchConfetti('MEGA WIN\n+' + fmt(gain) + ' 🪙');
  else if (gain >= bet * 5) launchConfetti('BIG WIN\n+' + fmt(gain) + ' 🪙');
}

/* ── Navigation ──────────────────────────────────────────── */
function switchTab(v) {
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
  if (v === 'wheel')   buildWheel();
  if (v === 'dice')    diceUpdate();
  if (v === 'history') loadHistory();
}

async function renderHome() {
  if (!USER) return;
  $('homeUser').textContent   = USER.username;
  $('homeLevel').textContent  = USER.level || 1;
  countUp($('homeBal'), Math.floor(USER.credit));
  const st = USER.stats || {};
  countUp($('homePlayed'), st.played || 0, 400);
  const net = (st.won || 0) - (st.wagered || 0);
  const netEl = $('homeNet');
  if (netEl) {
    countUp(netEl, Math.floor(Math.abs(net)));
    netEl.style.color = net >= 0 ? 'var(--green)' : 'var(--red)';
    setTimeout(() => {
      if (netEl) netEl.textContent = (net >= 0 ? '+' : '-') + Math.abs(Math.floor(net)).toLocaleString('fr-FR');
    }, 620);
  }
  const wrap = $('homeLeaderWrap');
  if (wrap) wrap.innerHTML = '<div class="loading-row"><span class="spinner"></span></div>';
  try {
    const top = (await api('/leaderboard')).top;
    if (!top.length) { wrap.innerHTML = '<p style="color:var(--tx-3);padding:16px">Aucun joueur pour l\'instant.</p>'; return; }

    // Podium top 3 — rangs basés sur l'index réel, ordre visuel [2e, 1er, 3e]
    const ranked = top.slice(0, 3).map((p, i) => ({ ...p, rank: i + 1 }));
    const visualIdx = [1, 0, 2]; // 2e gauche, 1er centre, 3e droite

    let podiumHtml = '<div class="podium">';
    visualIdx.forEach(idx => {
      const p = ranked[idx];
      if (!p) return;
      const isMine = p.name === USER.username;
      podiumHtml += '<div class="podium-place p' + p.rank + (isMine ? ' is-me' : '') + '">'
        + (p.rank === 1 ? '<div class="podium-crown">♛</div>' : '')
        + '<div class="podium-name">' + esc(p.name) + '</div>'
        + '<div class="podium-won">' + fmt(p.won || 0) + ' <span class="podium-coin">🪙</span></div>'
        + '<div class="podium-block"><span>' + p.rank + '</span></div>'
        + '</div>';
    });
    podiumHtml += '</div>';

    // Reste 4-10
    let tableHtml = '';
    if (top.length > 3) {
      tableHtml = '<table class="leader-table"><thead><tr><th>#</th><th>Joueur</th><th>Nv.</th><th>Gains</th></tr></thead><tbody>';
      top.slice(3).forEach((p, i) => {
        const isMine = p.name === USER.username;
        tableHtml += '<tr' + (isMine ? ' class="is-me-row"' : '') + '>'
          + '<td>' + (i + 4) + '</td>'
          + '<td>' + esc(p.name) + (isMine ? ' <span style="color:var(--v-300)">(vous)</span>' : '') + '</td>'
          + '<td style="color:var(--tx-3)">' + (p.level || 1) + '</td>'
          + '<td style="color:var(--gold);font-family:var(--display)">' + fmt(p.won || 0) + '</td>'
          + '</tr>';
      });
      tableHtml += '</tbody></table>';
    }

    if (wrap) wrap.innerHTML = podiumHtml + tableHtml;
  } catch (e) {
    if (wrap) wrap.innerHTML = '<p style="color:var(--tx-3);padding:16px">Impossible de charger le classement.</p>';
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
  gem:    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 3h12l4 6-10 12L2 9z"/><path d="M6 3 2 9h20l-4-6z" fill="#fff" opacity=".28"/></svg>',
  bell:   '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a6 6 0 0 0-6 6c0 4-2 6-2 6h16s-2-2-2-6a6 6 0 0 0-6-6z"/><circle cx="12" cy="20" r="2.2"/></svg>',
  cherry: '<svg viewBox="0 0 24 24"><path d="M11 4c3 1 6 2 9 1" fill="none" stroke="#3a8a4a" stroke-width="1.6" stroke-linecap="round"/><circle cx="7" cy="17" r="4.2" fill="currentColor"/><circle cx="17" cy="15.5" r="4.2" fill="currentColor"/><circle cx="5.6" cy="15.6" r="1.2" fill="#fff" opacity=".4"/></svg>',
  star:   '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 18.1 5 21.4l1.4-6.8L1.3 9.9l6.9-.8z"/></svg>',
  lemon:  '<svg viewBox="0 0 24 24" fill="currentColor"><ellipse cx="12" cy="12" rx="9" ry="6.4" transform="rotate(-20 12 12)"/><ellipse cx="9.5" cy="9.5" rx="3" ry="2" fill="#fff" opacity=".3" transform="rotate(-20 12 12)"/></svg>',
};
const SLOT_MAP = { '💎':['gem','sym-gem'], '🔔':['bell','sym-bell'], '🍒':['cherry','sym-cherry'], '⭐':['star','sym-star'], '🍋':['lemon','sym-lemon'] };
function slotSymbolHTML(emoji) {
  if (emoji === '7️⃣') return '<span class="slot-sym sym-seven">7</span>';
  const m = SLOT_MAP[emoji];
  if (!m) return '<span class="slot-sym">' + emoji + '</span>';
  return '<span class="slot-sym ' + m[1] + '">' + SLOT_SVG[m[0]] + '</span>';
}
function initSlots() {
  ['🍒','🔔','💎'].forEach((s, i) => { const r = $('r'+i); if (r) r.innerHTML = slotSymbolHTML(s); });
}
let slotSpinning = false;
async function spin() {
  if (slotSpinning) return;
  const bet = int('slotBet'); if (!bet) return toast('Mise invalide');
  slotSpinning = true;
  $('slotBtn').disabled = true;
  const reels = [0,1,2].map(i => $('r'+i));
  reels.forEach(r => { r.classList.add('spin'); r.classList.remove('hit'); });
  $('slotMsg').textContent = '';
  const tick = setInterval(() => reels.forEach(r => { if (r.classList.contains('spin')) r.innerHTML = slotSymbolHTML(SYM[Math.random()*SYM.length|0]); }), 70);
  let d;
  try { d = await api('/play/slots', 'POST', { bet }); }
  catch (e) { clearInterval(tick); reels.forEach(r => r.classList.remove('spin')); slotSpinning = false; $('slotBtn').disabled = false; return toast(e.message); }
  /* arrêt en cascade des 3 rouleaux pour le suspense */
  const stops = [600, 850, 1100];
  stops.forEach((delay, i) => setTimeout(() => {
    reels[i].classList.remove('spin');
    reels[i].innerHTML = slotSymbolHTML(d.reels[i]);
  }, delay));
  setTimeout(() => {
    clearInterval(tick);
    setBalance(d.balance, d.gain > 0, d.xp, d.level);
    const m = $('slotMsg');
    if (d.gain > 0) { reels.forEach(r => r.classList.add('hit')); m.className = 'msg win'; m.textContent = 'GAGNÉ +' + fmt(d.gain) + ' 🪙'; checkBigWin(bet, d.gain); }
    else { m.className = 'msg lose'; m.textContent = 'Perdu — retente !'; shakeEl($('view-slots').querySelector('.card')); }
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
  const bet = int('bjBet'); if (!bet) return toast('Mise invalide');
  $('bjDealBtn').disabled = true;
  bjCurrentBet = bet;
  let d; try { d = await api('/bj/deal', 'POST', { bet }); } catch (e) { $('bjDealBtn').disabled = false; return toast(e.message); }
  $('bjBetRow').classList.add('hidden'); $('bjActions').classList.remove('hidden'); $('bjMsg').textContent = '';
  setBalance(d.balance, undefined, d.xp, d.level); bjRender(d); $('bjDealBtn').disabled = false;
  if (d.outcome) bjFinish(d);
}
async function bjHit()   { let d; try { d = await api('/bj/hit',   'POST'); } catch (e) { return toast(e.message); } bjRender(d); if (d.outcome) bjFinish(d); }
async function bjStand() { let d; try { d = await api('/bj/stand', 'POST'); } catch (e) { return toast(e.message); } bjRender(d); bjFinish(d); }

/* ══════════════════ MINES ══════════════════════════════ */
let minesActive = false, minesCurrentBet = 0;
const MINE_GEM  = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 3h12l4 6-10 12L2 9z"/><path d="M6 3 4 9h16l-2-6zM2 9h20" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1"/></svg>';
const MINE_BOMB = '<svg viewBox="0 0 24 24"><circle cx="11" cy="14.5" r="7" fill="currentColor"/><path d="M16.5 6.5 19 4m0 0h-2.6M19 4v2.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="8.5" cy="12" r="1.6" fill="#fff" opacity=".4"/></svg>';
function buildMinesGrid() { const g = $('minesGrid'); if (!g) return; g.innerHTML = ''; for (let i = 0; i < 25; i++) { const c = document.createElement('div'); c.className = 'cell'; c.dataset.i = i; c.onclick = () => minesPick(i); g.appendChild(c); } }
function minesCell(i) { return document.querySelector('.cell[data-i="' + i + '"]'); }
function revealBombs(bombs) { bombs.forEach(j => { const c = minesCell(j); if (c && !c.classList.contains('gem')) { c.classList.add('bomb','done'); c.innerHTML = MINE_BOMB; } }); }

async function minesStartGame() {
  const bet = int('minesBet'); if (!bet) return toast('Mise invalide');
  const bombs = +$('minesCount').value;
  let d; try { d = await api('/mines/start', 'POST', { bet, bombs }); } catch (e) { return toast(e.message); }
  buildMinesGrid(); minesActive = true; minesCurrentBet = bet;
  $('minesStart').classList.add('hidden'); $('minesCash').classList.remove('hidden'); $('minesMsg').textContent = '';
  $('minesMult').textContent = '1.00×'; $('minesPot').textContent = '0'; $('minesGems').textContent = '0';
  setBalance(d.balance, undefined, d.xp, d.level);
}
async function minesPick(i) {
  if (!minesActive) return;
  const cell = minesCell(i); if (cell.classList.contains('done')) return;
  let d; try { d = await api('/mines/pick', 'POST', { i }); } catch (e) { return toast(e.message); }
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
  let d; try { d = await api('/mines/cashout', 'POST'); } catch (e) { return toast(e.message); }
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
  low:  [3.44,1.84,1.38,1.15,0.80,0.57,0.46,0.57,0.80,1.15,1.38,1.84,3.44],
  med:  [14.21,5.33,2.66,1.42,0.71,0.44,0.36,0.44,0.71,1.42,2.66,5.33,14.21],
  high: [66.34,15.92,5.31,1.33,0.53,0.27,0.13,0.27,0.53,1.33,5.31,15.92,66.34],
};
let pkBall = null, pkAnim = null, pkHighlight = -1, PK_DPR = 1, pkTrail = [];
let PK_W = 440, PK_H = 360;
function initPlinkoCanvas() {
  if (!PK) return;
  PK_DPR = window.devicePixelRatio || 1;
  const board = PK.closest('.game-board');
  let availW, availH;
  if (board && board.clientHeight > 40) { availW = board.clientWidth; availH = board.clientHeight; }
  else { availW = (PK.parentElement?.clientWidth || 440); availH = Math.round(window.innerHeight * 0.6); }
  let w = Math.max(240, Math.min(availW, 700));
  let h = Math.round(w * 0.8);
  if (h > availH) { h = availH; w = Math.min(w, availW, Math.round(h / 0.8)); }
  PK_W = w; PK_H = h;
  PK.style.width  = PK_W + 'px';
  PK.style.height = PK_H + 'px';
  PK.width  = Math.round(PK_W * PK_DPR);
  PK.height = Math.round(PK_H * PK_DPR);
  PCX.setTransform(PK_DPR, 0, 0, PK_DPR, 0, 0);
}
function pkColors() { const c = getComputedStyle(document.documentElement); return { gold: c.getPropertyValue('--gold').trim(), dim: c.getPropertyValue('--dim').trim() }; }
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
  if (m >= 1.5) return ['rgba(201,168,76,.85)', 'rgba(140,110,30,.8)'];
  if (m >= 0.9) return ['rgba(124,58,237,.7)',  'rgba(70,30,150,.7)'];
  return ['rgba(60,55,90,.7)', 'rgba(35,30,55,.7)'];
}
function drawPlinko() {
  if (!PK || !PCX) return;
  const g = pkGeom(), c = pkColors(), mult = PK_MULT[$('plinkoRisk').value || 'med'];
  const pegR  = Math.max(1.8, g.spacing * 0.085);
  const ballR = Math.max(4.5, g.spacing * 0.22);
  PCX.clearRect(0, 0, g.w, g.h);
  for (let l = 1; l <= PK_ROWS; l++) for (let s = 0; s <= l; s++) {
    const x = g.cx + (2*s-l)*g.spacing/2, y = g.topY + (l/PK_ROWS)*(g.binY - g.topY - g.spacing*0.4);
    PCX.beginPath(); PCX.fillStyle = 'rgba(212,180,90,.85)'; PCX.shadowColor = 'rgba(201,168,76,.5)'; PCX.shadowBlur = 3;
    PCX.arc(x, y, pegR, 0, 7); PCX.fill(); PCX.shadowBlur = 0;
  }
  const bw = g.spacing, fs = Math.min(13, Math.max(8, g.spacing * 0.34));
  for (let b = 0; b <= PK_ROWS; b++) {
    const x = g.cx + (2*b-PK_ROWS)*g.spacing/2, m = mult[b], on = b === pkHighlight;
    const [c1, c2] = pkBinColor(m);
    const grad = PCX.createLinearGradient(0, g.binY, 0, g.binY + g.binH);
    if (on) { grad.addColorStop(0, '#ffe9a8'); grad.addColorStop(1, c.gold); }
    else    { grad.addColorStop(0, c1); grad.addColorStop(1, c2); }
    PCX.fillStyle = grad;
    PCX.strokeStyle = 'rgba(0,0,0,.25)'; PCX.lineWidth = 1;
    roundRect(x - bw/2 + 1.5, g.binY, bw - 3, g.binH, Math.min(7, bw*0.18)); PCX.fill(); PCX.stroke();
    PCX.fillStyle = on ? '#1a1206' : '#fff'; PCX.font = '700 ' + fs + 'px Inter, system-ui, sans-serif';
    PCX.textAlign = 'center'; PCX.textBaseline = 'middle';
    PCX.fillText(m + '×', x, g.binY + g.binH/2);
  }
  for (let i = 0; i < pkTrail.length; i++) {
    const t = pkTrail[i], a = (i + 1) / pkTrail.length;
    PCX.beginPath(); PCX.fillStyle = 'rgba(245,224,138,' + (a * 0.35) + ')';
    PCX.arc(t.x, t.y, ballR * a * 0.8, 0, 7); PCX.fill();
  }
  if (pkBall) {
    PCX.beginPath(); PCX.fillStyle = '#fff6d8'; PCX.shadowColor = c.gold; PCX.shadowBlur = 20;
    PCX.arc(pkBall.x, pkBall.y, ballR, 0, 7); PCX.fill();
    PCX.fillStyle = c.gold; PCX.beginPath(); PCX.arc(pkBall.x, pkBall.y, ballR*0.6, 0, 7); PCX.fill();
    PCX.shadowBlur = 0;
  }
}
function shuffleArr(a) { for (let i = a.length-1; i > 0; i--) { const j = Math.random()*(i+1)|0; [a[i],a[j]]=[a[j],a[i]]; } return a; }
async function plinkoDrop() {
  if (pkAnim) return;
  const bet = int('plinkoBet'); if (!bet) return toast('Mise invalide');
  const risk = $('plinkoRisk').value;
  let d; try { d = await api('/play/plinko', 'POST', { bet, risk }); } catch (e) { return toast(e.message); }
  $('plinkoMsg').textContent = ''; pkHighlight = -1;
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
      setBalance(d.balance, d.gain >= bet, d.xp, d.level);
      const m = $('plinkoMsg');
      if (d.gain >= bet) { m.className = 'msg win'; m.textContent = d.mult + '× → +' + fmt(d.gain) + ' 🪙'; checkBigWin(bet, d.gain); }
      else { m.className = 'msg lose'; m.textContent = d.mult + '× → ' + fmt(d.gain) + ' 🪙 (perte)'; }
    }
  }
  pkAnim = requestAnimationFrame(frame);
}

/* ══════════════════ WHEEL ═══════════════════════════════ */
/* défaut écrasé par /api/config (source de vérité = games.ts) */
let WHEEL = [0, 1.5, 0, 2, 0, 1.5, 0, 5, 0, 1.5, 0, 2, 0, 1.5, 0, 15];
let wheelBuilt = false, wheelSpinning = false, wheelRot = 0;
function wheelColor(m) { return m===0?'#1c1430':m>=50?'#ffd24d':m>=10?'#ff2e88':m>=5?'#d6209e':m>=3?'#7b2ff7':m>=2?'#23e0d6':'#2a8fa0'; }
function buildWheel() {
  if (wheelBuilt) return;
  const g = $('wheelG'), cx = 160, cy = 160, r = 150, n = WHEEL.length, seg = 360/n; let html = '';
  for (let i = 0; i < n; i++) {
    const a0 = i*seg*Math.PI/180, a1 = (i+1)*seg*Math.PI/180;
    const x0 = cx+r*Math.sin(a0), y0 = cy-r*Math.cos(a0), x1 = cx+r*Math.sin(a1), y1 = cy-r*Math.cos(a1);
    html += '<path d="M'+cx+' '+cy+' L'+x0.toFixed(2)+' '+y0.toFixed(2)+' A'+r+' '+r+' 0 0 1 '+x1.toFixed(2)+' '+y1.toFixed(2)+' Z" fill="'+wheelColor(WHEEL[i])+'" stroke="rgba(0,0,0,.4)" stroke-width="1"/>';
    const am = i*seg+seg/2, rad = am*Math.PI/180, lx = cx+106*Math.sin(rad), ly = cy-106*Math.cos(rad);
    html += '<text x="'+lx.toFixed(1)+'" y="'+ly.toFixed(1)+'" fill="#fff" font-family="Inter, system-ui, sans-serif" font-size="17" text-anchor="middle" dominant-baseline="middle" transform="rotate('+am.toFixed(1)+' '+lx.toFixed(1)+' '+ly.toFixed(1)+')">'+(WHEEL[i]===0?'✕':WHEEL[i]+'×')+'</text>';
  }
  html += '<circle cx="160" cy="160" r="150" fill="none" stroke="rgba(255,201,77,.55)" stroke-width="3"/>';
  g.innerHTML = html; wheelBuilt = true; g.style.transform = 'rotate(0deg)';
}
async function wheelSpin() {
  if (wheelSpinning) return; buildWheel();
  const bet = int('wBet'); if (!bet) return toast('Mise invalide');
  let d; try { d = await api('/play/wheel', 'POST', { bet }); } catch (e) { return toast(e.message); }
  wheelSpinning = true; $('wBtn').disabled = true; $('wMsg').textContent = '';
  const seg = 360/WHEEL.length, mid = d.index*seg+seg/2, jitter = (Math.random()-.5)*(seg*.6);
  const base = Math.ceil(wheelRot/360)*360; wheelRot = base+360*6-mid+jitter;
  $('wheelG').style.transform = 'rotate('+wheelRot+'deg)';
  setTimeout(() => {
    wheelSpinning = false; $('wBtn').disabled = false;
    setBalance(d.balance, d.gain > 0, d.xp, d.level);
    const m = d.mult, msg = $('wMsg'), wrap = document.querySelector('.wheel-wrap');
    if (m >= 15) {
      msg.className = 'msg win'; msg.textContent = '💰 JACKPOT '+m+'× → +'+fmt(d.gain)+' 🪙 !';
      if (wrap) { wrap.classList.add('jackpot-flash'); setTimeout(() => wrap.classList.remove('jackpot-flash'), 2400); }
      checkBigWin(bet, d.gain);
    } else if (m > 0) { msg.className = 'msg win'; msg.textContent = m+'× → +'+fmt(d.gain)+' 🪙'; checkBigWin(bet, d.gain); }
    else              { msg.className = 'msg lose'; msg.textContent = '0× → mise perdue'; }
  }, 4700);
}

/* ══════════════════ DICE ═══════════════════════════════ */
let diceRolling = false;
function diceUpdate() {
  const c = Math.max(2, Math.min(95, +$('diceSlider').value));
  $('diceChanceLbl').textContent = c+'%'; $('diceTargetLbl').textContent = c.toFixed(2);
  const eff = (100/c)*GAME_RTP;
  $('diceMult').textContent = eff.toFixed(2)+'×';
  const bet = Math.floor(+$('diceBet').value)||0; $('dicePot').textContent = fmt(bet*eff);
  document.documentElement.style.setProperty('--win', c+'%'); $('diceMarker').style.left = c+'%';
}
async function diceRoll() {
  if (diceRolling) return;
  const bet = int('diceBet'); if (!bet) return toast('Mise invalide');
  const chance = Math.max(2, Math.min(95, +$('diceSlider').value));
  let d; try { d = await api('/play/dice', 'POST', { bet, chance }); } catch (e) { return toast(e.message); }
  diceRolling = true; $('diceBtn').disabled = true; $('diceMsg').textContent = '';
  const dot = $('diceDot'), res = $('diceResult'); res.className = 'dice-result'; res.textContent = '…'; dot.style.left = d.roll.toFixed(2)+'%';
  setTimeout(() => {
    diceRolling = false; $('diceBtn').disabled = false;
    res.textContent = d.roll.toFixed(2); res.className = 'dice-result '+(d.win?'win':'lose');
    setBalance(d.balance, d.win, d.xp, d.level);
    const msg = $('diceMsg');
    if (d.win) { msg.className = 'msg win'; msg.textContent = '🎲 '+d.roll.toFixed(2)+' < '+chance+' · GAGNÉ +'+fmt(d.gain)+' 🪙'; checkBigWin(bet, d.gain); }
    else       { msg.className = 'msg lose'; msg.textContent = '🎲 '+d.roll.toFixed(2)+' ≥ '+chance+' · Perdu'; }
  }, 850);
}

/* ══════════════════ BOOT ══════════════════════════════ */
(async () => {
  const u = await requireAuth();        // redirige vers / si non connecté
  if (!u) return;
  if (u.admin) { location.href = '/admin'; return; }
  if (typeof lucide !== 'undefined') lucide.createIcons();
  refreshBal(); updateXP(u.xp || 0, u.level || 1);
  buildMinesGrid(); initSlots();
  try { const cfg = await api('/config'); GAME_RTP = cfg.rtp ?? 0.70;
        if (cfg.plinko) PK_MULT = cfg.plinko; if (cfg.wheel) WHEEL = cfg.wheel; } catch (e) {}
  switchTab('home');

  initAnimations();
  const riskSel = $('plinkoRisk'); if (riskSel) riskSel.addEventListener('change', () => drawPlinko());
  let _pkResizeT;
  window.addEventListener('resize', () => {
    clearTimeout(_pkResizeT);
    _pkResizeT = setTimeout(() => {
      if (!pkAnim && $('view-plinko') && $('view-plinko').classList.contains('active')) { initPlinkoCanvas(); drawPlinko(); }
    }, 150);
  });
})();
