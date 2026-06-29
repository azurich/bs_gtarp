# Dice — Refonte ergonomique (centrée sur la piste)

**Date :** 2026-06-29
**Statut :** design validé en brainstorming (« c'est ok, go »)

## Objectif

Refondre l'**ergonomie et la mise en page** de la machine Dice pour qu'elle reste
**toujours visible** quel que soit le responsive (aujourd'hui, selon la hauteur de
la fenêtre, le jeu déborde et le numéro de résultat **ou** les contrôles ne sont
pas visibles ensemble). La refonte **recentre l'expérience sur la piste** : le
réglage de la chance et le résultat tournent autour d'elle, en compact.

**Hors périmètre :** logique serveur du Dice (`playDice`, calcul roll/chance/RTP),
modèle cagnotte, effets/notifs (`gameResult`), autres jeux, charte. Présentation
front uniquement.

## Problème actuel

La machine Dice empile beaucoup de hauteur :
en-tête → `.dice-stage` (un `#diceResult` jusqu'à **13rem** + marges/padding
`clamp(16px,4vh,48px)`) → piste → échelle → indicateur → `slider-row` → **3 stats**
→ ligne de mise. Total facilement 700–900px. Sur un viewport peu haut, il faut
scroller et l'essentiel (numéro **et** slider/LANCER) n'est pas visible d'un coup.

Le slider de chance est aujourd'hui **en bas** (dans `.machine-controls`), loin de
la piste qu'il pilote — alors que bouger le slider déplace la frontière vert/rouge
de la piste (via la variable CSS `--win`). Le lien visuel est cassé par la distance.

## Conception (centrée piste)

Réorganisation en **1 colonne compacte**, tout en `clamp()` + container-queries.

### Zone de jeu (`.machine-board`)
Ordre, de haut en bas :
1. **Lecture du lancer** (`.dice-readout`) : petit bloc — label « Dernier lancer »
   + le nombre (`#diceResult`) en taille **moyenne** (≈ `clamp(1.8rem, 6cqw, 3rem)`),
   animé, coloré vert/rouge selon gagné/perdu. **Fini le 13rem** qui mangeait tout.
2. **La piste** (`.dice-track`, le cœur) : zones GAGNANT/PERDANT, la frontière
   vert/rouge suit la chance (`--win`), marqueur de cible (`#diceMarker`) + le dé
   qui roule (`#diceDot`). Inchangée fonctionnellement.
3. **Échelle 0–100** (`.dice-scale`) juste sous la piste.
4. **Slider de chance collé sous la piste** (`.dice-slider`) : pleine largeur,
   aligné sur la piste → bouger le slider **déplace visuellement la frontière**
   (lien direct « je règle ma chance → je vois la zone gagnante changer »). Label
   « Chance de gagner **50%** » (`#diceChanceLbl`).

→ Le `slider-row` quitte `.machine-controls` pour venir **dans la zone de jeu**,
directement sous l'échelle/piste.

### Contrôles compacts (`.machine-controls`)
1. **2 stats** (au lieu de 3) : **Multiplicateur** (`#diceMult`) + **Gains
   potentiels** (`#dicePot`). On **retire « Cible (en dessous de) »**
   (`#diceTargetLbl`) qui faisait doublon avec la chance %.
2. **Ligne de mise** : Mise (`#diceBet`) + ½/×2/MAX + **LANCER** (`#diceBtn`).

### Compacité / responsive
- `#diceResult` passe de `clamp(3.6rem,…,13rem)` à une taille moyenne ; marges du
  bloc résultat fortement réduites.
- Tout en container-queries (`.machine` est déjà `container-type:inline-size`) :
  resserrement progressif (numéro, piste, stats) selon la largeur de la machine.
- Objectif : la machine Dice tient verticalement du petit téléphone au desktop,
  sans que le jeu disparaisse ni nécessite un scroll pour voir piste + LANCER.

## Impact JS
- `diceUpdate()` ne doit plus écrire `#diceTargetLbl` (élément supprimé) : retirer
  la ligne `$('diceTargetLbl').textContent = …`. Le reste (`--win`, marqueur,
  mult, pot, label chance) inchangé.
- `diceRoll()` inchangé (anime `#diceDot`, colore `#diceResult`, appelle
  `gameResult`). Les IDs réutilisés gardent leurs noms.

## Inchangé
- Serveur (`playDice`, chance 2–95, RTP), variable `--win`, marqueur/dé,
  `gameResult` (toast sur gain net, indicateur `#diceResultMsg`), charte violette.

## Tests / vérification
- **Structurel** : la vue Dice contient toujours `#diceResult`, `#diceSlider`,
  `#diceMarker`, `#diceDot`, `#diceMult`, `#dicePot`, `#diceBet`, `#diceBtn` ;
  `#diceTargetLbl` supprimé et plus référencé en JS (pas de `$('diceTargetLbl')`).
  `bun test` inchangé (aucune logique testée touchée), `/casino` 200, charte
  (pas de doré, pas de `rgba(91,33,182,…)` codé en dur nouveau).
- **Visuel (utilisateur)** : la machine Dice tient à l'écran sur fenêtre réduite
  et sur mobile (piste + slider + LANCER visibles ensemble) ; le slider sous la
  piste déplace bien la frontière vert/rouge ; le numéro de lancer s'affiche
  moyen/animé/coloré ; toast seulement sur gain net.

## Hors périmètre
- Logique de jeu / économie, autres jeux, refonte d'autres machines.
