FROM oven/bun:1-alpine

# uid/gid figés (10001) : le bind-mount ./data côté hôte doit appartenir à cet
# uid, sinon SQLite ne peut pas écrire casino.db (SQLITE_CANTOPEN). 10001 évite
# la collision avec l'utilisateur "bun" (uid 1000) de l'image de base.
RUN addgroup -g 10001 -S casino && adduser -u 10001 -S -G casino casino

WORKDIR /app

# dépendances d'abord (layer mis en cache) — lock inclus pour builds reproductibles
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# code source
COPY . .

# répertoire SQLite persisté via volume
RUN mkdir -p /app/data && chown -R casino:casino /app

USER casino

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["bun", "run", "server.ts"]
