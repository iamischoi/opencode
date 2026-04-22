FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

# Update system and install required programming languages & tools
RUN apt-get update && \
    apt-get install -y \
    curl \
    wget \
    git \
    findutils \
    jq \
    unzip \
    build-essential \
    python3 \
    make \
    g++ \
    openjdk-21-jdk \
    gradle \
    software-properties-common \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20.x for local Node builds
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Install Bun explicitly
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

WORKDIR /app

# Copy only workspace configuration first to leverage Docker cache
COPY package.json bun.lock ./
COPY packages/ ./packages/
COPY patches/ ./patches/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy the rest of the codebase
COPY . .

# Make entrypoint script executable and fix potential Windows line endings (CRLF -> LF)
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh

# Expose the requested port for the API server
EXPOSE 10043

ENTRYPOINT ["/app/docker-entrypoint.sh"]
