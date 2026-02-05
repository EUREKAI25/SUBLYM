#!/bin/bash
# ==============================================
# SUBLYM - Deployment Script
# Runs on the VPS to pull and deploy latest code
# Usage: bash deploy.sh [branch]
# ==============================================

set -e

APP_DIR="/var/www/sublym"
REPO="https://github.com/EUREKAI25/SUBLYM.git"
BRANCH="${1:-preprod}"

echo "=========================================="
echo "  SUBLYM - Deploying branch: $BRANCH"
echo "=========================================="

# --- Pull latest code ---
echo "[1/6] Pulling latest code..."
if [ ! -d "$APP_DIR/.git" ]; then
    cd /tmp
    rm -rf sublym-repo
    git clone -b "$BRANCH" "$REPO" sublym-repo
    rsync -a --exclude 'node_modules' --exclude 'venv' --exclude '.env' --exclude 'storage' sublym-repo/ "$APP_DIR/"
    rm -rf sublym-repo
else
    cd "$APP_DIR"
    git fetch origin
    git checkout "$BRANCH"
    git reset --hard "origin/$BRANCH"
fi

cd "$APP_DIR"

# --- Backend ---
echo "[2/6] Building backend..."
cd "$APP_DIR/backend"
npm ci --production=false
npx prisma generate
npx prisma migrate deploy 2>/dev/null || npx prisma db push --accept-data-loss

# --- Frontend ---
echo "[3/6] Building frontend..."
cd "$APP_DIR/frontend"
npm ci
npx vite build

# --- Backoffice ---
echo "[4/6] Building backoffice..."
cd "$APP_DIR/backoffice"
npm ci
NODE_ENV=production npx vite build

# --- Python environment ---
echo "[5/6] Setting up Python environment..."
cd "$APP_DIR"
if [ ! -d "venv" ]; then
    python3.11 -m venv venv
fi
source venv/bin/activate
pip install -q -r requirements.txt
deactivate

# --- Restart services ---
echo "[6/6] Restarting services..."
pm2 delete sublym-api 2>/dev/null || true
cd "$APP_DIR/backend"
pm2 start "npx tsx src/index.ts" --name sublym-api --interpreter none --cwd "$APP_DIR/backend"
pm2 save

echo ""
echo "=========================================="
echo "  DEPLOYMENT COMPLETE!"
echo "=========================================="
pm2 status
