#!/bin/bash
# ==============================================
# SUBLYM - Server Initial Setup (Ubuntu 24.04)
# Run once on a fresh VPS as root
# Usage: ssh root@IP 'bash -s' < setup-server.sh
# ==============================================

set -e

echo "=========================================="
echo "  SUBLYM - Server Setup"
echo "=========================================="

# --- System update ---
echo "[1/9] Updating system..."
apt update && apt upgrade -y

# --- Essential packages ---
echo "[2/9] Installing essentials..."
apt install -y curl wget git build-essential software-properties-common \
  ufw fail2ban ffmpeg unzip

# --- Node.js 20 LTS ---
echo "[3/9] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2

# --- Python 3.11 + venv ---
# NOTE: Do NOT change system default python3 — it breaks apt_pkg on Ubuntu 24.04
# Use python3.11 explicitly when creating venvs
echo "[4/9] Installing Python 3.11..."
add-apt-repository -y ppa:deadsnakes/ppa
apt update
apt install -y python3.11 python3.11-venv python3.11-dev python3-pip

# --- PostgreSQL 16 ---
echo "[5/9] Installing PostgreSQL 16..."
sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/postgresql-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/postgresql-archive-keyring.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
apt update
apt install -y postgresql-16 postgresql-client-16

# --- Create database ---
echo "[6/9] Configuring PostgreSQL..."
DB_PASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
sudo -u postgres psql -c "CREATE USER sublym WITH PASSWORD '$DB_PASS';"
sudo -u postgres psql -c "CREATE DATABASE sublym_preprod OWNER sublym;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE sublym_preprod TO sublym;"
echo ""
echo "============================================"
echo "  DATABASE_URL=postgresql://sublym:${DB_PASS}@localhost:5432/sublym_preprod"
echo "============================================"
echo ""
echo "$DB_PASS" > /root/.sublym_db_password

# --- Nginx ---
echo "[7/9] Installing Nginx..."
apt install -y nginx certbot python3-certbot-nginx

# --- Create app user + directory ---
echo "[8/9] Creating app user..."
useradd -m -s /bin/bash sublym || true
mkdir -p /var/www/sublym/{frontend,backoffice,backend,generation,storage,logs}
chown -R sublym:sublym /var/www/sublym

# --- Firewall ---
echo "[9/9] Configuring firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable

# --- PM2 startup ---
env PATH=$PATH:/usr/bin pm2 startup systemd -u sublym --hp /home/sublym

echo ""
echo "=========================================="
echo "  SETUP COMPLETE!"
echo "=========================================="
echo ""
echo "  Database password saved in: /root/.sublym_db_password"
echo "  DATABASE_URL: postgresql://sublym:${DB_PASS}@localhost:5432/sublym_preprod"
echo ""
echo "  Next steps:"
echo "  1. Copy the DATABASE_URL above"
echo "  2. Add SSH key for GitHub Actions"
echo "  3. Configure nginx (deploy/nginx-sublym.conf)"
echo "  4. Set up .env on server"
echo ""
