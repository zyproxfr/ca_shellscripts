#!/bin/sh
# Point d'entrée du conteneur de production : applique les migrations Prisma
# avant de démarrer le serveur, pour qu'une base Postgres neuve (premier
# `docker compose up`) obtienne son schéma automatiquement.
#
# Ne charge JAMAIS le seed de démonstration automatiquement ici : le seed
# vide et recrée des données à chaque exécution (voir prisma/seed.ts), ce qui
# détruirait les vraies données d'un bar en production à chaque redémarrage
# du conteneur. Charger le seed reste une action manuelle explicite :
#   docker compose exec app pnpm prisma:seed
set -e

echo "Application des migrations Prisma..."
pnpm prisma:deploy

echo "Démarrage du serveur..."
exec "$@"
