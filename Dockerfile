FROM oven/bun:1-alpine

RUN addgroup -S casino && adduser -S casino -G casino

WORKDIR /app

# dépendances d'abord (layer mis en cache)
COPY package.json .
RUN bun install --production

# code source
COPY . .

# répertoire SQLite persisté via volume
RUN mkdir -p /app/data && chown -R casino:casino /app

USER casino

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["bun", "run", "server.ts"]
