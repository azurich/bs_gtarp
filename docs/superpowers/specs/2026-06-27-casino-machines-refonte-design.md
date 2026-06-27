# Casino — Refonte des machines (DA, effets, notifications, logos, responsive)

**Date :** 2026-06-27
**Statut :** design validé en brainstorming (approche A + paliers + sans audio confirmés)

## Objectif

Refondre la **couche présentation** des 6 jeux du casino, sans toucher au modèle
économique (cagnotte/redistribution) ni à la logique de résolution serveur. Cinq
chantiers liés :

1. **Direction artistique des machines** — passer de cartes plates à un style
   « premium feutre & néon » cohérent.
2. **Logos / icônes des jeux** — set homogène game-icons.net (fini le mélange
   gravé/maison) + symboles internes cohérents.
3. **Effets de victoire / défaite** — système **gradué selon le gain** (5 paliers).
4. **Notifications de gain / perte** — **toasts** vert/rouge cohérents avec le
   reste de l'app + indicateur discret dans la machine.
5. **Responsive vraiment fluide** — container queries + `clamp()`, aucun device
   privilégié, nettoyage des résidus de l'ancien thème.

**Périmètre :** les **6 machines** (Slots, Plinko, Roue, Dice + Blackjack &
Démineur qui restent désactivés côté jeu mais reçoivent le même habillage).
**Pas d'audio** (effets purement visuels).

## Identité visuelle de référence

- Casino = **violet néon** `#7c3aed` (`--accent`) sur fond noir. Le noir & or est
  réservé au club/admin — il ne doit **pas** réapparaître ici.
- « Premium feutre & néon » : chaque jeu posé sur un **tapis feutré sombre**
  (dégradé radial + grain léger), encadré d'un **liseré violet lumineux**
  (bordure + halo néon), avec une **profondeur subtile** (ombre interne, relief
  des bords). Chic et homogène, sans skeuomorphisme complet.

## Approche de construction (A — framework centralisé)

Une **base partagée** plutôt que 6 refontes indépendantes :

- un **shell de machine** CSS réutilisé par les 6 jeux ;
- un **moteur d'effets unique** JS (`gameResult()`) que tous les jeux appellent
  pour déclencher palier d'effet + toast + flash solde + count-up.

La logique aujourd'hui éparpillée (`checkBigWin`, `flashBal`, `.msg` inline,
dupliquée par jeu) est **centralisée**. Bénéfice : cohérence garantie, un seul
endroit à régler, maintenabilité.

## Architecture

### 1. Shell de machine (CSS) — `.machine`

Structure HTML commune (remplace le `.card` + `.game-head` + `.game-board` actuels) :

```
.machine                     (tapis feutré + liseré néon, container-type: inline-size)
├── .machine-head            (icône gravée du jeu + titre + sous-titre)
├── .machine-board           (zone de jeu : rouleaux / roue / canvas / piste dé…)
├── .machine-result          (indicateur discret : dernier résultat, persistant)
└── .machine-controls        (.bet-row : mise + ½ ×2 MAX + bouton d'action)
```

- `.machine` : `container-type: inline-size` → la mise en page interne réagit à
  **sa propre largeur** (pas seulement au viewport).
- Tokens de feutre/néon ajoutés dans `casino.css` (ou tokens.css si réutilisés) :
  surface feutre, intensité du halo, épaisseur du liseré — dérivés de `--accent`.
- `.machine-result` : zone réservée sous le board ; affiche `+2 400 · ×24` (gain)
  ou `Perdu` (perte) ; **persiste** jusqu'au coup suivant. Remplace le `.msg`.

### 2. Moteur d'effets gradués (JS) — `gameResult()`

Point d'entrée **unique** appelé par les 6 jeux à la résolution.

```js
gameResult({
  machine,   // élément DOM .machine (cible des effets)
  bet,       // mise jouée
  gain,      // gain brut crédité (0 si perte)
  balance,   // nouveau solde (pour count-up + flash)
  xp, level, // barre XP
  push,      // optionnel : true = égalité (mise rendue, ex. blackjack)
})
```

Calcule `mult = bet > 0 ? gain / bet : 0`, choisit le palier (selon le résultat
**net**, `gain` vs `bet`), applique l'effet machine, met à jour le solde
(`setBalance`), écrit l'indicateur `.machine-result`, et déclenche un toast
**uniquement sur un vrai gain net**.

**Règle des toasts (choix produit) :** un toast n'apparaît **que lorsque le joueur
gagne réellement** (`gain > bet`). Perte, récupération partielle et mise rendue ne
produisent **pas** de toast — seul l'indicateur machine (discret, persistant) les
signale. Évite le déluge de rouge quand la cagnotte démarre à 0 (beaucoup de
pertes au début).

| Palier | Condition (net) | Effet machine | Notif |
|---|---|---|---|
| **Perte** | `gain == 0` | tapis assombri + micro-shake | indicateur `Perdu` — pas de toast |
| **Récup. partielle** | `0 < gain < bet` | assombri léger | indicateur `−{mise−gain}` — pas de toast |
| **Mise rendue** | `gain == bet` *(ou `push`)* | neutre (léger pulse) | indicateur `Mise rendue` — pas de toast |
| **Petit gain** | `bet < gain ≤ 2×bet` | glow violet du board + count-up solde | toast vert `+{gain}` |
| **Gain moyen** | `2×bet < gain ≤ 5×bet` | burst de particules + pulse du cadre néon | toast vert `+{gain}` |
| **Gros gain** | `5×bet < gain ≤ 20×bet` | overlay **BIG WIN** + confettis | toast vert `+{gain}` |
| **Jackpot** | `gain > 20×bet` | **MEGA WIN** plein écran, halo renforcé | toast vert `+{gain}` |

- Seuils ×5 / ×20 conservés (continuité avec `checkBigWin` actuel).
- L'égalité blackjack (`push`) coïncide avec `gain == bet` → palier « Mise rendue »
  (le paramètre `push` ne sert qu'à fiabiliser le libellé de l'indicateur).
- Effets machine = classes CSS posées/retirées sur `.machine` (`fx-lose`,
  `fx-win-s`, `fx-win-m`) + overlay pour `fx-win-big` / `fx-win-mega`.
- Remplace `flashBal`, `shakeEl` ad hoc, `checkBigWin`, et les `.msg` par jeu.

### 3. Overlay BIG / MEGA (redesign)

L'overlay confetti actuel (`#winOverlay`, couleurs arc-en-ciel hors charte) est
redesigné dans la DA feutre & néon : palette violet/or sobre, libellé
`BIG WIN` / `MEGA WIN` + montant, confettis renforcés au palier MEGA. Reste
cliquable pour fermer, auto-fermeture conservée.

### 4. Notifications (toasts résultat)

- **Toast uniquement sur gain net** (`gain > bet`) : `type='success'` (vert) via
  le système existant (`toast(msg, ms, type)` dans `core/auth.js`, `#toast` stylé
  dans `tokens.css`). **Aucun toast** sur perte, récupération partielle ou mise
  rendue — ces cas ne sont signalés que par l'indicateur machine.
- **Anti-spam** : le toast de gain **se remplace** (un seul nœud `#toast`, déjà le
  cas) et s'auto-efface vite (~1,8 s) pour le joueur qui enchaîne.
- Les **erreurs** (mise invalide, solde insuffisant, réseau) gardent leurs toasts
  rouges (`type='error'`) actuels — même canal, durée plus longue. À distinguer
  des pertes de jeu, qui elles ne toastent pas.
- L'indicateur `.machine-result` reste **persistant** jusqu'au coup suivant et
  couvre **tous** les résultats (gain, perte, récup. partielle, mise rendue), avec
  un code couleur (vert/violet sur gain, atténué sur perte).

### 5. Logos / icônes

- Régénérer `public/core/game-icons.js` via `scripts/gen-game-icons.ts` avec un
  set **game-icons.net homogène** (style gravé) pour les 6 jeux ; remplacer les
  icônes **Plinko & Roue « maison »** par de vraies icônes du même style.
  *(La disponibilité d'icônes Plinko/Roue adaptées sur game-icons.net est à
  confirmer en implémentation ; à défaut, retenir l'icône la plus proche du même
  auteur/style pour préserver l'homogénéité.)*
- **Symboles internes** (Slots) : passer le mélange emoji (`7️⃣💎🔔🍒⭐🍋`) et la
  paytable en SVG cohérents avec la DA — plus d'emoji dans l'UI de jeu.

### 6. Responsive vraiment fluide

- **Container queries** sur `.machine` (`container-type: inline-size`) + `@container`
  pour la disposition interne → chaque machine se réorganise selon sa largeur.
- Tailles en `clamp()` / unités relatives (fini les paliers de px en cascade).
- **Nettoyage** des résidus violets de l'ancien thème dans `responsive.css`
  (`rgba(91,33,182,…)` codés en dur) → tout passe par `--accent*`.
- Cible : impeccable du petit téléphone au grand écran, sans device privilégié.
- La nav latérale conserve son repli mobile (barre horizontale) existant, mais
  réaligné sur la nouvelle DA.

## Flux de données (inchangé côté serveur)

```
clic action → api('/play/<jeu>') → réponse { balance, gain, xp, level, … }
   → animation propre au jeu (rouleaux / roue / canvas / dé)
   → gameResult({ machine, bet, gain, balance, xp, level })
        → palier → effet machine + indicateur + toast + setBalance(count-up, flash, XP)
```

Aucune route serveur, aucune table, aucun calcul de gain n'est modifié. Le
bridage cagnotte et les paytables restent tels quels.

## Traitement par jeu

| Jeu | Board retravaillé | Notes |
|---|---|---|
| **Slots** | rouleaux sur feutre, symboles SVG, glow `hit` revu | cascade d'arrêt conservée |
| **Plinko** | canvas reposé sur le tapis, palette néon | rendu canvas inchangé fonctionnellement |
| **Roue** | roue SVG + pointeur + hub re-stylés néon | `jackpot-flash` remplacé par le moteur |
| **Dice** | piste + curseur + stats sur feutre | slider et stats conservés |
| **Blackjack** | table + cartes re-stylées (désactivé) | habillage prêt, route 503 inchangée |
| **Démineur** | grille + gemmes/bombes re-stylées (désactivé) | habillage prêt, route 503 inchangée |

Chaque résolution de jeu appelle `gameResult()` au lieu de sa logique
`.msg`/`checkBigWin`/`flashBal` propre.

## Fichiers touchés

- `public/casino.html` — markup `.machine` pour les 6 vues + overlay.
- `public/casino.css` — shell machine, feutre/néon, boards par jeu, overlay,
  classes d'effets `fx-*`, container queries.
- `public/casino.js` — moteur `gameResult()`, refactor des 6 résolutions,
  suppression de `checkBigWin`/`flashBal` ad hoc et des `.msg` par jeu.
- `public/core/game-icons.js` + `scripts/gen-game-icons.ts` — set unifié + symboles.
- `public/responsive.css` — réécriture vers container queries / `clamp`, purge
  des couleurs en dur (ou fusion ciblée dans `casino.css`).
- `public/core/tokens.css` — réutilisé pour les toasts (variants déjà présents) ;
  ajustements mineurs si besoin.

## Gestion d'erreurs

- Erreurs réseau / mise invalide / solde insuffisant : toasts rouges existants,
  durée longue ; **pas** d'effet machine de perte (ce n'est pas une partie jouée).
- `gameResult()` tolère `machine` absent (no-op sur les effets DOM, le toast de
  gain part quand même) pour ne jamais casser le flux de jeu.
- Égalité blackjack (`push`) : palier « Mise rendue », indicateur neutre, pas de
  toast.

## Tests / vérification

Refonte essentiellement visuelle → vérification manuelle + garde-fous :

1. **Non-régression du jeu** : les 6 résolutions fonctionnent (Slots/Plinko/Roue/
   Dice jouables ; BJ/Démineur renvoient bien 503), solde/XP corrects.
2. **Paliers** : forcer (mise/gain simulés) chaque palier — perte, récup.
   partielle, mise rendue, petit, moyen, BIG, MEGA — et vérifier l'effet machine,
   l'indicateur, et que **le toast ne part QUE sur gain net** (`gain > bet`).
3. **Anti-spam toast** : enchaîner des gains → un seul toast à la fois.
4. **Responsive fluide** : vérifier chaque machine de ~320px à grand écran
   (container queries), aucun débordement, boutons tactiles ≥ 44px.
5. **Charte** : aucune couleur or/violet hors `--accent*`, plus d'emoji dans l'UI
   de jeu, icônes des 6 jeux homogènes.
6. **Grep de propreté** : plus de référence morte à `.msg`, `checkBigWin`,
   `flashBal` hors du moteur centralisé.

## Hors périmètre

- Modèle économique, routes serveur, paytables, bridage cagnotte (inchangés).
- Réactivation de Blackjack / Démineur côté jeu (restent 503).
- Audio / effets sonores.
- Nouvelles mécaniques de jeu.
```
