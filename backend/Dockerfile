# Built with the monorepo root as build context (needs pnpm-workspace.yaml
# and the lockfile) — see compose.yml: build.context: . / dockerfile: backend/Dockerfile

FROM node:24-alpine AS base
RUN npm install -g corepack@latest && corepack enable && corepack prepare pnpm@11.17.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY backend/package.json ./backend/package.json
RUN pnpm install --frozen-lockfile --filter garde-manger-backend...

FROM deps AS build
COPY backend ./backend
RUN pnpm --filter garde-manger-backend run build

FROM base AS production
ARG APP_BUILD=local
ENV NODE_ENV=production APP_BUILD=$APP_BUILD
RUN addgroup -S gardemanger && adduser -S gardemanger -G gardemanger
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/build ./backend/build
COPY --from=build /app/backend/package.json ./backend/package.json
COPY backend/docker-entrypoint.sh ./docker-entrypoint.sh
# /app/data is the storage volume's mount point: created here so the volume
# inherits the non-root owner instead of root.
RUN chmod +x ./docker-entrypoint.sh && mkdir -p /app/data/storage && chown -R gardemanger:gardemanger /app
USER gardemanger
WORKDIR /app/backend/build
EXPOSE 3333
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3333/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "--import", "./instrumentation.ts", "bin/server.js"]
