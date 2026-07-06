# Refonte du hub connecté — carrousel de tuiles

**Date :** 2026-07-06
**Statut :** design validé en brainstorming

## Objectif

Refondre l'écran d'accueil **une fois connecté** (`#portalHub` de `public/club.html`)
en un **carrousel de tuiles portrait** (artworks fournis par l'utilisateur) : la
tuile centrale est grande et nette, les latérales sont des aperçus atténués ;
l'utilisateur slide pour choisir sa destination et clique la tuile centrale pour y
aller.

**Hors périmètre :** écrans **login** et **inscription** (inchangés ; l'inscription
est un chantier séparé), le vrai volet **Fight** (le jeu n'existe pas), le reste de
l'app.

## Assets

- 3 artworks **portrait 1080×1920 (9:16)** fournis : Casino, Fight, Profil (titre
  déjà intégré à l'image, monochrome + halo par univers : violet / rouge / or).
- Intégrés dans **`public/tiles/`** (`casino.png`, `fight.png`, `profil.png`).
- ⚠️ **Poids** : ~1,3 Mo/PNG (~4 Mo pour le hub). Aucun outil de conversion dispo
  côté implémentation. → **Pré-merge : l'utilisateur ré-exporte en WebP** (~700×1250,
  q85, ~150-250 Ko chacun) ; on remplace alors les fichiers (et l'extension dans le
  HTML/CSS). En attendant on intègre les PNG pour valider le rendu.

## Structure (`#portalHub`)

Ordre vertical, centré :
1. **`.hub-top`** : logo BlackState (gauche) + bouton « Déconnexion » (droite) —
   conservé.
2. **`.hub-hello`** : « Bonjour {prénom} » — conservé (`#hubUser`).
3. **`.hub-carousel`** (nouveau) : la scène du carrousel (remplace `.universe-cards`).
4. **`.hub-wallet`** : chip « Crédits Club » (`#hubCredit`) — conservée.

## Carrousel

- **3 tuiles** dans l'ordre : Casino (index 0), Fight (1), Profil (2). Position de
  départ : **Casino centré**.
- **Tuile** : carte `aspect-ratio: 9/16`, coins arrondis, image en `cover`, fin
  liseré + halo assorti à l'univers via `data-uni` (casino=violet, fight=rouge,
  profil=or, en réutilisant les tokens `--accent*`/couleurs de charte). La tuile
  **centrale** : pleine échelle + halo marqué + nette ; les **latérales** :
  `scale(~.8)`, opacité réduite, débordent partiellement sur les bords.
- **Flèches `‹ ›`** positionnées sur les côtés (desktop) ; masquées ou discrètes en
  mobile (swipe).
- **Fight verrouillée** : badge « Bientôt » + icône cadenas en overlay sur la tuile
  Fight.

### Interaction (`public/club.js`)
- État : `hubIndex` (0..2), démarre à 0 (Casino). Pas de bouclage (flèches
  désactivées aux extrémités).
- **Slide** : flèches, **swipe/drag** tactile+souris, et **← / →** clavier changent
  `hubIndex` ; le track se recentre par `translateX` + transitions (échelle/opacité
  des tuiles selon leur distance au centre).
- **Entrer** : clic sur la tuile **centrale** → navigation : Casino → `/casino`,
  Profil → `/profil` ; **Fight** (centrale) → `toast('Bientôt…')`, pas de navigation.
  **Entrée** clavier = entrer la tuile centrale.
- **Clic tuile latérale** → devient la tuile centrale (slide, pas de navigation).
- Accessibilité : chaque tuile est focusable (`role`/`tabindex`), `aria-label`
  explicite (« Casino », « Fight — bientôt », « Profil ») ; la centrale a
  `aria-current`.

## Responsive
- Desktop : 3 tuiles visibles (centrale + 2 aperçus), flèches sur les côtés.
- Mobile / fenêtre étroite : tuile centrale plus grande relativement, aperçus plus
  fins (ou juste un liseré), navigation au **swipe** (flèches réduites/masquées).
  Le tout **tient sans scroll** (cohérent avec le reste : hauteur bornée en `vh`).

## Fichiers
- `public/club.html` : remplacer le bloc `.universe-cards` (lignes ~121-137) par la
  scène `.hub-carousel` (track + 3 tuiles + flèches).
- `public/club.css` : styles du carrousel (tuiles, échelle/opacité centrale vs
  latérales, flèches, overlay Fight, responsive). Retirer les styles
  `.universe-card*` devenus morts.
- `public/club.js` : logique carrousel dans la branche « HUB connecté » de l'IIFE
  d'init (après `$('portalHub').classList.remove('hidden')`), + handlers
  slide/clic/clavier/swipe.
- `public/tiles/casino.png`, `fight.png`, `profil.png` (copie des artworks).

## Tests / vérification
- **Visuel (utilisateur, sur captures)** : carrousel conforme à `exemple.png` (tuile
  centrale grande, aperçus latéraux) ; slide fluide (flèches/swipe/clavier) ; clic
  central entre dans la bonne section ; Fight affiche « Bientôt » ; chip crédits +
  « Bonjour » + logo/déconnexion en place ; tient sans scroll (desktop et mobile).
  Itération sur captures.
- **Non-régression** : login et inscription toujours OK ; `bun test` inchangé (front
  non testé unitairement).

## Inchangé
- Login, inscription, 2FA ; le reste de l'app ; la charte/tokens ; le vrai jeu Fight.
