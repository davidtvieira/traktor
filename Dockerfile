FROM node:22-alpine
LABEL org.opencontainers.image.title="Traktor" org.opencontainers.image.description="Syncs AIOStreams with Trakt, one Trakt account per user" org.opencontainers.image.source="https://github.com/davidtvieira/traktor" org.opencontainers.image.licenses="MIT"
WORKDIR /app
COPY package.json server.js trakt.js ui.js lists.js calendar.js logo.svg ./
ENV NODE_ENV=production TOKENS_FILE=/data/tokens.json PORT=7100
RUN mkdir -p /data && chown node:node /data
VOLUME /data
USER node
EXPOSE 7100
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:${PORT}/healthz >/dev/null || exit 1
CMD ["node", "server.js"]
