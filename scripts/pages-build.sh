#!/usr/bin/env bash
# Cloudflare Pages build command (run on Cloudflare's build infrastructure
# when the GitHub repo is connected via Pages -> Connect to Git).
#
# Produces ./dist containing:
#   - the Next.js static export (frontend/out/*)
#   - _worker.js (bundled Worker: /api/* routes + /uploads/* from R2, with
#     env.ASSETS fallback that Pages provides for the static files)
#
# D1 + R2 bindings are configured in the Pages project settings (dashboard),
# NOT in this repo — see the setup instructions.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "[pages-build] installing frontend deps"
(cd frontend && npm ci --no-audit --no-fund)

echo "[pages-build] building frontend static export"
(cd frontend && NEXT_PUBLIC_API_URL="" npm run build)

echo "[pages-build] installing worker deps (esbuild for bundling)"
(cd worker && npm ci --no-audit --no-fund)

echo "[pages-build] bundling _worker.js"
rm -rf dist
mkdir -p dist
(cd worker && npx esbuild src/index.js --bundle --format=esm --target=es2022 --outfile=../dist/_worker.js)

echo "[pages-build] copying static assets"
cp -r frontend/out/* dist/

echo "[pages-build] done — dist/ ready:"
ls dist | head
