# Builds the frontend and serves the production bundle with Vite's own preview
# server. Not a hot-reload dev container — rebuild with
# `docker compose up --build frontend` after changing frontend code.
FROM node:24-alpine

WORKDIR /app
RUN corepack enable

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web apps/web
COPY apps/api apps/api

# The workspace-wide install also runs apps/api's `postinstall: prisma generate`,
# so its prisma/schema.prisma has to already be in place before this step.
RUN pnpm install --frozen-lockfile

# Vite bakes VITE_* vars into the bundle at build time, not at container
# startup — this must point wherever the browser (on the host) can reach
# the API, not the in-network container hostname.
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL

RUN pnpm --filter @maselview/web build

WORKDIR /app/apps/web
EXPOSE 5173

CMD ["pnpm", "exec", "vite", "preview", "--host", "0.0.0.0", "--port", "5173"]
