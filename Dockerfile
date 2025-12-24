# Stage 1: Builder
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including dev) for build
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma Client (might fail if env vars missing, but we try)
# We use a dummy URL because generation doesn't need a real DB connection usually, 
# but if it fails we skip it here and rely on postinstall or runtime generation if needed.
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npx prisma generate || true

# Build the application
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# Stage 2: Runner
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy necessary files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma

# Expose port (Cloud Run uses 8080 by default, but we can configure it)
EXPOSE 3000

# Start the application
CMD ["node", "dist/main"]
