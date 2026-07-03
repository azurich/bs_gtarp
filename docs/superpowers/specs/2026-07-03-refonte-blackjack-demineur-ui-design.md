# Refonte UI Blackjack & Démineur (parité machines)

**Date :** 2026-07-03
**Statut :** design validé en brainstorming

## Objectif

Amener **Blackjack** et **Démineur** au même niveau que les autres machines déjà
refondues : finition « feutre & néon », **tenue dans l'écran sans scroll** (desktop
et mobile), et **réparation de la table de Blackjack** mal dimensionnée. Le shell
partagé `.machine` (tête / board / contrôles / résultat) est déjà en place ; on
refait les parties **spécifiques au jeu**.

**Hors périmètre :** logique de jeu (backend intact — BJ/Mines fonctionnent),
cagnotte, autres machines, portail.

## Problèmes actuels (constatés sur captures)

1. **Table BJ cassée** : `.bj-table` est un `grid` sans largeur ni colonnes → il se
   réduit à la largeur du texte « CROUPIER » → **bande verticale étroite**. Les
   zones de cartes vides (`.cards { min-height: clamp(80px,20vh,170px) }` ×2) la
   rendent haute et vide avant la distribution.
2. **Débordement vertical** : tailles trop généreuses (cartes jusqu'à `23vh`, grille
   Mines `min(90vw,48vh,520px)`) → la vue dépasse la hauteur d'écran → **scroll**,
   et la barre d'infos Démineur passe **sous la ligne de flottaison**.
3. **Finition** : parties spécifiques (table, tuiles, barres) moins abouties que les
   autres machines ; `#bjMaxBet` réutilise une classe empruntée au Dice
   (`dice-result-cap`).

## Design

### 1. Fit-to-viewport (les deux jeux)
La vue de jeu est une **colonne flex bornée à la hauteur disponible** : `machine-head`
et `machine-controls` prennent leur taille naturelle ; le **`machine-board`** occupe
le reste (`flex:1; min-height:0`) et son contenu (table BJ / grille Mines) se met à
l'échelle via `clamp()` + unités conteneur (`cqw`/`cqh`) et `min()` bornées par la
hauteur, pour **ne jamais déborder**. Cible : **aucun scroll** aux hauteurs
courantes (≥ ~700px desktop) ; en très petit/mobile, dégradation propre (réduction,
pas de casse).

### 2. Blackjack — vraie table
- `.bj-table` : **largeur pleine du board**, feutre **horizontal**, 2 rangées
  (Croupier en haut, Vous en bas), bien proportionnées.
- **Emplacements de cartes dessinés** (contours discrets) présents dès l'ouverture,
  pour que la table ait de la présence avant la distribution — plus de zone vide.
- Cartes (`.pcard`) redimensionnées (via `clamp`/unités conteneur bornées hauteur)
  pour que **table + mise + actions + résultat** tiennent dans l'écran.
- `#bjMaxBet` : classe/style propre (retirer l'emprunt `dice-result-cap`).

### 3. Démineur — grille + infos qui tiennent
- `.mines-grid` plafonnée en hauteur (bornée par `cqh`/`vh` plus petits) pour laisser
  la place à **config + JOUER/ENCAISSER + barre d'infos**, **tout visible sans
  scroll**.
- Tuiles (`.cell`) et barre `.mines-info` repassées au niveau premium, espacements
  resserrés ; garder le comportement `.maxed` existant.

### 4. Cohérence visuelle
Réutiliser les tokens et le langage des autres machines (accents `var(--accent*)`,
rayons, ombres, typographies `--display`/`--num`). Ne pas coder de couleur d'accent
en dur. Le feutre vert de la table BJ reste (identité blackjack), harmonisé au thème.

## Architecture & fichiers
- `public/casino.css` : gros du travail (blocs `.bj-table`/`.hand`/`.cards`/`.pcard`,
  `.mines-grid`/`.cell`/`.mines-cfg`/`.mines-info`, sizing `.game-view`/`.machine-board`
  pour le fit).
- `public/casino.html` : retouches markup mineures si nécessaires (ex. slots de cartes,
  wrapper de rangée, remplacer la classe `dice-result-cap` de `#bjMaxBet`).
- `public/casino.js` : uniquement si des emplacements de cartes doivent être rendus
  (sinon inchangé).
- **Backend intact.**

## Tests / vérification
1. **Visuel (utilisateur, sur captures)** : Blackjack affiche une vraie table large
   (pré-distribution correcte), Démineur montre grille + config + infos **sans
   scroll** ; les deux tiennent dans l'écran (PC et fenêtre réduite/mobile) et sont
   au niveau des autres machines. Itération sur captures.
2. **Non-régression** : `bun test` passe toujours (le front n'est pas testé
   unitairement — vérif visuelle) ; jouer une main de BJ et une partie de Mines
   fonctionne comme avant (distribution, hit/stand, pioche, cashout, effets/toasts).

## Inchangé
- Backend et logique de jeu, cagnotte, shell `.machine`, autres machines, charte.
