"""
Sublym v4 - Prompts Templates
VERSION MISE À JOUR - Février 2026
Les valeurs entre {accolades} sont remplacées dynamiquement
"""

# =============================================================================
# ANALYSE PERSONNAGE
# =============================================================================

PROMPT_ANALYZE_CHARACTER = """Analyse cette photo de manière DÉTAILLÉE et PRÉCISE.

Extrais les caractéristiques suivantes en étant le plus précis possible.

Réponds UNIQUEMENT en JSON valide:
{{
    "age_estimate": 45,
    "face": {{
        "shape": "oval|round|square|heart|oblong",
        "features": "description des traits distinctifs"
    }},
    "body": {{
        "type": "slim|average|curvy|athletic",
        "build": "petite|medium|large",
        "height_estimate": "short|average|tall"
    }},
    "skin_tone": "#hexcolor",
    "hair": {{
        "color": "#hexcolor",
        "color_name": "blonde|brown|black|red|gray|white",
        "length": "very_short|short|medium|shoulder|long|very_long",
        "type": "straight|wavy|curly|coily"
    }},
    "glasses": {{
        "present": true|false,
        "frame_color": "#hexcolor ou null",
        "frame_style": "rectangular|round|cat_eye|aviator|other ou null"
    }},
    "accessories": [
        {{"type": "earrings|necklace|bracelet|watch|scarf|hat", "color": "#hexcolor", "pattern": "solid|striped|plaid|floral"}}
    ],
    "distinctive_features": ["liste des signes distinctifs"],
    "style_impression": "classique|créatif|décontracté|élégant|excentrique"
}}
"""


# =============================================================================
# ÉTAPE 0 : EXTRACTION DES ÉLÉMENTS DU RÊVE (NOUVEAU)
# =============================================================================

PROMPT_EXTRACT_DREAM_ELEMENTS = """{strict_prefix}

Tu es un analyste spécialisé dans la compréhension des rêves et aspirations personnelles.

RÊVE DE L'UTILISATEUR:
{dream_statement}

PERSONNAGE: {character_name} ({character_gender}, environ {age} ans)
STYLE VESTIMENTAIRE DÉTECTÉ: {style_description}

═══════════════════════════════════════════════════════════════════════════════
MISSION: EXTRAIRE ET PRIORISER LES ÉLÉMENTS DU RÊVE
═══════════════════════════════════════════════════════════════════════════════

Analyse le rêve et extrais TOUS les éléments mentionnés ou implicites.

QUESTION CENTRALE À TE POSER:
"Quels moments cette personne a-t-elle VRAIMENT envie de vivre ?"

1. ÉLÉMENTS EXPLICITES (mentionnés directement par l'utilisateur)
   - Objets cités (laptop, téléphone, instrument, véhicule...)
   - Actions décrites (travailler, parler, créer, voyager...)
   - Lieux évoqués (ville, bureau, nature, plage...)
   - Personnes mentionnées (seul, avec quelqu'un, en équipe...)
   - Émotions souhaitées (confiance, créativité, liberté...)

2. ÉLÉMENTS IMPLICITES (déduits du contexte)
   - Ce que le rêve suggère sans le dire explicitement
   - Les désirs sous-jacents

3. MOMENTS SUGGÉRÉS
   Pour chaque moment, attribue:
   - priority: 1 (essentiel), 2 (important), 3 (nice-to-have)
   - type: ACTION, INTERACTION, IMMERSION, INTROSPECTION, ACCOMPLISSEMENT

   RÈGLES DES TYPES:
   - ACTION: Le personnage FAIT quelque chose de visible et dynamique
   - INTERACTION: Échange avec quelqu'un (Character B, animal, commerçant, collègues)
   - IMMERSION: Découverte d'un lieu, absorption dans l'environnement
   - INTROSPECTION: Moment de réflexion, contemplation (modéré, pas trop)
   - ACCOMPLISSEMENT: Réservé à la scène finale uniquement

4. CHARACTER B (si interactions mentionnées)
   - Le rêve implique-t-il une autre personne ?
   - importance: "high" si mentionné explicitement, "low" si suggéré
   - Si high: B doit être présent dans >50% des scènes ET dans la dernière

5. ÉLÉMENTS ICONIQUES
   - Si un lieu précis est évoqué, il doit être reconnaissable
   - Subtil, jamais caricatural (Tour Eiffel au loin, pas en gros plan)

Réponds UNIQUEMENT en JSON:
{{
    "user_explicit_elements": ["élément 1", "élément 2", "..."],
    "user_implicit_desires": ["désir 1", "désir 2", "..."],
    "suggested_moments": [
        {{
            "moment": "Description du moment",
            "priority": 1,
            "type": "ACTION|INTERACTION|IMMERSION|INTROSPECTION",
            "dream_element_illustrated": "quel élément du rêve"
        }}
    ],
    "character_b": {{
        "present": true|false,
        "importance": "high|low|none",
        "role": "rôle si présent (collègue, ami, partenaire...)",
        "appearance_hints": "indices d'apparence si mentionnés",
        "min_scenes_ratio": 0.5
    }},
    "iconic_elements": ["élément iconique 1", "..."],
    "mood_keywords": ["mot-clé ambiance 1", "..."],
    "must_avoid": ["cliché à éviter 1", "..."]
}}

{strict_suffix}
"""


# =============================================================================
# PALETTE COULEURS
# =============================================================================

PROMPT_GENERATE_PALETTE = """{strict_prefix}

Tu es un directeur artistique spécialisé en colorimétrie cinématographique.

RÊVE À ILLUSTRER:
{dream_statement}

STYLE DU PERSONNAGE (déduit de la photo): {style_description}
MOTS-CLÉS AMBIANCE: {mood_keywords}

═══════════════════════════════════════════════════════════════════════════════
CRÉER UNE PALETTE DE 4 COULEURS HEXADÉCIMALES
═══════════════════════════════════════════════════════════════════════════════

RÈGLE PRINCIPALE: La palette doit être 100% inspirée par le RÊVE et son ambiance.

INSPIRATION PAR TYPE DE RÊVE:
- Rêve de mer/plage: bleus océan, turquoises, sable doré, blanc écume
- Rêve de ville créative: gris urbain chic, néons (corail, cyan), touches vives
- Rêve de nature/montagne: verts profonds, terres, ciel, pierre
- Rêve professionnel/succès: bleus confiants, gris élégants, accents dorés
- Rêve romantique: roses poudrés, dorés chauds, crèmes
- Rêve d'aventure: oranges, ocres, bleus intenses

ADAPTATION AU STYLE DU PERSONNAGE:
- Style classique/sobre: palette plus désaturée, élégante
- Style créatif/excentrique: palette plus vive, contrastée
- Style décontracté: tons naturels, chaleureux

STRUCTURE DE LA PALETTE:
- Couleur 1: Dominante (60%) - ton principal du rêve
- Couleur 2: Secondaire (25%) - complémente la dominante
- Couleur 3: Accent chaud (10%) - apporte vie et émotion
- Couleur 4: Accent froid/neutre (5%) - contraste et équilibre

Réponds UNIQUEMENT en JSON:
{{
    "main_palette": ["#XXXXXX", "#XXXXXX", "#XXXXXX", "#XXXXXX"],
    "palette_names": ["nom couleur 1", "nom 2", "nom 3", "nom 4"],
    "mood": "description courte de l'ambiance (3-5 mots)",
    "reasoning": "explication du lien avec le rêve"
}}

{strict_suffix}
"""

PROMPT_SCENE_PALETTE = """{strict_prefix}

Décline la palette principale pour cette scène spécifique.

PALETTE PRINCIPALE: {main_palette}
AMBIANCE GLOBALE: {mood}

SCÈNE:
- Moment de la journée: {time_of_day}
- Lieu: {indoor_outdoor}
- Atmosphère souhaitée: {atmosphere}

RÈGLES DE DÉCLINAISON:
- Golden hour / sunset: réchauffer les couleurs
- Aube / blue hour: refroidir légèrement, tons bleutés
- Midi: augmenter le contraste
- Nuit: assombrir, ajouter des tons bleutés
- Intérieur: couleurs plus saturées
- Extérieur: couleurs plus naturelles

Réponds UNIQUEMENT en JSON valide:
{{
    "scene_palette": ["#XXXXXX", "#XXXXXX", "#XXXXXX", "#XXXXXX"],
    "lighting_mood": "description de l'ambiance lumineuse",
    "color_temperature": "warm|neutral|cool",
    "adjustments_made": "ce qui a été modifié par rapport à la palette principale"
}}

{strict_suffix}
"""


# =============================================================================
# SCÉNARIO GLOBAL (AMÉLIORÉ)
# =============================================================================

PROMPT_SCENARIO_GLOBAL = """{strict_prefix}

Tu es un scénariste spécialisé dans la visualisation de rêves personnels.

RÊVE DE L'UTILISATEUR:
{dream_statement}

PERSONNAGE PRINCIPAL: {character_name} ({character_gender}, environ {age} ans)

ÉLÉMENTS EXTRAITS DU RÊVE:
{dream_elements_json}

NOMBRE DE SCÈNES: {nb_scenes}
SCÈNES POV: {nb_pov_scenes}

ÉLÉMENTS EXCLUS PAR L'UTILISATEUR (NE JAMAIS INCLURE):
{reject_text}

═══════════════════════════════════════════════════════════════════════════════
RÈGLES DE CRÉATION DU SCÉNARIO
═══════════════════════════════════════════════════════════════════════════════

1. FIDÉLITÉ AU RÊVE
   - Les éléments de "user_explicit_elements" doivent apparaître (objectif: >=60%)
   - Utiliser les "suggested_moments" comme base
   - Respecter les priorités (1 = doit apparaître, 2 = devrait, 3 = si possible)

2. DISTRIBUTION DES TYPES DE SCÈNES
   - ACTION: minimum 50%, maximum 70% des scènes
   - INTERACTION: si Character B présent ou interactions mentionnées
   - IMMERSION: 1-2 scènes max (découverte de lieu)
   - INTROSPECTION: 0-1 scène max (ne pas en abuser)
   - ACCOMPLISSEMENT: OBLIGATOIRE en dernière scène uniquement

   Note: Les scènes POV sont TOUJOURS de type IMMERSION, le personnage est DEBOUT et SE DÉPLACE (marche, visite, explore). JAMAIS assis.

3. SCÈNE FINALE (ACCOMPLISSEMENT)
   - Le personnage a RÉALISÉ son rêve
   - Expression de satisfaction, bonheur, fierté
   - AUTORISÉ: regard chaleureux vers la caméra, sourire complice
   - Character B présent si importance="high"

4. CHARACTER B (si présent avec importance="high")
   - Doit apparaître dans >50% des scènes
   - DOIT être présent dans la dernière scène
   - Toujours de dos, flouté, ou en silhouette (jamais de visage visible)
   - Apparence COHÉRENTE entre les scènes

5. ÉLÉMENTS ICONIQUES
   - Si lieu précis évoqué: reconnaissable mais SUBTIL
   - Tour Eiffel au loin, pas en gros plan
   - Terrasse parisienne, pizza à Rome = OK
   - Jamais de caricature touristique

6. VARIÉTÉ
   - Au moins 2 lieux différents
   - Au moins 2 moments de journée différents
   - Mix intérieur/extérieur si pertinent

7. ÉMOTIONS TOUJOURS POSITIVES
   - Le personnage VIT SON RÊVE: il est TOUJOURS au minimum content, épanoui, souriant
   - Pas d'émotion neutre, pas de tristesse, pas d'ennui
   - Chaque scène doit refléter le bonheur de vivre ce rêve
   - Exemples: joie, émerveillement, satisfaction, fierté, sérénité heureuse

Réponds en JSON:
{{
    "title": "Titre évocateur du scénario",
    "same_day": true|false,
    "character_b": {{
        "present": true|false,
        "role": "rôle",
        "appearance": "description (silhouette, vêtements)",
        "scenes": [liste des scene_id où B apparaît]
    }},
    "scenes": [
        {{
            "id": 1,
            "type": "ACTION|INTERACTION|IMMERSION|INTROSPECTION|ACCOMPLISSEMENT",
            "phase": "NOM_PHASE",
            "concept": "Description courte",
            "context": "Contexte détaillé",
            "dream_element_illustrated": "quel élément du rêve",
            "emotional_beat": "émotion",
            "time_of_day": "morning|afternoon|golden_hour|dusk|night",
            "indoor": true|false,
            "is_pov": true|false,
            "location_type": "type de lieu",
            "has_character_b": true|false,
            "allows_camera_look": false
        }}
    ],
    "elements_coverage": {{
        "explicit_elements_used": ["liste"],
        "coverage_ratio": 0.75
    }}
}}

IMPORTANT pour la dernière scène:
- type: "ACCOMPLISSEMENT"
- allows_camera_look: true
- has_character_b: true (si B.importance = "high")

{strict_suffix}
"""


# =============================================================================
# SCÈNES LIBRES (mode free_scenes) - AMÉLIORÉ
# =============================================================================

PROMPT_FREE_SCENES = """{strict_prefix}

Tu es un directeur artistique de clips cinématographiques.

RÊVE: {dream_statement}
PERSONNAGE: {character_name} ({character_gender}, environ {age} ans)
NOMBRE DE SCÈNES: {nb_scenes} (dont {nb_pov_scenes} en POV)

ÉLÉMENTS EXTRAITS DU RÊVE:
{dream_elements_json}

ÉLÉMENTS EXCLUS PAR L'UTILISATEUR (NE JAMAIS INCLURE):
{reject_text}

SCÈNES IMPOSÉES (respecter strictement si présentes):
{imposed_scenes}

TYPES DE PLANS DISPONIBLES: {shot_types}

═══════════════════════════════════════════════════════════════════════════════
RÈGLES
═══════════════════════════════════════════════════════════════════════════════

1. FIDÉLITÉ AU RÊVE: éléments explicites doivent apparaître (>=60%)

2. DISTRIBUTION DES TYPES:
   - ACTION: 50-70%
   - INTERACTION: si pertinent
   - IMMERSION: 1-2 max
   - INTROSPECTION: 0-1 max
   - ACCOMPLISSEMENT: dernière scène obligatoirement

3. DERNIÈRE SCÈNE:
   - type: ACCOMPLISSEMENT
   - allows_camera_look: true (regard caméra + clin d'oeil possibles)
   - Character B présent si importance="high"

4. CHARACTER B: >50% des scènes si importance="high", présent à la fin

5. ÉLÉMENTS ICONIQUES: subtils, jamais caricaturaux

6. CONTRAINTES DE DIVERSITÉ:
   - Au moins 1 scène INTÉRIEUR et 1 EXTÉRIEUR
   - Au moins 2 moments de journée DIFFÉRENTS
   - Au moins 2 cadrages DIFFÉRENTS
   - Varier les ÉMOTIONS

Réponds UNIQUEMENT en JSON valide:
{{
    "title": "Titre évocateur",
    "scenes": [
        {{
            "id": 1,
            "type": "ACTION|INTERACTION|IMMERSION|INTROSPECTION|ACCOMPLISSEMENT",
            "concept": "Description poétique courte",
            "dream_element_illustrated": "quel élément du rêve",
            "framing": "close_up|medium|full|wide",
            "location": "Lieu précis",
            "time_of_day": "dawn|morning|midday|afternoon|golden_hour|sunset|dusk|night",
            "indoor": true|false,
            "is_pov": false,
            "emotion": "Émotion dominante",
            "action": "Ce que fait le personnage (ACTION VISIBLE)",
            "visual_detail": "Le détail unique",
            "atmosphere": "3 mots",
            "has_character_b": true|false,
            "allows_camera_look": false
        }}
    ]
}}

{strict_suffix}
"""


# =============================================================================
# SCÉNARIO VIDÉO PAR SCÈNE (AMÉLIORÉ)
# =============================================================================

PROMPT_SCENARIO_VIDEO = """{strict_prefix}

Tu es un directeur artistique spécialisé en vidéos cinématographiques.

CONTEXTE DU RÊVE: {dream_title}
SCÈNE {scene_id}/{total_scenes}: {scene_phase}
TYPE DE SCÈNE: {scene_type}
DESCRIPTION: {scene_context}
ÉTAT ÉMOTIONNEL: {emotional_beat}

PERSONNAGE: {character_name} ({character_gender}, environ {age} ans)
CARACTÉRISTIQUES (FROM PHOTO ANALYSIS - DO NOT INVENT OR MODIFY):
{character_features}

STRICT RULE: ONLY use accessories and features listed above.
If "Glasses: NO" -> character must NOT wear glasses.
If "Accessories: NONE" -> character must NOT have accessories unless outfit requires them.
DO NOT invent any physical feature not present in the analysis.

CHARACTER B PRÉSENT: {has_character_b}
REGARD CAMÉRA AUTORISÉ: {allows_camera_look}

OPTIONS DE CADRAGE (choisis UNIQUEMENT parmi):
- Types de plan: {shot_types}
- Angles: {camera_angles}
- Mouvements: {camera_movements}

OPTIONS DE LUMIÈRE (choisis UNIQUEMENT parmi):
- Direction: {lighting_directions}
- Température: {lighting_temperatures}

OPTIONS PROFONDEUR DE CHAMP: {depth_of_field_options}
OPTIONS FOCUS: {focus_options}

PALETTE COULEURS DE CETTE SCÈNE: {scene_palette}

MÊME JOURNÉE: {same_day}
{outfit_instruction}

INTENSITÉ EXPRESSION: {expression_intensities} (JAMAIS exagéré)
DIRECTION REGARD: {gaze_directions} (JAMAIS vers la caméra SAUF si allows_camera_look=true)

═══════════════════════════════════════════════════════════════════════════════
RÈGLES POUR LES KEYFRAMES START ET END
═══════════════════════════════════════════════════════════════════════════════

L'ACTION entre start et end doit créer une DIFFÉRENCE VISUELLE ÉVIDENTE en 6 secondes.

EXEMPLES D'ACTIONS CORRECTES:
| START                              | END                                    |
|------------------------------------|----------------------------------------|
| Debout, bras le long du corps      | Bras levé pointant vers l'horizon      |
| Assis, mains sur les genoux        | Debout, main sur la rambarde           |
| Marche vers la gauche              | Arrêté, regarde vers la droite         |
| Tient un café, bras baissé         | Porte le café à ses lèvres             |
| Laptop fermé sur la table          | Laptop ouvert, mains sur clavier       |
| Regarde droit devant               | Tête tournée à 45 degrés vers la gauche|
| Main dans la poche                 | Geste large de la main en parlant      |

ACTIONS INTERDITES (différence trop subtile):
- "sourire s'élargit légèrement"
- "change le poids d'un pied à l'autre"
- "cligne des yeux"
- "respire profondément"
- "ajuste légèrement sa posture"
- DEMI-TOUR (crée des artefacts vidéo)

RÈGLES STRICTES:
1. Personnage ne regarde JAMAIS la caméra (SAUF si allows_camera_look=true pour dernière scène)
2. PAS de miroir ni surface réfléchissante
3. PAS de texte visible
4. Expressions naturelles, JAMAIS exagérées
5. Personnages secondaires: TOUJOURS de dos, flous, silhouettes

RÈGLE CHARACTER B (si présent):
- Toujours de dos, en silhouette, ou très flouté
- Position cohérente entre start et end
- Peut bouger légèrement mais reste identifiable

Réponds UNIQUEMENT en JSON valide:
{{
    "start_keyframe": {{
        "description": "Description visuelle COMPLÈTE",
        "location": "Décor avec couleurs de la palette",
        "pose": "Position précise",
        "expression": "Expression faciale",
        "expression_intensity": "subtle|moderate|pronounced",
        "gaze_direction": "direction du regard",
        "outfit": "Description tenue avec couleurs",
        "accessories": "Accessoires visibles avec couleurs/motifs",
        "character_b_position": "Position de B si présent"
    }},
    "end_keyframe": {{
        "description": "Description visuelle fin",
        "pose": "Position DIFFÉRENTE du start",
        "expression": "Expression finale",
        "expression_intensity": "subtle|moderate|pronounced",
        "gaze_direction": "direction (peut être 'camera' si allows_camera_look)",
        "character_b_position": "Position de B si présent"
    }},
    "action": "Description COURTE du mouvement VISIBLE (1 phrase, 1 action)",
    "shooting": {{
        "shot_type": "type choisi",
        "camera_angle": "angle choisi",
        "camera_movement": "mouvement choisi",
        "lighting_direction": "direction choisie",
        "lighting_temperature": "température choisie",
        "depth_of_field": "profondeur choisie",
        "focus_on": "sujet du focus"
    }}
}}

{strict_suffix}
"""


PROMPT_SCENARIO_VIDEO_POV = """{strict_prefix}

SCÈNE POV (Point de Vue) - Vue subjective depuis les yeux du personnage EN MOUVEMENT.

CONTEXTE: {scene_context}
MOMENT: {time_of_day}
LIEU: {indoor_outdoor}
PALETTE: {scene_palette}

Le personnage est DEBOUT et SE DÉPLACE (marche, visite, explore).
Cette scène montre CE QUE VOIT le personnage pendant qu'il se déplace, pas le personnage.

EXEMPLES DE SCÈNES POV:
- Marcher dans une rue pittoresque et découvrir une vitrine
- Visiter un musée et s'arrêter devant une oeuvre
- Explorer un marché coloré
- Se promener dans un jardin, un parc
- Longer une plage, un port

RÈGLES POV:
1. AUCUN personnage visible (c'est SA vue)
2. Hauteur caméra = niveau des yeux d'une personne DEBOUT (~1.65m)
3. Perspective naturelle de quelqu'un qui MARCHE et REGARDE autour de lui
4. Peut inclure au premier plan (flou): main tenant objet, bord de veste...
5. Le sujet principal = ce que le personnage REGARDE en se déplaçant
6. JAMAIS de perspective assise (pas de table, pas de tasse sur table)

OPTIONS SHOOTING:
- Profondeur de champ: {depth_of_field_options}
- Température lumière: {lighting_temperatures}

Réponds UNIQUEMENT en JSON valide:
{{
    "start_keyframe": {{
        "description": "Ce que voit le personnage au début en marchant",
        "camera_height": "~1.65m (debout)",
        "foreground": "Élément proche flou (main, bord veste, objet tenu)",
        "midground": "Sujet principal du regard",
        "background": "Arrière-plan du lieu visité",
        "lighting": "Description lumière avec couleurs palette"
    }},
    "end_keyframe": {{
        "description": "Ce que voit le personnage après s'être déplacé",
        "change": "Changement de perspective dû au déplacement"
    }},
    "action": "Mouvement de marche/exploration dans la scène",
    "shooting": {{
        "depth_of_field": "shallow|medium|deep",
        "lighting_temperature": "warm|neutral|cool"
    }}
}}

{strict_suffix}
"""


# =============================================================================
# GÉNÉRATION IMAGE
# =============================================================================

PROMPT_IMAGE_GENERATE = """{strict_prefix}

MAIN INSTRUCTION:
Take the EXACT person from the attached reference photo and place them in the described situation.
DO NOT modify this person. DO NOT reinvent their appearance.
You MUST reproduce EXACTLY: their face, their body type, their age, their features.

SITUATION TO CREATE:
- Context: {description}
- Location: {location}
- Pose: {pose}
- Expression: {expression} (intensity: {expression_intensity}, NEVER exaggerated)
- Gaze direction: {gaze_direction} (NEVER toward camera unless explicitly allowed)
- Outfit: {outfit}
- Accessories: {accessories}

SCENE COLOR PALETTE (use these 4 colors as dominant tones):
{scene_palette}

FRAMING:
- Shot type: {shot_type}
- Camera angle: {camera_angle}
- Lighting direction: {lighting_direction}
- Lighting temperature: {lighting_temperature}
- Depth of field: {depth_of_field}
- Focus on: {focus_on}

{same_day_rules}

ABSOLUTE RULES - FACE PRESERVATION:
- The person in the image MUST BE the EXACT SAME PERSON from the reference photo
- IDENTICAL face shape, nose, jawline, chin, ears, forehead
- IDENTICAL skin tone and complexion
- IDENTICAL body type (same silhouette, same weight, same proportions)
- NO change to facial structure or proportions
- NO adding or removing glasses unless specified in character analysis
- NO adding accessories not present in reference
- NO age change - same age as reference

ABSOLUTE RULES - SCENE:
- Character NEVER looks at the lens/camera (unless last scene and explicitly allowed)
- NO mirror or reflective surface showing a face
- NO visible text
- NO anatomical deformation
- Natural expression, NEVER exaggerated
- EXPRESSION MUST BE POSITIVE: the character is living their DREAM, they must look at minimum content, happy, or fulfilled. No neutral or negative expression.
- Cinematic quality

{strict_suffix}
"""

PROMPT_IMAGE_SAME_DAY_RULES = """
SAME-DAY RULES (same day continuity):
- Outfit EXACTLY IDENTICAL to the previous scene (same garment, same color, same pattern)
- Hairstyle EXACTLY IDENTICAL
- Accessories EXACTLY IDENTICAL (same color, same pattern - plaid scarf = plaid, not solid)
- Glasses IDENTICAL if present
"""

PROMPT_IMAGE_POV = """{strict_prefix}

INSTRUCTION: Generate a POV (point of view / subjective) image.
This shows what the character SEES while WALKING/EXPLORING, not the character themselves.

WHAT THE CHARACTER SEES:
- Description: {description}
- Foreground (blurred): {foreground}
- Midground (main subject): {midground}
- Background: {background}
- Lighting: {lighting}

COLOR PALETTE: {scene_palette}

CAMERA HEIGHT: Eye level of a person STANDING (~1.65m from ground)

FRAMING:
- Depth of field: {depth_of_field}
- Lighting temperature: {lighting_temperature}

RULES:
- NO person visible (this is THEIR view)
- Camera at STANDING eye level (~1.65m), NEVER at table/sitting level
- May include: hand holding object, edge of clothing (blurred foreground)
- Natural and immersive perspective of someone WALKING
- Cinematic quality

{strict_suffix}
"""


# =============================================================================
# VALIDATION
# =============================================================================

PROMPT_VALIDATION = """{strict_prefix}

Compare l'IMAGE GÉNÉRÉE avec l'IMAGE DE RÉFÉRENCE de manière TRÈS STRICTE.

CRITÈRES À ÉVALUER:
{criteria_with_definitions}

RÈGLES DE NOTATION:
- 1.0 = IDENTIQUE selon la définition
- 0.9 = Quasi-identique, différence imperceptible
- 0.8 = Très similaire, différences très mineures
- 0.7 = Similaire, quelques différences notables
- 0.6 = Assez similaire, différences visibles
- 0.5 = Moyennement similaire
- 0.4 = Peu similaire, différences importantes
- 0.3 = Très peu similaire
- 0.0 = Complètement différent ou absent

ATTENTION - SOIS SÉVÈRE:
- Une personne différente mais du même "type" = 0.3 MAXIMUM
- Le visage doit être LA MÊME PERSONNE, pas juste ressemblant
- Même corpulence signifie MÊME silhouette, pas juste "similaire"

Réponds UNIQUEMENT en JSON valide:
{{
    "scores": {{
        "critere_code": {{"score": 0.0, "comment": "explication"}}
    }},
    "global_score": 0.0,
    "is_same_person": true|false,
    "major_issues": ["liste des problèmes majeurs"]
}}

{strict_suffix}
"""


# =============================================================================
# VIDÉO
# =============================================================================

PROMPT_VIDEO = """Smooth {duration}-second cinematic video transitioning from the first image to the last image.

ACTION: {action}

CAMERA: {camera_movement}

RULES:
1. The video MUST start exactly like the first image and end exactly like the last image
2. Only the CHARACTER moves - background COMPLETELY STATIC
3. Do NOT morph, stretch, or deform any objects
4. Character's face must stay IDENTICAL throughout
5. Smooth, natural human movement only
6. Background elements must remain FIXED
"""

# =============================================================================
# SCENARIO PUB (mode scenario_pub)
# =============================================================================

PROMPT_SCENARIO_PUB_VIDEO_1A = """{strict_prefix}

SCENE 1A - DAILY LIFE TO DREAM TRANSITION

You are an art director specialized in REALISTIC emotional advertising spots.
Your style: Apple, Nike, Volvo -- genuine emotion, no special effects, no fantasy.

SPOT TITLE: {dream_title}
CHARACTER: {character_name} ({character_gender}, approximately {age} years old)
FEATURES (FROM PHOTO ANALYSIS - DO NOT INVENT OR MODIFY):
{character_features}

STRICT RULE: ONLY use accessories and features listed above.

DAILY CONTEXT: {daily_environment}
DREAM CONTEXT: {dream_environment}
EMOTIONAL ARC: {emotional_arc}

DAILY PALETTE (START): {daily_palette}
DREAM PALETTE (END): {dream_palette}

===============================================================================
TRANSITION KEYFRAMES
===============================================================================

START: Boring daily life
- Environment: a REAL, mundane, recognizable everyday location (office, public transport, kitchen...)
- Character: facing RIGHT, slightly slouched posture, arms at sides
- Expression: weariness, boredom, fatigue (intensity: moderate)
  - NATURAL: a genuine tired look, not a theatrical grimace
  - Slight shoulder drop, slightly empty gaze
- Gaze: downward or straight ahead, half-closed eyes
- Colors: DESATURATED, daily palette only
- Lighting: flat, cold, no depth
- Outfit: simple everyday clothes, no flair

END: Dream environment
- SAME character, SAME overall physical position
- COMPLETELY DIFFERENT setting: the dream location
- Character: head raised, body slightly straightened
- Expression: NATURAL and sincere wonder
  - Slightly raised eyebrows, eyes a bit wider, mouth slightly open
  - SUBTLE: like a real person discovering something beautiful
  - NO wide-open cartoon mouth
  - NO exaggerated wide eyes
  - A spontaneous beginning of a smile that reaches the eyes
- Gaze: ahead, slightly upward
- Colors: VIVID, dream palette, high saturation
- Lighting: warm, golden, cinematic, with depth

ACTION in 6 seconds: The daily setting transforms into the dream setting.
The character transitions from boredom to wonder.

===============================================================================
ABSOLUTE RULES - REALISM
===============================================================================

FORBIDDEN - SPECIAL EFFECTS:
- NO magic portal, vortex, light tunnel
- NO glowing particles, sparkles, aura, halo
- NO morphing or spatial distortion
- NO science-fiction or fantasy effects
- NO supernatural light rays

The transition is a CINEMATIC CUT: two different images of the same
character in two different settings. Like in a real advertising film.
The "magic" comes from the CONTRAST between the two images, not from visual effects.

FORBIDDEN - CARICATURE:
- NO unrealistic or fluorescent colors
- NO impossible fantasy setting
- NO supernatural lighting (no light without a source)
- NO exaggerated or theatrical facial expressions

The daily location MUST be a real, credible, photographable place.
The dream location MUST be a real place (even if stunning), not a fantasy world.

REQUIRED - AUTHENTIC EXPRESSIONS:
- START weariness: a genuine tired look, like at the end of a long day
- END wonder: a genuine joyful surprise, like discovering a stunning landscape for the first time
- The dawning smile: a Duchenne smile (reaching the eyes), not a forced advertising smile

Reply ONLY in valid JSON:
{{
    "start_keyframe": {{
        "description": "COMPLETE visual description of daily life - REALISTIC mundane location",
        "location": "Dull CREDIBLE everyday location with desaturated colors",
        "pose": "Facing right, slightly slouched, closed posture",
        "expression": "Natural weariness, genuine boredom",
        "expression_intensity": "moderate",
        "gaze_direction": "down",
        "outfit": "Simple everyday outfit",
        "accessories": ""
    }},
    "end_keyframe": {{
        "description": "COMPLETE visual description of dream - REAL but stunning location",
        "location": "Bright and colorful dream location, REALISTIC and photographable",
        "pose": "Head raised, body straightened, slight startled step back",
        "expression": "Natural wonder, sincere surprise, dawning smile",
        "expression_intensity": "moderate",
        "gaze_direction": "up",
        "outfit": "Same outfit as start",
        "accessories": ""
    }},
    "action": "Environment changes (cinematic cut): daily setting replaced by dream location. Character raises head, pleasantly surprised.",
    "shooting": {{
        "shot_type": "medium_full",
        "camera_angle": "eye_level",
        "camera_movement": "static",
        "lighting_direction": "front",
        "lighting_temperature": "cool_to_warm",
        "depth_of_field": "medium",
        "focus_on": "face"
    }}
}}

{strict_suffix}
"""

PROMPT_SCENARIO_PUB_VIDEO_1B = """{strict_prefix}

SCENE 1B - FIRST STEPS INTO THE DREAM

You are an art director specialized in REALISTIC emotional advertising spots.
Your style: Apple, Nike, Volvo -- genuine emotion, no special effects, no fantasy.

SPOT TITLE: {dream_title}
CHARACTER: {character_name} ({character_gender}, approximately {age} years old)
FEATURES (FROM PHOTO ANALYSIS - DO NOT INVENT OR MODIFY):
{character_features}

STRICT RULE: ONLY use accessories and features listed above.

DREAM CONTEXT: {dream_environment}
EMOTION: {emotional_beat}

DREAM PALETTE: {dream_palette}

===============================================================================
KEYFRAMES - DREAM EXPLORATION
===============================================================================

START: EXACTLY the same image as the END of scene 1A.
- Character in wonder, head raised
- Dream setting
- Vivid colors, dream palette

END: The character begins to explore.
- Changed orientation (facing LEFT or 3/4 view)
- First steps into the new world
- Expression: AUTHENTIC JOY
  - A genuine smile that reaches the eyes (Duchenne smile)
  - Curious and lively gaze, not fixed
  - Open, dynamic but natural posture
  - NO exaggerated pose (no wide-open arms, no jumping for joy)
- Gaze: exploring the surroundings

ACTION in 6 seconds: The character transitions from motionless wonder
to their first exploratory steps in the dream world.

===============================================================================
ABSOLUTE RULES - REALISM
===============================================================================

FORBIDDEN:
- NO special effects, particles, halo, magical light
- NO theatrical or exaggerated pose
- NO forced smile or toothpaste-commercial grin
- NO unrealistic fantasy setting
- NO cartoon expression (wide-open mouth, bulging eyes)

REQUIRED:
- The dream location is a REAL place, even if stunning
- The joy is AUTHENTIC and SPONTANEOUS
- The movement is that of a real person taking a curious first step
- The character looks HAPPY in a natural and credible way
- Cinematic quality, warm but realistic lighting

Reply ONLY in valid JSON:
{{
    "start_keyframe": {{
        "description": "IDENTICAL to end_keyframe of scene 1A",
        "location": "Bright dream location, REALISTIC",
        "pose": "Head raised, body straightened, slight startled step back",
        "expression": "Natural wonder",
        "expression_intensity": "moderate",
        "gaze_direction": "up"
    }},
    "end_keyframe": {{
        "description": "Exploring the dream with authentic joy",
        "location": "Same dream location, slight displacement",
        "pose": "In motion, curious first step, orientation toward the left",
        "expression": "Sincere joy, curiosity, natural smile reaching the eyes",
        "expression_intensity": "moderate",
        "gaze_direction": "away_left"
    }},
    "action": "Character takes their first steps in the dream location, turning to explore with a sincere smile.",
    "shooting": {{
        "shot_type": "medium_full",
        "camera_angle": "eye_level",
        "camera_movement": "slow_pan_left",
        "lighting_direction": "side",
        "lighting_temperature": "warm",
        "depth_of_field": "medium",
        "focus_on": "full_body"
    }}
}}

{strict_suffix}
"""

PROMPT_SCENARIO_PUB = """{strict_prefix}

You are an advertising screenwriter specialized in REALISTIC emotional video spots.
Your style: Apple, Nike, Volvo -- genuine emotion, no special effects, no fantasy.

USER'S DREAM:
{dream_statement}

DAILY CONTEXT (the boredom to escape):
{daily_context}

MAIN CHARACTER: {character_name} ({character_gender}, approximately {age} years old)

EXTRACTED DREAM ELEMENTS:
{dream_elements_json}

NUMBER OF DREAM SCENES: {nb_dream_scenes}

ELEMENTS EXCLUDED BY USER (NEVER INCLUDE):
{reject_text}

===============================================================================
MANDATORY SCENARIO STRUCTURE
===============================================================================

The scenario contains EXACTLY {total_scenes} scenes distributed as follows:

SCENE 1A - TRANSITION_AWAKENING (daily life to dream transition):
- START: The character is in their BORING daily context.
  - Environment: {daily_context}
  - Posture: facing right, slightly slouched, closed posture
  - Expression: weariness, boredom, daily fatigue
  - Colors: DESATURATED, gray, dull, muted
  - Lighting: flat, no depth
- END: The daily environment is REPLACED by the dream environment.
  - SAME physical position of the character
  - Setting has changed COMPLETELY (no gradual transition)
  - Character stops, raises head
  - Expression: shifts from surprise to wonder then a big smile
  - Colors: VIVID, dream palette
  - Lighting: warm, golden, cinematic

SCENE 1B - TRANSITION_ACTION (first steps in the dream):
- START: EXACTLY the same image as END of 1A (shared keyframe)
  - Character in wonder in the dream environment
- END: The character begins exploring the dream world.
  - First steps, exploration gestures
  - Expression: joy, curiosity, enthusiasm
  - Orientation: facing left or 3/4 view

SCENES 2 to {last_scene_id} - DREAM SCENES:
- INDEPENDENT scenes from one another
- same_day = FALSE (outfit may vary between scenes)
- Type distribution:
  - ACTION: majority (>=60%)
  - INTERACTION: if relevant (with Character B)
  - IMMERSION: 1-2 max
  - INTROSPECTION: 0-1 max
  - ACCOMPLISHMENT: MANDATORY for the LAST scene only
- Last scene (scene {last_scene_id}):
  - type: ACCOMPLISHMENT
  - allows_camera_look: true
  - The character has ACHIEVED their dream

===============================================================================
PALETTE RULES
===============================================================================

TWO DISTINCT PALETTES:
- DAILY palette (scene 1A START): gray, dull beige, off-white, desaturated colors
- DREAM palette (scene 1A END + all following scenes): vivid, luminous, cinematic

The CONTRAST between the two palettes must be STRIKING.

===============================================================================
EMOTIONS
===============================================================================

- Scene 1A START: weariness, boredom, fatigue (ONLY scene with negative emotion)
- Scene 1A END: surprise -> wonder -> joy
- Scene 1B: joy, curiosity, enthusiasm
- Dream scenes: ALWAYS positive (joy, fulfillment, pride, happy serenity)

ALL emotions must be NATURAL and AUTHENTIC:
- Weariness = a genuine tired look like at the end of a workday, not a grimace
- Surprise = a genuine subtle "oh!", not a cartoon expression
- Joy = a genuine sincere smile (Duchenne), not a forced advertising smile
- NEVER exaggerated or theatrical expression

===============================================================================
ABSOLUTE REALISM
===============================================================================

- The daily location MUST be a REAL mundane place (office, transport, kitchen...)
- The dream location MUST be a REAL place (even if stunning), NOT a fantasy world
- NO special effects: the transition is a cinematic CUT, not morphing
- NO science-fiction or fantasy elements
- Style: Apple/Nike ad -- authentic emotion, careful framing, natural light

Reply in JSON:
{{
    "title": "Evocative spot title",
    "daily_context_description": "Precise visual description of daily context",
    "daily_palette": ["#XXXXXX", "#XXXXXX", "#XXXXXX", "#XXXXXX"],
    "dream_palette": ["#XXXXXX", "#XXXXXX", "#XXXXXX", "#XXXXXX"],
    "character_b": {{
        "present": true|false,
        "role": "role",
        "appearance": "description (silhouette, clothing)",
        "scenes": [list of scene_ids where B appears]
    }},
    "scenes": [
        {{
            "id": "1A",
            "type": "TRANSITION_AWAKENING",
            "concept": "From [daily] to [dream]",
            "daily_environment": "Precise description of boring daily location",
            "dream_environment": "Precise description of dream location",
            "emotional_arc": "weariness -> surprise -> wonder -> joy",
            "time_of_day": "morning",
            "indoor": true,
            "is_pov": false,
            "allows_camera_look": false
        }},
        {{
            "id": "1B",
            "type": "TRANSITION_ACTION",
            "concept": "First steps in the dream",
            "context": "Exploring the dream world",
            "emotional_beat": "joy, curiosity",
            "time_of_day": "morning",
            "indoor": false,
            "is_pov": false,
            "allows_camera_look": false
        }},
        {{
            "id": 2,
            "type": "ACTION|INTERACTION|IMMERSION|INTROSPECTION|ACCOMPLISHMENT",
            "phase": "PHASE_NAME",
            "concept": "Short description",
            "context": "Detailed context",
            "dream_element_illustrated": "which dream element",
            "emotional_beat": "positive emotion",
            "time_of_day": "morning|afternoon|golden_hour|dusk|night",
            "indoor": true|false,
            "is_pov": false,
            "has_character_b": true|false,
            "allows_camera_look": false
        }}
    ],
    "elements_coverage": {{
        "explicit_elements_used": ["list"],
        "coverage_ratio": 0.75
    }}
}}

IMPORTANT:
- Scene 1A is the ONLY scene with negative emotions (boredom, weariness)
- The daily/dream contrast must be MAXIMAL
- Dream scenes = same_day FALSE
- Last scene = ACCOMPLISHMENT + allows_camera_look: true

{strict_suffix}
"""


PROMPT_VIDEO_POV = """Smooth {duration}-second cinematic POV video transitioning from the first image to the last image.

SUBTLE MOVEMENT: {action}

Point of view shot - no person visible.

RULES:
1. The video MUST start exactly like the first image and end exactly like the last image
2. Subtle, natural movement only
3. Objects may move slightly (wind, light shift)
4. NO sudden changes
5. Contemplative mood
"""
