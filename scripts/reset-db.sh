#!/bin/bash
# Réinitialise complètement la base de données locale (migrations + seed).
# Destructif : toutes les données actuelles sont perdues.
set -euo pipefail

cd "$(dirname "$0")/.."

read -r -p "Ceci va réinitialiser toute la base de données locale. Continuer ? [y/N] " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "Annulé."
  exit 0
fi

pnpm exec prisma migrate reset --force
