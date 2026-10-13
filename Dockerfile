FROM node:22-slim AS build
WORKDIR /srv
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY src/ src/
RUN pnpm build

FROM node:22-slim
WORKDIR /srv
RUN corepack enable
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=build /srv/dist dist/

EXPOSE 8000
CMD ["node", "dist/main.js"]
