FROM node:26-bookworm-slim AS dependencies
WORKDIR /app
COPY package*.json .npmrc ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:26-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN groupadd --system --gid 1001 nodeapp \
    && useradd --system --uid 1001 --gid nodeapp --create-home nodeapp \
    && mkdir -p /data/uploads \
    && chown -R nodeapp:nodeapp /data/uploads
COPY --from=dependencies /app/node_modules ./node_modules
COPY --chown=nodeapp:nodeapp src ./src
COPY --chown=nodeapp:nodeapp package.json ./
USER nodeapp
EXPOSE 3000
CMD ["node", "src/server.js"]
