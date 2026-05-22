FROM docker.io/library/node:24-slim@sha256:24dc26ef1e3c3690f27ebc4136c9c186c3133b25563ae4d7f0692e4d1fe5db0e AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@11.1.1 --activate && chmod -R 755 /pnpm

FROM base AS dependencies
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/readest-app/package.json ./apps/readest-app/
COPY patches/ ./patches/
COPY packages/ ./packages/
RUN --mount=type=cache,id=pnpm,sharing=locked,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm --filter @readest/readest-app setup-vendors

FROM base AS development-stage
WORKDIR /app
COPY --from=dependencies /app /app
COPY . .
WORKDIR /app/apps/readest-app
EXPOSE 3000
ENTRYPOINT ["pnpm", "dev-web", "-H", "0.0.0.0"]

FROM base AS build
ENV NODE_ENV=production
WORKDIR /app
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_PLATFORM
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_OBJECT_STORAGE_TYPE
ARG NEXT_PUBLIC_STORAGE_FIXED_QUOTA
ARG NEXT_PUBLIC_TRANSLATION_FIXED_QUOTA
COPY --from=dependencies /app/node_modules /app/node_modules
COPY --from=dependencies /app/apps/readest-app/node_modules /app/apps/readest-app/node_modules
COPY --from=dependencies /app/apps/readest-app/public/vendor /app/apps/readest-app/public/vendor
COPY --from=dependencies /app/packages/foliate-js/node_modules /app/packages/foliate-js/node_modules
COPY . .
WORKDIR /app/apps/readest-app
RUN pnpm build-web

FROM base AS production-stage
ENV NODE_ENV=production
WORKDIR /app
# Only copy what next start needs — omit source, Rust, tests, patches, etc.
COPY --chown=node:node --from=build /app/package.json /app/package.json
COPY --chown=node:node --from=build /app/pnpm-workspace.yaml /app/pnpm-workspace.yaml
COPY --chown=node:node --from=build /app/node_modules /app/node_modules
COPY --chown=node:node --from=build /app/apps/readest-app/package.json /app/apps/readest-app/package.json
COPY --chown=node:node --from=build /app/apps/readest-app/next.config.mjs /app/apps/readest-app/next.config.mjs
COPY --chown=node:node --from=build /app/apps/readest-app/node_modules /app/apps/readest-app/node_modules
COPY --chown=node:node --from=build /app/apps/readest-app/.next /app/apps/readest-app/.next
COPY --chown=node:node --from=build /app/apps/readest-app/public /app/apps/readest-app/public
USER node
WORKDIR /app/apps/readest-app
ENTRYPOINT ["pnpm", "start-web", "-H", "0.0.0.0"]
EXPOSE 3000
