#!/bin/bash
# Lancement one-shot de l'environnement de développement local :
# Postgres (Docker) + migrations + seed de démonstration.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Aucun fichier .env trouvé, copie de .env.example..."
  cp .env.example .env
fi

echo "Démarrage de Postgres (docker-compose.dev.yml)..."
docker compose -f docker-compose.dev.yml up -d

echo "Application des migrations..."
pnpm prisma:deploy

echo "Chargement du seed de démonstration..."
pnpm prisma:seed

echo ""
echo "Prêt ! Lancez maintenant : pnpm dev"
echo "Connexion admin : admin@bar.local / admin123"
