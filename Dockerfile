# ─── Stage 1: deps ───────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# ─── Stage 2: builder ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client before building
RUN npx prisma generate

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ─── Stage 3: runner ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Install Python 3 + pip + system deps needed by the findmy library
RUN apk add --no-cache python3 py3-pip gcc musl-dev libffi-dev openssl-dev python3-dev

# Install Python dependencies in a dedicated venv to avoid PEP 668 conflicts
RUN python3 -m venv /app/.venv
COPY requirements.txt ./
RUN /app/.venv/bin/pip install --no-cache-dir -r requirements.txt

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Make the venv python available as "py" (used by find-my.service.ts)
RUN ln -s /app/.venv/bin/python3 /usr/local/bin/py

# Copy built Next.js standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma schema + migrations so we can run migrate deploy at startup
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Copy the Python bridge script (keep path consistent with process.cwd())
COPY --from=builder /app/src/lib/scripts ./src/lib/scripts

# Copy the Apple session file if it already exists (will be empty on first run)
COPY --from=builder /app/apple_session.json* ./

COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
