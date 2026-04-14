FROM oven/bun:1

# Install git for repository cloning, and python/make/g++ for native module compilation (node-gyp)
RUN apt-get update && apt-get install -y git python3 make g++ build-essential && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only workspace configuration first to leverage Docker cache
COPY package.json bun.lock ./
COPY packages/ ./packages/
COPY patches/ ./patches/

# Install dependencies (ignoring scripts for now to speed up and reduce memory spikes, 
# but trustedDependencies will still run if configured)
RUN bun install --frozen-lockfile

# Copy the rest of the codebase (this will overwrite directories with source)
COPY . .

# Install dependencies (since the user runs it from local source)
# RUN bun install

# Make entrypoint script executable
RUN chmod +x docker-entrypoint.sh

# Expose the requested port for the API server
EXPOSE 10043

ENTRYPOINT ["/app/docker-entrypoint.sh"]
