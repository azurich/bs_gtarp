# Jackpot admin (caché) — design

**Date :** 2026-07-07
**Statut :** design validé en brainstorming

## Objectif

Donner à l'**admin** un pouvoir caché : **armer un jackpot** depuis la section
Cagnotte. Le **prochain joueur** qui lance **n'importe quel jeu** (les 6) remporte un
gros gain = `aléa(30-60 %) × base`. **Aucun joueur ne doit savoir que l'admin peut
déclencher ça** : pas de bandeau, pas d'annonce, pas d'attribution admin ; le
gagnant voit une célébration générique et croit avoir touché un jackpot du jeu.

**Hors périmètre :** faire « jouer » visuellement les jeux instantanés avant la
révélation (polish futur), modèle cagnotte lui-même, autres pouvoirs admin.

## Mécanique

- **Armement (admin)** : l'admin arme un jackpot en choisissant la **base** :
  - **GROS** → base = **pool** = `wagered − paid` (cagnotte totale)
  - **PETIT** → base = **budget** = `0.30 × pool` (part payable)
  Un seul jackpot armé à la fois (ré-armer remplace). Annulable.
- **Déclenchement (uniforme, 6 jeux)** : au **point de mise / démarrage** de la
  prochaine partie (slots, plinko, roue, dé, `bj/deal`, `mines/start`), si un
  jackpot est armé, la partie est **court-circuitée** → le joueur est crédité du
  jackpot et reçoit une réponse `{ jackpot: true, gain, …snapshot }`. Le
  `pendingJackpot` est consommé (remis à `null`).
- **Montant** (calculé au déclenchement, sur le pool courant) :
  `pct = 0.30 + random()*0.30` ; `baseAmount = base==='pool' ? pool : 0.30*pool` ;
  `gain = round(baseAmount * pct)`. Pool ≈ 0 → gain ≈ 0.

## État serveur

Variable module dans `server.ts`, à côté de `activeBJ`/`activeMines` :
```ts
let pendingJackpot: { base: 'pool' | 'budget'; armedBy: string } | null = null
```
En mémoire → **perdu au redémarrage** (événement éphémère, acceptable).

## Serveur — helper + hooks + endpoints

### Helper `awardJackpot(u, bet, gameKey, set)`
Court-circuite une partie en jackpot (renvoie le corps de réponse) :
1. `if (!charge(u, bet, gameKey)) { set.status = 400; return { error: 'Crédits Club insuffisants' } }`
2. `pool = max(0, wagered − paid)` ; `baseAmount = pendingJackpot.base==='pool' ? pool : CASINO_RESERVE*pool`
3. `pct = 0.30 + Math.random()*0.30` ; `gain = Math.round(baseAmount*pct)`
4. `payout(u, gain, gameKey)` ; `bookCasino(bet, gain)` ; `awardXP(u.id, bet)`
5. `recordHistory(u.id, gameKey, bet, gain, 'jackpot')`
6. `logEvent(pendingJackpot.armedBy, 'admin', 'JACKPOT gagné par ' + u.username + ' : ' + gain + ' (' + gameKey + ', ' + Math.round(pct*100) + '% du ' + pendingJackpot.base + ')', gain)`
7. `pendingJackpot = null`
8. `return { jackpot: true, gain, ...userSnapshot(u.id) }`

### Hook (6 routes)
Dans `/api/play/{slots,plinko,wheel,dice}`, `/api/bj/deal`, `/api/mines/start`, juste
après la validation de la mise (et **avant** le `charge`/déroulé normal) :
```ts
if (pendingJackpot) return awardJackpot(u, bet, '<gameKey>', set)
```
(gameKey = `slots`/`plinko`/`wheel`/`dice`/`blackjack`/`mines`). Le reste de la route
est inchangé.

### Endpoints admin (protégés `checkAdmin`)
- `GET /api/admin/jackpot` → `{ armed: !!pendingJackpot, base: pendingJackpot?.base ?? null }`
- `POST /api/admin/jackpot` body `{ base }` → si `base ∈ {'pool','budget'}` :
  `pendingJackpot = { base, armedBy: adm.username }`, `logEvent(adm, 'admin', 'Jackpot armé (' + base + ')')`, `return { ok: true, base }` ; sinon 400.
- `DELETE /api/admin/jackpot` → `pendingJackpot = null`, `logEvent(adm, 'admin', 'Jackpot annulé')`, `return { ok: true }`.

## Frontend — admin (`admin.html` + `admin.js`)

Dans la section **Cagnotte**, un bloc **« Jackpot »** :
- 2 boutons **Armer GROS** / **Armer PETIT** ; **Annuler** (visible si armé) ;
  affichage de l'**état** (armé + base) et de la **fourchette estimée** d'après le
  pool courant : GROS = `30-60 % × pool`, PETIT = `30-60 % × budget` (valeurs déjà
  fournies par `GET /api/admin/casino` : `pool`, `budget`).
- `admin.js` : appels `GET/POST/DELETE /api/admin/jackpot`, rafraîchit l'état, met à
  jour les fourchettes après chaque changement de cagnotte.

## Frontend — joueur (`casino.js` + `casino.css`)

- **Détection** : chaque handler de jeu (slots, plinko, wheel, dice, `bjDeal`,
  `minesStartGame`) teste `if (d.jackpot) { showJackpot(d.gain); setBalance(...); return; }`
  **avant** le rendu normal du résultat.
- **`showJackpot(gain)`** : overlay générique **« JACKPOT ! »** + montant, animation
  festive (réutilise l'ambiance des gros gains). **Aucune mention de l'admin** ni du
  caractère déclenché. Crédite le solde.
- Aucun autre changement côté joueur (pas de bandeau d'armement, pas de polling).

## Cagnotte / solvabilité

`bookCasino(bet, gain)` : le jackpot fait chuter le pool (`paid += gain`). Un GROS
jackpot dépasse volontairement le cap normal (30 %) et pioche dans la réserve — c'est
le but. Aucun risque d'impayable : `gain ≤ pool` (base pool, pct ≤ 60 %) ou
`gain ≤ 0.18×pool` (base budget), toujours ≤ solde de la cagnotte.

## Cas limites
- **Pool ≈ 0** : jackpot ≈ 0 (l'admin voit le pool avant d'armer).
- **Crédits insuffisants** : le joueur ne peut pas lancer → 400, le jackpot reste
  armé pour le prochain joueur solvable.
- **Un seul armé** : ré-armer remplace ; annuler vide.
- **Redémarrage serveur** : l'armement est perdu (mémoire).

## Tests / vérification
1. **Backend** : armer (POST) → `GET` renvoie `armed:true` ; un jeu suivant renvoie
   `jackpot:true` avec `gain = round(pct×base)` dans la fourchette ; `pendingJackpot`
   consommé (2e jeu = normal) ; `bookCasino` a réduit le pool ; annuler (DELETE)
   fonctionne ; endpoints refusés hors admin (403). Un test unitaire couvre le calcul
   du montant (`jackpotAmount(base, pool, pct)` pur, extrait dans `games.ts`).
2. **Manuel** : armer GROS/PETIT depuis l'admin → jouer un jeu (chaque type) →
   célébration générique + solde crédité ; rien côté joueur ne révèle l'admin ; le
   journal admin trace arm/annulation/gain.

## Inchangé
- Modèle cagnotte, RTP des jeux, autres routes, charte, portail.
