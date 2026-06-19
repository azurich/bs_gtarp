# BlackState — Visual Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Réécrire style.css intégralement + mettre à jour index.html et app.js pour implémenter l'identité visuelle BlackState (dark luxury, Cormorant Garamond, cinématique).

**Architecture:** Réécriture complète de style.css en partant des tokens du design system. Modifications ciblées d'index.html (polices, data-delay, structure login). Ajout de fonctions d'animation dans app.js sans toucher à la logique existante.

**Tech Stack:** CSS vanilla, HTML5, JS vanilla ES2022, Lucide 0.468 (déjà en place)

## Global Constraints

- Tous les IDs et classes utilisés par app.js DOIVENT être préservés (`.view`, `.nav-item`, `.hidden`, `.msg`, `.reel`, `.cell`, `.pcard`, etc.)
- Aucun framework JS — animations en CSS + vanilla JS minimal
- Lucide est servi localement via `/lucide.min.js` (déjà en place)
- Bun server sur port 3000 — vérifier avec `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/`
- Polices Google Fonts : Cormorant Garamond + Inter (remplace Bebas Neue)
- Couleur primaire : `--v-700: #5b21b6` (violet profond), or vieux : `--gold: #c9a84c`
- Test visuel : ouvrir `http://localhost:3000` dans le navigateur après chaque tâche

---

### Task 1: Design tokens + Google Fonts

**Files:**
- Modify: `public/index.html` (head — lien Google Fonts)
- Modify: `public/style.css` (bloc `:root` complet)

**Interfaces:**
- Produit: Toutes les variables CSS du design system, disponibles globalement
- Consommé par: Toutes les tâches suivantes

- [ ] **Step 1: Remplacer le lien Google Fonts dans index.html**

Remplacer la ligne existante `<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue...">` par :

```html
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Réécrire le bloc `:root` dans style.css**

Remplacer l'intégralité du bloc `:root{...}` existant par :

```css
:root{
  /* ── Fonds ── */
  --bg:        #05050c;
  --surface-1: #0c0a1a;
  --surface-2: #12103a;

  /* ── Bordures ── */
  --bdr:        rgba(255,255,255,.06);
  --bdr-med:    rgba(255,255,255,.10);
  --bdr-accent: rgba(91,33,182,.25);

  /* ── Violet (profond, retenu) ── */
  --v-900: #2e1065;
  --v-700: #5b21b6;
  --v-500: #7c3aed;
  --v-300: #a78bfa;
  --v-dim: rgba(91,33,182,.10);
  --v-glow:rgba(91,33,182,.30);

  /* ── Or vieux ── */
  --gold:     #c9a84c;
  --gold-dim: rgba(201,168,76,.15);

  /* ── Sémantique ── */
  --green:     #10b981;
  --green-dim: rgba(16,185,129,.12);
  --red:       #f43f5e;
  --red-dim:   rgba(244,63,94,.12);

  /* ── Texte ── */
  --tx:  #f5f0ff;
  --tx-2:rgba(245,240,255,.50);
  --tx-3:rgba(245,240,255,.28);
  --tx-4:rgba(245,240,255,.14);

  /* ── Legacy compat (utilisé dans app.js inline styles) ── */
  --txt:   var(--tx);
  --dim:   var(--tx-3);
  --panel: var(--surface-1);
  --panel-solid: var(--surface-1);
  --line:  var(--bdr);
  --line2: var(--bdr-med);
  --violet:var(--v-500);
  --v-lt:  var(--v-300);
  --v-xs:  var(--v-300);
  --v-dk:  var(--v-700);
  --cyan:  var(--v-300);
  --magenta: var(--v-700);

  /* ── Radius ── */
  --r1:4px; --r2:8px; --r3:12px; --r4:20px;
  /* legacy */
  --radius-sm:var(--r2); --radius-md:var(--r3); --radius-lg:var(--r4);

  /* ── Ombres ── */
  --shadow-sm:0 2px 8px rgba(5,5,12,.6);
  --shadow-md:0 8px 24px rgba(5,5,12,.7),0 0 0 1px rgba(91,33,182,.08);
  --shadow-lg:0 20px 48px rgba(5,5,12,.8),0 0 0 1px rgba(91,33,182,.10);
  --shadow-v: 0 8px 32px rgba(91,33,182,.25);

  /* ── Animations ── */
  --ease-out: cubic-bezier(.16,1,.3,1);
  --ease-back:cubic-bezier(.34,1.56,.64,1);
  --ease-in:  cubic-bezier(.4,0,1,1);
  --dur-fast: 180ms;
  --dur-med:  320ms;
  --dur-slow: 500ms;
  --dur-enter:600ms;
  --stagger:  80ms;

  /* ── Typographie ── */
  --display:'Cormorant Garamond',Georgia,serif;
  --body:'Inter',system-ui,sans-serif;
}
```

- [ ] **Step 3: Vérifier que les variables legacy ne cassent rien**

```bash
curl -s http://localhost:3000/style.css | grep -c "\-\-txt:\|\-\-dim:\|\-\-panel:"
```
Attendu : au moins 3 (les aliases legacy sont présents).

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\info\Documents\DEV\Casino_Online_GTARP"
git -c user.email="contact.quentin.baudry@gmail.com" -c user.name="Quentin" add public/index.html public/style.css
git -c user.email="contact.quentin.baudry@gmail.com" -c user.name="Quentin" commit -m "feat(design): design system tokens + Cormorant Garamond"
```

---

### Task 2: Base styles, background, scrollbar, système d'animations

**Files:**
- Modify: `public/style.css` (sections RESET, body, scrollbar, keyframes, classes .anim-*)

**Interfaces:**
- Produit: Classes `.anim-up`, `.anim-scale`, `.anim-left`, `.anim-fade`, keyframes, background atmosphérique
- Consommé par: Tasks 3–12 (toutes les pages utilisent les classes d'animation)

- [ ] **Step 1: Réécrire la section RESET & BASE dans style.css**

Remplacer `/* ── RESET & BASE */` jusqu'au `.scan{...}` par :

```css
/* ── RESET & BASE ───────────────────────────────────────── */
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%}
body{
  font-family:var(--body);color:var(--tx);min-height:100vh;overflow-x:hidden;
  font-size:14px;line-height:1.5;
  background:
    radial-gradient(ellipse 80% 50% at 20% 0%,rgba(46,16,101,.35),transparent 60%),
    radial-gradient(ellipse 60% 40% at 80% 100%,rgba(91,33,182,.12),transparent 55%),
    #05050c;
  background-attachment:fixed;
}
body::before{
  content:"";position:fixed;inset:0;z-index:0;pointer-events:none;
  background:repeating-linear-gradient(0deg,transparent 0 2px,rgba(91,33,182,.018) 2px 3px);
  mask:linear-gradient(180deg,transparent 40%,#000 100%);
}

/* Scrollbar */
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:rgba(91,33,182,.4);border-radius:4px}
::-webkit-scrollbar-thumb:hover{background:rgba(91,33,182,.7)}

.scan{position:fixed;inset:0;z-index:1;pointer-events:none;opacity:.015;
  background:repeating-linear-gradient(0deg,#fff 0 1px,transparent 1px 3px);}
.app{position:relative;z-index:2;display:flex;flex-direction:column;min-height:100vh}
.hidden{display:none!important}
```

- [ ] **Step 2: Ajouter la section TYPOGRAPHIE après le reset**

```css
/* ── TYPOGRAPHY ─────────────────────────────────────────── */
h1,h2,h3,.bignum{font-family:var(--display);letter-spacing:-0.02em}
.logo{
  font-family:var(--display);font-size:1.6rem;letter-spacing:.05em;
  color:var(--tx);line-height:1;user-select:none;font-weight:600;
}
.logo span{color:var(--v-500)}
```

- [ ] **Step 3: Ajouter la section ANIMATIONS après la typographie**

```css
/* ══════════════════════════════════════════════════════════
   ANIMATIONS — système unifié
══════════════════════════════════════════════════════════ */
@keyframes animUp{
  from{opacity:0;transform:translateY(18px)}
  to{opacity:1;transform:translateY(0)}
}
@keyframes animScale{
  from{opacity:0;transform:scale(.94)}
  to{opacity:1;transform:scale(1)}
}
@keyframes animLeft{
  from{opacity:0;transform:translateX(-20px)}
  to{opacity:1;transform:translateX(0)}
}
@keyframes animFade{
  from{opacity:0}to{opacity:1}
}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes shakeX{
  0%,100%{transform:translateX(0)}
  20%,60%{transform:translateX(-6px)}
  40%,80%{transform:translateX(6px)}
}
@keyframes pulseGold{
  0%,100%{box-shadow:0 0 0 0 rgba(201,168,76,.4)}
  50%{box-shadow:0 0 0 8px rgba(201,168,76,0)}
}
@keyframes countBounce{
  0%{transform:scale(1)}
  50%{transform:scale(1.08)}
  100%{transform:scale(1)}
}
@keyframes overlayIn{from{opacity:0}to{opacity:1}}
@keyframes modalIn{
  from{opacity:0;transform:scale(.93) translateY(-10px)}
  to{opacity:1;transform:none}
}
@keyframes winpop{
  from{transform:scale(.3);opacity:0}
  to{transform:scale(1);opacity:1}
}
@keyframes jackpotPulse{
  0%,100%{filter:drop-shadow(0 8px 28px rgba(0,0,0,.6))}
  50%{filter:drop-shadow(0 0 60px rgba(201,168,76,.9))}
}
@keyframes loginHalo{
  0%{transform:rotate(0deg) scale(1)}
  50%{transform:rotate(180deg) scale(1.1)}
  100%{transform:rotate(360deg) scale(1)}
}

/* Classes réutilisables */
.anim-up   {animation:animUp    var(--dur-med) var(--ease-out) both}
.anim-scale{animation:animScale var(--dur-med) var(--ease-back) both}
.anim-left {animation:animLeft  var(--dur-med) var(--ease-out) both}
.anim-fade {animation:animFade  var(--dur-med) var(--ease-out) both}
.shake-x   {animation:shakeX .45s var(--ease-out)}
```

- [ ] **Step 4: Commit**

```bash
git -c user.email="contact.quentin.baudry@gmail.com" -c user.name="Quentin" add public/style.css
git -c user.email="contact.quentin.baudry@gmail.com" -c user.name="Quentin" commit -m "feat(design): base styles, background atmosphérique, système d'animations"
```

---

### Task 3: Page de login — "Entrée dans le club"

**Files:**
- Modify: `public/index.html` (structure du bloc `#authView`)
- Modify: `public/style.css` (section AUTH)

**Interfaces:**
- Consomme: Tokens Task 1, classes .anim-* Task 2
- Produit: Page login cinématique avec cascade 5 temps, inputs underline, halo animé

- [ ] **Step 1: Restructurer le HTML du bloc `#authView`**

Remplacer le contenu de `<div id="authView" class="auth-wrap">` par :

```html
    <div id="authView" class="auth-wrap">
      <!-- Halo rotatif -->
      <div class="auth-halo"></div>

      <div class="auth-center">
        <!-- Logo -->
        <div class="auth-logo anim-up" data-delay="0">
          Black<span>State</span>
        </div>
        <!-- Sous-titre -->
        <div class="auth-subtitle anim-up" data-delay="1">Casino Privé &middot; Los Santos</div>
        <!-- Séparateur -->
        <div class="auth-sep anim-fade" data-delay="2"></div>

        <!-- Login -->
        <div id="loginForm" class="auth-form anim-up" data-delay="3">
          <div class="field"><label>Pseudo</label><input id="loginUser" type="text" placeholder="Votre pseudo" autocomplete="username"></div>
          <div class="field"><label>Mot de passe</label><input id="loginPass" type="password" placeholder="••••••••" autocomplete="current-password"></div>
          <div id="loginErr" class="err"></div>
          <button class="btn" onclick="doLogin()">Se connecter</button>
        </div>

        <!-- Register -->
        <div id="registerForm" class="auth-form anim-up hidden" data-delay="3">
          <div id="inviteBanner" class="invite-banner hidden">
            <i data-lucide="ticket" class="ic-sm"></i> Invitation · <span id="inviteCredits">1 000</span> crédits
          </div>
          <div class="field"><label>Pseudo</label><input id="regUser" type="text" placeholder="Choisir un pseudo" autocomplete="username"></div>
          <div class="field"><label>Mot de passe</label><input id="regPass" type="password" placeholder="••••••••" autocomplete="new-password"></div>
          <div id="regErr" class="err"></div>
          <button class="btn" onclick="doRegister()">Créer mon compte</button>
          <div class="auth-back-line"><a onclick="showLogin()">← Déjà un compte ?</a></div>
        </div>
      </div>
    </div>
```

- [ ] **Step 2: Réécrire la section AUTH dans style.css**

Remplacer toute la section `/* AUTH */` existante par :

```css
/* ══════════════════════════════════════════════════════════
   AUTH — Entrée dans le club
══════════════════════════════════════════════════════════ */
.auth-wrap{
  flex:1;display:flex;align-items:center;justify-content:center;
  min-height:100vh;padding:40px 24px;position:relative;overflow:hidden;
}

/* Halo violet rotatif en arrière-plan */
.auth-halo{
  position:absolute;width:700px;height:700px;top:-200px;left:-200px;
  background:radial-gradient(ellipse at 40% 40%,rgba(46,16,101,.55) 0%,transparent 65%);
  animation:loginHalo 60s linear infinite;
  pointer-events:none;z-index:0;
}

.auth-center{
  position:relative;z-index:1;
  width:100%;max-width:360px;
  display:flex;flex-direction:column;align-items:center;
  gap:0;
}

/* Logo */
.auth-logo{
  font-family:var(--display);font-size:clamp(3rem,8vw,4.5rem);
  font-weight:600;letter-spacing:.05em;
  color:var(--tx);text-align:center;line-height:1;
  margin-bottom:.2em;
}
.auth-logo span{color:var(--v-500)}

/* Sous-titre */
.auth-subtitle{
  font-family:var(--display);font-style:italic;font-weight:400;
  font-size:.85rem;letter-spacing:.3em;text-transform:uppercase;
  color:var(--tx-3);text-align:center;margin-bottom:2rem;
}

/* Séparateur */
.auth-sep{
  width:200px;height:1px;margin-bottom:2.5rem;
  background:linear-gradient(90deg,transparent,rgba(91,33,182,.5),transparent);
}

/* Form */
.auth-form{width:100%}

/* Champs — underline only */
.field{margin-bottom:1.25rem}
.field label{
  display:block;font-size:.7rem;font-weight:600;
  text-transform:uppercase;letter-spacing:.1em;
  color:var(--tx-3);margin-bottom:.5rem;
  font-family:var(--body);
}
.field input,.field select{
  width:100%;padding:.65rem 0;
  background:transparent;border:none;
  border-bottom:1px solid var(--bdr-med);
  color:var(--tx);font-family:var(--body);font-size:.95rem;font-weight:500;
  outline:none;transition:border-color var(--dur-fast) ease, box-shadow var(--dur-fast) ease;
}
.field input:focus,.field select:focus{
  border-bottom-color:var(--v-500);
  box-shadow:0 2px 0 var(--v-500);
}
.field input::placeholder{color:var(--tx-4)}
/* Select style normal pour les jeux */
.field select{
  border:1px solid var(--bdr-med);border-radius:var(--r2);
  padding:.65rem .75rem;background:rgba(0,0,0,.3);
}
.field select:focus{border-color:var(--v-500);box-shadow:0 0 0 3px var(--v-dim)}

.err{color:var(--red);font-size:.8rem;text-align:center;min-height:1.2rem;margin:.4rem 0;font-weight:600}

/* Bouton CTA login */
.auth-form .btn{
  font-family:var(--display);font-size:1.05rem;letter-spacing:.15em;
  margin-top:1.5rem;
}
.auth-form .btn:last-of-type{animation:pulseGold 2s ease 1.4s 1}

.auth-back-line{text-align:center;margin-top:1.2rem;color:var(--tx-3);font-size:.82rem}
.auth-back-line a{color:var(--v-300);cursor:pointer;font-weight:500}
.auth-back-line a:hover{color:var(--tx)}

/* Banner invitation */
.invite-banner{
  display:flex;align-items:center;gap:.5rem;justify-content:center;
  font-family:var(--display);font-style:italic;font-size:.95rem;
  color:var(--gold);letter-spacing:.05em;
  margin-bottom:1.2rem;padding:.6rem 1rem;
  border:1px solid var(--gold-dim);border-radius:var(--r2);
  background:var(--gold-dim);
}
```

- [ ] **Step 3: Tester visuellement**

Ouvrir `http://localhost:3000` — doit montrer :
- Fond noir avec halo violet en haut à gauche qui tourne lentement
- "BlackState" en Cormorant Garamond large, centré
- Sous-titre en italic small-caps espacé
- Ligne séparatrice
- Deux champs avec seulement une bordure inférieure
- Bouton violet pleine largeur

- [ ] **Step 4: Commit**

```bash
git -c user.email="contact.quentin.baudry@gmail.com" -c user.name="Quentin" add public/index.html public/style.css
git -c user.email="contact.quentin.baudry@gmail.com" -c user.name="Quentin" commit -m "feat(login): page cinématique dark luxury + inputs underline"
```

---

### Task 4: Topbar

**Files:**
- Modify: `public/style.css` (section TOPBAR)

**Interfaces:**
- Consomme: Tokens Task 1
- Produit: Topbar avec logo Cormorant, solde en or, XP bar fine

- [ ] **Step 1: Réécrire la section TOPBAR dans style.css**

Remplacer l'intégralité de la section `/* TOPBAR */` par :

```css
/* ══════════════════════════════════════════════════════════
   TOPBAR
══════════════════════════════════════════════════════════ */
.topbar{
  display:flex;align-items:center;
  padding:0 20px;height:52px;flex-shrink:0;
  border-bottom:1px solid rgba(91,33,182,.12);
  background:rgba(5,5,12,.92);
  backdrop-filter:blur(20px);
  position:sticky;top:0;z-index:30;gap:14px;
}
.tb-left{display:flex;align-items:center;flex:none}
.tb-right{display:flex;align-items:center;gap:12px;margin-left:auto;flex-wrap:wrap}
.topbar .logo{font-size:1.5rem;letter-spacing:.05em}
.who{font-size:.78rem;color:var(--tx-3);white-space:nowrap;font-family:var(--body)}
.who b{color:var(--tx);font-weight:500}
.balance{
  display:flex;align-items:center;gap:.6rem;
  background:rgba(201,168,76,.07);border:1px solid rgba(201,168,76,.2);
  padding:.35rem .85rem;border-radius:var(--r4);transition:all var(--dur-fast) ease;
}
.balance.flash-win{box-shadow:0 0 20px rgba(16,185,129,.4);border-color:var(--green)}
.balance.flash-lose{box-shadow:0 0 20px rgba(244,63,94,.3);border-color:var(--red)}
.balance .coin{
  width:14px;height:14px;border-radius:50%;flex:none;
  background:radial-gradient(circle at 35% 30%,#f5e090,var(--gold) 60%,#8a6a1a);
  box-shadow:0 0 6px rgba(201,168,76,.5);
}
.balance .bignum{
  font-family:var(--display);font-size:1.25rem;color:var(--gold);
  letter-spacing:.02em;font-weight:700;
}
.adminbadge{
  background:var(--v-700);color:#fff;font-size:.65rem;
  padding:2px 7px;border-radius:var(--r4);font-weight:700;
  letter-spacing:.08em;text-transform:uppercase;font-family:var(--body);
}

/* XP topbar */
.xp-topbar{display:flex;align-items:center;gap:.6rem;flex:none}
.xp-lvl-badge{
  font-family:var(--body);font-size:.75rem;color:var(--tx-3);white-space:nowrap;
}
.xp-lvl-badge b{color:var(--v-300);font-size:.85rem;font-weight:700}
.xp-track{
  width:60px;height:3px;border-radius:2px;
  background:rgba(255,255,255,.08);overflow:hidden;flex:none;
}
.xp-fill{
  height:100%;border-radius:2px;
  background:linear-gradient(90deg,var(--v-700),var(--v-300));
  transition:width .8s var(--ease-out);width:0%;
}
```

- [ ] **Step 2: Vérifier visuellement**

Après login : la topbar doit montrer `"BlackState"` en Cormorant, le solde dans un badge doré discret, la barre XP fine en violet.

- [ ] **Step 3: Commit**

```bash
git -c user.email="contact.quentin.baudry@gmail.com" -c user.name="Quentin" add public/style.css
git -c user.email="contact.quentin.baudry@gmail.com" -c user.name="Quentin" commit -m "feat(topbar): Cormorant logo, solde or, XP bar fine"
```

---

### Task 5: Sidebar redesign (palette dark luxury)

**Files:**
- Modify: `public/style.css` (section SIDEBAR)

**Interfaces:**
- Consomme: Tokens Task 1, Cormorant Task 1
- Produit: Sidebar avec labels en Cormorant small-caps, palette `--v-700`, left accent bar

- [ ] **Step 1: Réécrire la section SIDEBAR dans style.css**

Remplacer l'intégralité de la section `/* SIDEBAR — BlackState × shadcn */` par :

```css
/* ══════════════════════════════════════════════════════════
   SIDEBAR — Dark luxury × shadcn
══════════════════════════════════════════════════════════ */
.sidebar{
  width:220px;flex:none;
  background:linear-gradient(180deg,#0a0818 0%,#06050f 100%);
  border-right:1px solid rgba(91,33,182,.12);
  display:flex;flex-direction:column;
  padding:10px 8px;overflow-y:auto;overflow-x:hidden;
  position:relative;
}
.sidebar::before{
  content:'';pointer-events:none;position:absolute;
  top:0;left:0;right:0;height:160px;
  background:radial-gradient(ellipse 140% 80% at 50% -20%,rgba(46,16,101,.3),transparent 70%);
}

.nav-section{display:flex;flex-direction:column;gap:2px}
.nav-section-label{
  font-family:var(--display);font-style:italic;font-weight:500;
  font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;
  color:rgba(167,139,250,.45);padding:10px 12px 4px;
}
.nav-divider{
  height:1px;margin:5px 4px;flex:none;
  background:linear-gradient(90deg,transparent,rgba(91,33,182,.25),transparent);
}
.nav-spacer{flex:1;min-height:8px}

/* Items */
.nav-item{
  display:flex;align-items:center;gap:9px;
  padding:7px 10px;border-radius:var(--r2);
  background:none;border:none;
  width:100%;text-align:left;
  font-family:var(--body);font-size:.84rem;font-weight:500;letter-spacing:0;
  color:var(--tx-3);
  cursor:pointer;user-select:none;position:relative;
  transition:color var(--dur-fast) ease, background-color var(--dur-fast) ease;
}
.nav-item:hover{color:rgba(245,240,255,.82);background:rgba(91,33,182,.1)}
.nav-item.active{color:var(--v-300);background:rgba(91,33,182,.14)}
.nav-item.active::before{
  content:'';position:absolute;left:0;top:50%;
  transform:translateY(-50%);
  width:2px;height:18px;
  background:linear-gradient(180deg,var(--v-300),var(--v-700));
  border-radius:0 2px 2px 0;
  box-shadow:0 0 8px var(--v-glow);
}
.nav-item:focus{outline:none}
.nav-item:focus-visible{outline:2px solid rgba(91,33,182,.6);outline-offset:-2px}
.nav-item.active .ni svg.lucide{color:var(--v-300);filter:drop-shadow(0 0 4px rgba(167,139,250,.5))}

.ni{width:17px;height:17px;flex:none;display:flex;align-items:center;justify-content:center;color:inherit}

/* Badge bonus */
.nav-badge{
  margin-left:auto;flex:none;
  background:var(--gold);color:#1a0f00;
  font-size:.6rem;font-weight:800;line-height:1;
  width:15px;height:15px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  box-shadow:0 0 8px rgba(201,168,76,.45);
}
.nav-badge.hidden{display:none!important}

/* Mobile */
@media(max-width:860px){
  .sidebar{
    width:100%;flex-direction:row;height:auto;
    padding:4px 8px;gap:2px;
    overflow-x:auto;overflow-y:hidden;
    border-right:none;border-bottom:1px solid rgba(91,33,182,.15);
    background:linear-gradient(90deg,#0a0818,#06050f);
    scrollbar-width:none;
  }
  .sidebar::before{display:none}
  .sidebar::-webkit-scrollbar{display:none}
  .nav-section{flex-direction:row;gap:2px}
  .nav-section-label{display:none}
  .nav-spacer{display:none}
  .nav-divider{width:1px;height:20px;margin:0 3px;align-self:center;background:rgba(91,33,182,.3)}
  .nav-item{padding:6px 10px;gap:7px;font-size:.8rem;white-space:nowrap;border-radius:var(--r2)}
  .nav-item.active::before{
    top:auto;bottom:0;left:50%;transform:translateX(-50%);
    width:20px;height:2px;border-radius:2px 2px 0 0;box-shadow:0 0 6px var(--v-glow);
  }
  .ni{width:15px;height:15px}
  .ni svg.lucide{width:14px;height:14px}
}
@media(max-width:480px){
  .nav-item span:not(.ni){display:none}
  .nav-item{padding:8px;gap:0}
  .nav-item.active::before{display:none}
}
```

- [ ] **Step 2: Commit**

```bash
git -c user.email="contact.quentin.baudry@gmail.com" -c user.name="Quentin" add public/style.css
git -c user.email="contact.quentin.baudry@gmail.com" -c user.name="Quentin" commit -m "feat(sidebar): dark luxury palette, Cormorant labels, left accent bar"
```

---

### Task 6: Boutons et layout principal

**Files:**
- Modify: `public/style.css` (sections BUTTONS, MAIN LAYOUT, VIEWS & CARDS)

**Interfaces:**
- Consomme: Tokens Task 1, animations Task 2
- Produit: Boutons Cormorant, cards avec ombre colorisée, transitions de vues

- [ ] **Step 1: Réécrire la section BUTTONS**

```css
/* ══════════════════════════════════════════════════════════
   BUTTONS
══════════════════════════════════════════════════════════ */
.btn{
  cursor:pointer;border:none;border-radius:var(--r2);
  padding:.75rem 1.2rem;font-size:1rem;width:100%;
  font-family:var(--display);letter-spacing:.12em;font-weight:600;text-transform:uppercase;
  background:linear-gradient(135deg,var(--v-700),var(--v-900));
  color:var(--tx);border:1px solid rgba(91,33,182,.3);
  transition:transform var(--dur-fast) var(--ease-back),
             box-shadow var(--dur-fast) ease,
             background var(--dur-fast) ease,
             opacity var(--dur-fast) ease;
  box-shadow:0 4px 16px rgba(91,33,182,.25);
  position:relative;overflow:hidden;
}
.btn::after{
  content:'';position:absolute;inset:0;
  background:linear-gradient(135deg,rgba(255,255,255,.06),transparent);
  pointer-events:none;
}
.btn:hover{
  transform:translateY(-1px);
  box-shadow:0 8px 28px rgba(91,33,182,.4);
  background:linear-gradient(135deg,var(--v-500),var(--v-700));
}
.btn:active{
  transform:translateY(1px);
  box-shadow:0 2px 8px rgba(91,33,182,.2);
  transition-duration:.06s;
}
.btn:disabled{opacity:.35;cursor:not-allowed;transform:none!important;box-shadow:none!important;transition:none}
.btn:focus-visible{outline:2px solid var(--v-300);outline-offset:2px}

.btn.ghost{
  background:transparent;border:1px solid var(--bdr-med);
  box-shadow:none;color:var(--v-300);
}
.btn.ghost::after{display:none}
.btn.ghost:hover{border-color:var(--v-700);background:var(--v-dim);transform:none}
.btn.ghost:active{transform:translateY(1px);opacity:.7;transition-duration:.06s}

.btn.sm{width:auto;padding:.4rem .85rem;font-size:.78rem;margin-top:0}
.btn.sm:hover{transform:translateY(-1px)}
.btn.sm:active{transform:translateY(1px)}

.btn.gold{
  background:linear-gradient(135deg,var(--gold),#8a6a1a);
  color:#0d0a00;border-color:rgba(201,168,76,.3);
  box-shadow:0 4px 16px rgba(201,168,76,.2);
}
.btn.gold:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(201,168,76,.35)}
.btn.gold:active{transform:translateY(1px)}
.btn.gold::after{background:linear-gradient(135deg,rgba(255,255,255,.1),transparent)}
```

- [ ] **Step 2: Réécrire MAIN LAYOUT + VIEWS & CARDS**

```css
/* ══════════════════════════════════════════════════════════
   MAIN LAYOUT
══════════════════════════════════════════════════════════ */
#mainView{display:flex;flex-direction:column;height:100vh;overflow:hidden}
.main-layout{display:flex;flex:1;overflow:hidden;min-height:0}
.content-wrap{flex:1;overflow-y:auto;min-width:0;min-height:0}

/* ══════════════════════════════════════════════════════════
   VIEWS & CARDS
══════════════════════════════════════════════════════════ */
.view{display:none}
.view.active{display:block;animation:animUp var(--dur-med) var(--ease-out)}
.view-inner{padding:24px;max-width:960px;margin:0 auto}

.card{
  background:var(--surface-1);
  border:1px solid var(--bdr);
  border-radius:var(--r3);padding:24px;
  box-shadow:var(--shadow-md);
  backdrop-filter:blur(12px);
  /* Légère lueur intérieure */
  box-shadow:
    var(--shadow-md),
    0 1px 0 rgba(255,255,255,.03) inset;
}

/* Game head unifié */
.game-head{display:flex;align-items:baseline;gap:14px;margin-bottom:16px;flex-wrap:wrap}
.game-head h2{
  font-family:var(--display);font-size:2.2rem;
  font-weight:600;letter-spacing:-.01em;line-height:1;
  display:flex;align-items:center;gap:10px;
}
.game-head .sub{
  color:var(--tx-3);font-size:.75rem;font-style:italic;
  font-family:var(--body);letter-spacing:.02em;
}

/* Bet controls */
.bet-row{display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;margin:18px 0}
.bet-row .field{margin:0;flex:1;min-width:130px}
.bet-row .btn{margin-top:0}
.qbet{display:flex;gap:4px;margin-top:7px}
.qbet button{
  flex:1;cursor:pointer;border:1px solid var(--bdr-med);
  background:rgba(0,0,0,.3);color:var(--v-300);
  font-family:var(--body);font-size:.72rem;font-weight:600;
  padding:4px;border-radius:var(--r1);letter-spacing:.05em;
  transition:border-color var(--dur-fast),background var(--dur-fast);
}
.qbet button:hover{border-color:var(--v-700);background:var(--v-dim)}

.msg{min-height:1.5rem;font-size:1.1rem;font-weight:700;text-align:center;margin-top:10px;letter-spacing:.02em}
.msg.win{color:var(--green);font-family:var(--display);font-size:1.4rem}
.msg.lose{color:var(--red);font-family:var(--body)}
.msg.info{color:var(--v-300)}

.slider-row{margin:16px 0}
.slider-row label{
  display:flex;justify-content:space-between;font-size:.75rem;
  text-transform:uppercase;letter-spacing:.08em;color:var(--tx-3);margin-bottom:6px;
  font-family:var(--body);
}
.slider-row label b{color:var(--v-300);font-family:var(--display);font-size:1.1rem}

input[type=range]{
  width:100%;-webkit-appearance:none;height:4px;border-radius:4px;
  background:linear-gradient(90deg,var(--red),var(--gold),var(--green));outline:none;
}
input[type=range]::-webkit-slider-thumb{
  -webkit-appearance:none;width:16px;height:16px;border-radius:50%;
  background:var(--tx);border:2px solid var(--v-700);cursor:pointer;
  box-shadow:0 0 8px rgba(91,33,182,.5);
}

.section-title{
  font-family:var(--display);font-size:1.4rem;font-weight:500;
  margin-bottom:14px;color:var(--tx);letter-spacing:.01em;
  display:flex;align-items:center;gap:8px;
}
.hint{font-size:.8rem;color:var(--tx-3);margin-top:4px;line-height:1.5;font-family:var(--body)}
.foot{
  text-align:center;color:var(--tx-4);font-size:.72rem;
  padding:16px 20px;line-height:1.6;
  border-top:1px solid var(--bdr);margin-top:8px;
  font-family:var(--body);
}

/* Topbar responsive */
@media(max-width:640px){.who{display:none}.xp-topbar{display:none}.topbar .logo{font-size:1.2rem}}
@media(max-width:400px){.balance .bignum{font-size:1rem}.balance{padding:.3rem .6rem}}
@media(max-width:860px){
  #mainView{height:auto;min-height:100vh;overflow:visible}
  .main-layout{flex-direction:column;overflow:visible}
  .content-wrap{overflow-y:visible;min-height:auto}
}
```

- [ ] **Step 3: Commit**

```bash
git -c user.email="contact.quentin.baudry@gmail.com" -c user.name="Quentin" add public/style.css
git -c user.email="contact.quentin.baudry@gmail.com" -c user.name="Quentin" commit -m "feat(ui): boutons Cormorant, cards shadow violet, views transitions"
```

---

### Task 7: Composants de jeux (Slots, Blackjack, Mines, Plinko, Wheel, Dice)

**Files:**
- Modify: `public/style.css` (sections de chaque jeu)

**Interfaces:**
- Consomme: Tokens Task 1, .card Task 6
- Produit: Styles de chaque jeu, couleurs signature, icônes colorées

- [ ] **Step 1: Réécrire les sections de chaque jeu dans style.css**

```css
/* ── SLOTS ────────────────────────────────────────────── */
.reels{display:flex;gap:14px;justify-content:center;margin:24px 0}
.reel{
  width:96px;height:120px;border-radius:var(--r3);
  background:linear-gradient(180deg,#0d0720,#06040f);
  border:1px solid rgba(91,33,182,.2);
  display:flex;align-items:center;justify-content:center;font-size:56px;
  box-shadow:inset 0 0 24px rgba(0,0,0,.7),0 0 0 1px rgba(91,33,182,.06);
  overflow:hidden;transition:border-color var(--dur-fast),box-shadow var(--dur-fast);
}
.reel.spin{animation:reelspin .1s linear infinite}
@keyframes reelspin{0%{transform:translateY(-5px)}50%{transform:translateY(5px)}100%{transform:translateY(-5px)}}
.reel.hit{border-color:var(--gold);box-shadow:0 0 24px rgba(201,168,76,.55),inset 0 0 20px rgba(201,168,76,.1)}
.paytable{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-top:14px}
.paytable span{
  background:rgba(0,0,0,.3);padding:3px 8px;border-radius:var(--r1);
  border:1px solid var(--bdr);font-size:.72rem;color:var(--tx-3);font-family:var(--body);
}

/* ── BLACKJACK ─────────────────────────────────────────── */
.bj-table{display:grid;gap:16px;margin:18px 0}
.hand h3{font-size:1.1rem;color:var(--tx-3);margin-bottom:8px;font-family:var(--display);letter-spacing:.05em}
.hand h3 b{color:var(--v-300);font-size:.95rem}
.cards{display:flex;gap:8px;flex-wrap:wrap;min-height:106px}
.pcard{
  width:64px;height:96px;border-radius:var(--r2);
  background:linear-gradient(160deg,#fefcff,#f0eeff);color:#111;
  display:flex;flex-direction:column;justify-content:space-between;
  padding:6px 8px;font-weight:700;
  box-shadow:0 6px 20px rgba(0,0,0,.6),0 1px 0 rgba(255,255,255,.8) inset;
  animation:cardDeal var(--dur-med) var(--ease-out);
}
@keyframes cardDeal{from{transform:translateY(-30px) rotate(-6deg);opacity:0}to{transform:none;opacity:1}}
.pcard.red{color:#b91c1c}
.pcard.back{
  background:repeating-linear-gradient(45deg,#1a1240,#1a1240 7px,#231858 7px,#231858 14px);
  color:transparent;
}
.pcard .r{font-size:1.1rem}.pcard .s{font-size:1.3rem;align-self:flex-end}
.bj-actions{display:flex;gap:10px;flex-wrap:wrap}
.bj-actions .btn{width:auto;flex:1;min-width:100px}

/* ── MINES ─────────────────────────────────────────────── */
.mines-cfg{display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;margin-bottom:14px}
.mines-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;max-width:560px;margin:16px auto}
.cell{
  aspect-ratio:1;border-radius:var(--r2);
  background:linear-gradient(180deg,#14103a,#0a0822);
  border:1px solid var(--bdr);
  display:flex;align-items:center;justify-content:center;
  font-size:1.6rem;cursor:pointer;transition:all .12s ease;user-select:none;
}
.cell:hover:not(.done){transform:translateY(-3px);border-color:var(--v-500);box-shadow:0 0 14px var(--v-dim)}
.cell.gem{background:radial-gradient(circle at 40% 30%,#4dffd4,#0a7a5a);border-color:var(--green);box-shadow:0 0 16px rgba(16,185,129,.4)}
.cell.bomb{background:radial-gradient(circle at 40% 30%,#ff6b7a,#7a0d1e);border-color:var(--red);box-shadow:0 0 16px rgba(244,63,94,.4)}
.cell.done{cursor:default}
.mines-info{
  display:flex;justify-content:space-between;max-width:560px;
  margin:14px auto 0;background:rgba(0,0,0,.3);
  border:1px solid var(--bdr);border-radius:var(--r2);padding:10px 16px;
}
.mines-info div{text-align:center}
.mines-info .lbl{font-size:.65rem;color:var(--tx-3);text-transform:uppercase;letter-spacing:.08em;font-family:var(--body)}
.mines-info .val{font-family:var(--display);font-size:1.5rem;color:var(--gold)}

/* ── PLINKO ─────────────────────────────────────────────── */
.plinko-screen{
  position:relative;border-radius:var(--r3);overflow:hidden;margin:16px 0;
  background:radial-gradient(120% 120% at 50% -20%,rgba(46,16,101,.25),var(--bg));
  border:1px solid var(--bdr);
}
#plinkoCanvas{width:100%;display:block}
.plinko-risk{display:flex;gap:8px;align-items:center}

/* ── WHEEL ──────────────────────────────────────────────── */
.wheel-wrap{position:relative;width:min(400px,100%);margin:16px auto;aspect-ratio:1}
.wheel-svg{width:100%;height:100%;display:block;filter:drop-shadow(0 8px 28px rgba(0,0,0,.6));transition:filter .3s}
#wheelG{transition:transform 4.4s cubic-bezier(.1,.72,.12,1);transform-origin:160px 160px}
@keyframes jackpot-pulse{
  0%,100%{filter:drop-shadow(0 8px 28px rgba(0,0,0,.6))}
  50%{filter:drop-shadow(0 0 60px rgba(201,168,76,.9))}
}
.wheel-wrap.jackpot-flash .wheel-svg{animation:jackpot-pulse .35s ease-in-out 6}
.wheel-pointer{
  position:absolute;top:-4px;left:50%;transform:translateX(-50%);z-index:4;
  width:0;height:0;
  border-left:10px solid transparent;border-right:10px solid transparent;
  border-top:20px solid var(--gold);
  filter:drop-shadow(0 0 6px var(--gold));
}
.wheel-hub{
  position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:3;
  width:60px;height:60px;border-radius:50%;
  background:radial-gradient(circle at 38% 32%,#f5e090,var(--gold) 65%,#5a4000);
  display:flex;align-items:center;justify-content:center;
  font-family:var(--display);font-size:1rem;color:#0d0a00;letter-spacing:.05em;font-weight:600;
  box-shadow:0 0 16px rgba(201,168,76,.5),inset 0 -2px 6px rgba(0,0,0,.4);
}

/* ── DICE ────────────────────────────────────────────────── */
.dice-result{
  font-family:var(--display);font-size:5rem;text-align:center;
  line-height:1;margin:12px 0 6px;
  color:var(--v-300);letter-spacing:-.02em;transition:color .2s;
}
.dice-result.win{color:var(--green)}
.dice-result.lose{color:var(--red)}
.dice-track{
  position:relative;height:40px;border-radius:20px;margin:10px 0 4px;overflow:hidden;
  background:linear-gradient(90deg,var(--green) 0%,var(--green) var(--win,50%),rgba(20,16,50,1) var(--win,50%));
  border:1px solid var(--bdr);box-shadow:inset 0 2px 8px rgba(0,0,0,.5);
}
.dice-marker{position:absolute;top:-2px;bottom:-2px;width:2px;background:var(--gold);box-shadow:0 0 8px var(--gold);left:var(--win,50%);transform:translateX(-50%);z-index:2}
.dice-dot{position:absolute;top:50%;width:22px;height:22px;border-radius:50%;background:var(--tx);
  transform:translate(-50%,-50%);left:50%;box-shadow:0 0 10px rgba(255,255,255,.7);z-index:3;transition:left .8s var(--ease-out)}
.dice-scale{display:flex;justify-content:space-between;color:var(--tx-4);font-size:.7rem;font-family:var(--body);letter-spacing:.05em}
.dice-stats{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:12px 0}
.dice-stats .stat{flex:1;min-width:100px}
```

- [ ] **Step 2: Commit**

```bash
git -c user.email="contact.quentin.baudry@gmail.com" -c user.name="Quentin" add public/style.css
git -c user.email="contact.quentin.baudry@gmail.com" -c user.name="Quentin" commit -m "feat(games): styles jeux dark luxury, cartes BJ, grille mines, wheel, dice"
```

---

### Task 8: Home page + HTML data-delay (cascade)

**Files:**
- Modify: `public/index.html` (data-delay sur home-stats, home-games, homeLeaderWrap)
- Modify: `public/style.css` (section HOME)

**Interfaces:**
- Consomme: classes .anim-* Task 2, tokens Task 1
- Produit: Hero card, stat cards, game cards couleurs signature, cascade stagger

- [ ] **Step 1: Ajouter les attributs data-delay dans le HTML**

Dans `#view-home`, ajouter `data-delay` sur :
```html
<!-- Hero card -->
<div class="home-hero card anim-up" data-delay="0">

<!-- Stat cards -->
<div class="home-stat-card anim-up" data-delay="0">  <!-- Crédits -->
<div class="home-stat-card anim-up" data-delay="1">  <!-- Parties -->
<div class="home-stat-card anim-up" data-delay="2">  <!-- Net -->

<!-- Bonus card -->
<div id="homeBonusCard" class="home-bonus-card hidden anim-scale" data-delay="3">

<!-- Game cards -->
<div class="home-game-card anim-up" onclick="switchTab('slots')" data-delay="0">
<div class="home-game-card anim-up" onclick="switchTab('blackjack')" data-delay="1">
<div class="home-game-card anim-up" onclick="switchTab('mines')" data-delay="2">
<div class="home-game-card anim-up" onclick="switchTab('plinko')" data-delay="3">
<div class="home-game-card anim-up" onclick="switchTab('wheel')" data-delay="4">
<div class="home-game-card anim-up" onclick="switchTab('dice')" data-delay="5">

<!-- Leaderboard card -->
<div class="card anim-up" data-delay="6">
```

- [ ] **Step 2: Ajouter des couleurs signature aux game cards via data-game**

Remplacer chaque `.home-game-card` HTML pour ajouter `data-game` :
```html
<div class="home-game-card anim-up" onclick="switchTab('slots')" data-game="slots" data-delay="0">
<div class="home-game-card anim-up" onclick="switchTab('blackjack')" data-game="blackjack" data-delay="1">
<div class="home-game-card anim-up" onclick="switchTab('mines')" data-game="mines" data-delay="2">
<div class="home-game-card anim-up" onclick="switchTab('plinko')" data-game="plinko" data-delay="3">
<div class="home-game-card anim-up" onclick="switchTab('wheel')" data-game="wheel" data-delay="4">
<div class="home-game-card anim-up" onclick="switchTab('dice')" data-game="dice" data-delay="5">
```

- [ ] **Step 3: Réécrire la section HOME dans style.css**

```css
/* ══════════════════════════════════════════════════════════
   HOME
══════════════════════════════════════════════════════════ */
.home-hero{
  display:flex;align-items:center;justify-content:space-between;
  gap:16px;flex-wrap:wrap;margin-bottom:20px;
  background:linear-gradient(135deg,var(--surface-1),var(--surface-2));
}
.home-hero-info{}
.home-welcome{
  font-family:var(--display);font-size:1.5rem;font-weight:500;
  color:var(--tx-2);letter-spacing:.02em;
}
.home-username{color:var(--tx);font-size:2.2rem;font-weight:600;display:block;line-height:1.1}
.home-lvl-line{margin-top:.4rem}
.home-lvl-badge{font-size:.75rem;color:var(--tx-3);font-family:var(--body)}
.home-lvl-badge b{color:var(--v-300);font-weight:700}

/* Stat cards */
.home-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:0 0 20px}
.home-stat-card{
  background:var(--surface-1);border:1px solid var(--bdr);border-radius:var(--r3);
  padding:18px 16px;text-align:center;
  transition:transform var(--dur-fast) var(--ease-back), border-color var(--dur-fast), box-shadow var(--dur-fast);
}
.home-stat-card:hover{
  transform:translateY(-3px);border-color:var(--bdr-accent);
  box-shadow:var(--shadow-v);
}
.hs-icon{display:flex;align-items:center;justify-content:center;margin-bottom:8px;height:38px;color:var(--v-300)}
.hs-icon svg.lucide{width:28px;height:28px;stroke-width:1.5}
.hs-val{
  font-family:var(--display);font-size:1.8rem;color:var(--gold);
  letter-spacing:.01em;line-height:1;margin-bottom:4px;font-weight:700;
}
.hs-lbl{font-size:.7rem;text-transform:uppercase;letter-spacing:.09em;color:var(--tx-3);font-family:var(--body)}

/* Bonus card */
.home-bonus-card{
  display:flex;align-items:center;gap:16px;justify-content:space-between;
  background:linear-gradient(135deg,var(--green-dim),var(--gold-dim));
  border:1px solid rgba(16,185,129,.25);border-radius:var(--r3);
  padding:14px 18px;margin-bottom:20px;flex-wrap:wrap;
  animation:animFade var(--dur-med) var(--ease-out);
}
.hbc-title{font-family:var(--display);font-size:1.2rem;color:var(--tx);display:flex;align-items:center;gap:6px}
.hbc-sub{font-size:.75rem;color:var(--green);margin-top:2px;font-family:var(--body)}
.home-bonus-card .btn{margin-top:0;white-space:nowrap}

/* Game cards */
.home-games{
  display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;
  margin-bottom:8px;
}
.home-game-card{
  border-radius:var(--r3);padding:20px 12px;text-align:center;
  cursor:pointer;transition:transform var(--dur-fast) var(--ease-back), box-shadow var(--dur-fast);
  border:1px solid var(--bdr);
  background:var(--surface-1);
}
/* Couleurs signature par jeu */
.home-game-card[data-game="slots"]    {background:linear-gradient(160deg,#1a0a3d,#0d0522)}
.home-game-card[data-game="blackjack"]{background:linear-gradient(160deg,#0a1628,#060e1a)}
.home-game-card[data-game="mines"]    {background:linear-gradient(160deg,#1f0a0a,#110404)}
.home-game-card[data-game="plinko"]   {background:linear-gradient(160deg,#0a1a12,#050e08)}
.home-game-card[data-game="wheel"]    {background:linear-gradient(160deg,#1a1200,#0d0a00)}
.home-game-card[data-game="dice"]     {background:linear-gradient(160deg,#0f1016,#07080c)}

.home-game-card:hover{
  transform:translateY(-4px);
  box-shadow:var(--shadow-v);
  border-color:var(--bdr-accent);
}
.hg-icon{display:flex;align-items:center;justify-content:center;margin-bottom:10px;height:44px}
.hg-icon svg.lucide{width:36px;height:36px;stroke-width:1.4;color:var(--v-300)}
.hg-name{font-family:var(--display);font-size:1.05rem;letter-spacing:.03em;margin-bottom:3px;color:var(--tx)}
.hg-desc{font-size:.7rem;color:var(--tx-3);font-family:var(--body)}

/* Responsive home */
@media(max-width:600px){
  .home-stats{grid-template-columns:1fr 1fr}
  .home-games{grid-template-columns:repeat(3,1fr)}
}
@media(max-width:380px){
  .home-stats{grid-template-columns:1fr}
  .home-games{grid-template-columns:repeat(2,1fr)}
}
```

- [ ] **Step 4: Commit**

```bash
git -c user.email="contact.quentin.baudry@gmail.com" -c user.name="Quentin" add public/index.html public/style.css
git -c user.email="contact.quentin.baudry@gmail.com" -c user.name="Quentin" commit -m "feat(home): hero card, stat cards, game cards couleurs signature + data-delay"
```

---

### Task 9: Profil, historique, tables, spinner

**Files:**
- Modify: `public/style.css` (sections PROFIL, TABLES, MISC)

- [ ] **Step 1: Réécrire les sections PROFIL / STATS / TABLES dans style.css**

```css
/* ── PROFIL / STATS ────────────────────────────────────── */
.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin:16px 0}
.stat{
  background:rgba(0,0,0,.25);border:1px solid var(--bdr);
  border-radius:var(--r2);padding:14px;text-align:center;
}
.stat .lbl{font-size:.65rem;text-transform:uppercase;letter-spacing:.09em;color:var(--tx-3);font-family:var(--body)}
.stat .val{font-family:var(--display);font-size:1.7rem;color:var(--gold);margin-top:4px;font-weight:700}
.stat .val.green{color:var(--green)}.stat .val.red{color:var(--red)}

/* XP profil card */
.xp-profil-card{
  display:flex;align-items:center;gap:20px;
  background:linear-gradient(135deg,rgba(46,16,101,.2),rgba(91,33,182,.06));
  border:1px solid var(--bdr-accent);border-radius:var(--r3);
  padding:18px 22px;margin:10px 0 20px;
}
.xp-pc-left{text-align:center;flex:none}
.xp-big-num{
  font-family:var(--display);font-size:4rem;line-height:1;
  color:var(--v-300);letter-spacing:-.02em;font-weight:700;
}
.xp-sub-lbl{font-size:.65rem;text-transform:uppercase;letter-spacing:.12em;color:var(--tx-4);margin-top:2px;font-family:var(--body)}
.xp-pc-right{flex:1;min-width:0}
.xp-title-name{
  font-family:var(--display);font-size:1.6rem;color:var(--gold);
  letter-spacing:.05em;margin-bottom:8px;font-weight:600;
}
.xp-bar-lg{height:4px;border-radius:4px;background:rgba(255,255,255,.06);overflow:hidden;margin-bottom:6px}
.xp-bar-fill-lg{
  height:100%;border-radius:4px;
  background:linear-gradient(90deg,var(--v-700),var(--v-300));
  transition:width .9s var(--ease-out);width:0%;
}
.xp-progress-lbl{font-size:.72rem;color:var(--tx-3);font-family:var(--body)}

/* Tables */
table{width:100%;border-collapse:collapse;font-size:.82rem}
th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--bdr)}
th{color:var(--tx-4);font-size:.65rem;text-transform:uppercase;letter-spacing:.09em;font-weight:600;font-family:var(--body)}
tbody tr:hover td{background:rgba(91,33,182,.04)}
td .btn{display:inline-block;width:auto;padding:4px 9px;font-size:.72rem;margin:0 2px}
.tablewrap{max-height:400px;overflow:auto;border-radius:var(--r2)}

/* Misc */
.log-type{font-family:var(--body);font-size:.65rem;padding:2px 6px;border-radius:var(--r1);letter-spacing:.06em;font-weight:700;text-transform:uppercase}
.lt-bet{background:rgba(91,33,182,.15);color:var(--v-300)}
.lt-win{background:var(--green-dim);color:var(--green)}
.lt-auth{background:rgba(91,33,182,.1);color:#c4b5fd}
.lt-admin{background:var(--gold-dim);color:var(--gold)}
.lt-sys{background:rgba(255,255,255,.05);color:var(--tx-3)}
.log-time{color:var(--tx-3);font-size:.7rem;white-space:nowrap;font-family:var(--body);font-variant-numeric:tabular-nums}
.adminbadge{background:var(--v-700);color:var(--tx);font-size:.62rem;padding:1px 6px;border-radius:var(--r4);font-weight:700;letter-spacing:.06em;text-transform:uppercase;font-family:var(--body)}
.adm-lvl{color:var(--tx-3);font-weight:600}

/* Set sliders (admin) */
.set-game{padding:11px 0;border-bottom:1px solid var(--bdr)}
.set-name{font-family:var(--display);font-size:1.1rem;letter-spacing:.03em;margin-bottom:6px;color:var(--tx)}
.set-ctl{display:flex;align-items:center;gap:10px;margin:4px 0}
.set-lbl{font-size:.65rem;text-transform:uppercase;letter-spacing:.08em;color:var(--tx-3);width:70px;flex:none;font-family:var(--body)}
.set-ctl input[type=range]{flex:1}
.set-num{
  width:62px;flex:none;padding:4px 6px;border-radius:var(--r1);
  border:1px solid var(--bdr-med);background:rgba(0,0,0,.3);
  color:var(--gold);font-family:var(--display);font-size:.95rem;text-align:center;outline:none;
}
.set-num:focus{border-color:var(--v-500)}
.set-unit{color:var(--tx-4);font-size:.72rem;width:14px;font-family:var(--body)}

/* Loading */
.spinner{
  display:inline-block;width:18px;height:18px;border-radius:50%;
  border:2px solid var(--bdr-med);border-top-color:var(--v-300);
  animation:spin .7s linear infinite;vertical-align:middle;
}
.loading-row{display:flex;justify-content:center;padding:20px}
.loading-cell{text-align:center;padding:20px}
```

- [ ] **Step 2: Commit**

```bash
git -c user.email="contact.quentin.baudry@gmail.com" -c user.name="Quentin" add public/style.css
git -c user.email="contact.quentin.baudry@gmail.com" -c user.name="Quentin" commit -m "feat(profil): XP card, stats Cormorant or, tables dark luxury"
```

---

### Task 10: Modal, Toast, Chat, Win overlay, Invite

**Files:**
- Modify: `public/style.css` (sections MODAL, TOAST, CHAT, WIN, INVITE)

- [ ] **Step 1: Réécrire les sections MODAL, WIN, TOAST, CHAT, INVITE**

```css
/* ── INVITE ──────────────────────────────────────────── */
.invite-gen-row{display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;margin-bottom:12px}
.invite-result{margin-top:12px}
.invite-link-box{
  display:flex;align-items:center;gap:10px;background:rgba(0,0,0,.35);
  border:1px solid var(--bdr-med);border-radius:var(--r2);padding:10px 14px;flex-wrap:wrap;
}
.invite-link-url{font-family:var(--body);font-size:.75rem;color:var(--v-300);word-break:break-all;flex:1;user-select:all;font-variant-numeric:tabular-nums}
.invite-tag{font-family:var(--body);font-size:.65rem;padding:2px 6px;border-radius:var(--r1);font-weight:700;letter-spacing:.05em}
.inv-ok{background:var(--green-dim);color:var(--green)}
.inv-used{background:rgba(255,255,255,.04);color:var(--tx-4)}

/* ── WIN OVERLAY ─────────────────────────────────────── */
.win-overlay{
  position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;
  pointer-events:auto;cursor:pointer;
  background:rgba(5,5,12,.6);backdrop-filter:blur(4px);
  animation:overlayIn .3s var(--ease-out);
}
.confetti-cvs{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.win-label{
  position:relative;z-index:1;font-family:var(--display);
  font-size:clamp(2rem,8vw,5.5rem);
  letter-spacing:.05em;text-align:center;line-height:1.1;white-space:pre-line;font-weight:600;
  background:linear-gradient(135deg,var(--gold),#fff,var(--gold));
  -webkit-background-clip:text;background-clip:text;color:transparent;
  filter:drop-shadow(0 0 30px rgba(201,168,76,.6));
  animation:winpop .5s var(--ease-back);
}

/* ── MODAL ───────────────────────────────────────────── */
.modal-overlay{
  position:fixed;inset:0;z-index:150;display:flex;align-items:center;justify-content:center;
  background:rgba(5,5,12,.85);backdrop-filter:blur(8px);padding:20px;
  animation:overlayIn .2s var(--ease-out);
}
.modal-card{
  background:var(--surface-1);border:1px solid var(--bdr-med);border-radius:var(--r3);
  padding:26px 26px 20px;width:100%;max-width:430px;
  box-shadow:var(--shadow-lg);
  animation:modalIn .22s var(--ease-back);
}
.modal-title{font-family:var(--display);font-size:1.5rem;color:var(--tx);margin-bottom:12px;letter-spacing:.02em;font-weight:600}
.modal-body{color:var(--tx-3);font-size:.85rem;margin-bottom:18px;line-height:1.6;font-family:var(--body)}
.modal-body .field{margin-bottom:0}
.modal-body p{color:var(--tx-3)}
.modal-btns{display:flex;gap:10px}
.modal-btns .btn{flex:1;margin-top:0}

/* ── CHAT ────────────────────────────────────────────── */
.chat-toggle{
  position:fixed;bottom:80px;right:20px;z-index:100;
  width:46px;height:46px;border-radius:50%;padding:0;
  background:linear-gradient(135deg,var(--v-700),var(--v-900));
  box-shadow:var(--shadow-v);cursor:pointer;border:1px solid var(--bdr-accent);
  display:flex;align-items:center;justify-content:center;
  transition:transform var(--dur-fast) var(--ease-back),box-shadow var(--dur-fast);
}
.chat-toggle:hover{transform:scale(1.08);box-shadow:0 8px 32px rgba(91,33,182,.5)}
.chat-toggle.open{background:linear-gradient(135deg,var(--v-500),var(--v-700))}
.chat-panel{
  position:fixed;bottom:140px;right:20px;z-index:100;width:300px;max-height:400px;
  background:var(--surface-1);border:1px solid var(--bdr-med);border-radius:var(--r3);
  display:flex;flex-direction:column;box-shadow:var(--shadow-lg);overflow:hidden;
}
.chat-head{
  display:flex;justify-content:space-between;align-items:center;padding:10px 14px;
  border-bottom:1px solid var(--bdr);
  font-family:var(--display);font-size:1rem;letter-spacing:.04em;
  background:rgba(91,33,182,.06);
}
.chat-close{background:none;border:none;color:var(--tx-3);cursor:pointer;transition:color var(--dur-fast);display:flex;align-items:center;padding:0}
.chat-close:hover{color:var(--tx)}
.chat-msgs{flex:1;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:5px;min-height:0}
.chat-msg{font-size:.82rem;line-height:1.4;word-break:break-word;font-family:var(--body)}
.chat-who{font-family:var(--display);font-size:.78rem;color:var(--v-300);letter-spacing:.03em;margin-right:4px}
.chat-who.is-admin{color:var(--gold)}
.chat-input-row{display:flex;gap:7px;padding:8px 10px;border-top:1px solid var(--bdr)}
.chat-input-row input{
  flex:1;padding:7px 10px;border-radius:var(--r2);
  border:1px solid var(--bdr-med);background:rgba(0,0,0,.35);
  color:var(--tx);font-family:var(--body);font-size:.82rem;outline:none;
  transition:border-color var(--dur-fast);
}
.chat-input-row input:focus{border-color:var(--v-500)}
.chat-input-row button{
  cursor:pointer;border:none;border-radius:var(--r2);padding:7px 11px;
  background:var(--v-700);color:var(--tx);
  display:flex;align-items:center;justify-content:center;transition:background var(--dur-fast);
}
.chat-input-row button:hover{background:var(--v-500)}

/* ── TOAST ───────────────────────────────────────────── */
.toast{
  position:fixed;bottom:22px;left:50%;transform:translateX(-50%) translateY(80px);z-index:99;
  background:var(--surface-1);border:1px solid var(--bdr-med);color:var(--tx);
  padding:10px 20px;border-radius:var(--r4);font-weight:600;font-family:var(--body);
  box-shadow:var(--shadow-lg);opacity:0;font-size:.82rem;
  transition:opacity .4s ease, transform .4s ease;
  white-space:nowrap;
}
.toast.show{
  transform:translateX(-50%) translateY(0);opacity:1;
  transition:opacity .12s ease, transform .22s var(--ease-back);
}
```

- [ ] **Step 2: Commit**

```bash
git -c user.email="contact.quentin.baudry@gmail.com" -c user.name="Quentin" add public/style.css
git -c user.email="contact.quentin.baudry@gmail.com" -c user.name="Quentin" commit -m "feat(ui): modal, toast, chat, win overlay dark luxury"
```

---

### Task 11: Admin panel — aligné avec l'identité BlackState

**Files:**
- Modify: `public/style.css` (section PANEL ADMIN)

**Interfaces:**
- Consomme: Tokens Task 1, .card Task 6, tables Task 9
- Produit: Admin panel avec même identité que le site, titres Cormorant, stat chips or

- [ ] **Step 1: Réécrire la section PANEL ADMIN dans style.css**

```css
/* ══════════════════════════════════════════════════════════
   PANEL ADMIN — même identité que le site
══════════════════════════════════════════════════════════ */
#adminPanel{
  --a-bg:      var(--bg);
  --a-surface: var(--surface-1);
  --a-surface2:var(--surface-2);
  --a-border:  var(--bdr);
  --a-border2: var(--bdr-med);
  --a-accent:  var(--v-700);
  --a-tx:      var(--tx);
  --a-tx-muted:var(--tx-2);
  --a-tx-dim:  var(--tx-3);
  --a-danger:  var(--red);
  --a-success: var(--green);
  --a-r:       var(--r2);
  display:flex;flex-direction:column;min-height:100vh;
  background:var(--bg);color:var(--tx);
  font-family:var(--body);font-size:.875rem;
}
#adminPanel.hidden{display:none}
.adm-shell{display:flex;min-height:100vh}

/* Sidebar admin */
.adm-nav-panel{
  width:220px;flex:none;
  background:linear-gradient(180deg,#0a0818,#06050f);
  border-right:1px solid rgba(91,33,182,.12);
  display:flex;flex-direction:column;
  position:sticky;top:0;height:100vh;overflow-y:auto;
}
.adm-brand-area{
  padding:18px 16px 14px;border-bottom:1px solid rgba(91,33,182,.1);
  display:flex;align-items:center;gap:10px;flex-wrap:wrap;
}
.adm-brand-logo{
  font-family:var(--display);font-size:1.4rem;
  letter-spacing:.05em;color:var(--tx);font-weight:600;
}
.adm-brand-logo span{color:var(--v-500)}
.adm-brand-badge{
  font-size:.6rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;
  padding:2px 6px;border-radius:var(--r1);
  background:rgba(91,33,182,.2);color:var(--v-300);
  border:1px solid rgba(91,33,182,.3);font-family:var(--body);
}
.adm-nav-links{flex:1;padding:10px 8px;display:flex;flex-direction:column;gap:2px}
.adm-nl{
  display:flex;align-items:center;gap:9px;
  padding:7px 10px;border-radius:var(--r2);
  color:var(--tx-3);cursor:pointer;font-size:.84rem;
  font-weight:500;transition:color var(--dur-fast),background var(--dur-fast);
  border:none;background:none;width:100%;text-align:left;font-family:var(--body);
  position:relative;
}
.adm-nl svg.lucide{width:16px;height:16px;stroke-width:1.75;flex:none;color:inherit}
.adm-nl:hover{color:rgba(245,240,255,.82);background:rgba(91,33,182,.1)}
.adm-nl.active{color:var(--v-300);background:rgba(91,33,182,.14)}
.adm-nl.active::before{
  content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);
  width:2px;height:16px;background:var(--v-700);border-radius:0 2px 2px 0;
}
.adm-nav-foot{padding:14px 14px 18px;border-top:1px solid rgba(91,33,182,.1)}
.adm-who-line{display:flex;flex-direction:column;gap:2px;margin-bottom:10px}
.adm-who-lbl{font-size:.65rem;text-transform:uppercase;letter-spacing:.1em;color:var(--tx-4);font-family:var(--body)}
.adm-who-name{font-size:.875rem;font-weight:600;color:var(--tx)}
.adm-logout-btn{
  width:100%;padding:7px 10px;border-radius:var(--r2);
  background:transparent;border:1px solid var(--bdr-med);
  color:var(--tx-3);cursor:pointer;font-size:.78rem;
  font-family:var(--body);transition:all var(--dur-fast);
  display:flex;align-items:center;gap:6px;
}
.adm-logout-btn:hover{background:rgba(255,255,255,.04);color:var(--tx)}

/* Main admin */
.adm-main{flex:1;padding:28px 32px;overflow-y:auto;min-width:0}
.adm-view{display:block}
.adm-view.hidden{display:none}
.adm-page-head{margin-bottom:20px}
.adm-page-title{
  font-family:var(--display);font-size:1.8rem;font-weight:500;
  color:var(--tx);letter-spacing:-.01em;
}
.adm-content-card{
  background:var(--surface-1);border:1px solid var(--bdr);
  border-radius:var(--r3);padding:20px 22px;margin-bottom:16px;
}

/* Stat chips */
.adm-stats{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px}
.adm-stat-chip{
  background:var(--bg);border:1px solid var(--bdr-accent);
  border-radius:var(--r2);padding:14px 18px;min-width:140px;
}
.adm-stat-chip .val{display:block;font-family:var(--display);font-size:1.6rem;font-weight:700;color:var(--gold);line-height:1}
.adm-stat-chip .lbl{display:block;font-size:.65rem;color:var(--tx-3);margin-top:4px;text-transform:uppercase;letter-spacing:.08em;font-family:var(--body)}

/* Tables admin */
#adminPanel .tablewrap{overflow-x:auto;border:1px solid var(--bdr);border-radius:var(--r2)}
#adminPanel table{width:100%;border-collapse:collapse;font-size:.8rem}
#adminPanel th{
  background:rgba(91,33,182,.06);color:var(--tx-3);
  font-size:.65rem;font-weight:600;text-transform:uppercase;letter-spacing:.08em;
  padding:10px 14px;text-align:left;border-bottom:1px solid var(--bdr);font-family:var(--body);
}
#adminPanel td{padding:11px 14px;border-bottom:1px solid var(--bdr);vertical-align:middle;color:var(--tx)}
#adminPanel tr:last-child td{border-bottom:none}
#adminPanel tbody tr:hover td{background:rgba(91,33,182,.04)}

/* Boutons admin — pas de lift, pas d'!important */
#adminPanel .btn{
  border-radius:var(--r2);font-family:var(--body);font-size:.78rem;font-weight:600;
  letter-spacing:.04em;padding:7px 12px;cursor:pointer;
  border:1px solid transparent;
  transition:background var(--dur-fast),opacity var(--dur-fast),border-color var(--dur-fast);
  transform:none;box-shadow:none;
}
#adminPanel .btn:hover{transform:none;box-shadow:none}
#adminPanel .btn:active{opacity:.7;transition-duration:.06s}
#adminPanel .btn:not(.ghost):not(.gold){background:var(--tx);color:var(--bg);border-color:var(--tx)}
#adminPanel .btn:not(.ghost):not(.gold):hover{opacity:.85}
#adminPanel .btn.ghost{background:transparent;color:var(--tx);border-color:var(--bdr-med)}
#adminPanel .btn.ghost:hover{background:rgba(255,255,255,.05)}
#adminPanel .btn.gold{background:var(--gold);color:#0d0a00;border-color:var(--gold);font-weight:700}
#adminPanel .btn.gold:hover{opacity:.85}
#adminPanel .btn.sm{padding:4px 8px;font-size:.72rem}
#adminPanel .btn[onclick*="adminDebit"]{color:#fb923c;border-color:rgba(251,146,60,.3)}
#adminPanel .btn[onclick*="adminDebit"]:hover{background:rgba(251,146,60,.08)}
#adminPanel .btn[onclick*="adminDelete"]{color:var(--red);border-color:rgba(244,63,94,.3)}
#adminPanel .btn[onclick*="adminDelete"]:hover{background:var(--red-dim)}
#adminPanel .adm-preset-row{display:flex;gap:8px;flex-wrap:wrap;padding-bottom:16px;margin-bottom:16px;border-bottom:1px solid var(--bdr)}

/* Invite admin */
#adminPanel .invite-gen-row{display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;margin-bottom:16px}
#adminPanel .invite-result{margin-top:14px}
#adminPanel .invite-link-box{
  display:flex;gap:10px;align-items:center;
  background:var(--bg);border:1px solid var(--bdr);border-radius:var(--r2);padding:10px 14px;
}
#adminPanel .invite-link-url{flex:1;font-family:var(--body);font-size:.75rem;color:var(--tx-3);word-break:break-all}
#adminPanel .invite-tag{font-size:.65rem;font-weight:700;letter-spacing:.05em;padding:2px 7px;border-radius:var(--r1);font-family:var(--body)}
#adminPanel .inv-ok{background:var(--green-dim);color:var(--green)}
#adminPanel .inv-used{background:rgba(255,255,255,.04);color:var(--tx-4)}
#adminPanel .field label{font-size:.65rem;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--tx-3)}
#adminPanel .field input,#adminPanel select{
  background:var(--bg);border:1px solid var(--bdr-med);color:var(--tx);
  border-radius:var(--r2);padding:7px 10px;font-size:.82rem;font-family:var(--body);outline:none;
}
#adminPanel .field input:focus,#adminPanel select:focus{border-color:var(--v-500)}
#adminPanel .set-game{display:flex;align-items:center;gap:16px;padding:12px 0;border-bottom:1px solid var(--bdr);flex-wrap:wrap}
#adminPanel .set-game:last-child{border-bottom:none}
#adminPanel .set-name{font-size:.82rem;font-weight:600;color:var(--tx);min-width:100px;font-family:var(--body)}
#adminPanel .set-ctl{display:flex;align-items:center;gap:8px;flex:1}
#adminPanel .set-lbl{font-size:.65rem;color:var(--tx-3);min-width:66px;text-transform:uppercase;letter-spacing:.06em;font-family:var(--body)}
#adminPanel .set-num{width:58px;background:var(--bg);border:1px solid var(--bdr-med);color:var(--gold);border-radius:var(--r1);padding:4px 7px;font-size:.82rem;text-align:center;font-family:var(--display)}
#adminPanel .set-unit{font-size:.72rem;color:var(--tx-4);font-family:var(--body)}
#adminPanel input[type="range"]{accent-color:var(--v-500);flex:1}
#adminPanel .adm-log-bar{display:flex;gap:8px;align-items:center;margin-bottom:16px;flex-wrap:wrap}
#adminPanel .log-time{font-size:.7rem;color:var(--tx-3);font-family:var(--body);font-variant-numeric:tabular-nums}
#adminPanel .log-type{font-size:.62rem;font-weight:700;letter-spacing:.06em;padding:2px 5px;border-radius:var(--r1);text-transform:uppercase;font-family:var(--body)}
#adminPanel .lt-auth{background:rgba(91,33,182,.12);color:#c4b5fd}
#adminPanel .lt-bet{background:var(--gold-dim);color:var(--gold)}
#adminPanel .lt-win{background:var(--green-dim);color:var(--green)}
#adminPanel .lt-admin{background:rgba(91,33,182,.12);color:var(--v-300)}
#adminPanel .lt-sys{background:rgba(255,255,255,.04);color:var(--tx-4)}
#adminPanel .hint{font-size:.78rem;color:var(--tx-3);line-height:1.5;font-family:var(--body)}
#adminPanel .adminbadge{background:var(--v-700);color:var(--tx);font-size:.6rem;padding:1px 5px;border-radius:var(--r1)}

/* Mobile admin */
@media(max-width:680px){
  .adm-shell{flex-direction:column}
  .adm-nav-panel{width:100%;height:auto;position:static;flex-direction:row;flex-wrap:wrap}
  .adm-brand-area{flex:none;border-bottom:none;border-right:1px solid rgba(91,33,182,.1);padding:10px 12px}
  .adm-nav-links{flex-direction:row;padding:5px 6px;flex:1;gap:2px}
  .adm-nl{padding:6px 8px;font-size:.78rem;gap:6px}
  .adm-nl::before{display:none}
  .adm-nav-foot{display:none}
  .adm-main{padding:14px}
}
```

- [ ] **Step 2: Commit**

```bash
git -c user.email="contact.quentin.baudry@gmail.com" -c user.name="Quentin" add public/style.css
git -c user.email="contact.quentin.baudry@gmail.com" -c user.name="Quentin" commit -m "feat(admin): panel aligné identité BlackState, Cormorant titres, stat chips or"
```

---

### Task 12: Icônes Lucide + CSS icônes

**Files:**
- Modify: `public/style.css` (section LUCIDE ICONS)

- [ ] **Step 1: Réécrire la section LUCIDE ICONS**

```css
/* ── LUCIDE ICONS ───────────────────────────────────────── */
svg.lucide{display:inline-block;vertical-align:middle;stroke:currentColor;fill:none;stroke-linecap:round;stroke-linejoin:round}
.ni svg.lucide{width:16px;height:16px;stroke-width:1.75;color:inherit}
.ic-game{width:28px;height:28px;stroke-width:1.5;margin-right:8px;vertical-align:sub}
.ic-title{width:18px;height:18px;stroke-width:1.8;margin-right:6px;vertical-align:sub}
.ic-sm{width:13px;height:13px;stroke-width:2;vertical-align:middle;margin-right:4px}
.ic-btn{width:14px;height:14px;stroke-width:2;vertical-align:middle;margin-right:5px}
.hs-icon svg.lucide{width:28px;height:28px;stroke-width:1.5}
.hg-icon svg.lucide{width:36px;height:36px;stroke-width:1.4}
.chat-toggle svg.lucide{width:20px;height:20px;stroke-width:2}
.chat-close svg.lucide{width:16px;height:16px;stroke-width:2}
.chat-input-row button svg.lucide{width:15px;height:15px;stroke-width:2}
.adm-logout-btn svg.lucide{width:13px;height:13px;stroke-width:2}

/* Couleur icône jeu dans .game-head */
.game-head .ic-game{color:var(--v-300)}
```

- [ ] **Step 2: Commit**

```bash
git -c user.email="contact.quentin.baudry@gmail.com" -c user.name="Quentin" add public/style.css
git -c user.email="contact.quentin.baudry@gmail.com" -c user.name="Quentin" commit -m "feat(icons): Lucide sizing unifié"
```

---

### Task 13: JS — initAnimations(), countUp(), transitions de vues, game events

**Files:**
- Modify: `public/app.js` (fonctions d'animation à ajouter avant le boot)

**Interfaces:**
- Consomme: classes .anim-up, .anim-scale (Task 2 CSS), data-delay (Task 8 HTML)
- Produit: `initAnimations()`, `countUp()`, `shakeEl()`, view transitions avec délai, `claimBonusHome()` update balance

- [ ] **Step 1: Ajouter le bloc d'animations au début de app.js (après les déclarations de variables)**

Insérer après la ligne `const INVITE_TOKEN = new URLSearchParams(...)` :

```js
/* ── Animations ───────────────────────────────────────────── */
function initAnimations(root) {
  const target = root || document;
  target.querySelectorAll('[data-delay]').forEach(el => {
    el.style.animationDelay = (parseInt(el.dataset.delay || 0) * 80) + 'ms';
  });
}

function countUp(el, target, duration = 600) {
  if (!el) return;
  const start = parseInt(el.textContent.replace(/\s/g, '')) || 0;
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
```

- [ ] **Step 2: Mettre à jour `setBalance()` pour utiliser countUp**

Remplacer la fonction `setBalance` existante :

```js
function setBalance(b, win, xp, level) {
  if (USER) USER.credit = b;
  const el = $('balVal');
  if (el) countUp(el, Math.floor(b), 500);
  if (win !== undefined) flashBal(win);
  if (xp != null) updateXP(xp, level || 1);
}
```

- [ ] **Step 3: Mettre à jour `flashBal()` pour ajouter shakeX sur les pertes**

```js
function flashBal(win) {
  const b = $('balBox');
  b.classList.remove('flash-win','flash-lose');
  void b.offsetWidth;
  b.classList.add(win ? 'flash-win' : 'flash-lose');
  if (!win) shakeEl(b);
  setTimeout(() => b.classList.remove('flash-win','flash-lose'), 600);
}
```

- [ ] **Step 4: Mettre à jour `switchTab()` pour appeler initAnimations sur la vue active**

Dans `_doTab(v)`, ajouter après `$('view-' + v).classList.add('active')` :

```js
  // Initialiser les animations de la vue qui vient d'être activée
  const activeView = $('view-' + v);
  if (activeView) initAnimations(activeView);
```

- [ ] **Step 5: Appeler initAnimations() dans le boot**

Remplacer la ligne `if (typeof lucide !== 'undefined') lucide.createIcons();` par :

```js
if (typeof lucide !== 'undefined') lucide.createIcons();
initAnimations();
```

- [ ] **Step 6: Mettre à jour renderHome() pour utiliser countUp sur les stats**

Dans `renderHome()`, remplacer les lignes qui mettent à jour les stats par :

```js
  $('homeUser').textContent   = USER.username;
  $('homeLevel').textContent  = USER.level || 1;
  countUp($('homeBal'), Math.floor(USER.credit));
  const st = USER.stats || {};
  countUp($('homePlayed'), st.played || 0);
  const net = (st.won || 0) - (st.wagered || 0);
  const netEl = $('homeNet');
  if (netEl) {
    countUp(netEl, Math.floor(Math.abs(net)));
    netEl.style.color = net >= 0 ? 'var(--green)' : 'var(--red)';
    netEl.textContent = (net >= 0 ? '+' : '-') + Math.abs(Math.floor(net)).toLocaleString('fr-FR');
  }
  updateBonusBadge();
```

- [ ] **Step 7: Ajouter shakeX sur les pertes aux jeux**

Dans `spin()` (slots), remplacer la ligne de perte par :

```js
else { m.className = 'msg lose'; m.textContent = 'Perdu — retente !'; shakeEl($('view-slots').querySelector('.card')); }
```

Dans `minesPick()` sur bomb :

```js
    cell.classList.add('bomb'); cell.textContent = '💣'; revealBombs(d.bombs); minesActive = false;
    shakeEl($('minesGrid'));
```

- [ ] **Step 8: Tester visuellement**

- Login : cascade en 5 temps visible au chargement
- Home : stat cards apparaissent en stagger, chiffres comptent vers le haut
- Navigation entre jeux : vues glissent légèrement
- Perte aux slots : card secoue
- Bombe mines : grille secoue

- [ ] **Step 9: Commit**

```bash
git -c user.email="contact.quentin.baudry@gmail.com" -c user.name="Quentin" add public/app.js
git -c user.email="contact.quentin.baudry@gmail.com" -c user.name="Quentin" commit -m "feat(animations): initAnimations, countUp, shakeX, transitions de vues"
```

---

### Task 14: Redémarrage serveur + test d'intégration

**Files:**
- Aucun fichier modifié

- [ ] **Step 1: Tuer l'ancien serveur et redémarrer**

```bash
cd "C:\Users\info\Documents\DEV\Casino_Online_GTARP"
pkill -f "bun run server.ts" 2>/dev/null; sleep 1
bun run server.ts &
sleep 2
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/
```
Attendu : `200`

- [ ] **Step 2: Vérifier que les assets sont servis**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/style.css
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/app.js
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/lucide.min.js
```
Attendu : trois `200`

- [ ] **Step 3: Vérifier les tokens clés dans style.css**

```bash
curl -s http://localhost:3000/style.css | grep -c "Cormorant Garamond\|#05050c\|#c9a84c\|--ease-out\|animUp"
```
Attendu : au moins 8

- [ ] **Step 4: Checklist visuelle navigateur** (ouvrir http://localhost:3000)

- [ ] Page login : fond noir, halo violet rotatif, logo Cormorant large centré, inputs underline
- [ ] Connexion : transition vers home avec animation
- [ ] Home : hero card avec pseudo + solde, 3 stat cards, 6 game cards couleurs signature
- [ ] Sidebar : fond sombre violet, labels Cormorant italic, left accent bar
- [ ] Topbar : logo Cormorant, solde badge doré
- [ ] Slot : card sombre, reel animé, message win en Cormorant
- [ ] Mines : grille 5×5 élargie, cellules sombres
- [ ] Profil : XP card violet, stats Cormorant or
- [ ] Admin : même identité que site, stat chips dorés, tables cohérentes
- [ ] Modal : entrée scale animée
- [ ] Toast : apparaît vite, disparaît doucement

- [ ] **Step 5: Commit final**

```bash
git -c user.email="contact.quentin.baudry@gmail.com" -c user.name="Quentin" add -A
git -c user.email="contact.quentin.baudry@gmail.com" -c user.name="Quentin" commit -m "feat: refonte visuelle complète BlackState — dark luxury, Cormorant Garamond, cinématique"
```
