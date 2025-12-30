# Multi-stage build for Abby Baby Coach
# Combines Node.js 20 + Python 3.11 in single container

FROM node:20-slim

# Install Python 3.11 and pip
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy Python dependencies first (for better layer caching)
COPY specs/ /app/specs/

# Install Python dependencies
COPY apps/abby/requirements.txt /app/apps/abby/requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r /app/apps/abby/requirements.txt

# Copy Node.js package files
COPY apps/abby/package*.json /app/apps/abby/

# Install Node dependencies
WORKDIR /app/apps/abby
RUN npm install --only=production

# Copy application source
COPY apps/abby/src/ /app/apps/abby/src/
COPY apps/abby/tsconfig.json /app/apps/abby/tsconfig.json

# Install tsx globally for running TypeScript (lighter than full build)
RUN npm install -g tsx

# Create data directory for logs (ephemeral)
RUN mkdir -p /app/apps/abby/data/logs /app/apps/abby/data/conversations

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Start server using tsx (no build step needed)
CMD ["tsx", "src/server.ts"]
