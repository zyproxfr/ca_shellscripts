# Tournois Fléchettes 🎯

Application de gestion de tournois de fléchettes pour bar : inscriptions, check-in,
génération de brackets/poules, saisie de score en direct, classement, statistiques
et écran TV en temps réel.

Stack : Next.js (App Router) + TypeScript sur serveur HTTP custom, PostgreSQL + Prisma,
NextAuth, Tailwind CSS, Socket.io.

## Démarrage rapide (local)

Prérequis : Node.js 20+, pnpm, une instance PostgreSQL accessible (ou Docker).

```bash
pnpm install
cp .env.example .env          # adapter DATABASE_URL / NEXTAUTH_SECRET si besoin
docker compose -f docker-compose.dev.yml up -d   # Postgres seul, si pas d'instance locale
pnpm prisma:migrate           # crée le schéma en base
pnpm prisma:seed              # charge les données de démonstration
pnpm dev                      # démarre Next.js + Socket.io sur http://localhost:3000
```

Ou en une commande : `./scripts/dev-up.sh` (démarre Postgres, migre, seed).

### Comptes de démonstration (après `pnpm prisma:seed`)

| Rôle  | Email              | Mot de passe |
|-------|---------------------|--------------|
| Admin | admin@bar.local      | admin123     |
| Staff | staff1@bar.local     | staff123     |
| Staff | staff2@bar.local     | staff123     |

Le seed crée un établissement ("Le Fléchette d'Or", 3 plateaux), 16 joueurs, 2 équipes,
et trois tournois de démonstration :
- **Soirée Ligue du Mardi** (Round Robin, terminé) — historique, classement et stats
  déjà peuplés.
- **Coupe du Bar — Édition 2026** (Élimination directe, en cours) — un match est
  laissé en plein direct pour tester la saisie de score et l'écran TV immédiatement.
- **Tournoi par équipes du samedi** (brouillon) — pour tester le flux de création
  de zéro.

Écran TV de démonstration : `/tv/<venueId>` (l'id de l'établissement est visible dans
la page Admin → Établissement).

## Déploiement au bar (production, auto-hébergé)

```bash
cp .env.example .env    # définir un vrai NEXTAUTH_SECRET : openssl rand -base64 32
docker compose up -d    # démarre Postgres + l'application
```

L'application est alors accessible sur le réseau local du bar (tablette staff, TV
publique) sans dépendre d'une connexion internet. Le premier compte admin doit être
créé via `pnpm prisma:seed` (à adapter en retirant les données de démo) ou directement
en base avant la mise en service réelle.

## Qualité et tests

```bash
pnpm typecheck   # TypeScript strict
pnpm lint        # ESLint
pnpm test        # Vitest (logique métier : machine à états, brackets, scoring, classement)
pnpm test:e2e    # Playwright — nécessite une base seedée (pnpm prisma:seed)
```

Le test e2e (`src/test/e2e/golden-path.spec.ts`) rejoue le parcours complet : connexion
admin, création de tournoi, inscriptions, check-in, lancement, vérification du bracket,
puis saisie de score jusqu'à la victoire via l'écran staff.

## Structure du projet

```
prisma/          schéma de données, migrations, seed de démonstration
server.ts        serveur HTTP custom (Next.js + Socket.io)
src/app/         écrans (public, auth, admin, staff) et routes API
src/server/      logique métier pure (tournois, brackets, scoring, classement, TV...)
src/lib/         infrastructure transverse (auth, Prisma, temps réel, validation)
src/components/  composants d'interface réutilisables
src/test/        tests unitaires (généralisables en intégration/e2e, cf. Roadmap)
scripts/         scripts shell (dont les exercices d'origine du repo, hello.sh/variables.sh)
```

## Rôles

- **Admin** : configuration des tournois, établissement, plateaux, utilisateurs.
- **Staff** : check-in, gestion du tournoi en direct, saisie de score, corrections.
- **Spectateur (écran TV)** : aucun compte requis, lecture seule (bracket, poules,
  classement, matchs en direct).

## Fonctionnalités V1

- Formats **Round Robin** (poules) et **Élimination directe** (seeding standard,
  gestion des exempts/byes, propagation automatique) — Double élimination, Ligue et
  Custom sont modélisés et prêts à être branchés (pattern Strategy), pas encore
  implémentés.
- Joueurs solo (inscription équipe modélisée, formulaire fonctionnel).
- Cycle de vie de tournoi verrouillé par une machine à états (brouillon → inscriptions
  → check-in → en cours → terminé/annulé), avec garde-fous métier à chaque transition.
- Scoring 501/301/Cricket : double/master/straight-out, legs/sets configurables,
  alternance des lancers imposée côté serveur, verrouillage optimiste, correction
  du dernier tour avec audit complet.
- Classement recalculé après chaque match, statistiques carrière joueur (moyenne,
  meilleur score, 180/140+, historique des tournois).
- Temps réel (Socket.io) avec repli automatique sur polling en cas de coupure, écran
  TV public par établissement.
- Audit trail sur toutes les actions sensibles (changement de statut, correction de
  score, check-in).

## Roadmap (hors V1, architecture prête à les accueillir)

Double élimination, ligue saisonnière, ELO, QR code de check-in, suggestions de
checkout, notifications push, intégration cibles électroniques, export CSV/PDF,
paiement/fidélité, multi-établissement.

## Limites connues de la V1

- Pas d'auto-inscription joueur : l'inscription se fait au comptoir par le staff
  (décision pragmatique pour un usage terrain — un joueur n'a souvent pas de compte).
- Correction de score limitée au dernier tour saisi, et impossible une fois le match
  validé (évite d'avoir à rejouer toute la cascade de propagation déjà déclenchée).
- Tests automatisés : couverture unitaire solide sur la logique métier critique
  (machine à états, générateurs de bracket, moteurs de scoring, classement) et un
  scénario e2e couvrant le parcours complet ; les tests d'intégration base de données
  réelle et des scénarios e2e supplémentaires (double élimination une fois implémentée,
  écran TV, corrections de score) restent à étoffer avant une mise en production à
  grande échelle.
