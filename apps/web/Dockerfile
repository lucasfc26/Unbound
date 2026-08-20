# Builds the frontend and serves the production bundle with Vite's own preview
# server. Not a hot-reload dev container — rebuild with
# `docker compose up --build frontend` after changing frontend code.
FROM node:24-alpine

WORKDIR /app
RUN corepack enable

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web apps/web
COPY apps/api apps/api

# Scoped to @maselview/web on purpose: apps/api pulls in mediasoup, whose
# postinstall needs a native build toolchain this (alpine) image doesn't have.
# The frontend has no dependency on the api package, so it doesn't need to be
# installed here at all — apps/api is only copied in because pnpm needs every
# workspace package.json present to resolve the filter.
RUN pnpm install --frozen-lockfile --filter @maselview/web

# Vite bakes VITE_* vars into the bundle at build time, not at container
# startup — this must be the public URL the browser uses to reach the API
# (e.g. https://unbound.maselcorp.com.br), never an in-network hostname.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN pnpm --filter @maselview/web build

WORKDIR /app/apps/web
EXPOSE 5173

CMD ["pnpm", "exec", "vite", "preview", "--host", "0.0.0.0", "--port", "5173"]
