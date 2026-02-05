# SUBLYM Dream App

Application PWA de visualisation d'images d'attraction / rêves. Mode images uniquement (pas de vidéos).

## Architecture

```
sublym-dream-app/
├── frontend/          # PWA React + Vite + Tailwind
├── backend/           # API Hono + Prisma + PostgreSQL
├── modules/
│   ├── link-builder/      # Génération liens signés + QR codes
│   ├── business-model/    # Offres, quotas, permissions
│   └── payment/           # Stripe checkout + webhooks
├── docker-compose.yml
└── README.md
```

## Stack Technique

- **Frontend**: React 18 + Vite + Tailwind CSS + Framer Motion + PWA
- **Backend**: Hono (Node.js) + Prisma + PostgreSQL
- **Storage**: MinIO (S3-compatible)
- **Auth**: AccessCode + PIN 6 chiffres
- **Modules**: Eurkai standalone (Link Builder, Business Model, Payment)

## Prérequis

- Node.js 20+
- Docker & Docker Compose
- Git

## Démarrage rapide (Développement)

```bash
# 1. Cloner et entrer dans le dossier
cd sublym-dream-app

# 2. Démarrer les services (DB, MinIO)
docker-compose up -d postgres minio minio-init

# 3. Installer les dépendances backend
cd backend
npm install
cp .env.example .env
npx prisma generate
npx prisma db push

# 4. Démarrer le backend
npm run dev

# 5. Dans un autre terminal, démarrer le frontend
cd ../frontend
npm install
npm run dev
```

L'application sera accessible sur http://localhost:5173

## Variables d'environnement

Voir `.env.example` dans chaque module pour les variables requises.

### Variables principales

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | URL PostgreSQL |
| `S3_ENDPOINT` | URL MinIO/S3 |
| `S3_ACCESS_KEY` | Clé d'accès S3 |
| `S3_SECRET_KEY` | Clé secrète S3 |
| `JWT_SECRET` | Secret pour les tokens JWT |
| `GENERATION_API_URL` | URL du moteur de génération d'images |
| `BREVO_API_KEY` | Clé API Brevo (emails) |
| `STRIPE_SECRET_KEY` | Clé secrète Stripe |

## Déploiement (Production)

```bash
# 1. Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec les vraies valeurs

# 2. Construire et démarrer tous les services
docker-compose up -d --build

# 3. Exécuter les migrations
docker-compose exec backend npx prisma migrate deploy
```

## Endpoints API

### Auth
- `POST /api/auth/access-code` - Valider un code d'accès
- `POST /api/auth/create-pin` - Créer un utilisateur avec PIN
- `POST /api/auth/verify-pin` - Vérifier le PIN
- `POST /api/auth/lock` - Verrouiller la session
- `POST /api/auth/logout` - Déconnecter
- `GET /api/auth/me` - Info utilisateur courant

### Dreams
- `GET /api/dreams` - Liste des rêves
- `POST /api/dreams` - Créer un rêve
- `GET /api/dreams/:id` - Détail d'un rêve
- `PATCH /api/dreams/:id` - Modifier un rêve
- `DELETE /api/dreams/:id` - Supprimer un rêve
- `POST /api/dreams/:id/generate` - Lancer la génération
- `GET /api/dreams/:id/viewer` - Données pour le viewer

### Assets
- `GET /api/assets` - Liste des images
- `POST /api/assets/upload` - Upload une image
- `PATCH /api/assets/:id` - Modifier (enable/favorite)
- `DELETE /api/assets/:id` - Supprimer
- `POST /api/assets/:id/set-background` - Définir comme fond
- `GET /api/assets/:id/wallpaper` - Télécharger en fond d'écran

### Users
- `GET /api/users/settings` - Paramètres
- `PATCH /api/users/settings` - Modifier paramètres
- `POST /api/users/change-pin` - Changer le PIN
- `GET /api/users/stats` - Statistiques
- `DELETE /api/users/account` - Supprimer le compte
- `GET /api/users/export` - Exporter les données (RGPD)

## Modules Eurkai

### Link Builder (port 3010)
Génère des liens signés et QR codes pour la distribution d'accès.

```bash
# Créer un lien signé
POST /api/links
{
  "source": "etsy",
  "campaign": "launch-2026",
  "expiresAt": "2026-12-31T23:59:59Z"
}
```

### Business Model (port 3011)
Gère les offres, quotas et permissions.

```bash
# Vérifier un entitlement
POST /api/entitlements/check
{
  "userId": "...",
  "planId": "essential",
  "action": "generate_images"
}
```

### Payment (port 3012)
Intégration Stripe pour les paiements.

```bash
# Créer une session de checkout
POST /api/checkout/session
{
  "userId": "...",
  "planId": "premium",
  "period": "monthly"
}
```

## Flow utilisateur

1. **Acquisition** : Etsy/partenaire → Lien signé avec AccessCode
2. **Activation** : Entrée du code → Création PIN → Session
3. **Définition** : Upload photos + description rêve
4. **Génération** : Appel au moteur IA → Images générées
5. **Consultation** : Viewer scroll/swipe en boucle infinie
6. **Progression** : Marquer "C'est arrivé" → Statut réalisé

## Design System

- **Glassmorphism** : Mode rêve (cartes translucides, blur)
- **Neumorphism** : Mode système (ombres douces, relief)
- **Palette** : Dégradés rose/violet/indigo
- **Thèmes** : System / Light / Dark

## Sécurité

- PIN 6 chiffres obligatoire (bcrypt)
- Sessions révocables avec expiration
- Tokens Bearer pour l'API
- Rate limiting sur les endpoints sensibles
- Soft delete pour les données utilisateur

## Analytics

GTM/GA4 préparés via `window.dataLayer`. Événements tracés :
- `accesscode_submitted`
- `install_prompt_shown` / `installed`
- `dream_created`
- `dream_view_started`
- `asset_favorited`

---

*SUBLYM Dream App - Visualisez vos rêves, manifestez votre réalité*
