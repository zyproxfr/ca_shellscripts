# Image de production pour un déploiement auto-hébergé au bar (docker compose up).
FROM node:20-slim AS base
# node:20-slim n'inclut pas OpenSSL par défaut : le moteur Prisma (generate,
# migrate deploy) en a besoin pour fonctionner, sinon échec silencieux au
# démarrage du conteneur ("Schema engine error").
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma:generate
RUN pnpm build

FROM base AS runner
ENV NODE_ENV=production
# node_modules vient de l'étape "build", pas "deps" : c'est là que
# `pnpm prisma:generate` écrit le client généré (node_modules/.prisma/client) —
# le copier depuis "deps" (avant génération) fait planter l'app au runtime
# avec "Cannot find module '.prisma/client/default'".
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/server.ts ./server.ts
COPY --from=build /app/src ./src
COPY --from=build /app/next.config.mjs ./next.config.mjs
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["pnpm", "start"]
