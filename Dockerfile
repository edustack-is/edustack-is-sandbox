# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/
COPY apps/frontend/package*.json ./apps/frontend/
COPY apps/mcp-server/package*.json ./apps/mcp-server/

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build backend
RUN cd apps/backend && npm run build

# Build frontend
RUN cd apps/frontend && npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/
COPY apps/mcp-server/package*.json ./apps/mcp-server/

# Install production dependencies only
RUN npm install --production
RUN cd apps/backend && npm install --production
RUN cd apps/mcp-server && npm install --production

# Copy built files from builder
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/package.json ./apps/backend/
COPY --from=builder /app/apps/mcp-server/dist ./apps/mcp-server/dist
COPY --from=builder /app/apps/mcp-server/package.json ./apps/mcp-server/

# Copy frontend build
COPY --from=builder /app/apps/frontend/dist ./apps/frontend/dist

# Copy prisma files if needed
COPY apps/backend/prisma ./apps/backend/prisma

EXPOSE 3000

WORKDIR /app/apps/backend

CMD ["node", "dist/main.js"]
