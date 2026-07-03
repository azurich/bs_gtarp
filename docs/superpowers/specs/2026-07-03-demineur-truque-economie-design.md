# Démineur truqué — refonte économie (RTP 70 %)

**Date :** 2026-07-03
**Statut :** design validé en brainstorming

## Objectif

Aligner le **Démineur** sur le modèle « maison contrôle tout » des autres jeux :
multiplicateurs **attractifs (hype)** tout en garantissant un **RTP ~70 %** comme
Slots/Roue/Blackjack. Le modèle actuel (placement de bombes équitable + marge
`MINES_RAKE` de 11 %) rend les multiplicateurs poussifs (ex. ×1.5 seulement à
8 gemmes en 3 bombes) et est le seul jeu « honnête » du casino — incohérent.

**Hors périmètre :** refonte visuelle du Démineur (barre d'infos, grille — traitées
côté UI), autres jeux, modèle cagnotte lui-même.

## Modèle

Les bombes ne sont **plus placées au départ**. À chaque clic, le serveur fait un
**tirage truqué** dont la probabilité de survie découle de la courbe de
multiplicateurs affichée. Propriété centrale (par construction) :

- Multiplicateur après `n` gemmes : **`M(n) = M1 × g^(n-1)`** (géométrique),
  `M(0) = 1` (mise rendue si on encaisse à 0 gemme — cas non exposé, la mise est
  simplement récupérable).
- Probabilité d'atteindre `n` gemmes : **`P(n) = 0.70 / M(n)`**.
- Donc **RTP à tout encaissement = `P(n) × M(n) = 0.70`** (exact, à chaque `n`).
- Probabilité de survie du clic `k` (passage `k-1 → k` gemmes) :
  - `k = 1` : **`0.70 / M1`** (l'avantage maison de 30 % est porté par le 1er clic)
  - `k ≥ 2` : **`1 / g`** (constant ; continuer est neutre en espérance, c'est un
    pari sur la variance)

**Conséquence assumée :** plus `M1` est gros, plus le 1er clic saute
(`bust = 1 − 0.70/M1 ≥ 30 %` toujours). Validé par l'utilisateur : hype = gros
gains rarement atteints.

## Courbes par nombre de bombes

Seuls **3 / 6 / 12** sont exposés (le serveur valide `bombs ∈ {3, 6, 12}`).

| Bombes | `M1` | `g` | Gemmes 1→5 | Bust 1er / suivants |
|---|---|---|---|---|
| 3  | 1.15 | 1.25 | 1.15 · 1.44 · 1.80 · 2.25 · 2.81 | 39 % / 20 % |
| 6  | 1.5  | 1.6  | 1.5 · 2.4 · 3.84 · 6.1 · 9.8      | 53 % / 37 % |
| 12 | 3.0  | 2.5  | 3 · 7.5 · 18.75 · 47 · 117        | 77 % / 60 % |

- **Grille** : 25 cases, `bombs` bombes → **max gemmes = `25 − bombs`**. Atteindre
  toutes les cases sûres = **sweep** → encaissement automatique au multiplicateur
  courant. (Multiplicateurs de fin de grille énormes mais quasi jamais atteints —
  jackpot vitrine.)

## Truquage & affichage des bombes

- Le clic sur la case `i` ne détermine pas l'issue (c'est le tirage truqué qui
  décide safe/bombe) — comme les autres jeux, « le serveur décide ». La case `i`
  est révélée gemme (safe) ou bombe (perte).
- À la **perte** ou au **sweep**, on place `bombs` bombes sur des cases non
  révélées (dont la case fatale à la perte) **pour l'affichage** de fin, afin que
  la grille montre un décompte cohérent.
- Au plus **une** bombe est « touchée » en jeu (le clic fatal met fin à la partie).

## Cagnotte — « empêcher l'impayable » (conservé)

- **Plafond de mise au start** : `floor(budget / M1[bombs])` (le 1er gain est
  toujours payable).
- **`maxReached`** : après chaque gemme, si `bet × M(gems+1) > budget`, on bloque la
  continuation (case suivante refusée côté serveur, `maxReached: true` côté front)
  → le gain encaissé reste toujours ≤ budget malgré les multiplicateurs qui
  explosent.
- `bookCasino(bet, gain)` inchangé : perte → `(bet, 0)` ; encaisse/sweep →
  `(bet, gain)`. Parties abandonnées (cleanup) → `(bet, 0)` (déjà en place).

## Architecture & fichiers

### `games.ts`
- **Retirer** `MINES_RAKE`, `minesStepFactor`, et le placement équitable
  (`placeBombs` fair) devient inutile pour la logique d'issue.
- **Ajouter** :
  - `MINES_RTP = 0.70`
  - `MINES_CURVES: Record<3|6|12, { m1: number; g: number }>` (valeurs ci-dessus)
  - `minesMult(bombs, gems): number` → `m1 × g^(gems-1)` (gems ≥ 1 ; gems 0 → 1)
  - `minesSafeProb(bombs, pick): number` → `pick===1 ? MINES_RTP/m1 : 1/g`
  - (optionnel) `minesMaxGems(bombs) = 25 - bombs`

### `server.ts` (handlers Mines)
- `/api/mines/start` : valider `bombs ∈ {3,6,12}` ; plafond mise
  `floor(casinoBudget() / G.minesMult(bombs, 1))` ; état sans `bombSet` pré-placé.
- `/api/mines/pick` : refuser si `maxReached` ; sinon **tirer** safe/bombe via
  `rnd() < G.minesSafeProb(bombs, st.picks + 1)`. Sur bombe : `bookCasino(bet,0)`,
  fin, révéler bombes d'affichage. Sur gemme : `st.gems++`,
  `st.mult = G.minesMult(bombs, st.gems)`, `pot = round(bet × st.mult)` ; si
  `st.gems === 25 - bombs` → sweep (payout + bookCasino + fin) ; sinon calculer
  `st.maxReached = bet × G.minesMult(bombs, st.gems + 1) > casinoBudget()`.
- `/api/mines/cashout` : `gain = round(bet × st.mult)` (inchangé dans la forme).

### `public/casino.js`
- L'affichage utilise déjà `pot/mise` pour le multiplicateur → cohérent. Vérifier
  le rendu des bombes de fin (le serveur renvoie toujours un tableau `bombs`).

### Tests
- **Retirer** les tests `minesStepFactor` de `tests/cagnotte-stateful.test.ts`.
- **Ajouter** `tests/mines.test.ts` :
  - `minesMult`/`minesSafeProb` valeurs exactes (M1, g par mode).
  - **Simulation RTP** : pour chaque mode, jouer N parties avec des politiques
    d'encaissement variées → RTP mesuré ≈ **0.70** (tolérance serrée, c'est exact
    par construction).

## Tests / vérification
1. **Automatisé** : `bun test` — RTP ≈ 0.70 pour 3/6/12 bombes (simulation) ;
   `minesMult`/`minesSafeProb` corrects ; plus aucune référence à `minesStepFactor`.
2. **Manuel** : jouer en 3/6/12 bombes — multiplicateurs punchy, le multiplicateur
   affiché = gain encaissable (déjà corrigé), `maxReached` bloque toujours à temps,
   révélation des bombes cohérente, cagnotte jamais dépassée.

## Inchangé
- Modèle cagnotte, autres jeux, shell `.machine`, refonte visuelle du Démineur
  (séparée), plafond « empêcher l'impayable » (conservé, adapté aux nouveaux mult).
