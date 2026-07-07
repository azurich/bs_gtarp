# Jackpot admin v2 — multiplicateur réel forcé (corrigé)

**Date :** 2026-07-07
**Statut :** design validé en brainstorming (remplace la v1)

## Pourquoi v2

La **v1** court-circuitait le jeu et créditait un montant plat aléatoire (% de la
cagnotte) **sans que la machine tourne** — ce n'était pas l'intention. La **v2** :
la machine **tourne normalement** et est **forcée sur un vrai multiplicateur du
jeu** tel que le gain (`mise × mult`) approche un **montant-cible** sans le dépasser,
et **toujours payable**. Un gros gain **légitime**, indiscernable d'un coup de chance
(rien ne révèle l'admin).

## Périmètre

- **4 jeux à multiplicateur** : Slots, Roue, Plinko, Dé. **Blackjack & Démineur
  exclus** (pas de gros multiplicateur en un coup).
- **Hors périmètre** : modèle cagnotte, RTP normal des jeux, autres pouvoirs admin.
- **Réutilisé de la v1** : `jackpotAmount()` (games.ts) pour la cible ; le bloc admin
  « Jackpot » (armer GROS/PETIT, annuler). **Remplacé** : le hook serveur et tout le
  front v1 (overlay `showJackpot` + gardes `d.jackpot`) sont **retirés**.

## Mécanique

À l'armement, l'admin choisit la **base** : GROS = `pool` (= `wagered − paid`),
PETIT = `budget` (= `0.30 × pool`). Puis, au **prochain jeu à multiplicateur** :

1. **Cible** : `pct = 0.30 + Math.random()*0.30` ; `cible = jackpotAmount(base, pool, 0.30, pct)` (= `pct × pool` ou `pct × 0.30×pool`). Comme `cible ≤ 0.60×pool ≤ pool`, elle est **toujours payable** par la cagnotte (le jackpot pioche dans la réserve, au-delà du cap normal de 30 %).
2. **Multiplicateur désiré** : `desiredMult = cible / mise`.
3. **Choix du multiplicateur réel** : `chosenMult = pickJackpotMult(multsDuJeu, desiredMult)` = le **plus grand** multiplicateur réel du jeu `≤ desiredMult` (donc `mise × chosenMult ≤ cible`), plafonné par le top du jeu (petite mise → on tape le top). Renvoie `null` si aucun multiplicateur du jeu n'est `≤ desiredMult` (mise trop grosse).
4. **Si `chosenMult` existe** → la machine est **forcée** sur un résultat gagnant à ce multiplicateur ; `gain = round(mise × chosenMult)` ; `charge`/`payout`/`bookCasino`/`awardXP`/`recordHistory` normaux ; **jackpot consommé** (`pendingJackpot = null`) ; réponse = **la réponse normale du jeu** (reels/index/bin/roll + gain) → le front l'anime comme un gros gain ordinaire.
5. **Si `null`** (mise trop grosse pour un multiplicateur payable ≤ cible) → **pas de jackpot** : le jeu se déroule normalement et `pendingJackpot` **reste armé** pour le prochain joueur.

## Multiplicateurs forçables par jeu (games.ts)

- **Slots** : brelans → `[[20,'7️⃣'],[8,'💎'],[3,'🔔'],[2,'🍒'],[1.75,'⭐'],[1.25,'🍋']]`. Forcer = renvoyer `fill3(symbole)` pour le multiplicateur choisi.
- **Roue** : `WHEEL[risk]` (tableau des multiplicateurs par segment, selon le risque choisi par le joueur). Multiplicateurs candidats = valeurs distinctes de `WHEEL[risk]`. Forcer = renvoyer un `index` de segment portant `chosenMult`.
- **Plinko** : `PK_MULT[risk]` (multiplicateurs par bin). Candidats = valeurs distinctes. Forcer = renvoyer un `bin` portant `chosenMult`.
- **Dé** : un seul multiplicateur possible = `(100/chance)×RTP` (fixé par la chance du joueur). Pas de choix ; on **force une victoire** si ce mult `≤ desiredMult` (et donc payable), sinon `null` (pas de jackpot). Forcer = renvoyer un `roll` gagnant.

**Note discrète** : parce que les multiplicateurs sont discrets, `mise × chosenMult`
n'atteint pas toujours la cible pile (surtout sur petite mise où le top du jeu est le
plafond) — c'est le comportement voulu (« le plus gros mult réaliste »).

## Fonctions pures (games.ts) — testables

- `pickJackpotMult(mults: number[], desiredMult: number): number | null` — plus grand `m ∈ mults` avec `m ≤ desiredMult`, sinon `null`.
- `slotsJackpot(bet: number, mult: number): { reels: string[]; mult: number; gain: number }`
- `wheelJackpot(bet: number, risk: string, mult: number): { index: number; mult: number; gain: number }`
- `plinkoJackpot(bet: number, risk: string, mult: number): { bin: number; mult: number; gain: number }`
- (Dé : pas de helper dédié — victoire forcée gérée côté serveur avec le mult du jeu.)
- Exposer les multiplicateurs candidats : `slotsJackpotMults(): number[]` (= `[20,8,3,2,1.75,1.25]`), `wheelMults(risk)`, `plinkoMults(risk)` (valeurs distinctes triées desc).

## Serveur (server.ts)

- `pendingJackpot: { base: 'pool'|'budget'; armedBy: string } | null` — **conservé** (v1).
- Endpoints admin `GET/POST/DELETE /api/admin/jackpot` — **conservés** (v1).
- **Remplacer** le hook v1 (`if (pendingJackpot) return awardJackpot(...)`) dans les 4 routes multiplicateur par la logique v2 : calculer `cible`, `desiredMult`, `chosenMult` ; si non-`null`, produire le résultat forcé (via le helper du jeu) + `charge`/`payout`/`bookCasino`/`awardXP`/`recordHistory(gameKey, bet, gain, 'jackpot')` + `logEvent(armedBy, 'admin', …)` + `pendingJackpot = null` + renvoyer la réponse normale du jeu ; sinon, laisser le jeu se dérouler normalement (jackpot reste armé).
- **Retirer** le hook des routes `/api/bj/deal` et `/api/mines/start`.
- **Supprimer** le helper `awardJackpot` v1 (remplacé par la logique par-jeu, factorisée dans un helper `tryJackpot(u, bet, gameKey, ctx…)` qui renvoie le résultat forcé ou `null`).

## Front (casino.js + casino.css)

- **Retirer** tout le code jackpot v1 : la fonction `showJackpot`, les 6 gardes
  `if (d.jackpot) …`, et l'overlay `.jackpot-*` dans casino.css. Le jeu forcé renvoie
  une réponse **normale** (reels/index/bin/roll + gros `gain`) → l'animation et la
  célébration de gain existantes (`gameResult`, effets gradués) s'en chargent. Rien
  de spécifique côté joueur (c'est le but : indiscernable d'un gros coup de chance).

## Admin (inchangé vs v1)
Bloc « Jackpot » dans la Cagnotte (Armer GROS/PETIT, Annuler, fourchettes, état) —
déjà en place, conservé.

## Solvabilité
`gain = mise × chosenMult ≤ cible ≤ pool` → toujours payable ; `bookCasino` fait
chuter le pool. Mise énorme → `chosenMult = null` → pas de jackpot (le joueur ne peut
pas décrocher un gain impayable). Pool ≈ 0 → cible ≈ 0 → `desiredMult ≈ 0` → `null`.

## Tests / vérification
1. **Automatisé** (pur) : `pickJackpotMult` (plus grand ≤ desired, `null` si aucun) ;
   `slotsJackpot`/`wheelJackpot`/`plinkoJackpot` renvoient un résultat cohérent
   (mult demandé, `gain = round(bet*mult)`, reels/index/bin valides pour ce mult).
   `jackpotAmount` (déjà testé).
2. **Manuel** : armer PETIT/GROS ; jouer slots à petite mise → la machine tombe sur
   trois 7️⃣ (×20) et gros gain ; à grosse mise → un palier plus bas, gain ≈ cible ;
   all-in → pas de jackpot, jeu normal, jackpot reste armé ; le tout **sans overlay
   spécial** (gros gain normal) ; journal admin trace l'armement et le gain.

## Inchangé
- Modèle cagnotte, RTP normal, autres jeux, charte, portail.
