ARG NODE_IMAGE=node:24-alpine
FROM ${NODE_IMAGE}

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund \
    && npm cache clean --force

COPY migrations ./migrations
COPY src ./src

RUN chmod -R a+rX /app

USER node
EXPOSE 3000

CMD ["sh", "-c", "node src/migrate.js && exec node src/server.js"]
