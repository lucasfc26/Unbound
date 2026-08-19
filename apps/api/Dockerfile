# Builds and runs the NestJS API. Not a hot-reload dev container — rebuild
# with `docker compose up --build backend` after changing backend code.
FROM node:24-alpine

# Prisma's engine binaries need a real OpenSSL on Alpine — without it they fail
# at runtime with an unparseable "Error load..." response, not at build time.
RUN apk add --no-cache openssl

WORKDIR /app
RUN corepack enable

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api apps/api
COPY apps/web apps/web

# The workspace-wide install runs apps/api's `postinstall: prisma generate`,
# so its prisma/schema.prisma has to already be in place before this step.
RUN pnpm install --frozen-lockfile

RUN pnpm --filter @maselview/api build

WORKDIR /app/apps/api
EXPOSE 3000

# Migrations run against whatever DB the container connects to at startup,
# not at build time — the DB isn't reachable while the image is being built.
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/main.js"]
