# Built with the monorepo root as build context (needs pnpm-workspace.yaml
# and the lockfile) — see compose.yml: build.context: . / dockerfile: landing/Dockerfile

FROM node:26-alpine AS base
RUN npm install -g corepack@latest && corepack enable && corepack prepare pnpm@11.17.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY landing/package.json ./landing/package.json
RUN pnpm install --frozen-lockfile --filter garde-manger-landing...

FROM deps AS build
# Vite inlines VITE_* at build time: the browser does the fetching, so these
# are public URLs, not runtime secrets.
ARG VITE_CONNECTOR=http
ARG VITE_API_URL=https://api-gardemanger.floriaaan.fr
ARG VITE_GITHUB_REPO=floriaaan/garde-manger
ENV VITE_CONNECTOR=$VITE_CONNECTOR VITE_API_URL=$VITE_API_URL VITE_GITHUB_REPO=$VITE_GITHUB_REPO
COPY landing ./landing
RUN pnpm --filter garde-manger-landing run build

FROM base AS production
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0
RUN addgroup -S gardemanger && adduser -S gardemanger -G gardemanger
COPY --from=build --chown=gardemanger:gardemanger /app/node_modules ./node_modules
COPY --from=build --chown=gardemanger:gardemanger /app/landing/node_modules ./landing/node_modules
COPY --from=build --chown=gardemanger:gardemanger /app/landing/dist ./landing/dist
COPY --from=build --chown=gardemanger:gardemanger /app/landing/package.json ./landing/package.json
USER gardemanger
WORKDIR /app/landing
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["pnpm", "run", "start"]
