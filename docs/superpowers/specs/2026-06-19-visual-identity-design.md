# BlackState Casino — Visual Identity Redesign
**Date:** 2026-06-19  
**Scope:** Refonte visuelle complète — design system, typographie, animations, tous les composants  
**Stack:** HTML/CSS/JS vanilla, Bun/Elysia backend, Lucide icons  

---

## 1. Direction artistique

**Registre :** Dark luxury / mafieux. Interface froide, élégante, légèrement intimidante. Comme le back-office d'une organisation criminelle haut de gamme dans GTA RP. Pense club privé, pas salle d'arcade.

**Ce qui change :**
- Bebas Neue → Cormorant Garamond (display/titres)
- Violet criard → violet profond retenu
- Animations ponctuelles → cinématique partout (cascade, stagger, transitions de vues)
- Admin panel zinc neutre → même identité que le site principal

---

## 2. Design System — Tokens CSS

### Couleurs
```css
/* Fonds */
--bg:          #05050c;   /* page background */
--surface-1:   #0c0a1a;   /* cartes, panels */
--surface-2:   #12103a;   /* modales, elements surélevés */

/* Bordures */
--bdr:         rgba(255,255,255,.06);
--bdr-med:     rgba(255,255,255,.10);
--bdr-accent:  rgba(91,33,182,.25);

/* Violet (assombri et retenu) */
--v-900:  #2e1065;   /* fonds de sections */
--v-700:  #5b21b6;   /* primary actions, boutons CTA */
--v-500:  #7c3aed;   /* hover, states interactifs */
--v-300:  #a78bfa;   /* texte actif, icônes */
--v-dim:  rgba(91,33,182,.10);
--v-glow: rgba(91,33,182,.30);

/* Or vieux (désaturé, luxe) */
--gold:     #c9a84c;   /* chiffres, solde, gains */
--gold-dim: rgba(201,168,76,.15);

/* Sémantique */
--green:     #10b981;
--green-dim: rgba(16,185,129,.12);
--red:       #f43f5e;
--red-dim:   rgba(244,63,94,.12);

/* Texte */
--tx:   #f5f0ff;                  /* blanc légèrement violet */
--tx-2: rgba(245,240,255,.50);    /* muted */
--tx-3: rgba(245,240,255,.28);    /* dim */
--tx-4: rgba(245,240,255,.14);    /* très discret */

/* Radius */
--r1: 4px;
--r2: 8px;
--r3: 12px;
--r4: 20px;

/* Ombres (colorisées violet, pas noir neutre) */
--shadow-sm: 0 2px 8px rgba(5,5,12,.6);
--shadow-md: 0 8px 24px rgba(5,5,12,.7), 0 0 0 1px rgba(91,33,182,.08);
--shadow-lg: 0 20px 48px rgba(5,5,12,.8), 0 0 0 1px rgba(91,33,182,.10);
--shadow-v:  0 8px 32px rgba(91,33,182,.25);
```

### Typographie
```
Display  → Cormorant Garamond 600, 2.5–5rem, letter-spacing -0.02em
           Usage: logo, game titles, big numbers
Heading  → Cormorant Garamond 500, 1.25–2rem
           Usage: section titles, card heads
UI       → Inter 500, 0.875rem (14px)
           Usage: labels, nav, body text
Caption  → Inter 400, 0.75rem (12px), --tx-2
           Usage: hints, sous-titres, descriptions
Number   → Inter 700 tabular-nums, couleur --gold
           Usage: solde, stats, multiplicateurs
```

**Google Fonts à charger :**
```
Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500
Inter:wght@400;500;600;700
```

### Tokens d'animation
```css
--ease-out:  cubic-bezier(.16,1,.3,1);
--ease-back: cubic-bezier(.34,1.56,.64,1);
--ease-in:   cubic-bezier(.4,0,1,1);
--dur-fast:  180ms;
--dur-med:   320ms;
--dur-slow:  500ms;
--dur-enter: 600ms;
--stagger:   80ms;   /* délai entre éléments d'une cascade */
```

---

## 3. Système d'animations

### Classes réutilisables
```css
.anim-up    { animation: animUp    var(--dur-med) var(--ease-out) both; }
.anim-scale { animation: animScale var(--dur-med) var(--ease-back) both; }
.anim-left  { animation: animLeft  var(--dur-med) var(--ease-out) both; }
```

### Stagger via data-delay
```html
<div class="anim-up" data-delay="0">  <!-- 0ms   -->
<div class="anim-up" data-delay="1">  <!-- 80ms  -->
<div class="anim-up" data-delay="2">  <!-- 160ms -->
```
JS: `el.style.animationDelay = (parseInt(el.dataset.delay||0) * 80) + 'ms'`

### Transitions de vues
- Vue sortante : `translateX(-8px) + opacity:0` en 180ms
- Vue entrante : `translateX(8px→0) + opacity:0→1` en 320ms
- Délai 50ms entre sortie et entrée

### Événements jeu
| Événement | Animation |
|---|---|
| Gain normal | Balance countUp + flash vert |
| Gros gain (≥5×) | Confetti + win overlay |
| Jackpot (≥50×) | Overlay plein écran + pulse doré |
| Perte | Balance flash rouge + shakeX card |
| Bombe (Mines) | Explosion radiale + shakeX grille |
| Deal (Blackjack) | Carte glisse en diagonale depuis le haut |

---

## 4. Page de Login

### Concept : "Entrée dans le club"
Plein écran, fond `#05050c`. Halo violet `#2e1065` en haut à gauche (rotation lente 60s, radial-gradient animé). Pas de card englobante — les éléments flottent dans l'obscurité.

### Cascade d'entrée (5 temps)
```
0ms   → fond noir complet
300ms → "BlackState" monte + fade (Cormorant 600, 4.5rem)
600ms → "Casino Privé · Los Santos" (Cormorant italic, small-caps, letter-spacing .3em)
900ms → ligne séparatrice (1px, gradient violet→transparent, 200px wide)
1100ms → champs + bouton glissent de bas en haut
1400ms → bouton pulse doucement une fois
```

### Inputs
- Pas de card, pas de fond : les champs flottent
- `border: none; border-bottom: 1px solid --bdr-med;`
- Focus : `border-bottom-color: --v-500;` + glow subtil `box-shadow: 0 2px 0 --v-500`
- Labels au-dessus en Inter caption muted

### Bouton CTA
- Fond `--v-700`, Cormorant 600 1.1rem, `letter-spacing: .15em`, uppercase
- Hover : fond `--v-500`, `translateY(-1px)`

### Banner invitation
- Ligne dorée `#c9a84c` en Cormorant italic au-dessus des champs
- `"Invitation · X crédits"` fade-in si token présent

---

## 5. Home / Dashboard

### Concept : "Le QG du joueur"

### Cascade d'entrée
```
0ms    → sidebar glisse de la gauche
200ms  → hero card monte
500ms  → 3 stat cards en stagger (100ms)
800ms  → titre "Nos Jeux" fade
900ms  → 6 game cards en cascade (80ms)
1200ms → classement ligne par ligne
```

### Hero card
- Pleine largeur, `background: linear-gradient(135deg, #0c0a1a, #12103a)`
- Gauche : `"Bienvenue,"` Inter muted + `"[Pseudo]"` Cormorant 600 3rem blanc
- Dessous : niveau + barre XP fine
- Droite : solde en Cormorant 700 4rem or `#c9a84c`
- Badge vert pulsant `"Bonus disponible"` si dispo

### Stat cards (3)
- Grid 3 colonnes, fond `--surface-1`
- Chiffre : Cormorant 600 2rem, or
- Label : Inter caption muted
- Hover : lift 3px + bordure violet

### Game cards (6) — couleurs signature
```
Slots     → #1a0a3d  (violet profond)
Blackjack → #0a1628  (bleu nuit)
Mines     → #1f0a0a  (rouge sombre)
Plinko    → #0a1a12  (vert sombre)
Roue      → #1a1200  (or sombre)
Dice      → #0f1016  (gris bleu)
```
- Icône Lucide 32px centrée, couleur unique par jeu
- Nom en Cormorant Bold
- Description Inter caption
- Hover : lift 4px + fond s'intensifie

---

## 6. Sidebar

Reprend la structure shadcn déjà en place, palette mise à jour :
- Fond : `linear-gradient(180deg, #0a0818 0%, #06050f 100%)`
- Border-right : `rgba(91,33,182,.12)`
- Item actif : bg `rgba(91,33,182,.12)` + left-bar `#5b21b6` avec glow
- Item hover : bg `rgba(255,255,255,.04)`, texte `rgba(245,240,255,.82)`
- Section labels : Cormorant small-caps 0.7rem, `rgba(167,139,250,.5)`

---

## 7. Topbar

- Fond : `#05050c`, bordure bas `rgba(91,33,182,.12)`, height 52px
- Logo : `"Black"` blanc + `"State"` `#7c3aed`, Cormorant 600 1.6rem
- Solde : Cormorant 700 1.4rem, or `#c9a84c`
- XP bar : fine (3px), gradient violet
- Pseudo : Inter 500, muted
- Déconnexion : `.btn.ghost.sm`

---

## 8. Game Views

### Card header (unifié)
```
Icône Lucide 28px (couleur unique par jeu)
Nom en Cormorant 600 2.2rem
Sous-titre Inter italic caption muted
```

### Contrôles
- Inputs underline seulement (pas de box)
- Boutons qbet : petits, discrets, Inter 600
- Message résultat : Cormorant 500 pour les gains, Inter pour les pertes

### Profil
- Niveau : Cormorant 700 5rem gauche
- Barre XP : fine, élégante, 6px
- Stats grid : chiffres Cormorant or, labels Inter caption
- Bonus : `.btn.gold` seulement si disponible

---

## 9. Panel Admin

Reprend la même identité visuelle que le site principal (plus de zinc).

- Fond : `#05050c`, même palette que le site
- Sidebar admin : même style que sidebar principale
- Titres de pages : Cormorant 500 1.8rem
- Stat chips : Cormorant 700 or, bordure `--bdr-accent`
- Tables : même style que les tables utilisateur
- Boutons : mêmes que le site (sans `!important` partout)
- Badges logs : pills couleurs desaturées (violet, or, vert, rouge)
- Nav items : même left-accent bar, couleurs `--v-300` et `--v-700`

---

## 10. Fichiers à modifier

| Fichier | Type de changement |
|---|---|
| `public/index.html` | Nouveau lien Google Fonts, `data-delay` sur les cartes cascade, structure login |
| `public/style.css` | Réécriture complète |
| `public/app.js` | Fonction `initAnimations()` pour stagger, `countUp()` pour les chiffres, transitions de vues |

**Contrainte critique :** Tous les IDs et classes utilisés par `app.js` (`#balVal`, `.view`, `.nav-item`, etc.) doivent être préservés.
