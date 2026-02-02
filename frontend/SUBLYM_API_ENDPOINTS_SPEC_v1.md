# SUBLYM — API Endpoints Specification v1

## Format d'échange global

Tous les endpoints respectent le contrat de données Eurkai :

```json
{
  "meta": {
    "version": "v1",
    "run_id": "uuid | null",
    "user_id": "uuid | null"
  },
  "timestamp": "ISO-8601",
  "payload": {
    "inputlist": [],
    "outputlist": {
      "success": true,
      "output": [],
      "message": "string | null",
      "error": {}
    }
  },
  "nextaction": {}
}
```

### Elementlist structure
```json
{
  "kind": "text | image | video | json | event",
  "role": "semantic_role",
  "ref": "id | url | path",
  "rule": {}
}
```

---

# 1. AUTHENTIFICATION

## POST /auth/register

Inscription nouvel utilisateur.

**Input:**
```json
{
  "inputlist": [
    { "kind": "text", "role": "login", "ref": "marie_dupont" },
    { "kind": "text", "role": "email", "ref": "marie@example.com" },
    { "kind": "text", "role": "birthdate", "ref": "1990-05-15" },
    { "kind": "text", "role": "gender", "ref": "F | M | null" }
  ]
}
```

| Champ | Type | Obligatoire | Description |
|-------|------|-------------|-------------|
| login | string | ✅ | Identifiant unique choisi par l'utilisateur |
| email | string | ✅ | Email valide |
| birthdate | date (ISO) | ✅ | Date de naissance |
| gender | string | ❌ | "F", "M" ou null |

**Output (success):**
```json
{
  "success": true,
  "output": [
    { "kind": "json", "role": "user", "ref": {
      "id": "uuid",
      "login": "marie_dupont",
      "email": "marie@example.com",
      "created_at": "ISO-8601"
    }}
  ],
  "message": "Magic link envoyé"
}
```

**Output (error):**
```json
{
  "success": false,
  "output": [],
  "message": null,
  "error": {
    "code": "EMAIL_EXISTS | INVALID_EMAIL | INVALID_BIRTHDATE | LOGIN_EXISTS",
    "message": "Description erreur"
  }
}
```

---

## POST /auth/magic-link

Envoi d'un magic link par email (login existant).

**Input:**
```json
{
  "inputlist": [
    { "kind": "text", "role": "email", "ref": "marie@example.com" }
  ]
}
```

**Output (success):**
```json
{
  "success": true,
  "output": [],
  "message": "Magic link envoyé à marie@example.com"
}
```

---

## POST /auth/verify

Vérification du token magic link.

**Input:**
```json
{
  "inputlist": [
    { "kind": "text", "role": "token", "ref": "abc123xyz" }
  ]
}
```

**Output (success):**
```json
{
  "success": true,
  "output": [
    { "kind": "text", "role": "auth_token", "ref": "jwt_token_here" },
    { "kind": "json", "role": "user", "ref": {
      "id": "uuid",
      "login": "marie_dupont",
      "email": "marie@example.com",
      "subscription": {
        "level": 2,
        "end_date": "2025-03-15T00:00:00Z",
        "is_active": true
      }
    }}
  ]
}
```

---

## GET /auth/me

Récupère l'utilisateur courant (authentifié).

**Headers:** `Authorization: Bearer {jwt_token}`

**Output:**
```json
{
  "success": true,
  "output": [
    { "kind": "json", "role": "user", "ref": {
      "id": "uuid",
      "login": "marie_dupont",
      "email": "marie@example.com",
      "birthdate": "1990-05-15",
      "gender": "F",
      "created_at": "ISO-8601",
      "subscription": {
        "level": 2,
        "level_name": "Standard",
        "end_date": "2025-03-15T00:00:00Z",
        "is_active": true,
        "active_dreams": 1,
        "max_dreams": 1
      },
      "smile_used": false
    }}
  ]
}
```

---

## POST /auth/logout

Déconnexion (invalidation token).

**Headers:** `Authorization: Bearer {jwt_token}`

**Output:**
```json
{
  "success": true,
  "output": [],
  "message": "Déconnecté"
}
```

---

# 2. CONFIGURATION (Toutes données depuis BDD)

## GET /config/texts/{lang}

Récupère tous les textes UI dans la langue spécifiée.

**Params:** `lang` = "fr" | "en" | "it" | "es" | ...

**Output:**
```json
{
  "success": true,
  "output": [
    { "kind": "json", "role": "texts", "ref": {
      "common": {
        "login": "Connexion",
        "logout": "Déconnexion",
        "...": "..."
      },
      "landing": {
        "title": "Transformez vos rêves...",
        "...": "..."
      },
      "pricing": {
        "level1_name": "Essentiel",
        "level2_name": "Standard",
        "level3_name": "Premium",
        "...": "..."
      }
    }}
  ]
}
```

---

## GET /config/pricing

Récupère la configuration des niveaux et tarifs.

**Output:**
```json
{
  "success": true,
  "output": [
    { "kind": "json", "role": "pricing", "ref": {
      "levels": [
        {
          "level": 1,
          "photos_min": 3,
          "photos_max": 3,
          "scenes": 3,
          "active_dreams": 1,
          "definable_dreams": 1,
          "subliminal": false,
          "price_oneshot": 19,
          "price_monthly": 9,
          "currency": "EUR"
        },
        {
          "level": 2,
          "photos_min": 3,
          "photos_max": 5,
          "scenes": 5,
          "active_dreams": 1,
          "definable_dreams": 1,
          "subliminal": false,
          "price_oneshot": 29,
          "price_monthly": 19,
          "currency": "EUR"
        },
        {
          "level": 3,
          "photos_min": 3,
          "photos_max": 5,
          "scenes": 5,
          "active_dreams": 3,
          "definable_dreams": 5,
          "subliminal": true,
          "dream_selection": "manual | random",
          "price_oneshot": 49,
          "price_monthly": 39,
          "currency": "EUR"
        }
      ],
      "videos_per_week": 1
    }}
  ]
}
```

---

## GET /config/countries

Liste des pays et langues disponibles.

**Output:**
```json
{
  "success": true,
  "output": [
    { "kind": "json", "role": "countries", "ref": [
      { "code": "FR", "name": "France", "lang": "fr", "flag": "🇫🇷" },
      { "code": "IT", "name": "Italia", "lang": "it", "flag": "🇮🇹" },
      { "code": "US", "name": "United States", "lang": "en", "flag": "🇺🇸" }
    ]}
  ]
}
```

---

## GET /config/smile-status/{country}

Vérifie si l'offre Smile est encore disponible pour ce pays.

**Params:** `country` = "FR" | "IT" | ...

**Output:**
```json
{
  "success": true,
  "output": [
    { "kind": "json", "role": "smile_status", "ref": {
      "available": true,
      "current_count": 4523,
      "threshold": 10000,
      "offer_details": {
        "level": 3,
        "duration_months": 3,
        "description": "Premium 3 mois offert"
      }
    }}
  ]
}
```

---

# 3. RÊVES

## POST /dreams

Créer un nouveau rêve.

**Headers:** `Authorization: Bearer {jwt_token}`

**Input:**
```json
{
  "inputlist": [
    { "kind": "text", "role": "dream", "ref": "Je nous vois sur une plage au coucher du soleil..." },
    { "kind": "text", "role": "reject", "ref": "Pas de scène de pluie, pas d'animaux" },
    { "kind": "json", "role": "photolist", "ref": [
      { "url": "https://storage.../photo1.jpg", "order": 1 },
      { "url": "https://storage.../photo2.jpg", "order": 2 },
      { "url": "https://storage.../photo3.jpg", "order": 3 }
    ]}
  ]
}
```

| Champ | Type | Obligatoire | Description |
|-------|------|-------------|-------------|
| dream | string | ✅ | Description du rêve (min 20 caractères) |
| reject | string | ❌ | Ce que l'utilisateur ne veut PAS voir |
| photolist | array | ✅ | 3 à 5 photos (URLs après upload) |

**Output (success):**
```json
{
  "success": true,
  "output": [
    { "kind": "json", "role": "dream", "ref": {
      "id": "uuid",
      "trace_id": "uuid",
      "dream": "Je nous vois sur une plage...",
      "reject": "Pas de scène de pluie...",
      "status": "pending",
      "created_at": "ISO-8601"
    }}
  ]
}
```

**Note:** `trace_id` est généré par le backend et retourné dans la réponse.

---

## GET /dreams

Liste des rêves de l'utilisateur.

**Headers:** `Authorization: Bearer {jwt_token}`

**Output:**
```json
{
  "success": true,
  "output": [
    { "kind": "json", "role": "dreams", "ref": [
      {
        "id": "uuid",
        "dream": "Je nous vois sur une plage...",
        "status": "active",
        "is_active": true,
        "runs_count": 3,
        "last_run_at": "ISO-8601",
        "manifested": false,
        "created_at": "ISO-8601"
      }
    ]}
  ]
}
```

---

## GET /dreams/{id}

Détail d'un rêve avec ses runs.

**Headers:** `Authorization: Bearer {jwt_token}`

**Output:**
```json
{
  "success": true,
  "output": [
    { "kind": "json", "role": "dream", "ref": {
      "id": "uuid",
      "trace_id": "uuid",
      "dream": "Je nous vois sur une plage...",
      "reject": "Pas de scène de pluie...",
      "photolist": [
        { "url": "https://...", "order": 1 }
      ],
      "status": "active",
      "is_active": true,
      "manifested": false,
      "manifest_photo": null,
      "subliminal": {
        "enabled": false,
        "texts": []
      },
      "runs": [
        {
          "id": "uuid",
          "status": "done",
          "progress": 100,
          "created_at": "ISO-8601",
          "video_available": true
        }
      ],
      "created_at": "ISO-8601",
      "updated_at": "ISO-8601"
    }}
  ]
}
```

---

## PUT /dreams/{id}

Modifier un rêve (abonnés uniquement).

**Headers:** `Authorization: Bearer {jwt_token}`

**Input:**
```json
{
  "inputlist": [
    { "kind": "text", "role": "dream", "ref": "Nouveau texte du rêve..." },
    { "kind": "text", "role": "reject", "ref": "Nouvelles exclusions..." }
  ]
}
```

**Output:** Même structure que GET /dreams/{id}

---

## DELETE /dreams/{id}

Supprimer un rêve.

**Headers:** `Authorization: Bearer {jwt_token}`

**Output:**
```json
{
  "success": true,
  "output": [],
  "message": "Rêve supprimé"
}
```

---

## POST /dreams/{id}/manifest

Upload de la photo "rêve réalisé" (preuve de manifestation).

**Headers:** `Authorization: Bearer {jwt_token}`

**Input:**
```json
{
  "inputlist": [
    { "kind": "image", "role": "manifest_photo", "ref": "https://storage.../manifest.jpg" },
    { "kind": "text", "role": "consent", "ref": "true" }
  ]
}
```

| Champ | Type | Obligatoire | Description |
|-------|------|-------------|-------------|
| manifest_photo | URL | ✅ | Photo prouvant la manifestation |
| consent | boolean | ✅ | Autorisation d'utilisation (checkbox) |

**Output:**
```json
{
  "success": true,
  "output": [
    { "kind": "json", "role": "dream", "ref": {
      "id": "uuid",
      "manifested": true,
      "manifest_photo": "https://...",
      "manifest_consent": true,
      "manifested_at": "ISO-8601"
    }}
  ],
  "message": "Félicitations ! Votre rêve est manifesté 🎉"
}
```

---

# 4. RUNS (Générations vidéo)

## GET /runs/{id}

Statut d'une génération.

**Headers:** `Authorization: Bearer {jwt_token}`

**Output:**
```json
{
  "success": true,
  "output": [
    { "kind": "json", "role": "run", "ref": {
      "id": "uuid",
      "dream_id": "uuid",
      "status": "running | done | error",
      "progress": 65,
      "current_step": "Génération des images...",
      "created_at": "ISO-8601",
      "completed_at": "ISO-8601 | null",
      "video_available": false,
      "access_granted": false
    }}
  ]
}
```

---

## GET /runs/{id}/teaser

Récupère l'image teaser (extraite et floutée).

**Headers:** `Authorization: Bearer {jwt_token}`

**Output:**
```json
{
  "success": true,
  "output": [
    { "kind": "image", "role": "teaser", "ref": "https://storage.../teaser_blurred.jpg" }
  ]
}
```

---

## GET /runs/{id}/video

Accès à la vidéo (si payé ou smile validé).

**Headers:** `Authorization: Bearer {jwt_token}`

**Output (si accès autorisé):**
```json
{
  "success": true,
  "output": [
    { "kind": "video", "role": "video", "ref": "https://storage.../video.mp4" },
    { "kind": "json", "role": "metadata", "ref": {
      "duration": 10,
      "scenes": 5,
      "has_subliminal": false
    }}
  ]
}
```

**Output (si accès non autorisé):**
```json
{
  "success": false,
  "output": [],
  "error": {
    "code": "ACCESS_DENIED",
    "message": "Paiement ou validation Smile requis"
  }
}
```

---

# 5. PHOTOS

## POST /photos/upload

Upload de photos (retourne URLs).

**Headers:** `Authorization: Bearer {jwt_token}`
**Content-Type:** `multipart/form-data`

**Input:** Files (3 à 5 images)

**Output:**
```json
{
  "success": true,
  "output": [
    { "kind": "json", "role": "photos", "ref": [
      { "id": "uuid", "url": "https://storage.../photo1.jpg", "order": 1 },
      { "id": "uuid", "url": "https://storage.../photo2.jpg", "order": 2 },
      { "id": "uuid", "url": "https://storage.../photo3.jpg", "order": 3 }
    ]}
  ]
}
```

---

## POST /photos/verify

Vérification faciale : toutes les photos doivent montrer la même personne.

**Headers:** `Authorization: Bearer {jwt_token}`

**Input:**
```json
{
  "inputlist": [
    { "kind": "json", "role": "photo_urls", "ref": [
      "https://storage.../photo1.jpg",
      "https://storage.../photo2.jpg",
      "https://storage.../photo3.jpg"
    ]}
  ]
}
```

**Output (success):**
```json
{
  "success": true,
  "output": [
    { "kind": "json", "role": "verification", "ref": {
      "valid": true,
      "faces_detected": 3,
      "same_person": true,
      "confidence": 0.97
    }}
  ]
}
```

**Output (échec):**
```json
{
  "success": true,
  "output": [
    { "kind": "json", "role": "verification", "ref": {
      "valid": false,
      "faces_detected": 3,
      "same_person": false,
      "confidence": 0.45,
      "message": "Les photos semblent montrer plusieurs personnes. Pour l'instant, une seule personne par création est possible."
    }}
  ]
}
```

---

# 6. PAIEMENT (Stripe)

## POST /payment/create-session

Crée une session de paiement Stripe.

**Headers:** `Authorization: Bearer {jwt_token}`

**Input:**
```json
{
  "inputlist": [
    { "kind": "text", "role": "type", "ref": "oneshot | subscription" },
    { "kind": "text", "role": "level", "ref": "1 | 2 | 3" },
    { "kind": "text", "role": "run_id", "ref": "uuid (si oneshot pour débloquer une vidéo)" }
  ]
}
```

**Output:**
```json
{
  "success": true,
  "output": [
    { "kind": "json", "role": "stripe_session", "ref": {
      "session_id": "cs_xxx",
      "url": "https://checkout.stripe.com/xxx",
      "expires_at": "ISO-8601"
    }}
  ]
}
```

---

## POST /payment/webhook

Webhook Stripe (appelé par Stripe, pas par le frontend).

**Headers:** `Stripe-Signature: xxx`

**Input:** Event Stripe (checkout.session.completed, etc.)

**Output:**
```json
{
  "success": true,
  "output": [],
  "message": "Webhook traité"
}
```

---

## GET /payment/status/{session_id}

Vérifie le statut d'un paiement.

**Headers:** `Authorization: Bearer {jwt_token}`

**Output:**
```json
{
  "success": true,
  "output": [
    { "kind": "json", "role": "payment", "ref": {
      "session_id": "cs_xxx",
      "status": "paid | pending | failed",
      "amount": 29,
      "currency": "EUR",
      "type": "oneshot | subscription",
      "level": 2,
      "paid_at": "ISO-8601"
    }}
  ]
}
```

---

# 7. SMILE (Captation réaction)

## POST /smile/start

Démarre une session de captation (avant lecture vidéo).

**Headers:** `Authorization: Bearer {jwt_token}`

**Input:**
```json
{
  "inputlist": [
    { "kind": "text", "role": "run_id", "ref": "uuid" }
  ]
}
```

**Output:**
```json
{
  "success": true,
  "output": [
    { "kind": "json", "role": "smile_session", "ref": {
      "session_id": "uuid",
      "run_id": "uuid",
      "started_at": "ISO-8601"
    }}
  ]
}
```

---

## POST /smile/upload

Upload de la vidéo de réaction.

**Headers:** `Authorization: Bearer {jwt_token}`
**Content-Type:** `multipart/form-data`

**Input:** File (video/webm)

**Output:**
```json
{
  "success": true,
  "output": [
    { "kind": "json", "role": "smile_upload", "ref": {
      "session_id": "uuid",
      "video_url": "https://storage.../reaction.webm",
      "duration": 12,
      "uploaded_at": "ISO-8601"
    }}
  ]
}
```

---

## POST /smile/confirm

Confirmation de l'accord d'utilisation (après visionnage).

**Headers:** `Authorization: Bearer {jwt_token}`

**Input:**
```json
{
  "inputlist": [
    { "kind": "text", "role": "session_id", "ref": "uuid" },
    { "kind": "text", "role": "consent", "ref": "true" }
  ]
}
```

**Output:**
```json
{
  "success": true,
  "output": [
    { "kind": "json", "role": "smile_confirmed", "ref": {
      "session_id": "uuid",
      "video_access_granted": true,
      "premium_granted": {
        "level": 3,
        "duration_months": 3,
        "end_date": "ISO-8601"
      }
    }}
  ],
  "message": "Merci ! Votre accès Premium 3 mois est activé 🎉"
}
```

---

## POST /smile/cancel

Refus d'utilisation → suppression vidéo réaction, bascule vers paiement.

**Headers:** `Authorization: Bearer {jwt_token}`

**Input:**
```json
{
  "inputlist": [
    { "kind": "text", "role": "session_id", "ref": "uuid" }
  ]
}
```

**Output:**
```json
{
  "success": true,
  "output": [],
  "message": "Enregistrement supprimé. Vous pouvez payer pour accéder à votre vidéo.",
  "nextaction": {
    "action": "redirect_payment",
    "run_id": "uuid"
  }
}
```

---

# 8. ABONNEMENT

## GET /subscription

Détail de l'abonnement utilisateur.

**Headers:** `Authorization: Bearer {jwt_token}`

**Output:**
```json
{
  "success": true,
  "output": [
    { "kind": "json", "role": "subscription", "ref": {
      "is_active": true,
      "level": 3,
      "level_name": "Premium",
      "start_date": "ISO-8601",
      "end_date": "ISO-8601",
      "auto_renew": true,
      "price_monthly": 39,
      "currency": "EUR",
      "active_dreams": [
        { "id": "uuid", "dream": "Je nous vois..." }
      ],
      "max_active_dreams": 3,
      "definable_dreams": 5,
      "dream_selection": "manual",
      "subliminal_enabled": true,
      "stripe_subscription_id": "sub_xxx"
    }}
  ]
}
```

---

## POST /subscription/cancel

Annulation de l'abonnement (reste actif jusqu'à end_date).

**Headers:** `Authorization: Bearer {jwt_token}`

**Output:**
```json
{
  "success": true,
  "output": [
    { "kind": "json", "role": "subscription", "ref": {
      "is_active": true,
      "cancelled": true,
      "end_date": "ISO-8601",
      "message": "Votre abonnement reste actif jusqu'au {end_date}"
    }}
  ]
}
```

---

## PUT /subscription/dreams

Sélection des rêves actifs (Niveau 3 / Luxe uniquement).

**Headers:** `Authorization: Bearer {jwt_token}`

**Input:**
```json
{
  "inputlist": [
    { "kind": "json", "role": "active_dream_ids", "ref": ["uuid1", "uuid2", "uuid3"] },
    { "kind": "text", "role": "selection_mode", "ref": "manual | random" }
  ]
}
```

**Output:**
```json
{
  "success": true,
  "output": [
    { "kind": "json", "role": "active_dreams", "ref": [
      { "id": "uuid1", "dream": "..." },
      { "id": "uuid2", "dream": "..." },
      { "id": "uuid3", "dream": "..." }
    ]}
  ],
  "message": "Rêves actifs mis à jour"
}
```

---

# 9. SUBLIMINAL (Premium uniquement)

## GET /subliminal/templates

Récupère les templates de textes subliminaux disponibles.

**Headers:** `Authorization: Bearer {jwt_token}`

**Output:**
```json
{
  "success": true,
  "output": [
    { "kind": "json", "role": "templates", "ref": [
      { "id": "uuid", "category": "abundance", "text": "L'abondance coule vers moi naturellement" },
      { "id": "uuid", "category": "love", "text": "Je suis digne d'amour inconditionnel" },
      { "id": "uuid", "category": "health", "text": "Mon corps est en parfaite santé" }
    ]}
  ]
}
```

---

## POST /subliminal/validate

Validation des textes subliminaux par l'utilisateur AVANT génération.

**Headers:** `Authorization: Bearer {jwt_token}`

**Input:**
```json
{
  "inputlist": [
    { "kind": "text", "role": "dream_id", "ref": "uuid" },
    { "kind": "json", "role": "subliminal_config", "ref": {
      "enabled": true,
      "audio": true,
      "visual": true,
      "texts": [
        { "template_id": "uuid", "custom_text": null },
        { "template_id": null, "custom_text": "Mon texte personnalisé" }
      ]
    }}
  ]
}
```

**Output:**
```json
{
  "success": true,
  "output": [
    { "kind": "json", "role": "subliminal", "ref": {
      "dream_id": "uuid",
      "enabled": true,
      "audio": true,
      "visual": true,
      "texts": ["L'abondance coule...", "Mon texte personnalisé"],
      "validated_at": "ISO-8601",
      "locked": true
    }}
  ],
  "message": "Configuration subliminal validée. Elle ne pourra plus être modifiée."
}
```

**Note importante:** Une fois validé, le subliminal ne peut plus être modifié.

---

# 10. TÉMOIGNAGE

## POST /testimonial

Soumettre un témoignage (après confirmation Smile).

**Headers:** `Authorization: Bearer {jwt_token}`

**Input:**
```json
{
  "inputlist": [
    { "kind": "text", "role": "type", "ref": "text | audio | video" },
    { "kind": "text", "role": "content", "ref": "Texte du témoignage..." },
    { "kind": "text", "role": "media_url", "ref": "https://... (si audio/video)" },
    { "kind": "text", "role": "consent", "ref": "true" }
  ]
}
```

| Champ | Type | Obligatoire | Description |
|-------|------|-------------|-------------|
| type | string | ✅ | "text", "audio" ou "video" |
| content | string | Si type=text | Texte du témoignage |
| media_url | URL | Si type=audio/video | URL du fichier uploadé |
| consent | boolean | ✅ | Autorisation publication |

**Output:**
```json
{
  "success": true,
  "output": [
    { "kind": "json", "role": "testimonial", "ref": {
      "id": "uuid",
      "type": "text",
      "content": "...",
      "status": "pending_review",
      "created_at": "ISO-8601"
    }}
  ],
  "message": "Merci pour votre témoignage !"
}
```

---

# 11. BACK-OFFICE (Admin)

## POST /admin/auth

Authentification admin.

**Input:**
```json
{
  "inputlist": [
    { "kind": "text", "role": "login", "ref": "admin" },
    { "kind": "text", "role": "password", "ref": "xxx" }
  ]
}
```

---

## GET /admin/config

Récupère toute la configuration (textes, prix, params).

---

## PUT /admin/config/texts

Met à jour les textes (par langue).

---

## PUT /admin/config/pricing

Met à jour les tarifs et params des niveaux.

---

## PUT /admin/config/smile

Met à jour la config Smile (seuils par pays).

---

## GET /admin/users

Liste des utilisateurs.

---

## GET /admin/testimonials

Liste des témoignages (pour modération).

---

## PUT /admin/testimonials/{id}

Approuver/rejeter un témoignage.

---

## GET /admin/smile-reactions

Liste des vidéos de réaction Smile.

---

## PUT /admin/stripe-mode

Switch entre mode test et live.

**Input:**
```json
{
  "inputlist": [
    { "kind": "text", "role": "mode", "ref": "test | live" }
  ]
}
```

---

# VARIABLES ENVIRONNEMENT (.env)

```env
# Stripe
STRIPE_SECRET_KEY_TEST=sk_test_xxx
STRIPE_SECRET_KEY_LIVE=sk_live_xxx
STRIPE_PUBLISHABLE_KEY_TEST=pk_test_xxx
STRIPE_PUBLISHABLE_KEY_LIVE=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_MODE=test

# Database
DATABASE_URL=postgresql://...

# Storage
STORAGE_BUCKET=sublym-media
STORAGE_URL=https://storage...

# JWT
JWT_SECRET=xxx
JWT_EXPIRY=7d

# Magic Link
MAGIC_LINK_EXPIRY=15m
SMTP_HOST=...
SMTP_USER=...
SMTP_PASS=...

# Face Recognition API
FACE_API_URL=...
FACE_API_KEY=...
```

---

# CODES D'ERREUR STANDARDS

| Code | Description |
|------|-------------|
| `AUTH_REQUIRED` | Token manquant ou invalide |
| `AUTH_EXPIRED` | Token expiré |
| `NOT_FOUND` | Ressource non trouvée |
| `FORBIDDEN` | Accès non autorisé |
| `VALIDATION_ERROR` | Données invalides |
| `EMAIL_EXISTS` | Email déjà utilisé |
| `LOGIN_EXISTS` | Login déjà utilisé |
| `INVALID_EMAIL` | Format email invalide |
| `INVALID_BIRTHDATE` | Date de naissance invalide |
| `PHOTO_LIMIT` | Trop ou pas assez de photos |
| `FACE_MISMATCH` | Photos multi-personnes |
| `SUBSCRIPTION_REQUIRED` | Fonctionnalité réservée abonnés |
| `PREMIUM_REQUIRED` | Fonctionnalité réservée Premium |
| `SMILE_UNAVAILABLE` | Offre Smile épuisée (seuil atteint) |
| `PAYMENT_FAILED` | Échec paiement |
| `ALREADY_CANCELLED` | Abonnement déjà annulé |
