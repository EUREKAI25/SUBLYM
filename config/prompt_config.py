# config/prompt_config.py
"""
SUBLYM - Configuration des prompts pour génération de scénarios et images.

Structure orientée objet / prête pour EURKAI (GEV/ERK):
├── Config (paramètres globaux, pilotables depuis back-office)
├── Location (ville, setting, saison, météo)
├── Scene (type, properties, requirements)
│   ├── Scene:Intro
│   ├── Scene:Iconic
│   ├── Scene:Introspective
│   ├── Scene:Action
│   └── Scene:Outro
├── Scenario (collection de scenes, règles globales)
├── Character (A et B, règles de visibilité)
└── Prompt (builders pour scenario, keyframe, video)
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from enum import Enum
import random


# =============================================================================
# CONFIG - Paramètres globaux (futurs candidats BDD/back-office)
# =============================================================================

class Config:
    """
    Paramètres configurables depuis back-office.
    En GEV: Config:Parameter:*
    """
    
    # Video
    DURATION_PER_SCENE: int = 6  # MiniMax constraint
    TOTAL_SCENES: int = 5
    
    # Scoring
    IMAGE_MIN_SCORE: float = 8.0
    IMAGE_MAX_ATTEMPTS: int = 2
    IMAGE_VARIANTS_COUNT: int = 1
    
    # Probabilities
    OUTRO_INTERACTION_PROBABILITY: float = 0.7  # 70% interaction, 30% "manque"
    CUT_POSITIONS: List[int] = [2, 3, 4]  # Positions possibles pour le cut
    
    # App
    APP_PURPOSE: str = "Generate a cinematic video representing the user's dream fulfilled"
    VIDEO_STYLE: str = "cinematic, emotionally credible, visually coherent"


# =============================================================================
# ENUMS - Types standardisés
# =============================================================================

class SceneType(Enum):
    INTRO = "intro"
    ICONIC = "iconic"
    INTROSPECTIVE = "introspective"
    ACTION = "action"
    OUTRO = "outro"


class EnergyLevel(Enum):
    CALM = "calm"
    ANTICIPATION = "anticipation"
    CONTEMPLATIVE = "contemplative"
    MODERATE = "moderate"
    WONDER = "wonder"
    DYNAMIC = "dynamic"
    ENERGETIC = "energetic"
    JOYFUL = "joyful"
    COMPLICIT = "complicit"


class TransitionType(Enum):
    CHAIN = "chain"  # END[n] = START[n+1]
    CUT = "cut"      # Fondu noir, nouveau START indépendant


class TimeOfDay(Enum):
    MORNING = "morning"
    MIDDAY = "midday"
    AFTERNOON = "afternoon"
    GOLDEN_HOUR = "golden_hour"
    NIGHT = "night"


class Setting(Enum):
    INTERIOR = "interior"
    EXTERIOR = "exterior"


class Season(Enum):
    SPRING = "spring"
    SUMMER = "summer"
    AUTUMN = "autumn"
    WINTER = "winter"


# =============================================================================
# LOCATION - Où se passe la scène
# =============================================================================

@dataclass
class Location:
    """
    En GEV: Object:Location:*
    Location.city, Location.setting, Location.place, etc.
    """
    city: str = ""
    setting: Setting = Setting.EXTERIOR
    specific_place: str = ""
    season: Season = Season.SUMMER
    weather: str = "sunny"
    
    # Catalogues
    INTERIOR_PLACES: List[str] = field(default_factory=lambda: [
        "apartment", "hotel room", "restaurant", "museum", "theater",
        "airport terminal", "train station", "shopping mall", "office",
        "concert hall", "gym", "spa", "bar", "café", "church",
    ])
    
    EXTERIOR_PLACES: List[str] = field(default_factory=lambda: [
        "street", "park", "beach", "mountain", "forest", "desert",
        "rooftop", "terrace", "garden", "plaza", "waterfront", "bridge",
        "stadium", "market", "pier", "viewpoint", "countryside",
    ])
    
    SEASON_VISUALS: Dict[str, Dict] = field(default_factory=lambda: {
        "spring": {"cues": "flowers blooming, mild weather, light jacket", "colors": "pastel greens, pinks"},
        "summer": {"cues": "bright sun, light clothes, sunglasses", "colors": "vibrant, saturated, warm"},
        "autumn": {"cues": "falling leaves, warm tones, cozy layers", "colors": "orange, brown, gold"},
        "winter": {"cues": "snow possible, warm coat, breath visible", "colors": "white, grey, blue"},
    })
    
    def to_prompt(self) -> str:
        season_info = self.SEASON_VISUALS.get(self.season.value, {})
        return (
            f"Location: {self.specific_place} in {self.city}\n"
            f"Setting: {self.setting.value}\n"
            f"Season: {self.season.value} ({season_info.get('cues', '')})\n"
            f"Weather: {self.weather}\n"
            f"Color palette hint: {season_info.get('colors', '')}"
        )


# =============================================================================
# CHARACTER - Personnages et règles de visibilité
# =============================================================================

@dataclass
class Character:
    """
    En GEV: Object:Character:A, Object:Character:B
    """
    
    # CharacterA rules
    A_RULES: Dict = field(default_factory=lambda: {
        "always_visible": True,
        "is_focus": True,
        "camera_look_allowed": "only_in_outro_end",
    })
    
    # CharacterB rules
    B_RULES: Dict = field(default_factory=lambda: {
        "first_appearance": "scene_2_or_later",
        "face_visibility": "never_fully_visible",
        "allowed_views": [
            "from behind (back to camera)",
            "in profile (side view, partial face)",
            "partially out of frame (cropped)",
            "silhouette or blurred in background",
            "over-the-shoulder shot",
        ],
    })
    
    @classmethod
    def get_B_visibility_rule(cls) -> str:
        rules = cls().B_RULES
        views = ", ".join(rules["allowed_views"])
        return (
            f"CharacterB's face must {rules['face_visibility']}.\n"
            f"Allowed views: {views}\n"
            f"First appearance: {rules['first_appearance']}"
        )


# =============================================================================
# SCENE - Types de scènes et leurs propriétés
# =============================================================================

@dataclass
class SceneProperties:
    """Propriétés communes à toutes les scènes."""
    energy: EnergyLevel = EnergyLevel.MODERATE
    transition_to_next: TransitionType = TransitionType.CHAIN
    time_of_day: TimeOfDay = TimeOfDay.AFTERNOON
    location: Location = field(default_factory=Location)
    
    # Requirements
    min_expressions: int = 1
    min_movements: int = 1
    min_actions: int = 1
    gaze_rule: str = "never_frozen"


class Scene:
    """
    Base class pour les scènes.
    En GEV: Object:Scene:Type (Scene:Intro, Scene:Iconic, etc.)
    """
    
    # Palettes (catalogues partagés)
    EXPRESSION_PALETTE: List[str] = [
        "curious glance", "soft smile forming", "eyes widening with wonder",
        "peaceful closed eyes moment", "deep breath visible", "subtle laugh",
        "amazed open mouth", "contented sigh", "playful smirk",
        "emotional tear", "grateful nod", "surprised eyebrow raise",
        "dreamy distant gaze", "warm genuine smile", "complicit wink", "blown kiss",
    ]
    
    MOVEMENT_PALETTE: List[str] = [
        "turns head slowly", "takes a step forward", "touches something",
        "adjusts hair or scarf", "spins around playfully", "leans against something",
        "reaches out hand", "sits down gracefully", "stands up with energy",
        "walks into frame", "looks over shoulder", "tilts head",
        "shrugs shoulders lightly", "clasps hands together", "points at something",
        "waves gently", "hugs self", "stretches arms wide",
    ]
    
    ENERGY_DETAILS: Dict[str, Dict] = {
        "calm": {"speed": "slow, deliberate", "camera": "static or very slow pan"},
        "anticipation": {"speed": "moderate, slightly eager", "camera": "slow push in"},
        "contemplative": {"speed": "minimal, subtle", "camera": "static with gentle drift"},
        "moderate": {"speed": "natural walking pace", "camera": "tracking or follow"},
        "wonder": {"speed": "slow with pauses", "camera": "reveal shot, slow pan"},
        "dynamic": {"speed": "active, purposeful", "camera": "tracking, handheld feel"},
        "energetic": {"speed": "fast, fluid", "camera": "dynamic tracking"},
        "joyful": {"speed": "light, bouncy", "camera": "follows energy"},
        "complicit": {"speed": "gentle, intimate", "camera": "close-up, steady"},
    }
    
    def __init__(self, scene_type: SceneType, position: int):
        self.scene_type = scene_type
        self.position = position
        self.properties = SceneProperties()
    
    def get_random_expressions(self, n: int = 2) -> List[str]:
        return random.sample(self.EXPRESSION_PALETTE, min(n, len(self.EXPRESSION_PALETTE)))
    
    def get_random_movements(self, n: int = 2) -> List[str]:
        return random.sample(self.MOVEMENT_PALETTE, min(n, len(self.MOVEMENT_PALETTE)))


class SceneIntro(Scene):
    """
    Scene:Intro - Arrivée, préparatifs, anticipation.
    En GEV: Scene:Intro IN Scenario.scenes
    """
    
    TYPE_CONFIG: Dict = {
        "position": 1,  # Toujours première
        "description": "Arrival, preparation, anticipation before the dream unfolds",
        "can_contain_micro_moments": True,
        "characterB_allowed": False,
        "camera_look_allowed": False,
        "energy_range": [EnergyLevel.CALM, EnergyLevel.ANTICIPATION],
        "transition_to_next": TransitionType.CHAIN,
    }
    
    EXAMPLES: List[str] = [
        "Checking passport at airport, boarding plane, looking through window",
        "Packing suitcase with excitement, taxi ride, arriving at destination",
        "Waking up early, getting ready, stepping outside into new city",
    ]
    
    def __init__(self):
        super().__init__(SceneType.INTRO, position=1)
        self.properties.energy = random.choice(self.TYPE_CONFIG["energy_range"])
        self.properties.min_actions = 1
        self.properties.transition_to_next = TransitionType.CHAIN


class SceneIconic(Scene):
    """
    Scene:Iconic - Le moment évident qui définit ce rêve.
    En GEV: Scene:Iconic IN Scenario.scenes
    """
    
    TYPE_CONFIG: Dict = {
        "position": "random_middle",
        "description": "The obvious, emblematic moment when evoking this dream",
        "can_contain_micro_moments": False,
        "characterB_allowed": True,
        "camera_look_allowed": False,
        "energy_range": [EnergyLevel.MODERATE, EnergyLevel.WONDER, EnergyLevel.DYNAMIC, EnergyLevel.ENERGETIC],
    }
    
    EXAMPLES: List[str] = [
        "Brazil → dancing at carnival surrounded by feathers and colors",
        "TED talk → receiving standing ovation from audience",
        "Safari → lion walking majestically right past the jeep",
        "New York Christmas → ice skating at Rockefeller Center",
        "Japan → cherry blossoms falling while walking in Kyoto",
        "Wedding → first dance, spinning together",
    ]
    
    def __init__(self, position: int):
        super().__init__(SceneType.ICONIC, position=position)
        self.properties.energy = random.choice(self.TYPE_CONFIG["energy_range"])


class SceneIntrospective(Scene):
    """
    Scene:Introspective - Émotion pure, contemplation.
    En GEV: Scene:Introspective IN Scenario.scenes
    """
    
    TYPE_CONFIG: Dict = {
        "position": "random_middle",
        "description": "Pure emotion - character remembers, imagines, savors the moment",
        "can_contain_micro_moments": False,
        "characterB_allowed": True,
        "camera_look_allowed": False,
        "energy_range": [EnergyLevel.CALM, EnergyLevel.CONTEMPLATIVE],
        "exception_no_action": True,  # Seul type sans action obligatoire
    }
    
    EXAMPLES: List[str] = [
        "Sitting quietly on a bench, lost in thought, slight smile",
        "Standing at viewpoint, deep breath, eyes closing briefly",
        "Holding a warm drink, gazing at scenery, peaceful expression",
    ]
    
    def __init__(self, position: int):
        super().__init__(SceneType.INTROSPECTIVE, position=position)
        self.properties.energy = random.choice(self.TYPE_CONFIG["energy_range"])
        self.properties.min_actions = 0  # Exception
        self.properties.transition_to_next = TransitionType.CUT  # Souvent suivi d'un cut


class SceneAction(Scene):
    """
    Scene:Action - L'activité principale du rêve.
    En GEV: Scene:Action IN Scenario.scenes
    """
    
    TYPE_CONFIG: Dict = {
        "position": "random_middle",
        "description": "Main activity - what the character DOES to live the dream",
        "can_contain_micro_moments": False,
        "characterB_allowed": True,
        "camera_look_allowed": False,
        "energy_range": [EnergyLevel.DYNAMIC, EnergyLevel.ENERGETIC, EnergyLevel.JOYFUL],
    }
    
    EXAMPLES: List[str] = [
        "Swimming in crystal clear Maldives water",
        "Dog sledding through Alaskan snow",
        "Dancing at Rio carnival",
        "Surfing a wave in Hawaii",
        "Skiing down a mountain slope",
    ]
    
    def __init__(self, position: int):
        super().__init__(SceneType.ACTION, position=position)
        self.properties.energy = random.choice(self.TYPE_CONFIG["energy_range"])


class SceneOutro(Scene):
    """
    Scene:Outro - Moment de clôture, complicité possible.
    En GEV: Scene:Outro IN Scenario.scenes
    """
    
    TYPE_CONFIG: Dict = {
        "position": 5,  # Toujours dernière
        "description": "Closing moment - connection with viewer (or not)",
        "can_contain_micro_moments": False,
        "characterB_allowed": True,
        "camera_look_allowed": True,  # SEUL moment autorisé
        "comes_after_cut": True,
        "often_night": True,
        "energy_range": [EnergyLevel.CALM, EnergyLevel.COMPLICIT],
    }
    
    INTERACTIONS_YES: List[str] = ["wink", "blown kiss", "wave", "complicit smile", "nod"]
    INTERACTIONS_NO: List[str] = ["just a look", "suspended moment", "turning away slowly"]
    
    def __init__(self):
        super().__init__(SceneType.OUTRO, position=5)
        self.properties.energy = random.choice(self.TYPE_CONFIG["energy_range"])
        self.properties.min_actions = 0
        self.properties.gaze_rule = "never_frozen"
    
    def get_interaction(self) -> str:
        """Retourne une interaction aléatoire (ou pas)."""
        if random.random() < Config.OUTRO_INTERACTION_PROBABILITY:
            return random.choice(self.INTERACTIONS_YES)
        return random.choice(self.INTERACTIONS_NO)


# =============================================================================
# SCENARIO - Collection de scènes avec règles globales
# =============================================================================

class Scenario:
    """
    En GEV: Object:Scenario
    Scenario.scenes = [Scene:Intro, Scene:*, Scene:*, Scene:*, Scene:Outro]
    """
    
    def __init__(self, dream_text: str, location: Location = None):
        self.dream_text = dream_text
        self.location = location or Location()
        self.scenes: List[Scene] = []
        self.cut_position: int = 0
        
        self._build_scene_structure()
    
    def _build_scene_structure(self):
        """Construit la structure des 5 scènes avec ordre aléatoire."""
        
        # Position 1 = INTRO (fixe)
        self.scenes.append(SceneIntro())
        
        # Positions 2, 3, 4 = ICONIC, INTROSPECTIVE, ACTION (ordre random)
        middle_types = [SceneIconic, SceneIntrospective, SceneAction]
        random.shuffle(middle_types)
        
        for i, scene_class in enumerate(middle_types):
            self.scenes.append(scene_class(position=i + 2))
        
        # Position 5 = OUTRO (fixe)
        self.scenes.append(SceneOutro())
        
        # Position du CUT (random parmi 2, 3, 4)
        self.cut_position = random.choice(Config.CUT_POSITIONS)
        
        # Appliquer le cut
        for scene in self.scenes:
            if scene.position == self.cut_position:
                scene.properties.transition_to_next = TransitionType.CUT
        
        # OUTRO toujours après un cut
        self.scenes[3].properties.transition_to_next = TransitionType.CUT
    
    def get_scene_order_description(self) -> str:
        """Retourne la description de l'ordre des scènes."""
        lines = []
        for scene in self.scenes:
            transition = scene.properties.transition_to_next.value if scene.properties.transition_to_next else "end"
            lines.append(f"Scene {scene.position}: {scene.scene_type.value.upper()} → {transition}")
        return "\n".join(lines)
    
    def to_dict(self) -> Dict:
        """Export pour JSON/API."""
        return {
            "dream_text": self.dream_text,
            "location": {
                "city": self.location.city,
                "setting": self.location.setting.value,
                "specific_place": self.location.specific_place,
                "season": self.location.season.value,
            },
            "cut_position": self.cut_position,
            "scenes": [
                {
                    "position": s.position,
                    "type": s.scene_type.value,
                    "energy": s.properties.energy.value,
                    "transition": s.properties.transition_to_next.value if s.properties.transition_to_next else None,
                }
                for s in self.scenes
            ],
        }


# =============================================================================
# PROMPT - Builders pour les différents prompts
# =============================================================================

class Prompt:
    """
    En GEV: Object:Prompt:Scenario, Object:Prompt:Keyframe, Object:Prompt:Video
    """
    
    @staticmethod
    def build_scenario(scenario: Scenario) -> str:
        """Génère le prompt pour créer le scénario complet."""
        
        scene_structure = scenario.get_scene_order_description()
        
        # Collecter les exemples pour chaque type de scène
        scene_examples = ""
        for scene in scenario.scenes:
            examples = getattr(scene, 'EXAMPLES', [])
            if examples:
                scene_examples += f"\n{scene.scene_type.value.upper()} examples: {', '.join(examples[:3])}"
        
        return f"""
# SUBLYM SCENARIO GENERATION

## CONTEXT
{Config.APP_PURPOSE}
Creating a {Config.TOTAL_SCENES}-scene video ({Config.DURATION_PER_SCENE}s each = {Config.TOTAL_SCENES * Config.DURATION_PER_SCENE}s total)

## THE DREAM
"{scenario.dream_text}"

## LOCATION
{scenario.location.to_prompt()}

## SCENE STRUCTURE (MANDATORY - THIS EXACT ORDER)
{scene_structure}

## SCENE TYPE EXAMPLES
{scene_examples}

## REQUIREMENTS FOR EVERY SCENE

1. EXPRESSIONS: At least 1 per scene (be creative, don't repeat)
   Examples: {', '.join(random.sample(Scene.EXPRESSION_PALETTE, 5))}

2. MOVEMENTS: At least 1 per scene (vary them)
   Examples: {', '.join(random.sample(Scene.MOVEMENT_PALETTE, 5))}

3. ACTIONS: Something must HAPPEN (except INTROSPECTIVE)

4. GAZE: NEVER frozen - eyes must move naturally

5. INTROSPECTIVE exception: can be purely contemplative

## TRANSITION RULES

CHAIN: END of Scene N = START of Scene N+1 (identical position/pose)
CUT: 0.5s fade to black, new independent START (used at position {scenario.cut_position} and before OUTRO)

## CHARACTER RULES

CharacterA: Always visible, focus of every scene
{Character.get_B_visibility_rule()}

## CLOTHING
Must match season ({scenario.location.season.value}) and remain consistent across ALL scenes.

## OUTPUT FORMAT (JSON)

```json
{{
  "scenario_name": "Title",
  "global_parameters": {{
    "color_palette": "...",
    "lighting_style": "...",
    "outfit_description": "..."
  }},
  "scenes": [
    {{
      "scene_number": 1,
      "scene_type": "INTRO/ICONIC/INTROSPECTIVE/ACTION/OUTRO",
      "name": "Scene name",
      "energy": "calm/dynamic/etc",
      "transition_to_next": "chain/cut",
      "time_of_day": "morning/afternoon/night",
      "startkeyframe_description": "Precise START image description",
      "endkeyframe_description": "Precise END image description",
      "video_action_description": "What HAPPENS during 6s (MOTION, not poses)"
    }}
  ]
}}
```

CRITICAL: video_action_description must describe MOTION.
Example: "CharacterA walks forward, pauses at window, turns with a smile"

Generate the complete scenario now.
"""
    
    @staticmethod
    def build_keyframe(
        scene_data: Dict,
        is_start: bool,
        is_first_scene: bool,
        is_last_scene: bool,
        previous_end_description: str = None
    ) -> str:
        """Génère le prompt pour une image keyframe."""
        
        kf_type = "START" if is_start else "END"
        description = scene_data.get(
            "startkeyframe_description" if is_start else "endkeyframe_description", 
            ""
        )
        
        # Chaînage
        chain_rule = ""
        if is_start and not is_first_scene and scene_data.get("transition_to_next") != "cut":
            chain_rule = f"""
## CONTINUITY (CRITICAL)
This START must be IDENTICAL to previous END:
"{previous_end_description}"
Same position, pose, expression, framing.
"""
        
        # Regard caméra
        camera_rule = ""
        if is_last_scene and not is_start:
            camera_rule = """
## CAMERA LOOK (ALLOWED - FINAL MOMENT)
CharacterA MAY look at camera with complicit expression.
Options: warm smile, gentle wink, knowing look
But NEVER frozen - always subtle movement.
"""
        else:
            camera_rule = """
## CAMERA LOOK (FORBIDDEN)
CharacterA must NOT look at camera.
"""
        
        return f"""
# KEYFRAME GENERATION - {kf_type}

## SCENE
Name: {scene_data.get('name', '')}
Type: {scene_data.get('scene_type', '')}
Energy: {scene_data.get('energy', '')}

## DESCRIPTION
{description}

{chain_rule}
{camera_rule}

## REQUIREMENTS
- Image must suggest MOTION (hair moving, weight shifting)
- Never a frozen static pose
- Photorealistic, cinematic lighting

Generate detailed image prompt.
"""
    
    @staticmethod
    def build_video(scene_data: Dict) -> str:
        """Génère le prompt pour la vidéo MiniMax."""
        
        action = scene_data.get("video_action_description", "")
        energy = scene_data.get("energy", "moderate")
        energy_info = Scene.ENERGY_DETAILS.get(energy, Scene.ENERGY_DETAILS["moderate"])
        
        return f"""
{action}

Movement: {energy_info['speed']}
Camera: {energy_info['camera']}
Style: Cinematic, photorealistic, smooth motion
Gaze: Natural eye movement, never frozen
Duration: 6 seconds continuous
"""


# =============================================================================
# FACTORY - Création simplifiée
# =============================================================================

class ScenarioFactory:
    """
    Factory pour créer des scénarios.
    En GEV: Method:Create IN Scenario.methodList
    """
    
    @staticmethod
    def create(dream_text: str, city: str = "", season: str = "summer") -> Scenario:
        """Crée un nouveau scénario avec structure aléatoire."""
        
        location = Location(
            city=city,
            season=Season(season) if season in [s.value for s in Season] else Season.SUMMER,
        )
        
        return Scenario(dream_text=dream_text, location=location)
    
    @staticmethod
    def get_scenario_prompt(dream_text: str, city: str = "", season: str = "summer") -> str:
        """Shortcut pour obtenir directement le prompt."""
        scenario = ScenarioFactory.create(dream_text, city, season)
        return Prompt.build_scenario(scenario)


# =============================================================================
# LEGACY COMPATIBILITY
# =============================================================================

# Pour ne pas casser l'existant pendant la transition
context = Config.APP_PURPOSE
global_scenario_context = f"{context}\nCreating a cinematic video."
global_scenario_role = "You are a screenwriter expert in short visual storytelling."
global_scenario_mission = "Design a structured scenario with varied scenes."
characterB_visibility_rule = Character.get_B_visibility_rule()
scene1_solo_rule = "Scene 1 must show CharacterA ALONE."
video_duration_rule = f"Each scene = {Config.DURATION_PER_SCENE}s."

# Legacy variables pour keyframes_generate.py
keyframe_generate_context = (
    "We are generating a detailed image prompt for a keyframe in a dream visualization video. "
    "The image must be photorealistic, cinematic, and emotionally compelling."
)

keyframe_generate_role = (
    "You are an expert prompt engineer specialized in AI image generation. "
    "You create detailed, precise prompts that produce stunning photorealistic images."
)

keyframe_generate_mission = (
    "Generate a detailed FLUX/Gemini image prompt that will create the exact keyframe described. "
    "Include all visual details: pose, expression, lighting, composition, atmosphere."
)

keyframe_generate_goal = (
    "Produce a prompt that generates a photorealistic image matching the keyframe description exactly, "
    "maintaining character consistency and emotional authenticity."
)

keyframe_generate_rule = (
    "- Output ONLY the image prompt, no explanations\n"
    "- The reference photos define EVERYTHING about the character (face, body, outfit, style)\n"
    "- Your prompt must ONLY describe what CHANGES from the reference, nothing else\n"
    "## WHAT TO CHANGE (pick from this list):\n"
    "- POSE: standing, sitting, walking, leaning, turning, spinning, crouching, reaching, pointing\n"
    "- GESTURE: hands in pockets, arms crossed, hand on hip, touching hair, waving, clapping\n"
    "- EXPRESSION: smiling, laughing, surprised, contemplative, peaceful, excited, curious, moved\n"
    "- GAZE DIRECTION: looking up, looking left/right, looking at something specific, eyes closed\n"
    "- HEAD POSITION: tilted, turned slightly, looking over shoulder\n"
    "- BODY ORIENTATION: facing camera, 3/4 view, profile, back to camera\n"
    "- ACTION: stepping forward, catching snowflakes, taking a photo, hailing a cab, skating\n"
    "- LOCATION/DECOR: describe the specific place and its visual elements\n"
    "- LIGHTING: golden hour, night with city lights, snowy atmosphere, morning light\n"
    "- CAMERA ANGLE: wide shot, medium shot, close-up, low angle, high angle\n"
    "## RULES:\n"
    "- DO NOT describe outfit, hair, face features, body type - these come from photos\n"
    "- DO NOT put the same person twice in the image\n"
    "- Focus on ACTION and EMOTION, not static poses\n"
    "- The image should suggest MOTION (hair moving, weight shifting, gesture in progress)\n"
)

keyframe_generate_forbidden = (
    "Do not include: physical descriptions of face/body, brand names, celebrities, "
    "text in image, watermarks, unrealistic elements, multiple people unless specified, "
    "anything from the reject list."
)

keyframe_generate_deliverables = (
    "A single detailed image generation prompt (100-200 words) that will produce "
    "the exact keyframe described."
)

keyframe_generate_output_format = (
    "Output format: Plain text prompt, no markdown, no explanations, just the prompt itself."
)

keyframe_generate_relevant_example = '''
A woman in her 30s wearing a warm burgundy coat stands in Times Square at golden hour, 
soft winter light illuminating her face. She gazes upward with wonder, a gentle smile 
forming on her lips. Light snow falls around her. Her scarf flutters slightly in the breeze. 
The neon lights of Broadway create colorful bokeh in the background. Medium shot, 
eye-level angle. Cinematic lighting, photorealistic, 8K quality.
'''

keyframe_generate_irrelevant_example = '''
Beautiful woman smiling in New York.
'''

# Legacy variables pour get_user_params.py
user_param_context = (
    "We are analyzing a user's dream description to extract key parameters "
    "that will guide the visual generation of their dream."
)

user_param_role = (
    "You are an expert at understanding dreams and extracting visual, emotional, "
    "and contextual elements from natural language descriptions."
)

user_param_mission = (
    "Extract all relevant parameters from the dream description: location, season, "
    "time of day, mood, activities, other people involved, and any specific wishes."
)

user_param_goal = (
    "Produce a structured JSON with all parameters needed to generate a compelling "
    "visual representation of the user's dream."
)

user_param_rule = (
    "- Extract explicit AND implicit information\n"
    "- Infer season/weather from context if not stated\n"
    "- Identify if another person (characterB) is needed\n"
    "- Note any specific locations, landmarks, or activities mentioned"
)

rules = user_param_rule  # Alias

user_param_forbidden = (
    "Do not invent details not implied by the dream. "
    "Do not assume romantic context unless clearly stated."
)

user_param_deliverables = "A JSON object with extracted parameters."

user_param_output_format = '''
{
    "location": "city or place",
    "country": "country name",
    "season": "winter/spring/summer/autumn",
    "time_of_day": "morning/afternoon/evening/night",
    "weather": "sunny/snowy/rainy/cloudy",
    "mood": "romantic/adventurous/peaceful/exciting",
    "activities": ["activity1", "activity2"],
    "requires_other_person": true/false,
    "specific_wishes": ["wish1", "wish2"],
    "landmarks": ["landmark1", "landmark2"]
}
'''

user_param_relevant_example = '''
Dream: "Je rêve de voir New York sous la neige à Noël"
Output: {
    "location": "New York",
    "country": "USA", 
    "season": "winter",
    "time_of_day": "any",
    "weather": "snowy",
    "mood": "magical, festive",
    "activities": ["walking", "sightseeing"],
    "requires_other_person": false,
    "specific_wishes": ["see snow", "Christmas atmosphere"],
    "landmarks": ["Times Square", "Central Park", "Rockefeller Center"]
}
'''

user_param_irrelevant_example = '''
Dream: "Je rêve de voir New York"
Output: {"location": "New York"}
(Too minimal - missing inferred details)
'''
