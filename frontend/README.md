# 💕 Ma Déclaration d'Amour

Frontend React pour la campagne Saint-Valentin de Sublym - Créez une déclaration d'amour en vidéo.

## ✨ Features

- 🔐 **Authentification** : Magic link (sans mot de passe)
- 📝 **Création** : Formulaire de génération (rêve + photos)
- 📸 **Upload** : Drag & drop multiple photos
- ⏳ **Polling** : Suivi en temps réel de la génération
- 🖼️ **Galerie** : Espace personnel (créations + photos)
- 📱 **Responsive** : Mobile-first design

## 🚀 Installation

```bash
# 1. Extraire et entrer dans le dossier
unzip valentine-app.zip
cd valentine-app

# 2. Installer les dépendances
npm install

# 3. Lancer le serveur de développement
npm run dev
```

→ http://localhost:5173

## 📁 Structure

```
valentine-app/
├── src/
│   ├── components/      # Composants réutilisables
│   │   ├── Logo.tsx
│   │   ├── Header.tsx
│   │   ├── PhotoUploader.tsx
│   │   ├── ProgressDisplay.tsx
│   │   └── ResultDisplay.tsx
│   ├── hooks/           # Hooks React
│   │   ├── useAuth.tsx
│   │   └── useGeneration.ts
│   ├── pages/           # Pages de l'app
│   │   ├── LandingPage.tsx
│   │   ├── LoginPage.tsx
│   │   ├── CreatePage.tsx
│   │   ├── GalleryPage.tsx
│   │   └── AccountPage.tsx
│   ├── lib/             # Utilitaires
│   │   ├── config.ts    # Configuration API
│   │   └── utils.ts
│   ├── types/           # Types TypeScript
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css        # Styles globaux
└── public/
    ├── logo.jpg
    └── favicon.svg
```

## 🎨 Design

**Palette Saint-Valentin élégante :**
- Wine (bordeaux) : `#8f1d40` → `#cc2d5a`
- Blush (rose poudré) : `#fef7f7`
- Cream : `#fdf9f3`
- Charcoal (texte) : `#3d3d3d`

**Typographie :**
- Display : Cormorant Garamond (titres)
- Script : Dancing Script (accents)
- Body : Lato (texte)

## 🔌 Contrat API Backend

### Auth

```
POST /api/auth/magic-link
Body: { "email": "user@example.com" }
Response: { "success": true }

POST /api/auth/verify
Body: { "token": "..." }
Response: { "user": {...}, "access_token": "..." }

GET /api/auth/me
Headers: Authorization: Bearer <token>
Response: { "id": "...", "email": "...", "created_at": "..." }
```

### Génération

```
POST /api/generate
Content-Type: multipart/form-data
Fields:
  - dream: string (obligatoire)
  - photos_user: File[] (obligatoire, min 1)
  - photos_other_character: File[] (optionnel)
  - photos_other_decor: File[] (optionnel)
  - style: string (optionnel)
  - character_a_name: string (optionnel)
  - character_b_name: string (optionnel)
Response: { "run_id": "..." }

GET /api/runs/{run_id}
Response: {
  "status": "queued|running|done|error",
  "progress": 0-100,
  "result": {
    "scenario": "...",
    "keyframes": ["url1", "url2"],
    "video_url": "...",
    "images": [{ "url": "...", "scene": "..." }]
  },
  "error": "..."
}
```

### Données utilisateur

```
GET /api/generations
GET /api/photos
GET /api/characters
```

## ⚙️ Configuration

Créez un fichier `.env` à la racine :

```env
# En dev, le proxy Vite redirige vers localhost:8000
VITE_API_URL=/api

# En prod, mettre l'URL complète
# VITE_API_URL=https://api.madeclarationdamour.com
```

## 📦 Build Production

```bash
npm run build
```

Les fichiers sont générés dans `dist/`.

## 🎯 Comportement UI

1. **Page d'accueil** : Landing page avec CTA vers création
2. **Connexion** : Email → Magic link → Redirect vers /create
3. **Création** : 
   - Formulaire avec textarea (rêve) + uploaders (photos)
   - Submit → POST /api/generate → polling GET /api/runs/{id}
   - Progression en temps réel avec animation
   - Résultat : vidéo + galerie + actions (download, share)
4. **Galerie** : Espace perso avec historique créations + photos
