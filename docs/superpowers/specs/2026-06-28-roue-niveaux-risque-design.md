# Roue — Niveaux de risque (Faible / Moyen / Élevé)

**Date :** 2026-06-28
**Statut :** design validé en brainstorming (« garde le 50× et rédige la spec »)

## Objectif

Ajouter à la Roue 3 niveaux de risque, sur le modèle du Plinko : Faible / Moyen /
Élevé. Chaque niveau a le **même RTP (0,70)** — seule la **variance** change. La
roue **change visuellement** selon le niveau (les 16 segments affichent les
valeurs du profil choisi). Le joueur choisit le niveau via un sélecteur, comme
pour le Plinko.

**Hors périmètre :** aucun changement au modèle cagnotte, aux effets/notifs
(`gameResult`), à la charte (violet), ni aux autres jeux.

## Modèle de la roue (existant, rappel)

La roue a deux jeux de données :
- `WHEEL` : 16 valeurs **visibles** (le multiplicateur de chaque segment, dessiné
  sur la roue).
- `WHEEL_W` : 16 **poids cachés** (proba de sélection ; invisible au joueur).

`playWheel` tire un segment selon `WHEEL_W`, bridé par la cagnotte (poids à 0 pour
les segments non payables). EV = Σ poidsᵢ·valeurᵢ = 0,70.

Contrairement au Plinko (probabilités fixes = binomiale, on normalise les
**valeurs**), la roue garde des **valeurs rondes** (2×, 5×, 50×…) et ajuste les
**poids** pour atteindre l'EV.

## Conception des niveaux

`WHEEL` et `WHEEL_W` deviennent des `Record<'low' | 'med' | 'high', number[]>`
(16 segments chacun). Trois profils, chacun calibré à EV = 0,70 :

| Niveau | Caractère | Valeurs (rondes) | 0× ? |
|---|---|---|---|
| **Faible** (`low`) | Basse variance : on perd rarement tout, mais on récupère souvent un peu moins que sa mise | `0,5× · 0,7× · 0,9× · 1,5× · 2× · 3×` | **non** — récup. partielle à la place |
| **Moyen** (`med`) | Équilibré (≈ roue actuelle) | `0× · 1,5× · 2× · 5× · 15×` | oui (modéré) |
| **Élevé** (`high`) | Haute variance, jackpot rare | `0× (majorité) · 2× · 5× · 50×` | oui (beaucoup) |

**Pourquoi le « Faible » n'est pas « toujours gagnant » :** avec un RTP de 0,70,
une roue qui ne descend jamais sous 1× rendrait la maison perdante (RTP ≥ 1).
Comme le Plinko faible (qui contient des cases 0,5× / 0,7×), le niveau Faible
remplace les 0× par des **récupérations partielles** (0,5×–0,9×) : pas de perte
totale, mais souvent un retour inférieur à la mise. Les `gameResult`/`pickTier`
gèrent déjà ce cas (« récup. partielle », indicateur atténué, pas de toast).

### Disposition visuelle (16 segments)

Les valeurs sont réparties autour de la roue en alternant fort/faible pour
l'équilibre visuel (comme l'actuel `med`). Valeurs **représentatives** (les
nombres et poids exacts sont figés dans le plan, voir Calibrage) :

- `low`  : `[0.5, 1.5, 0.7, 2, 0.5, 1.5, 0.9, 3, 0.5, 1.5, 0.7, 2, 0.5, 1.5, 0.9, 3]`
- `med`  : `[0, 1.5, 0, 2, 0, 1.5, 0, 5, 0, 1.5, 0, 2, 0, 1.5, 0, 15]` (inchangé)
- `high` : `[0, 0, 2, 0, 0, 5, 0, 0, 0, 0, 5, 0, 0, 2, 0, 50]`

### Calibrage à EV = 0,70 (déterministe, testé)

Pour chaque niveau : on part des valeurs `seg[]` et d'une forme de poids brute
`wRaw[]` (choisie à la main pour la variance voulue), puis on **ajuste un seul
poids « balancier »** pour atteindre EV = 0,70 exactement, et on normalise en
probabilités (Σ = 1). Le balancier est un segment 0× (med/high) ou un segment
0,5× (low).

Méthode (analogue à `normMults` du Plinko) :

```
// N = Σ(wRaw·seg), D = Σ(wRaw), v_b = valeur du segment balancier b
// On cherche Δ ajouté à wRaw[b] tel que (N + Δ·v_b)/(D + Δ) = 0.70
Δ = (0.70·D − N) / (v_b − 0.70)
wRaw[b] += Δ            // reste ≥ 0 car l'EV brute des payeurs > 0.70
poids = wRaw / Σ(wRaw)  // normalisation finale, Σ = 1
```

Un **test unitaire** vérifie `Σ poidsᵢ·valeurᵢ ≈ 0.70` (±0,001) pour les 3
niveaux, et que tous les poids sont ≥ 0 et somment à 1.

## Architecture & fichiers

### `games.ts`
- `WHEEL` → `export const WHEEL: Record<'low'|'med'|'high', number[]>`.
- `WHEEL_W` → `Record<'low'|'med'|'high', number[]>`, calibrés (ci-dessus).
- `playWheel(bet, risk, budget)` : ajoute `risk`, sélectionne `WHEEL[risk]` /
  `WHEEL_W[risk]` (défaut `med` si inconnu). **Bridage cagnotte conservé** :
  `w = WHEEL_W[risk].map((wt, i) => (WHEEL[risk][i]·bet ≤ budget ? wt : 0))`.
  Retourne `{ index, mult, gain }` (inchangé).
- Met à jour le commentaire d'en-tête (les 3 profils).

### `server.ts`
- Route `/api/play/wheel` : lit `risk` comme le Plinko —
  `const risk = (['low','med','high'] as const).find(x => x === b.risk) ?? 'med'`
  puis `G.playWheel(bet, risk, casinoBudget())`. Aucune autre route touchée.

### Front (`public/casino.html` + `public/casino.js` + `public/casino.css`)
- **HTML** : ajouter un sélecteur `<select id="wheelRisk">` (Faible / Moyen /
  Élevé) dans `.machine-controls` de la Roue, sur le modèle de `#plinkoRisk`.
- **JS** :
  - Recevoir les jeux de valeurs par niveau du serveur via `/api/config` (comme
    `PK_MULT` pour le Plinko) ; fallback local si absent.
  - Re-dessiner la roue SVG (`renderWheel`) au changement de niveau et au boot,
    à partir des valeurs du niveau courant.
  - `wheelSpin()` envoie `{ bet, risk }` ; le `risk` lu sur `#wheelRisk`.
  - `wheelColor(m)` étendu pour la couleur du segment **50×** (réutiliser la
    teinte « gros gain », rose/violet ; rester dans la charte). Gérer aussi les
    valeurs < 1 (0,5×–0,9×) du niveau faible avec une teinte sobre.
  - Réinitialiser l'indicateur `#wResult` au lancement (déjà en place).
- **CSS** : style du `.plinko-risk` réutilisé / `.wheel-risk` équivalent (même
  look que le sélecteur Plinko). Aucune nouvelle couleur hors charte.
- **Défaut** : `med` (sélectionné par défaut, comme Plinko).

### `/api/config`
- Exposer les valeurs visibles de la roue par niveau (`WHEEL`) pour que le front
  dessine la bonne roue sans dupliquer les nombres — exactement comme `PK_MULT`
  est déjà exposé pour le Plinko. (Le front n'a pas besoin des poids.)

## Flux de données

```
changement de #wheelRisk → renderWheel(valeurs du niveau)         (visuel)
clic TOURNER → api('/play/wheel', { bet, risk })
   → serveur playWheel(bet, risk, budget) → { index, mult, gain }
   → animation rotation jusqu'au segment `index`
   → gameResult({ machine, bet, gain, ... })  (effets/toast inchangés)
```

## Gestion d'erreurs / cohérence
- `risk` inconnu côté serveur → `med` (jamais d'erreur).
- Le bridage cagnotte s'applique par niveau : à cagnotte faible, les gros
  segments (50×, 15×) sont non payables → poids 0, la roue tombe sur du payable
  (souvent 0× / petits) — cohérent avec le reste de l'économie.
- RTP global 0,70 inchangé quel que soit le niveau choisi.

## Tests / vérification
1. **Unitaire** : `Σ poidsᵢ·valeurᵢ ≈ 0.70` (±0,001) pour `low`/`med`/`high` ;
   poids ≥ 0, somme = 1 ; `WHEEL[risk].length === 16` et `WHEEL_W[risk].length === 16`.
2. **Route** : `/api/play/wheel` accepte `risk`, défaut `med` ; économie intacte
   (le smoke test cagnotte passe toujours).
3. **Visuel (utilisateur)** : la roue se redessine en changeant de niveau (faible
   montre des 0,5×/petits, élevé montre le 50× + beaucoup de 0×) ; rotation tombe
   sur le bon segment ; toast seulement sur gain net ; charte violet respectée.

## Hors périmètre
- Modèle cagnotte, autres jeux, effets/notifs, réactivation BJ/Démineur.
- Niveaux pour les autres jeux (Slots, Dice).
