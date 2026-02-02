#!/bin/bash
# SUBLYM - Lance backend + frontend + backoffice en parallele
# Usage: ./dev.sh
#        ./dev.sh install   (installe les deps d'abord)

DIR="$(cd "$(dirname "$0")" && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

# Install deps if requested or if node_modules missing
if [ "$1" = "install" ] || [ ! -d "$DIR/backend/node_modules" ] || [ ! -d "$DIR/frontend/node_modules" ] || [ ! -d "$DIR/backoffice/node_modules" ]; then
  echo -e "${CYAN}Installing dependencies...${NC}"
  (cd "$DIR/backend" && npm install) &
  (cd "$DIR/frontend" && npm install) &
  (cd "$DIR/backoffice" && npm install) &
  wait
  echo -e "${GREEN}Dependencies installed.${NC}"
fi

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  SUBLYM DEV - Starting all services${NC}"
echo -e "${GREEN}============================================${NC}"
echo -e "  Backend:    ${CYAN}http://localhost:8000${NC}"
echo -e "  Frontend:   ${CYAN}http://localhost:5173${NC}"
echo -e "  Backoffice: ${CYAN}http://localhost:5174${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""

# Trap to kill all children on exit
trap 'kill 0' EXIT

# Start all 3 in parallel with colored prefixes
(cd "$DIR/backend"    && npm run dev 2>&1 | sed "s/^/[backend]    /") &
(cd "$DIR/frontend"   && npm run dev 2>&1 | sed "s/^/[frontend]   /") &
(cd "$DIR/backoffice" && npm run dev 2>&1 | sed "s/^/[backoffice] /") &

wait
