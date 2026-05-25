# Production image: Luna SPA (nginx) + Express API (/api) in ONE container.
# Coolify: Base Directory = repository root (/.), Dockerfile = Dockerfile

FROM node:20-alpine AS frontend-build

WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ARG VITE_API_BASE=/api
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm run build

FROM node:20-alpine AS server-build

WORKDIR /server
RUN apk add --no-cache openssl
COPY server/package.json server/package-lock.json ./
COPY server/prisma ./prisma
RUN npm ci && npx prisma generate
COPY server/ ./

FROM node:20-alpine

RUN apk add --no-cache nginx openssl

WORKDIR /app

COPY --from=server-build /server ./server
COPY --from=frontend-build /build/dist /usr/share/nginx/html
COPY deploy/nginx.coolify.conf /etc/nginx/conf.d/default.conf
COPY deploy/start.sh /start.sh
RUN chmod +x /start.sh && rm -f /etc/nginx/http.d/default.conf 2>/dev/null || true

EXPOSE 80

ENV NODE_ENV=production
ENV PORT=4000

CMD ["/start.sh"]
