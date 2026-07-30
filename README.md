# Tournois Fléchettes 🎯

Application de gestion de tournois de fléchettes pour bar : inscriptions, check-in,
génération de brackets/poules, saisie de score, classement, statistiques et écran TV
en temps réel.

Stack : Next.js (App Router) + TypeScript, PostgreSQL + Prisma, NextAuth, Tailwind CSS,
Socket.io. Voir `/root/.claude/plans/tu-es-un-lead-magical-lollipop.md` (ou l'historique
Git) pour le plan d'architecture complet.

> Statut : en cours de construction (étape 1/7 — scaffold, auth, base de données).

## Lancement en local (développement)

Prérequis : Node.js 20+, pnpm, une instance PostgreSQL accessible.

```bash
pnpm install
cp .env.example .env   # adapter DATABASE_URL / NEXTAUTH_SECRET si besoin
pnpm prisma:migrate    # crée le schéma en base
pnpm dev               # démarre Next.js + Socket.io sur http://localhost:3000
```

Si vous n'avez pas de PostgreSQL local, `docker compose -f docker-compose.dev.yml up -d`
démarre uniquement la base de données (l'app tourne alors avec `pnpm dev` sur l'hôte).

## Déploiement au bar (production, auto-hébergé)

```bash
cp .env.example .env    # définir un vrai NEXTAUTH_SECRET (openssl rand -base64 32)
docker compose up -d    # démarre Postgres + l'application
```

L'application est alors accessible sur le réseau local du bar (tablette staff, TV
publique) sans dépendre d'une connexion internet.

## Structure du projet

```
prisma/          schéma de données, migrations, seed de démonstration
server.ts        serveur HTTP custom (Next.js + Socket.io)
src/app/         écrans (public, auth, admin, staff, joueur) et routes API
src/server/      logique métier pure (tournois, brackets, scoring, classement...)
src/lib/         infrastructure transverse (auth, Prisma, temps réel, validation)
src/components/  composants d'interface réutilisables
src/test/        tests unitaires, intégration, e2e
scripts/         scripts shell (dont les exercices d'origine du repo)
```

## Rôles

- **Admin** : configuration des tournois, établissement, plateaux, utilisateurs.
- **Staff** : check-in, gestion du tournoi en direct, saisie de score.
- **Joueur** : inscription, profil, historique.
- **Spectateur (écran TV)** : aucun compte requis, lecture seule.
