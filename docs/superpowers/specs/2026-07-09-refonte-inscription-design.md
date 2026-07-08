# Refonte de l'inscription — design

**Date :** 2026-07-09
**Statut :** design validé en brainstorming

## Objectif

Refondre le formulaire d'inscription du club en un flux **clair et « pro »** :
rendre obligatoires les champs d'identité RP essentiels, appliquer une vraie
**politique de force du mot de passe**, et donner un **retour de validation en
direct par champ** (au lieu de l'unique ligne d'erreur globale actuelle).

Aujourd'hui, seuls le **pseudo** (3–20 car., `[A-Za-z0-9_-]`) et le **mot de
passe** (8–128 car., aucune règle de force) sont validés. NOM / Prénom /
Téléphone / Discord sont envoyés et stockés mais **jamais obligatoires** : on
peut créer un compte en les laissant vides. Le seul retour d'erreur est une ligne
globale affichée après clic.

**Hors périmètre :** connexion (`/api/login`), 2FA (mise en place post-création
inchangée), mécanique d'invitation (lien requis, réservation atomique TOCTOU),
pages admin, schéma DB (les colonnes `rp_nom`, `rp_prenom`, `rp_phone`,
`discord` existent déjà). Le captcha Turnstile reste tel quel.

## Décisions de design (validées)

1. **Champs obligatoires** : Pseudo, Mot de passe, **NOM**, **Prénom**,
   **id Discord**. Le **Téléphone RP reste optionnel**.
2. **Politique mot de passe « pro »** : longueur **≥ 12**, au moins une
   **majuscule**, une **minuscule**, un **chiffre** et un **caractère spécial** ;
   refus si le mot de passe **contient le pseudo**. Plafond 128 conservé
   (anti-DoS bcrypt).
3. **Règles à une seule source de vérité** : un module pur partagé
   `public/core/password.js` (UMD, comme `core/tiers.js`) utilisé par le front
   (checklist live) **et** importé par le serveur (application). Pas de
   duplication des règles.
4. **Validation live par champ** : bordure verte/rouge + message sous le champ,
   astérisque sur les requis, checklist mot de passe qui se coche en direct +
   jauge de force, bouton **« Créer mon compte » désactivé** tant que tout n'est
   pas valide.
5. **Discord** : non-vide + plafond de longueur, **pas** de contrôle de format
   strict (les handles/ID Discord varient — YAGNI).

## Le module partagé `public/core/password.js`

Module **pur, sans DOM**, en wrapper UMD (identique au patron de `core/tiers.js` :
`module.exports` en Node/bun, `root.Password` dans le navigateur).

```js
// Constantes exportées
MIN_LEN = 12
MAX_LEN = 128

// checkPassword(pw, pseudo) -> résultat détaillé
{
  rules: {
    length : pw.length >= MIN_LEN && pw.length <= MAX_LEN,
    upper  : /[A-Z]/.test(pw),
    lower  : /[a-z]/.test(pw),
    digit  : /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
    notName: pseudo.length < 3 || !pw.toLowerCase().includes(pseudo.toLowerCase()),
  },
  ok: <toutes les règles vraies>,
  score: 0..6,     // pour la largeur de la jauge (voir ci-dessous)
  label: 'Faible' | 'Moyen' | 'Fort',
}
```

**Score / label (jauge)** — mesure de robustesse **indépendante du seuil
d'acceptation** (un mot de passe peut ne pas être `ok` et afficher tout de même
« Moyen », ou être `ok` au minimum et n'être que « Moyen ») :

```
classes = upper + lower + digit + special            // 0..4 (booléens → 0/1)
lenScore = len >= 16 ? 2 : len >= 12 ? 1 : 0          // 0..2
score  = classes + lenScore                           // 0..6
label  = score >= 6 ? 'Fort' : score >= 4 ? 'Moyen' : 'Faible'
```

Conséquences : un mot de passe **minimal valide** (12 car., 4 classes) →
`score 5` → **« Moyen »** ; un mot de passe **long** (≥ 16 car., 4 classes) →
`score 6` → **« Fort »**. La largeur de la barre = `score / 6`.

Le seuil d'**acceptation** reste binaire (`ok`) : toutes les règles doivent être
vraies. La jauge est un retour visuel, pas la barrière — la checklist reste la
référence de ce qui bloque le bouton.

**Signature** : `checkPassword(pw, pseudo)` où `pseudo` est optionnel (défaut
`''`). Aucune dépendance externe, testable en isolation.

## Serveur — `/api/register` (`src/server.ts`)

Le serveur reste la **source de vérité** : il rejette même si le client est
contourné (POST direct). Modifications de la route (ordre conservé : captcha →
validations → invitation → création) :

1. Après le contrôle du pseudo (`validUser`), **remplacer** le bloc
   `if (p.length < 8) … / if (p.length > 128) …` par :
   ```ts
   const pw = Password.checkPassword(p, u)
   if (!pw.ok) { set.status = 400; return { error: <message règle manquante> } }
   ```
   Le message serveur nomme la première règle en échec (ex. « Mot de passe :
   12 caractères minimum. », « … : ajoute un caractère spécial. »,
   « Le mot de passe ne doit pas contenir ton pseudo. »).
2. **Exiger** les champs RP obligatoires **avant** de réserver l'invitation
   (pour ne pas consommer un lien sur une saisie incomplète) :
   ```ts
   const nom = clip(b.nom), prenom = clip(b.prenom), discord = clip(b.discord)
   if (!nom || !prenom || !discord) {
     set.status = 400; return { error: 'NOM, prénom et id Discord sont obligatoires.' }
   }
   const phone = clip(b.phone, 20)   // reste optionnel
   ```
   `clip()` applique déjà le trim + plafond de longueur. Réutiliser ces valeurs
   dans `Q.insertUser.run(...)`.
3. `import` du module partagé en haut de `server.ts` :
   `import * as Password from '../public/core/password.js'` (précédent :
   `tiers.js` est importé côté tests bun ; l'import runtime sous bun fonctionne).

Aucun changement de schéma, de session, ni du flux 2FA post-création.

## Front — markup (`public/club.html`, section `#registerSection`)

- Marqueur **requis** (astérisque) sur Pseudo, Mot de passe, NOM, Prénom,
  id Discord ; le Téléphone garde un libellé « (optionnel) ».
- Sous chaque champ requis : un `<span class="field-msg">` pour le message de
  validation (vide par défaut).
- Sous le mot de passe : un bloc **checklist** (5 items : 12+ car., majuscule,
  minuscule, chiffre, spécial) + une **jauge** (barre + label Faible/Moyen/Fort).
- Charger `core/password.js` via `<script>` avant `club.js`.
- Le bouton « Créer mon compte » reçoit un état **désactivé** initial.

## Front — logique (`public/club.js`)

- **Validation live** : au `input` de chaque champ, valider et basculer les
  classes `.valid` / `.invalid` sur le champ + écrire le `.field-msg`.
  - Pseudo : `validUser` côté client (même règle 3–20 `[A-Za-z0-9_-]`) — extraire
    une petite fonction locale (le serveur revalide).
  - Mot de passe : appeler `Password.checkPassword(pw, pseudoActuel)` → mettre à
    jour la checklist (coché/décoché par règle) + la jauge (largeur + label +
    couleur selon `score`). Recalculer aussi quand le **pseudo** change (règle
    `notName`).
  - NOM / Prénom / Discord : non-vides après trim.
- **Bouton** : activé **uniquement** si tous les requis sont valides ET
  `checkPassword(...).ok`. Fonction `refreshRegisterState()` appelée à chaque
  input.
- `submitRegister()` : conserve le flux actuel (POST `/api/register` avec
  `cfToken`, puis `TOKEN`/`localStorage`, puis étape 2FA optionnelle). En cas
  d'erreur serveur, afficher le message et `cfReset`. Garde-fou : revalider en
  entrée de `submitRegister` (défense si l'état du bouton est contourné).

## Front — styles (`public/club.css`)

- `.field-msg` (petit texte sous le champ ; variantes ok/erreur).
- Champs `.valid` / `.invalid` : bordure verte / rouge discrète, cohérente avec
  le thème néon existant.
- Checklist : items avec puce ✓ (validée) / ○ (à faire), couleur atténuée→verte.
- Jauge : barre à largeur variable (`score/4`) avec couleur Faible (rouge) →
  Moyen (ambre) → Fort (vert).
- Bouton `:disabled` : opacité réduite, `cursor: not-allowed`.

## Tests

- **Unitaire (nouveau `tests/password.test.ts`)** — `checkPassword` pur :
  - trop court (`'Ab1!'`) → `length` faux, `ok` faux.
  - manque une classe : pas de majuscule / minuscule / chiffre / spécial → règle
    correspondante fausse, `ok` faux (un test par classe).
  - contient le pseudo (`checkPassword('Motdepasse1!', 'motdepasse')`
    variante où le pseudo apparaît) → `notName` faux, `ok` faux.
  - valide (`'Bl@ckState12'` avec un pseudo distinct) → toutes règles vraies,
    `ok` vrai.
  - `label` : minimal valide (12 car., 4 classes) → « Moyen » (`score` 5) ;
    long (≥ 16 car., 4 classes) → « Fort » (`score` 6).
  - pseudo court/absent → `notName` vrai (pas de fausse alarme).
- **Manuel** :
  - Formulaire : pw faible → bouton grisé, checklist rouge ; compléter jusqu'à
    tout coché → bouton actif. NOM vide → bouton grisé. Création OK → étape 2FA.
  - Serveur (contournement client) : `POST /api/register` direct avec pw faible
    → 400 ; avec NOM/prénom/discord vides → 400 ; l'invitation **n'est pas
    consommée** sur un refus (vérifier `used = 0` après un 400).

## Inchangé

- Connexion, 2FA, invitation (réservation atomique), captcha Turnstile, schéma
  DB, sessions, pages admin/profil/casino/fight, économie du casino.
