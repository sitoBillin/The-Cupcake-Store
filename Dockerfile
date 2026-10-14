FROM node:24.22.0-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24.22.0-alpine
ENV NODE_ENV=production \
    PORT=8080 \
    STATIC_DIR=/app/dist
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY server ./server
USER node
EXPOSE 8080
CMD ["node", "server/server.mjs"]
