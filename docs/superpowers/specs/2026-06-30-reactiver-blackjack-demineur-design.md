# Réactivation Blackjack & Démineur (intégration cagnotte)

**Date :** 2026-06-30
**Statut :** design validé en brainstorming (« ouai go »)

## Objectif

Rendre **Blackjack** et **Démineur** de nouveau jouables (ils sont codés mais
désactivés — routes 503, UI « Bientôt »), en les **intégrant à la cagnotte**
(réserve 70%) selon le principe **« empêcher l'impayable »** : pas de gain rogné,
mais on empêche le joueur d'atteindre un gain que la cagnotte ne peut pas payer.

**Hors périmètre :** modèle cagnotte lui-même, autres jeux, habillage `.machine`
(déjà fait en refonte), charte.

## État actuel

- Routes `/api/bj/deal` et `/api/mines/start` commencent par
  `set.status = 503; return {...}` → injouables.
- BJ/Mines **chargent et paient le solde joueur** (`charge`/`payout`) mais
  **n'appellent jamais `bookCasino`** → ils sont hors comptabilité cagnotte, et
  n'ont **aucun bridage budget**. Leur RTP ~0,70 vient de `BJ_BIAS` (36) et
  `MINES_RAKE` (0,11).
- UI verrouillée : nav (`nav-item locked` + `nav-soon` « Bientôt »), cartes
  d'accueil (`home-game-card locked` + `hg-soon`), vues (`machine locked` +
  `.machine-veil`), et garde `switchTab` (`casino.js` : `if (v === 'blackjack'
  || v === 'mines') { toast('Bientôt…'); return; }`).

## Économie cagnotte — « empêcher l'impayable »

Le **budget** = `casinoBudget()` = 30% × max(0, W − P), recalculé à chaque pas
(gère la cagnotte qui évolue, y compris avec d'autres joueurs).

### Blackjack — mise plafonnée
- Paiement max d'une main = `bet × BJ_BJ_MULT` (2,2, blackjack naturel).
- **Mise max = `floor(budget / BJ_BJ_MULT)`** au moment du `deal`. Le serveur
  **refuse** une mise supérieure (`400` + message « Mise max actuelle : {max}
  (cagnotte) »). Ainsi tout gain (≤ mise×2,2 ≤ budget) est toujours payable.
- Le front **affiche la mise max** courante (dérivée du budget exposé dans les
  réponses) et borne l'input.
- `BJ_BIAS` conservé (RTP ~0,70). La cagnotte est le garde-fou de solvabilité
  par-dessus.

### Démineur — montée limitée
- À chaque case sûre (après mise à jour de `st.mult`), on calcule le
  multiplicateur de la **case suivante** :
  `nextMult = st.mult × ((25−(k+1))/(safe−(k+1))) × (1−MINES_RAKE)` (avec
  `k = st.picks`, `safe = 25 − bombs`).
- Si **`bet × nextMult > budget`**, la réponse de `pick` porte un flag
  **`maxReached: true`** → le front **désactive les cases restantes** et invite
  à encaisser (« Max atteint — encaisse »).
- **Garantie côté serveur** (pas seulement UI) : à la requête `pick` suivante, si
  la partie est déjà en état `maxReached` (la case piochée pousserait le pot
  au-delà du budget), le serveur **refuse la case** (`400` + « Max atteint —
  encaisse »). Le rejet est **global à la partie** (ne révèle pas si la case visée
  est une bombe), et garantit que le gain encaissé reste ≤ budget.
- `MINES_RAKE` conservé (RTP ~0,70).
- Cas dégénéré (cagnotte ≈ 0 → budget ≈ 0) : `maxReached` quasi immédiat, le
  joueur ne peut quasiment rien gagner — cohérent avec la stinginess à cagnotte
  vide (comme les autres jeux).

### Comptabilité cagnotte
- **`bookCasino(bet, gain)` à la résolution**, atomique, comme les jeux one-shot :
  - BJ (`bjResolve`) : `bookCasino(bet, gain)` (gain = mise×mult sur victoire,
    = mise sur égalité/push, = 0 sur défaite/buste).
  - Mines : à l'encaisse / sweep `bookCasino(bet, gain)` ; à la bombe
    `bookCasino(bet, 0)`.
- Le wager n'est booké qu'à la fin (W += bet, P += gain), donc le budget pendant
  la partie ne compte pas la mise en cours (légèrement conservateur, sans risque).

## Architecture & fichiers

### `server.ts`
- `/api/bj/deal` : retirer la ligne `set.status = 503`. Ajouter, après la
  validation de la mise : `const max = Math.floor(casinoBudget() / G.BJ_BJ_MULT);
  if (bet > max) { set.status = 400; return { error: 'Mise max actuelle : ' + max
  + ' (cagnotte)' } }`.
- `bjResolve` : après le calcul du `gain` final (win/push/lose), ajouter
  `bookCasino(st.bet, gain)`.
- `/api/mines/start` : retirer la ligne `set.status = 503`.
- `/api/mines/pick` : **en début de handler**, si la partie est déjà `maxReached`
  (stocké dans l'état Mines), refuser (`400` + « Max atteint — encaisse »). Sinon,
  après le calcul de `st.mult`/`pot`, calculer `nextMult`, stocker/retourner
  `maxReached = bet × nextMult > casinoBudget()`. À la bombe :
  `bookCasino(st.bet, 0)`. Au sweep : `bookCasino(st.bet, pot)`.
- `/api/mines/cashout` : `bookCasino(st.bet, gain)` avant de répondre.
- Exposer le **budget cagnotte** au front pour l'affichage mise max BJ : l'ajouter
  à `userSnapshot` (renvoyé par toutes les réponses de jeu) — champ `budget`.

### Frontend (`public/casino.html` + `public/casino.js`)
- **Déverrouiller l'UI** :
  - nav : retirer `locked` + le `<span class="nav-soon">Bientôt</span>` des items
    Blackjack/Démineur.
  - cartes d'accueil : retirer `locked` + le `<div class="hg-tag hg-soon">Bientôt
    </div>` (remettre une vraie accroche, ex. « Bats le croupier » / « Évite les
    bombes »).
  - vues : retirer `machine locked` → `machine`, supprimer les `.machine-veil`.
  - `casino.js` : retirer le garde `switchTab` qui bloque `blackjack`/`mines`.
- **Brancher sur `gameResult`** : au lieu des anciens `#bjMsg`/`#minesMsg` +
  `flashBal`/`checkBigWin`, router le résultat final de BJ (`bjFinish`) et de
  Mines (bombe / encaisse / sweep) via `gameResult({ machine, bet, gain, balance,
  xp, level, push })` — toast/effets/indicateur cohérents avec les 4 autres jeux.
  (Égalité BJ → `push: true`.)
- **BJ** : afficher la **mise max** (`budget / 2,2`) à partir du `budget` reçu, et
  borner l'input ; gérer le message d'erreur « Mise max… » si dépassement.
- **Mines** : sur `maxReached`, désactiver les cases restantes et afficher « Max
  atteint — encaisse ».

## Inchangé
- `BJ_BIAS`, `MINES_RAKE`, la logique de jeu (cartes, bombes, multiplicateurs),
  le shell `.machine`, la charte, le modèle cagnotte, les autres jeux.

## Tests / vérification
1. **Backend** : `/api/bj/deal` et `/api/mines/start` ne renvoient plus 503 ;
   une mise BJ > `budget/2,2` est refusée (400 + message) ; `pick` renvoie
   `maxReached` quand `bet × nextMult > budget` ; `bookCasino` est appelé sur
   chaque issue (la cagnotte bouge). Économie : la réserve 70% tient (aucun gain
   payé ne dépasse le budget). Le smoke test cagnotte passe toujours.
2. **Frontend (utilisateur)** : Blackjack et Démineur sont déverrouillés (nav,
   accueil, plus de « Bientôt » ni voile) et jouables ; toast seulement sur gain
   net ; BJ affiche la mise max ; Mines bloque les cases au max et invite à
   encaisser ; pas de gain « rogné ».

## Hors périmètre
- Modèle cagnotte, autres jeux, refonte visuelle (habillage déjà fait), variantes
  de règles (split/double BJ, etc.).
