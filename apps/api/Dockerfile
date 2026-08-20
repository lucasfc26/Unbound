# Builds and runs the NestJS API. Not a hot-reload dev container — rebuild
# with `docker compose up --build backend` after changing backend code.
#
# Debian-based (not alpine): mediasoup only ships prebuilt worker binaries for
# glibc. On musl (Alpine) it falls back to compiling the worker from source on
# every install, which is slow and needs the full Python/meson/ninja toolchain.
FROM node:24-slim

# openssl for Prisma's engines; python3/build-essential as a fallback in case
# mediasoup's prebuilt worker binary doesn't match this exact glibc/kernel and
# it has to compile from source instead.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl python3 build-essential \
  && rm -rf /var/lib/apt/lists/*

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
