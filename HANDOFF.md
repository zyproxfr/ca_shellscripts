# Handoff — Tournois Fléchettes

Document de reprise pour continuer ce projet dans un autre outil (Cursor, etc.).
Ce projet a été construit par Claude Code sur plusieurs sessions ; ce fichier résume
ce qui existe, comment le reprendre, et ce qu'il reste à faire.

## Récupérer le projet

Le code est sur GitHub : `zyproxfr/ca_shellscripts`, branche `claude/dart-tournament-app-pmmhle`
(pas encore mergée sur `main`). Si tu l'as déjà cloné en local (ex: `~/ca_shellscripts`),
ouvre simplement ce dossier dans Cursor. Sinon :

```bash
git clone https://github.com/zyproxfr/ca_shellscripts.git
cd ca_shellscripts
git checkout claude/dart-tournament-app-pmmhle
```

Procédure complète de lancement (prérequis, seed, identifiants de démo) : voir `README.md`.

## Ce que c'est

Application de gestion de tournois de fléchettes pour un bar : inscriptions, check-in,
génération de bracket/poules, saisie de score en direct, classement, stats, écran TV
temps réel. Pensée pour un usage terrain réel (tablette staff, TV publique, réseau local
sans dépendance internet), avec une architecture prête à évoluer vers un SaaS multi-bar.

Stack : Next.js 14 (App Router) + TypeScript sur un **serveur HTTP custom** (`server.ts`,
nécessaire pour héberger Socket.io — voir gotcha plus bas), PostgreSQL + Prisma, NextAuth,
Tailwind CSS, Vitest + Playwright.

## Ce qui a été construit (V1 complète, 16 commits)

1. **Scaffold** : Next.js + Docker + Prisma (schéma complet, toutes les entités du besoin
   produit même celles pas encore exploitées par l'UI) + NextAuth (rôles ADMIN/STAFF/PLAYER) + RBAC.
2. **Tournois** : CRUD, machine à états verrouillée (`src/server/tournaments/tournament-state-machine.ts`
   — un seul point d'écriture du statut, gardes par transition), établissement/plateaux,
   inscriptions solo/équipe, check-in. Recherche joueur avant création pour éviter les doublons.
3. **Brackets** : pattern Strategy (`src/server/brackets/`) — Round Robin (poules, algorithme
   du cercle) et Élimination directe (seeding standard, exempts/byes auto-résolus, propagation
   via `Match.nextMatchId`/`nextMatchSlot`) implémentés ; Double élimination/Ligue/Custom
   enregistrés comme stubs prêts à être branchés.
4. **Scoring** : moteurs 501/301/Cricket purs (`src/server/scoring/`), alternance des lancers
   imposée côté serveur, verrouillage optimiste (`version` sur `Match`/`MatchGame`), correction
   du dernier tour avec audit immuable (jamais de suppression).
5. **Classement/stats** : recalcul après chaque match (round robin par points+départage,
   élimination par profondeur de parcours), stats carrière joueur (moyenne pondérée exacte,
   180/140+, historique).
6. **Temps réel** : Socket.io (rooms `tournament:{id}`, `match:{id}`), hook
   `useRealtimeResource` (socket + polling de secours), écran TV public par établissement (`/tv/[venueId]`).
7. **Tests + seed + doc** : 40 tests unitaires (Vitest), 1 test e2e Playwright qui rejoue
   le parcours complet, `prisma/seed.ts` (données de démo réalistes), CI GitHub Actions, README.
8. **Gestion des utilisateurs** (`src/server/users/`, `src/app/api/users/`,
   `src/app/(admin)/admin/users/`) : création/modification de comptes ADMIN/STAFF,
   désactivation (bloque la connexion), garde-fous (impossible de se désactiver
   soi-même, de changer son propre rôle, ou de retirer le dernier admin actif),
   audit trail. Testé de bout en bout (création, connexion, doublon email, 403 pour
   un compte STAFF).
9. **Déploiement Docker de production** (`docker compose up -d --build`) validé de bout
   en bout en conditions réelles (voir gotchas ci-dessous pour le détail des 4 bugs
   corrigés) : migrations automatiques au démarrage, seed manuel uniquement.

## Gotchas / pièges déjà rencontrés — à ne pas refaire

- **Socket.io + Next.js dev** : l'instance `io` doit être stockée sur `globalThis`
  (`src/lib/realtime/socket-server.ts`), pas dans une simple variable de module. En dev,
  Next.js compile les routes API via son propre bundler, séparément de `server.ts` — une
  variable de module donnerait deux instances différentes et l'émetteur ne trouverait
  jamais le vrai serveur socket (bug réel rencontré et corrigé, silencieux car `emitToRoom`
  ne plante pas si `io` est undefined).
- **pnpm bloque les build scripts par défaut** : après `pnpm install`, le client Prisma
  n'est PAS généré automatiquement (script `postinstall` ignoré). Il faut lancer
  `pnpm prisma:generate` explicitement, ou `pnpm approve-builds`. Piège rencontré en
  testant l'installation sur un Mac vierge.
- **pnpm@latest peut exiger une version de Node trop récente** (pnpm 11+ veut Node 22.13+).
  Le projet a été construit et testé avec **Node 20 + pnpm 10** — utiliser
  `corepack prepare pnpm@10 --activate` si `pnpm@latest` échoue.
- **Alternance des lancers dans le scoring** : la version (`MatchGame.version`) repart à 0
  à CHAQUE nouveau leg — ne pas maintenir un compteur global côté client/script, toujours
  relire le leg courant en base avant de soumettre un tour (bug rencontré dans le script de
  seed en le corrigeant).
- **Correction de score et checkout en mode DOUBLE/MASTER** : un jet qui amène le score
  restant à 0 sans `lastDartWasDouble`/`lastDartWasTriple` est traité comme un **bust**, pas
  un rejet — c'est voulu (comportement réel des fléchettes), mais ça peut surprendre en écrivant
  des scripts de test.
- **`/admin/users` est maintenant une page réelle** (section 8 ci-dessus) — seul
  `/admin/boards` reste un lien à ne pas ajouter au menu tant que la page n'existe pas.
- **Corepack résout `pnpm@latest` si aucune version n'est épinglée** : dans l'image Docker
  (basée sur `node:20-slim`), ça a entraîné l'installation de pnpm 11.x qui exige Node
  22.13+, avec un échec obscur (`ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite`) au lieu d'une
  erreur de version claire. Fixé en épinglant `"packageManager": "pnpm@10.34.5"` dans
  `package.json` — Corepack utilise alors toujours cette version exacte, partout
  (Docker, CI, postes de dev).
- **`node:20-slim` n'inclut pas OpenSSL** : le moteur Prisma (généré au `pnpm prisma:generate`,
  utilisé par `prisma migrate deploy`) en a besoin pour tourner ; sans lui, le conteneur
  redémarre en boucle avec une erreur "Schema engine error" précédée d'avertissements de
  détection OpenSSL peu explicites. Fixé en installant `openssl` via `apt-get` dans l'étape
  `base` du `Dockerfile`.
- **Ordre des étapes de build Docker et `node_modules`** : le client Prisma généré
  (`node_modules/.prisma/client`) n'existe qu'APRÈS `pnpm prisma:generate`, qui tourne dans
  l'étape `build`, pas dans l'étape `deps` (qui ne fait que `pnpm install`). Copier
  `node_modules` depuis `deps` dans l'étape finale `runner` fait planter l'app au runtime
  avec `Cannot find module '.prisma/client/default'` alors que le build Next.js a réussi.
  Toujours copier `node_modules` depuis l'étape `build` dans `runner`.

## Ce qui manque / prochaines priorités

Par ordre d'impact pour un usage réel au bar :

1. **Auto-inscription joueur** — actuellement le staff inscrit tout le monde au comptoir
   (décision V1 assumée, mais à reconsidérer si besoin d'un lien d'inscription en ligne).
2. **Formats non implémentés** (modèle de données prêt, générateur à écrire dans
   `src/server/brackets/`, suivre le pattern des stubs existants) : Double élimination,
   Ligue (classement multi-soirées), Custom.
3. **ELO**, **QR code de check-in**, **notifications**, **export CSV/PDF**,
   **intégration cibles électroniques**, **paiement/fidélité**, **multi-établissement** —
   tous pensés dans l'architecture (`PlayerStats.eloRating`, `Notification`, `Board`,
   `formatConfig` en Json) mais pas codés.
4. **Tests** : couverture solide sur la logique métier + 1 e2e du parcours complet, mais
   pas de tests d'intégration DB réelle, ni d'e2e sur la correction de score / l'écran TV /
   les futurs formats / la gestion des utilisateurs.
5. **Page `/admin/boards`** — gestion des plateaux (déjà modélisée en base, `Board`) mais
   pas d'UI dédiée ; actuellement les plateaux ne sont visibles qu'en lecture au sein des
   tournois.

## Repères dans le code

- `src/server/` = toute la logique métier, testable sans HTTP (c'est là qu'il faut regarder
  en premier pour comprendre les règles).
- `src/app/api/` = fine couche d'orchestration (auth, validation zod, appel du service).
- `src/app/(admin)`, `(staff)`, `(public)` = groupes de routes par rôle.
- `prisma/schema.prisma` = source de vérité du modèle de données, bien commenté.
- Plan d'architecture d'origine (contexte, décisions, risques) : demander à Claude Code
  s'il est encore accessible, sinon ce fichier + le README suffisent pour reprendre.
