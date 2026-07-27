FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
RUN npx prisma generate
RUN mkdir -p uploads
EXPOSE 3000

# Log missing critical env early so Railway deploy logs are actionable
CMD ["sh", "-c", "echo \"PORT=${PORT:-3000}\"; if [ -z \"$DATABASE_URL\" ]; then echo 'ERROR: DATABASE_URL is not set on this service'; exit 1; fi; if [ -z \"$REDIS_URL\" ]; then echo 'WARNING: REDIS_URL is not set'; fi; npx prisma migrate deploy && exec node dist/src/main.js"]
