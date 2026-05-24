FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma

RUN npm ci && npx prisma generate

COPY db.js index.js sessionStore.js ./
COPY kb ./kb

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
