# Turnstile (CAPTCHA) sur login + inscription

**Date :** 2026-07-03
**Statut :** design validé en brainstorming

## Objectif

Ajouter le CAPTCHA **Cloudflare Turnstile** sur les formulaires de **connexion** et
**d'inscription** de BlackState, pour bloquer les bots (brute-force / credential
stuffing au login, abus de liens d'invitation à l'inscription) avant le lancement
prod. Piloté par variables d'environnement, **désactivé automatiquement si les clés
sont absentes** (dev local inchangé).

**Hors périmètre :** autres formulaires, refonte de l'auth, 2FA (déjà en place),
modèle d'invitation.

## Contexte code

- `server.ts` : `/api/register` (invite-gated + rate-limité) et `/api/login`
  (rate-limité, bcrypt, TOTP optionnel) sous le plugin `authRL`. Une **CSP stricte**
  (constante `CSP`) est posée dans `.onRequest`.
- Front : `public/core/auth.js` gère les écrans/formulaires login & inscription.

## Sécurité des clés

- **Clé de site** (`TURNSTILE_SITE_KEY`) : publique, destinée au front → OK à exposer.
- **Clé secrète** (`TURNSTILE_SECRET_KEY`) : **serveur uniquement**, dans `.env`,
  **jamais commitée** (image publique). Aucune valeur réelle dans le repo.

## Architecture & fichiers

### `server.ts`
1. **Config env** : lire `TURNSTILE_SITE_KEY` et `TURNSTILE_SECRET_KEY`.
   `TURNSTILE_ENABLED = !!(site && secret)`.
2. **Endpoint public** `GET /api/config` → `{ turnstile: TURNSTILE_ENABLED ? site : null }`.
   Le front l'appelle pour savoir s'il affiche le widget et avec quelle clé.
3. **Helper** `async verifyTurnstile(token: string, ip: string): Promise<boolean>` :
   POST `https://challenges.cloudflare.com/turnstile/v0/siteverify` (form-encoded :
   `secret`, `response=token`, `remoteip=ip`), timeout ~5 s via `AbortSignal.timeout`,
   renvoie `data.success === true`. Toute erreur réseau / timeout → `false`
   (**fail-closed**).
4. **Gating** dans `/api/register` et `/api/login` : si `TURNSTILE_ENABLED`, lire
   `cfToken = String(b.cfToken ?? '')` ; si vide ou `!(await verifyTurnstile(...))`
   → `set.status = 400; return { error: 'Vérification anti-robot échouée, réessaie.' }`,
   **avant** tout bcrypt / accès DB. L'IP vient d'un en-tête de confiance
   (`CF-Connecting-IP` fourni par le tunnel Cloudflare, fallback vide).
   - **Login 2FA** : Turnstile n'est vérifié qu'à la **1re étape** (quand `!code`).
     Le 2e POST (code TOTP) ne re-exige pas de token (usage unique, étape déjà
     validée humaine).
5. **CSP** : ajouter `https://challenges.cloudflare.com` à `script-src` **et**
   `frame-src` de la constante `CSP`. Le reste inchangé.

### `public/core/auth.js` (+ markup login/inscription)
- Au chargement de l'écran d'auth : `GET /api/config`. Si `turnstile` non nul :
  - injecter une fois le script `https://challenges.cloudflare.com/turnstile/v0/api.js`
    (async, defer) ;
  - insérer `<div class="cf-turnstile" data-sitekey="{site}">` dans les 2 formulaires ;
  - au submit, récupérer le token (`turnstile.getResponse(widgetId)` ou callback) et
    l'ajouter au corps POST sous `cfToken` ; `turnstile.reset(widgetId)` après un
    échec serveur pour permettre un nouvel essai.
- Si `turnstile` est nul (dev sans clés) : ne rien injecter, formulaires inchangés.

### `env.example` + `deploy/PREPROD.md`
- Documenter `TURNSTILE_SITE_KEY` et `TURNSTILE_SECRET_KEY` (secret côté serveur).
  Valeurs à remplir sur la machine, jamais dans le repo.

## Dégradé / erreurs
- Clés absentes → Turnstile **entièrement bypassé** (dev).
- Token manquant / invalide → **400** avant bcrypt.
- `siteverify` injoignable → **fail-closed** (rejet, l'utilisateur réessaie) —
  acceptable puisque tout le site passe déjà par Cloudflare.

## Tests / vérification
1. **Automatisé** (fetch mocké) : `verifyTurnstile` renvoie `true` sur
   `{success:true}`, `false` sur `{success:false}` et sur timeout/erreur réseau ;
   la logique de gating rejette quand activé + token absent, et bypasse quand
   désactivé.
2. **Manuel (prod)** : sur `https://blackstate.club`, le widget s'affiche sur login
   & inscription ; une soumission sans résolution est refusée ; une soumission
   valide passe. En dev local (sans clés), les formulaires marchent sans widget.

## Inchangé
- Logique métier auth (invitations, TOTP, sessions, rate-limit), autres routes,
  autres formulaires, le reste de la CSP.
