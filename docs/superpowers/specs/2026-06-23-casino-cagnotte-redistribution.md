# Casino — Modèle économique « cagnotte / redistribution » (V1)

**Date :** 2026-06-23
**Statut :** spec validé sur le principe (« on part sur ça pour l'instant »)

## Objectif

Remplacer le modèle RTP fixe (marge maison par mise, indépendante) par un **pool global redistributif** (la « cagnotte ») :

- La cagnotte **part de 0** et grossit à chaque mise perdue.
- Les gains des joueurs sont **bornés par la cagnotte** : une machine ne peut pas tirer un multiplicateur dont le gain dépasse ce que la cagnotte peut payer.
- La cagnotte garde toujours une **réserve de 70%** → le casino reste solvable et gagnant en général, en partant de 0.
- Sessions **variables** (le joueur peut finir + ou −), pour rester captivant, une fois la cagnotte amorcée.

## Modèle économique

### Comptabilité globale (persistée)

Deux compteurs cumulés, tous joueurs / tous jeux confondus :

- `W` = total misé
- `P` = total payé aux joueurs (gains bruts crédités)
- **Cagnotte = `W − P`** (le net accumulé de la maison)

### Règle de bridage

Avant de résoudre une partie de mise `bet` :

```
pool      = max(0, W − P)          // cagnotte AVANT cette mise
budget    = 0.30 × pool            // 30% dispo, 70% gardés en réserve
maxGain   = budget                 // gain brut maximum payable ce tour
maxMult   = bet > 0 ? budget / bet : 0
```

La machine **ne peut produire qu'un résultat dont `gain ≤ budget`** (donc `mult ≤ maxMult`). Les multiplicateurs au-dessus sont **retirés du tirage** (proba redistribuée vers le bas / la perte). Ils restent **affichés** dans la grille du jeu mais sont injouables tant que la cagnotte ne suit pas.

Après résolution (gain effectif `g`) :

```
W += bet
P += g
```

### Propriétés

- `pool = 0` (début) → `budget = 0` → seul `gain = 0` est tirable → **x0 garanti**, le joueur perd, la cagnotte se remplit. ✅ « premiers crédits pas gagnants ».
- La cagnotte grossit (mises perdues) → `budget` grandit → des multiplicateurs de plus en plus gros se débloquent → sessions variées.
- Après chaque payout, `pool_après = pool + bet − g ≥ 0.70 × pool` → réserve 70% toujours respectée, casino jamais à sec.
- **Marge maison de base** conservée dans les distributions des jeux (EV des paytables calibrée à RTP 0.70) → la maison gagne sur la durée même quand la cagnotte est grande et ne bride plus rien.
- Le plafond réel de chaque multiplicateur reste celui de la **grille du jeu** (le budget ne crée pas de jackpots au-delà des paytables, il ne fait que les débloquer progressivement).

### Atomicité

bun:sqlite est synchrone et la résolution d'une partie est **synchrone** (RNG + écritures DB, aucun `await` au milieu) → pas d'entrelacement entre requêtes sur le pool. Lecture `W,P` puis écriture `W+=bet, P+=g` dans le même handler, sans `await` intermédiaire.

## Stockage

Table mono-ligne :

```sql
CREATE TABLE IF NOT EXISTS casino (
  id      INTEGER PRIMARY KEY CHECK (id = 1),
  wagered REAL NOT NULL DEFAULT 0,
  paid    REAL NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO casino (id, wagered, paid) VALUES (1, 0, 0);
```

Statements : `getCasino` (SELECT), `addWagered` (UPDATE wagered += ?), `addPaid` (UPDATE paid += ?) — ou un seul `UPDATE wagered = wagered + ?, paid = paid + ? WHERE id = 1`.

## Implémentation par machine (V1)

Une fonction utilitaire centrale côté serveur :

```ts
// renvoie le gain effectif (peut être 0), met à jour la cagnotte
function settle(bet: number, naturalGain: number): number { ... }   // pour Dice/Slots déjà résolus
// ou expose budget pour brider le tirage en amont :
function casinoBudget(): number  // = 0.30 * max(0, W - P)
function bookRound(bet: number, gain: number): void   // W+=bet; P+=gain
```

### Roue (Wheel) — *a déjà des x0*
`WHEEL = [0, 1.5, 0, 2, 0, 1.5, 0, 5, 0, 1.5, 0, 2, 0, 1.5, 0, 15]`.
Tirage pondéré **filtré** : on ne garde que les segments où `WHEEL[i] × bet ≤ budget`, on renormalise les poids, on tire. Les segments 0 sont toujours dispo → à cagnotte vide, on ne tombe que sur du 0. La roue visuelle affiche toujours ses 16 segments.

### Dice — *a déjà des x0*
Le joueur fixe une `chance` → `mult = (100/chance) × RTP` (fixe). Si `mult × bet > budget`, le **tir est forcé perdant** (l'aléatoire ne peut pas sortir un gagnant non payable). Sinon tir normal (gagne si `roll < chance`). → les réglages très payants (faible chance, gros mult) sont ingagnables tant que la cagnotte est petite.

### Slots — *a déjà des x0*
Résolution = tirage d'un résultat (combo) avec multiplicateur. On **exclut les combos gagnants dont `mult × bet > budget`** du tirage (renormalisation), le reste de la proba va vers les combos perdants / petits. (À détailler dans le plan selon la résolution actuelle des rouleaux.)

### Plinko — *REFONTE : ajout de x0 + profils de risque + bridage*
Le serveur décide la case via la binomiale (`plinkoBin`) puis le client anime la bille vers cette case → on peut **brider en amont** : binomiale **restreinte aux cases payables** (`mult × bet ≤ budget`), renormalisée. La bille tombe donc toujours sur une case payable.

Nouveaux profils (avant `normMults`, qui recale l'EV sur RTP 0.70) — valeurs à vérifier après normalisation :

```
faible : [3, 2, 1.4, 1.1, 0.8, 0.6, 0.5, 0.6, 0.8, 1.1, 1.4, 2, 3]      // régulier, pas de 0
moyen  : [12, 4, 1.6, 0.6, 0, 0, 0, 0, 0, 0.6, 1.6, 4, 12]               // x0 au centre, équilibré
élevé  : [40, 10, 3, 0.4, 0, 0, 0, 0, 0, 0.4, 3, 10, 40]                 // large x0, gros bords rares
```

Objectif : « faible » = sûr/régulier, « élevé » = vraie haute variance (perte le plus souvent, jackpot rare). Les valeurs exactes seront ajustées pour que les multiplicateurs normalisés restent sensés (pas de bords absurdes).

### Blackjack & Démineur — *DÉSACTIVÉS en V1*
- UI : items de nav + cartes d'accueil **verrouillés** (badge « Bientôt », non cliquables / message coming soon), comme Fight.
- Serveur : routes `/api/bj/*` et `/api/mines/*` renvoient une erreur « temporairement indisponible » (le code reste, juste coupé).
- Réactivation ultérieure avec leur traitement propre (plafond de mise pour que tout gain légitime soit toujours payable).

## Admin

Onglet « Machines / RTP » → **« Cagnotte »** :
- Cagnotte actuelle (`W − P`), total misé (`W`), total payé (`P`).
- Marge réelle observée (`1 − P/W`) et RTP réel (`P/W`).
- Budget dispo actuel (`30% × cagnotte`).
- (Optionnel) bouton **« Réinitialiser la cagnotte »** (confirmation) pour repartir de 0.

Route `GET /api/admin/casino` → `{ wagered, paid, pool, budget, rtp, margin }`.

## Hors cagnotte (inchangé)

- **Récompenses de niveau** (paliers décennaux) : crédits offerts, **ne sortent pas** de la cagnotte.
- **Invitations** : crédits de départ offerts, hors cagnotte.

## Hors périmètre V1 (plus tard)

- Traitement cagnotte de Blackjack / Démineur (plafond de mise / multiplicateur).
- Cagnotte visible aux joueurs (jackpot affiché) — à discuter.
- Réglage fin de la générosité de base (RTP) par jeu.
