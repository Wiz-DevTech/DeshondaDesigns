#!/usr/bin/env bash
# One-time Cloudflare resource setup for Deshonda Designs.
#
#   bash scripts/setup-cloudflare.sh YOUR_CLOUDFLARE_API_TOKEN
#
# Creates (if missing): D1 database "deshonda-db", R2 bucket "deshonda-uploads".
# Applies the D1 schema and seeds JWT_SECRET + ADMIN_PASSWORD_HASH (prints the
# generated admin password once). Optionally seeds Stripe keys from env:
#   STRIPE_SECRET_KEY=... STRIPE_WEBHOOK_SECRET=... bash scripts/setup-cloudflare.sh TOKEN
#
# Requires Node 18+ (fetch). Safe to re-run: everything is idempotent.
set -euo pipefail
cd "$(dirname "$0")"

if [ $# -lt 1 ]; then
  echo "usage: bash scripts/setup-cloudflare.sh CLOUDFLARE_API_TOKEN" >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "[setup] installing script dependencies"
  npm ci --no-audit --no-fund
fi

export CLOUDFLARE_API_TOKEN="$1"
export CLOUDFLARE_ACCOUNT_ID=""

echo "[setup] bootstrapping Cloudflare resources (D1 + R2)"
node ci-bootstrap.mjs

echo "[setup] applying schema + seeding secrets"
node ci-seed.mjs

echo "[setup] done. Next: connect the repo in Cloudflare Pages (see docs)."
