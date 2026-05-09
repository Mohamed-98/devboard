# Stage 1: Build
FROM node:24-alpine AS builder

WORKDIR /app

# Install build dependencies if needed
RUN apk add --no-cache openssl

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for building)
RUN npm install

# Copy Prisma schema and generated folder (if it exists)
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Copy the rest of the application code
COPY . .

# Generate Prisma client (in case it wasn't pre-generated)
RUN npx prisma generate

# Build the application
RUN npm run build

# Stage 2: Production
FROM node:24-alpine AS runner

WORKDIR /app

# Install runtime dependencies for Prisma
RUN apk add --no-cache openssl

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Set environment variables
ENV NODE_ENV=production

# Copy only the necessary files from the builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/prisma ./prisma

# Change ownership to the non-root user
RUN chown -R nestjs:nodejs /app

# Switch to the non-root user
USER nestjs

# Expose the application port
EXPOSE 3000

# Start the application
CMD ["node", "dist/main"]
