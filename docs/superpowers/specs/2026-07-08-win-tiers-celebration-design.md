# Paliers de gain & écran de célébration — design

**Date :** 2026-07-08
**Statut :** design validé en brainstorming

## Objectif

Refondre le feedback de gain du casino en une hiérarchie **logique et lisible** —
`Win → Big Win → Mega Win → Jackpot` — et ajouter un **écran de célébration qui
reste affiché**, avec le **montant en très gros qui compte de 0 jusqu'au gain
final**, fermé par le joueur (clic / bouton **Continuer**).

Aujourd'hui les paliers sont décidés par un ratio flou (`win-s/m/big/mega`),
« MEGA WIN » est quasi inatteignable (max slots ×20 = borne haute de `win-big`),
le jackpot admin s'affiche comme un `win-big` lambda, et les confettis
s'effacent seuls en 5 s sans montant qui monte.

**Hors périmètre :** modèle cagnotte, RTP des jeux, mécanique du jackpot admin
(inchangée — on ne fait qu'améliorer sa *présentation* via le palier Jackpot),
paliers de perte (`lose`/`partial`/`push` conservés tels quels), portail, admin.

## Décisions de design (validées)

1. **Jackpot = top multiplicateur du jeu.** Déclenché par l'**événement de gain
   maximal** du jeu (pas par l'admin) → n'importe quel joueur peut le toucher par
   chance, donc le jackpot armé par l'admin tombe dessus **sans rien révéler**
   (contrainte « caché » respectée).
2. **Overlay count-up** sur **Big / Mega / Jackpot** uniquement. Un simple **Win**
   garde un feedback léger (glow machine + flash solde + toast) pour ne pas casser
   le rythme du jeu rapide.
3. **Fermeture** par le joueur : l'overlay **reste affiché** jusqu'à un clic
   n'importe où ou le bouton **Continuer** (pas d'auto-disparition).

## Les paliers

`mult = gain / mise`. Décision dans une fonction **pure** `Tiers.pickTier`.

| Palier | Condition | Feedback |
|---|---|---|
| `lose` | gain ≤ 0 | inchangé (shake machine + plateau assombri, « Perdu ») |
| `partial` | 0 < gain < mise | inchangé (plateau légèrement assombri, « −(mise−gain) ») |
| `push` | gain = mise | inchangé (« Mise rendue », neutre, aucun FX) |
| `win` | `mult` de ×1 (exclu) à **×5** | léger : `fx-win` (glow machine) + flash solde vert + toast `+X` |
| `big-win` | **×5 < mult ≤ ×10** | **overlay count-up** (violet) + confettis |
| `mega-win` | **mult > ×10** (et pas `top`) | **overlay count-up** plus imposant (violet intense) + confettis |
| `jackpot` | **`top` vrai ET mult ≥ ×10** | **overlay count-up** doré + confettis dorés + pulse écran |

**Seuils (constantes dans `tiers.js`)** : `BIG_MULT = 5`, `MEGA_MULT = 10`,
`JACKPOT_MIN_MULT = 10`.

**Ordre d'évaluation** (le jackpot prime sur mega) :
```
if (gain <= 0)      return 'lose'
if (gain < bet)     return 'partial'
if (gain === bet)   return 'push'
mult = gain / bet
if (isTop && mult >= JACKPOT_MIN_MULT) return 'jackpot'
if (mult > MEGA_MULT)                  return 'mega-win'
if (mult > BIG_MULT)                   return 'big-win'
return 'win'
```

Le gate `mult ≥ JACKPOT_MIN_MULT` empêche un « top » à faible mult de déclencher
un Jackpot (ex : top segment d'une roue faible-risque à ×3, ou un blackjack ×2.5).

### Conséquences concrètes par jeu
- **Slots** (mults 20/8/3/2/1.75/1.25) : 3×7️⃣ (×20) = **JACKPOT** ; 3×💎 (×8) =
  **BIG WIN** ; ×3 et moins = **WIN**. (Pas de Mega sur slots — rien entre ×10 et
  ×20 ; c'est voulu.)
- **Roue** : top segment du risque courant (`high` monte à ×50) → **JACKPOT** ;
  segments intermédiaires → Mega/Big/Win selon le mult.
- **Plinko** : top bin du risque courant → **JACKPOT** (si ≥ ×10) ; sinon
  Mega/Big/Win.
- **Dé** : gain à **chance ≤ 3** (mult ≥ `diceMult(3)` ≈ ×23) → **JACKPOT** ;
  mults élevés à chance plus haute → Mega/Big/Win.
- **Démineur** : **full-clear** (toutes les cases sûres) → **JACKPOT** (les mults
  full-clear dépassent ×10 pour tous les niveaux de bombes) ; cashout partiel →
  Mega/Big/Win selon le mult.
- **Blackjack** : max ×2.5 → toujours **WIN** (jamais d'overlay bloquant sur une
  main — logique, et le gate le garantit même si `top` était vrai).
- **Jackpot admin** : le jeu forcé renvoie sa réponse normale ; s'il atterrit sur
  le top mult (cas d'une petite mise forcée au sommet), `top` est vrai → écran
  **JACKPOT** ; sinon Mega/Big. Aucune trace admin, indiscernable.

## Le flag `top` (serveur)

Le serveur connaît l'issue gagnante ; il ajoute un booléen **`top`** à la réponse
JSON des jeux à multiplicateur (défaut `false`, additif, non cassant) :

- **Slots** : `top = mult === Math.max(...slotsJackpotMults())` (= ×20).
- **Roue** : `top = m === Math.max(...WHEEL[risk])` (top segment du risque joué).
- **Plinko** : `top = m === Math.max(...PK_MULT[risk])` (top bin du risque joué).
- **Dé** : `top = won && mult >= diceMult(3)` (gain à très basse chance).
- **Démineur** (cashout uniquement) : `top = gemsRevealed === minesMaxGems(bombs)`
  (board entièrement nettoyé).
- **Blackjack** : `top` non renvoyé (absent → `false` côté front).

Pour factoriser, ajouter dans `games.ts` de petits helpers purs testables :
- `slotsIsTop(mult): boolean`
- `wheelIsTop(risk, m): boolean`
- `plinkoIsTop(risk, m): boolean`
- `diceIsTop(chance, won): boolean`
- `minesIsTop(bombs, gems): boolean`

Les routes appellent ces helpers et ajoutent `top` à leur réponse. Le chemin du
jackpot admin (`jackpotResolve`) renvoie la réponse normale du jeu → `top` est
calculé pareil, aucune logique spéciale.

## Front — décision de palier (`core/tiers.js`)

Devient une **fonction pure** (déjà sans DOM) :
```js
Tiers.pickTier(gain, bet, isTop) -> 'lose'|'partial'|'push'|'win'|'big-win'|'mega-win'|'jackpot'
```
Expose aussi les constantes de seuils. Signature à un 3ᵉ argument `isTop`
(défaut `false`). Aucune dépendance à une map de config → pas de plomberie
`/api/config` (le `top` vient du serveur, les seuils sont locaux).

## Front — moteur d'effets (`casino.js` : `gameResult`)

`gameResult({ machine, bet, gain, balance, xp, level, push, top })` :
1. `key = push ? 'push' : Tiers.pickTier(gain, bet, !!top)`.
2. `setBalance(...)` (inchangé : count-up solde sidebar + flash + XP).
3. Texte `.machine-result` (inchangé : win `+X ·×Y` / lose / partial / neutral).
4. Classe machine `fx-<key>` (renommage des classes, cf. CSS).
5. **Si `key ∈ {big-win, mega-win, jackpot}`** → `showWinOverlay(key, gain, mult)`.
   Sinon si `win` → toast `+X` (feedback léger, pas d'overlay).

Tous les points d'appel de `gameResult` (slots, bj, mines ×3, plinko, wheel, dice)
passent `top: d.top`.

## Front — écran de célébration (`showWinOverlay`)

Overlay plein écran **persistant** (`#winOverlay`, remanié) :
- Structure : fond assombri ; au centre un **libellé de palier**
  (`BIG WIN` / `MEGA WIN` / `JACKPOT`), le **montant en très gros** (`#winAmount`)
  qui **compte de 0 → gain** via `countUp()` (~1,2 s), un **badge `×N`**
  (`#winMult`), un **bouton Continuer**. `#confettiCanvas` conservé.
- **Escalade visuelle** par palier via `data-tier` : `big-win` violet,
  `mega-win` violet intense + label plus grand, `jackpot` **doré** + confettis
  dorés + pulse de l'écran.
- **Reste affiché** : ne se ferme QUE sur clic n'importe où sur l'overlay ou sur
  **Continuer** (`hideWinOverlay()`). Plus de `setTimeout` d'auto-fermeture.
- Les confettis continuent d'animer le canvas ; palette dorée si `jackpot`.

## Front — HTML/CSS

- `casino.html` : remanier le bloc `#winOverlay` → `#winLabel`, `#winAmount`,
  `#winMult`, bouton `Continuer` (`onclick="hideWinOverlay()"`), fond cliquable
  (`onclick` sur l'overlay).
- `casino.css` : styles des paliers (`[data-tier="big-win|mega-win|jackpot"]`),
  overlay persistant (retrait de l'auto-hide), montant géant + count-up, variante
  **or** pour Jackpot, pulse écran. Renommer les classes FX machine
  (`fx-win-s/m/big/mega` → `fx-win/big-win/mega-win/jackpot`).

## Tests

- **Unitaire (nouveau `test/tiers.test.ts`)** — `Tiers.pickTier` pur :
  - `lose` (gain 0, gain<0), `partial` (gain<bet), `push` (gain=bet).
  - `win` (×2, ×5 exact = borne haute de win), `big-win` (×5.01, ×10 exact),
    `mega-win` (×15 sans top), `jackpot` (`isTop` + ×20 ; **PAS** jackpot si
    `isTop` mais mult ×2.5 < gate → `win`).
  - jackpot prime sur mega (`isTop` + ×50 → `jackpot`).
- **Unitaire (dans le test games)** — helpers `top` : `slotsIsTop(20)===true`,
  `slotsIsTop(8)===false` ; `wheelIsTop('high', 50)===true` ; `plinkoIsTop` top
  bin ; `diceIsTop(2,true)===true`, `diceIsTop(50,true)===false`,
  `diceIsTop(2,false)===false` ; `minesIsTop(3,22)===true`,
  `minesIsTop(3,10)===false`.
- **Manuel** : slots jusqu'au ×20 → écran **JACKPOT** doré, montant qui monte,
  reste jusqu'à Continuer ; ×8 → **BIG WIN** ; ×3 → **WIN** léger (pas d'overlay) ;
  full-clear démineur → **JACKPOT** ; blackjack → **WIN** ; armer un jackpot admin
  sur petite mise → écran Jackpot sans indice admin.

## Inchangé

- Modèle cagnotte, RTP, mécanique jackpot admin, paliers de perte, sidebar,
  solde, XP, portail, pages admin/profil/fight.
