"""
Sublym v4 - Scenario Generator
Génère scénario global et descriptions des scènes
"""

import json
import re
import urllib.request
from typing import Dict, List, Any, Optional

from .env_loader import get_api_key
from config.settings import DEFAULT_MODELS
from prompts.templates import (
    PROMPT_SCENARIO_GLOBAL, PROMPT_FREE_SCENES,
    PROMPT_SCENARIO_VIDEO, PROMPT_SCENARIO_VIDEO_POV,
    PROMPT_SCENARIO_PUB, PROMPT_SCENARIO_PUB_VIDEO_1A, PROMPT_SCENARIO_PUB_VIDEO_1B
)


class ScenarioGenerator:
    """Génère les scénarios via LLM."""

    def __init__(self, config: Dict, dry_run: bool = False, verbose: bool = False):
        self.config = config
        self.dry_run = dry_run
        self.verbose = verbose
        self.model = config.get("models", {}).get("scenario", DEFAULT_MODELS["scenario"])
        self.strict_prefix = config.get("prompt_strict_prefix", "")
        self.strict_suffix = config.get("prompt_strict_suffix", "")
        
        self.costs_real = {"tokens_input": 0, "tokens_output": 0, "calls": 0}
    
    def generate_global_scenario(
        self,
        dream_statement: str,
        character_name: str,
        character_gender: str,
        age: int,
        nb_scenes: int,
        nb_pov_scenes: int,
        dream_elements_json: str = "{}",
        reject: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Génère le scénario global structuré."""

        print("\n" + "=" * 60)
        print("ÉTAPE 3: SCÉNARIO GLOBAL")
        print("=" * 60)

        reject_text = "\n".join(f"- {r}" for r in reject) if reject else "Aucun"

        prompt = PROMPT_SCENARIO_GLOBAL.format(
            strict_prefix=self.strict_prefix,
            dream_statement=dream_statement,
            character_name=character_name,
            character_gender=character_gender,
            age=age,
            nb_scenes=nb_scenes,
            nb_pov_scenes=nb_pov_scenes,
            dream_elements_json=dream_elements_json,
            reject_text=reject_text,
            strict_suffix=self.strict_suffix
        )
        
        if self.verbose:
            print(f"\n--- PROMPT SCENARIO_GLOBAL ---\n{prompt}\n---")
        
        if self.dry_run:
            print("  [DRY RUN] Scénario simulé")
            return self._mock_global(character_name, nb_scenes, nb_pov_scenes)
        
        response = self._call_openai(prompt)
        scenario = self._parse_json(response)
        
        print(f"  ✓ Titre: {scenario.get('title', 'N/A')}")
        print(f"  ✓ {len(scenario.get('scenes', []))} scènes")
        print(f"  ✓ Same day: {scenario.get('same_day', True)}")
        
        return scenario
    
    def generate_free_scenes(
        self,
        dream_statement: str,
        character_name: str,
        character_gender: str,
        age: int,
        nb_scenes: int,
        nb_pov_scenes: int,
        dream_elements_json: str = "{}",
        imposed_scenes: Optional[List[Dict]] = None,
        reject: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Génère des scènes libres (mode free_scenes)."""

        print("\n" + "=" * 60)
        print("ÉTAPE 3: SCÈNES LIBRES")
        print("=" * 60)

        imposed_str = "Aucune"
        if imposed_scenes:
            lines = []
            for i, s in enumerate(imposed_scenes):
                if s:
                    lines.append(f"Scène {i+1}: " + ", ".join(f"{k}={v}" for k, v in s.items()))
            imposed_str = "\n".join(lines) if lines else "Aucune"

        reject_text = "\n".join(f"- {r}" for r in reject) if reject else "Aucun"

        prompt = PROMPT_FREE_SCENES.format(
            strict_prefix=self.strict_prefix,
            dream_statement=dream_statement,
            character_name=character_name,
            character_gender=character_gender,
            age=age,
            nb_scenes=nb_scenes,
            nb_pov_scenes=nb_pov_scenes,
            dream_elements_json=dream_elements_json,
            shot_types=", ".join(self.config.get("shot_types", [])),
            imposed_scenes=imposed_str,
            reject_text=reject_text,
            strict_suffix=self.strict_suffix
        )
        
        if self.verbose:
            print(f"\n--- PROMPT FREE_SCENES ---\n{prompt}\n---")
        
        if self.dry_run:
            print("  [DRY RUN] Scènes simulées")
            return {"scenes": self._mock_global("", nb_scenes, nb_pov_scenes)["scenes"]}
        
        response = self._call_openai(prompt)
        return self._parse_json(response)

    def generate_pub_scenario(
        self,
        dream_statement: str,
        daily_context: str,
        character_name: str,
        character_gender: str,
        age: int,
        nb_dream_scenes: int,
        dream_elements_json: str = "{}",
        reject: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Génère le scénario pub (transition quotidien → rêve + scènes de rêve)."""

        print("\n" + "=" * 60)
        print("ÉTAPE 3: SCÉNARIO PUB")
        print("=" * 60)

        reject_text = "\n".join(f"- {r}" for r in reject) if reject else "Aucun"
        total_scenes = nb_dream_scenes + 2  # 1A + 1B + dream scenes
        last_scene_id = nb_dream_scenes + 1  # Numérotation: 1A, 1B, 2, 3, ..., N+1

        prompt = PROMPT_SCENARIO_PUB.format(
            strict_prefix=self.strict_prefix,
            dream_statement=dream_statement,
            daily_context=daily_context,
            character_name=character_name,
            character_gender=character_gender,
            age=age,
            nb_dream_scenes=nb_dream_scenes,
            total_scenes=total_scenes,
            last_scene_id=last_scene_id,
            dream_elements_json=dream_elements_json,
            reject_text=reject_text,
            strict_suffix=self.strict_suffix
        )

        if self.verbose:
            print(f"\n--- PROMPT SCENARIO_PUB ---\n{prompt}\n---")

        if self.dry_run:
            print("  [DRY RUN] Scénario pub simulé")
            return self._mock_pub_scenario(character_name, nb_dream_scenes)

        response = self._call_openai(prompt)
        scenario = self._parse_json(response)

        print(f"  ✓ Titre: {scenario.get('title', 'N/A')}")
        print(f"  ✓ {len(scenario.get('scenes', []))} scènes (dont 1A + 1B)")
        print(f"  ✓ Quotidien: {scenario.get('daily_context_description', '')[:50]}...")

        return scenario

    def generate_pub_video_scenarios(
        self,
        pub_scenario: Dict,
        character_name: str,
        character_gender: str,
        age: int,
        character_features: str,
        scene_palettes: Dict[Any, List[str]]
    ) -> List[Dict[str, Any]]:
        """Génère les descriptions vidéo pour le mode pub (1A, 1B, puis scènes standard)."""

        print("\n" + "=" * 60)
        print("ÉTAPE 4: SCÉNARIOS VIDÉO PUB")
        print("=" * 60)

        scenes = pub_scenario.get("scenes", [])
        title = pub_scenario.get("title", "Spot pub")
        daily_palette = pub_scenario.get("daily_palette", [])
        dream_palette = pub_scenario.get("dream_palette", [])

        video_scenarios = []

        for scene in scenes:
            scene_id = scene["id"]
            scene_type = scene.get("type", "")

            print(f"\n  [Scène {scene_id}] {scene_type} - {scene.get('concept', '')[:40]}")

            if scene_type == "TRANSITION_AWAKENING":
                vs = self._generate_pub_1a_scenario(
                    scene, title, character_name, character_gender, age,
                    character_features, daily_palette, dream_palette
                )
            elif scene_type == "TRANSITION_ACTION":
                vs = self._generate_pub_1b_scenario(
                    scene, title, character_name, character_gender, age,
                    character_features, dream_palette
                )
            elif scene.get("is_pov", False):
                palette = scene_palettes.get(scene_id, dream_palette)
                vs = self._generate_pov_scenario(scene, title, len(scenes), palette)
            else:
                palette = scene_palettes.get(scene_id, dream_palette)
                vs = self._generate_standard_scenario(
                    scene, title, len(scenes), character_name, character_gender,
                    age, character_features, False, palette  # same_day=False pour pub
                )

            vs["scene_id"] = scene_id
            vs["is_pov"] = scene.get("is_pov", False)
            vs["scene_type"] = scene_type
            video_scenarios.append(vs)

            print(f"    ✓ Start: {vs.get('start_keyframe', {}).get('description', '')[:50]}...")

        return video_scenarios

    def _generate_pub_1a_scenario(self, scene, title, name, gender, age, features, daily_palette, dream_palette):
        """Génère le scénario vidéo pour la scène 1A (transition quotidien → rêve)."""
        prompt = PROMPT_SCENARIO_PUB_VIDEO_1A.format(
            strict_prefix=self.strict_prefix,
            dream_title=title,
            character_name=name,
            character_gender=gender,
            age=age,
            character_features=features,
            daily_environment=scene.get("daily_environment", "Bureau morne"),
            dream_environment=scene.get("dream_environment", "Lieu de rêve"),
            emotional_arc=scene.get("emotional_arc", "lassitude → émerveillement"),
            daily_palette=", ".join(daily_palette) if daily_palette else "gris, beige terne",
            dream_palette=", ".join(dream_palette) if dream_palette else "couleurs vives",
            strict_suffix=self.strict_suffix
        )

        if self.verbose:
            print(f"\n--- PROMPT PUB 1A ---\n{prompt}\n---")

        if self.dry_run:
            return self._mock_pub_1a()

        response = self._call_openai(prompt)
        return self._parse_json(response)

    def _generate_pub_1b_scenario(self, scene, title, name, gender, age, features, dream_palette):
        """Génère le scénario vidéo pour la scène 1B (premiers pas dans le rêve)."""
        prompt = PROMPT_SCENARIO_PUB_VIDEO_1B.format(
            strict_prefix=self.strict_prefix,
            dream_title=title,
            character_name=name,
            character_gender=gender,
            age=age,
            character_features=features,
            dream_environment=scene.get("context", "Monde de rêve"),
            emotional_beat=scene.get("emotional_beat", "joie, curiosité"),
            dream_palette=", ".join(dream_palette) if dream_palette else "couleurs vives",
            strict_suffix=self.strict_suffix
        )

        if self.verbose:
            print(f"\n--- PROMPT PUB 1B ---\n{prompt}\n---")

        if self.dry_run:
            return self._mock_pub_1b()

        response = self._call_openai(prompt)
        return self._parse_json(response)

    def generate_video_scenarios(
        self,
        global_scenario: Dict,
        character_name: str,
        character_gender: str,
        age: int,
        character_features: str,
        scene_palettes: Dict[int, List[str]]
    ) -> List[Dict[str, Any]]:
        """Génère les descriptions détaillées par scène."""
        
        print("\n" + "=" * 60)
        print("ÉTAPE 4: SCÉNARIOS VIDÉO")
        print("=" * 60)
        
        scenes = global_scenario.get("scenes", [])
        same_day = global_scenario.get("same_day", True)
        title = global_scenario.get("title", "Rêve")
        
        video_scenarios = []
        
        for scene in scenes:
            scene_id = scene["id"]
            is_pov = scene.get("is_pov", False)
            
            print(f"\n  [Scène {scene_id}] {scene.get('phase', scene.get('concept', ''))} {'(POV)' if is_pov else ''}")
            
            palette = scene_palettes.get(scene_id, [])
            
            if is_pov:
                vs = self._generate_pov_scenario(scene, title, len(scenes), palette)
            else:
                vs = self._generate_standard_scenario(
                    scene, title, len(scenes), character_name, character_gender,
                    age, character_features, same_day, palette
                )
            
            vs["scene_id"] = scene_id
            vs["is_pov"] = is_pov
            video_scenarios.append(vs)
            
            print(f"    ✓ Start: {vs.get('start_keyframe', {}).get('description', '')[:50]}...")
        
        return video_scenarios
    
    def _generate_standard_scenario(self, scene, title, total, name, gender, age, features, same_day, palette):
        outfit_instruction = "TENUE IDENTIQUE à la scène 1" if same_day else "Tenue peut être différente"

        prompt = PROMPT_SCENARIO_VIDEO.format(
            strict_prefix=self.strict_prefix,
            dream_title=title,
            scene_id=scene["id"],
            total_scenes=total,
            scene_phase=scene.get("phase", scene.get("concept", "")),
            scene_type=scene.get("type", "ACTION"),
            scene_context=scene.get("context", scene.get("concept", "")),
            emotional_beat=scene.get("emotional_beat", scene.get("emotion", "")),
            character_name=name,
            character_gender=gender,
            age=age,
            character_features=features,
            has_character_b=scene.get("has_character_b", False),
            allows_camera_look=scene.get("allows_camera_look", False),
            shot_types=", ".join(self.config.get("shot_types", [])),
            camera_angles=", ".join(self.config.get("camera_angles", [])),
            camera_movements=", ".join(self.config.get("camera_movements", [])),
            lighting_directions=", ".join(self.config.get("lighting_directions", [])),
            lighting_temperatures=", ".join(self.config.get("lighting_temperatures", [])),
            depth_of_field_options=", ".join(self.config.get("depth_of_field_options", [])),
            focus_options=", ".join(self.config.get("focus_options", [])),
            scene_palette=", ".join(palette) if palette else "non définie",
            same_day="Oui" if same_day else "Non",
            outfit_instruction=outfit_instruction,
            expression_intensities=", ".join(self.config.get("expression_intensities", [])),
            gaze_directions=", ".join(self.config.get("gaze_directions", [])),
            strict_suffix=self.strict_suffix
        )
        
        if self.verbose:
            print(f"\n--- PROMPT SCENARIO_VIDEO ---\n{prompt}\n---")
        
        if self.dry_run:
            return self._mock_video_scenario(scene)
        
        response = self._call_openai(prompt)
        return self._parse_json(response)
    
    def _generate_pov_scenario(self, scene, title, total, palette):
        prompt = PROMPT_SCENARIO_VIDEO_POV.format(
            strict_prefix=self.strict_prefix,
            scene_context=scene.get("context", scene.get("concept", "")),
            time_of_day=scene.get("time_of_day", "afternoon"),
            indoor_outdoor="intérieur" if scene.get("indoor") else "extérieur",
            scene_palette=", ".join(palette) if palette else "non définie",
            depth_of_field_options=", ".join(self.config.get("depth_of_field_options", [])),
            lighting_temperatures=", ".join(self.config.get("lighting_temperatures", [])),
            strict_suffix=self.strict_suffix
        )
        
        if self.verbose:
            print(f"\n--- PROMPT POV ---\n{prompt}\n---")
        
        if self.dry_run:
            return self._mock_pov_scenario(scene)
        
        response = self._call_openai(prompt)
        return self._parse_json(response)
    
    def _call_openai(self, prompt: str) -> str:
        api_key = get_api_key("OPENAI_API_KEY")
        
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.7,
            "max_tokens": 2000
        }
        
        req = urllib.request.Request(
            "https://api.openai.com/v1/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        )
        
        with urllib.request.urlopen(req, timeout=60) as response:
            result = json.loads(response.read().decode("utf-8"))
        
        usage = result.get("usage", {})
        self.costs_real["tokens_input"] += usage.get("prompt_tokens", 0)
        self.costs_real["tokens_output"] += usage.get("completion_tokens", 0)
        self.costs_real["calls"] += 1
        
        return result["choices"][0]["message"]["content"]
    
    def _parse_json(self, text: str) -> Dict:
        text = text.strip()
        if text.startswith("```"):
            text = re.sub(r'^```\w*\n?', '', text)
            text = re.sub(r'\n?```$', '', text)
        match = re.search(r'\{[\s\S]*\}', text)
        if match:
            try:
                return json.loads(match.group())
            except:
                pass
        return {}
    
    def _mock_global(self, name, nb, nb_pov):
        phases = ["PRÉPARATION", "DÉPART", "DÉCOUVERTE", "ACTION", "CONNEXION", "ACCOMPLISSEMENT"]
        scenes = []
        pov_assigned = 0
        for i in range(nb):
            is_pov = pov_assigned < nb_pov and i >= nb - nb_pov
            if is_pov:
                pov_assigned += 1
            scenes.append({
                "id": i + 1,
                "phase": phases[i % len(phases)],
                "context": f"Scène {i + 1}",
                "emotional_beat": "Progression",
                "time_of_day": ["morning", "midday", "golden_hour", "sunset"][i % 4],
                "indoor": i % 2 == 0,
                "is_pov": is_pov
            })
        return {"title": f"Rêve de {name}", "same_day": True, "scenes": scenes}
    
    def _mock_video_scenario(self, scene):
        return {
            "start_keyframe": {
                "description": f"Début scène {scene.get('id', 1)}",
                "location": "Lieu",
                "pose": "Pose initiale",
                "expression": "Expression naturelle",
                "expression_intensity": "moderate",
                "gaze_direction": "away_left",
                "outfit": "Tenue",
                "accessories": ""
            },
            "end_keyframe": {
                "description": "Fin scène",
                "pose": "Pose finale",
                "expression": "Expression finale",
                "expression_intensity": "moderate"
            },
            "action": "Action simple",
            "shooting": {
                "shot_type": "medium",
                "camera_angle": "eye_level",
                "camera_movement": "static",
                "lighting_direction": "side",
                "lighting_temperature": "warm",
                "depth_of_field": "shallow",
                "focus_on": "face"
            }
        }
    
    def _mock_pov_scenario(self, scene):
        return {
            "start_keyframe": {
                "description": "Vue subjective",
                "foreground": "Main tenant café",
                "midground": "Horizon mer",
                "background": "Ciel",
                "lighting": "Lumière dorée"
            },
            "end_keyframe": {
                "description": "Vue légèrement changée",
                "change": "Lumière plus chaude"
            },
            "action": "Léger mouvement",
            "shooting": {"depth_of_field": "shallow", "lighting_temperature": "warm"}
        }

    def _mock_pub_scenario(self, name, nb_dream):
        scenes = [
            {
                "id": "1A", "type": "TRANSITION_AWAKENING",
                "concept": "Du bureau au rêve",
                "daily_environment": "Bureau gris et morne",
                "dream_environment": "Atelier lumineux",
                "emotional_arc": "lassitude → émerveillement",
                "time_of_day": "morning", "indoor": True, "is_pov": False,
                "allows_camera_look": False
            },
            {
                "id": "1B", "type": "TRANSITION_ACTION",
                "concept": "Premiers pas dans le rêve",
                "context": "Exploration de l'atelier",
                "emotional_beat": "joie, curiosité",
                "time_of_day": "morning", "indoor": False, "is_pov": False,
                "allows_camera_look": False
            },
        ]
        phases = ["ACTION", "ACTION", "IMMERSION", "ACTION", "INTERACTION", "ACTION", "ACCOMPLISSEMENT"]
        for i in range(nb_dream):
            is_last = i == nb_dream - 1
            scenes.append({
                "id": i + 2,
                "type": phases[i % len(phases)] if not is_last else "ACCOMPLISSEMENT",
                "phase": phases[i % len(phases)] if not is_last else "ACCOMPLISSEMENT",
                "concept": f"Scène de rêve {i + 2}",
                "context": f"Contexte scène {i + 2}",
                "emotional_beat": "Joie",
                "time_of_day": ["morning", "afternoon", "golden_hour", "sunset"][i % 4],
                "indoor": i % 2 == 0,
                "is_pov": False,
                "has_character_b": False,
                "allows_camera_look": is_last
            })
        return {
            "title": f"Pub rêve de {name}",
            "daily_context_description": "Bureau morne",
            "daily_palette": ["#9E9E9E", "#BDBDBD", "#E0E0E0", "#F5F5F5"],
            "dream_palette": ["#FF6B35", "#F7C59F", "#1A535C", "#4ECDC4"],
            "character_b": {"present": False},
            "scenes": scenes
        }

    def _mock_pub_1a(self):
        return {
            "start_keyframe": {
                "description": "Personnage dans bureau gris, face à droite, posture voutée",
                "location": "Bureau open space terne",
                "pose": "Face à droite, légèrement vouté, bras le long du corps",
                "expression": "Lassitude, ennui",
                "expression_intensity": "moderate",
                "gaze_direction": "down",
                "outfit": "Chemise grise, pantalon sombre",
                "accessories": ""
            },
            "end_keyframe": {
                "description": "Même personnage dans atelier lumineux, tête relevée",
                "location": "Atelier créatif lumineux",
                "pose": "Tête relevée, corps redressé",
                "expression": "Émerveillement, surprise joyeuse",
                "expression_intensity": "moderate",
                "gaze_direction": "up",
                "outfit": "Même chemise grise",
                "accessories": ""
            },
            "action": "L'environnement se transforme du bureau gris à l'atelier lumineux",
            "shooting": {
                "shot_type": "medium_full", "camera_angle": "eye_level",
                "camera_movement": "static", "lighting_direction": "front",
                "lighting_temperature": "cool→warm", "depth_of_field": "medium",
                "focus_on": "face"
            }
        }

    def _mock_pub_1b(self):
        return {
            "start_keyframe": {
                "description": "Personnage émerveillé dans atelier lumineux (= end 1A)",
                "location": "Atelier créatif lumineux",
                "pose": "Tête relevée, corps redressé",
                "expression": "Émerveillement",
                "expression_intensity": "moderate",
                "gaze_direction": "up"
            },
            "end_keyframe": {
                "description": "Personnage explorant l'atelier, tourné vers la gauche",
                "location": "Atelier créatif lumineux",
                "pose": "En mouvement, premier pas, orientation vers la gauche",
                "expression": "Joie, curiosité",
                "expression_intensity": "moderate",
                "gaze_direction": "away_left"
            },
            "action": "Le personnage fait ses premiers pas dans le monde de rêve",
            "shooting": {
                "shot_type": "medium_full", "camera_angle": "eye_level",
                "camera_movement": "slow_pan_left", "lighting_direction": "side",
                "lighting_temperature": "warm", "depth_of_field": "medium",
                "focus_on": "full_body"
            }
        }

    def get_real_cost(self) -> float:
        costs = self.config.get("costs", {})
        input_cost = (self.costs_real["tokens_input"] / 1000) * costs.get("scenario_input_per_1k", 0.005)
        output_cost = (self.costs_real["tokens_output"] / 1000) * costs.get("scenario_output_per_1k", 0.015)
        return input_cost + output_cost
