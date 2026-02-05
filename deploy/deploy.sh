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
echo "[1/7] Pulling latest code..."
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

# --- Ensure critical env vars ---
ENV_FILE="$APP_DIR/backend/.env"
if [ -f "$ENV_FILE" ]; then
    grep -q "^FRONTEND_URL=" "$ENV_FILE" || echo 'FRONTEND_URL=https://preprod.sublym.org' >> "$ENV_FILE"
    # Force correct sender email (replace any existing value)
    sed -i 's/^BREVO_SENDER_EMAIL=.*/BREVO_SENDER_EMAIL=noreply@sublym.org/' "$ENV_FILE"
    # Ensure ENVIRONMENT is set for production email sending
    grep -q "^ENVIRONMENT=" "$ENV_FILE" || echo 'ENVIRONMENT=production' >> "$ENV_FILE"
    echo "  → .env patched: FRONTEND_URL, BREVO_SENDER_EMAIL, ENVIRONMENT"
    echo "  → Current sender: $(grep BREVO_SENDER_EMAIL "$ENV_FILE")"
    echo "  → Current frontend: $(grep FRONTEND_URL= "$ENV_FILE" | head -1)"
fi

# --- Backend ---
echo "[2/7] Building backend..."
cd "$APP_DIR/backend"
npm ci --production=false
npx prisma generate
npx prisma migrate deploy 2>/dev/null || npx prisma db push --accept-data-loss

# --- Frontend ---
echo "[3/7] Building frontend..."
cd "$APP_DIR/frontend"
npm ci
npx vite build

# --- Coming Soon page ---
echo "[4/7] Setting up coming-soon page..."
mkdir -p "$APP_DIR/coming-soon"
cp "$APP_DIR/deploy/coming-soon/"* "$APP_DIR/coming-soon/"
cp "$APP_DIR/frontend/public/favicon.svg" "$APP_DIR/coming-soon/" 2>/dev/null || true
cp "$APP_DIR/frontend/public/background.mp4" "$APP_DIR/coming-soon/" 2>/dev/null || true
cp "$APP_DIR/frontend/public/background.gif" "$APP_DIR/coming-soon/" 2>/dev/null || true

# --- Backoffice ---
echo "[5/7] Building backoffice..."
cd "$APP_DIR/backoffice"
npm ci
NODE_ENV=production npx vite build

# --- Python environment ---
echo "[6/7] Setting up Python environment..."
cd "$APP_DIR"
if [ ! -d "venv" ]; then
    python3.11 -m venv venv
fi
source venv/bin/activate
pip install -q -r requirements.txt
deactivate

# --- Restart services ---
echo "[7/7] Restarting services..."
pm2 delete sublym-api 2>/dev/null || true
cd "$APP_DIR/backend"

# Load .env variables into the shell so PM2 inherits them
# (the backend has no dotenv dependency, so env vars must come from the process environment)
if [ -f "$APP_DIR/backend/.env" ]; then
    echo "  → Loading .env into environment..."
    set -a
    source "$APP_DIR/backend/.env"
    set +a
    echo "  → ENVIRONMENT=$ENVIRONMENT"
    echo "  → FRONTEND_URL=$FRONTEND_URL"
    echo "  → BREVO_SENDER_EMAIL=$BREVO_SENDER_EMAIL"
fi

pm2 start "npx tsx src/index.ts" --name sublym-api --interpreter none --cwd "$APP_DIR/backend"
pm2 save

echo ""
echo "=========================================="
echo "  DEPLOYMENT COMPLETE!"
echo "=========================================="
pm2 status
