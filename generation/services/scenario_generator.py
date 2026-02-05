"""
Sublym v4 - Scenario Generator
VERSION v7 - 11 étapes avec triple validation graduée (V1/V2/V3)
- Validation graduée: full (V1+V2+V3), medium (V1+V3), light (V1)
- Parallélisation par scène: steps 4,5,6,7,8,11 via ThreadPoolExecutor
- Modèle validation séparé (GPT-4o-mini) pour réduction des coûts

Steps:
1. Blocages émotionnels + affirmations (light)
2. Pitch global (full)
3. Découpage en scènes (medium)
4. Paramètres par scène (medium, parallèle)
5. Keyframes start/end (full, parallèle)
6. Pitchs individuels (medium, parallèle)
7. Attitudes et déplacements (light, parallèle)
8. Palettes couleurs (light, parallèle)
9. Cadrage justifié (medium, séquentiel pour variété)
10. Rythme (light)
11. Prompts finaux EN + bande son (full, parallèle)

Conserve les modes pub et free_scenes en rétrocompatibilité.
"""

import json
import re
import time
import threading
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Any, Optional, Tuple

from .env_loader import get_api_key
from .audit_log import AuditLog
from config.settings import DEFAULT_MODELS, PRODUCTION_RULES, get_rules
from prompts.templates import (
    PROMPT_SCENARIO_GLOBAL, PROMPT_FREE_SCENES,
    PROMPT_SCENARIO_VIDEO, PROMPT_SCENARIO_VIDEO_POV,
    PROMPT_SCENARIO_PUB, PROMPT_SCENARIO_PUB_VIDEO_1A, PROMPT_SCENARIO_PUB_VIDEO_1B,
    RULES_PUB
)


class ScenarioGenerator:
    """Génère les scénarios via LLM.

    Mode v7 (par défaut): 11 étapes granulaires avec triple validation.
    Mode pub/free_scenes: méthodes héritées (rétrocompatibilité).
    """

    def __init__(self, config: Dict, dry_run: bool = False, verbose: bool = False):
        self.config = config
        self.dry_run = dry_run
        self.verbose = verbose
        self.model = config.get("models", {}).get("scenario", DEFAULT_MODELS["scenario"])
        self.model_validation = config.get("models", {}).get(
            "scenario_validation",
            DEFAULT_MODELS.get("scenario_validation", "gpt-4o-mini")
        )
        self.strict_prefix = config.get("prompt_strict_prefix", "")
        self.strict_suffix = config.get("prompt_strict_suffix", "")

        # v7 config
        self.validation_config = config.get("validation", {})
        self.enable_v1 = self.validation_config.get("enable_v1", True)
        self.enable_v2 = self.validation_config.get("enable_v2", True)
        self.enable_v3 = self.validation_config.get("enable_v3", True)
        self.validation_min_score = self.validation_config.get("score_min_pass", 0.8)
        self.max_retries = config.get("llm", {}).get("max_retries", 3)
        self.llm_timeout = config.get("llm", {}).get("timeout", 120)
        self.temp_generation = config.get("llm", {}).get("temperature_generation", 0.7)
        self.temp_validation = config.get("llm", {}).get("temperature_validation", 0.2)

        # Coûts séparés: génération vs validation (thread-safe)
        self._costs_lock = threading.Lock()
        self.costs_generation = {"tokens_input": 0, "tokens_output": 0, "calls": 0}
        self.costs_validation = {"tokens_input": 0, "tokens_output": 0, "calls": 0}
        self.costs_real = {"tokens_input": 0, "tokens_output": 0, "calls": 0}  # total
        self.audit = AuditLog()
        self._scenario = {}  # v7 internal state

    # =========================================================================
    # V7: MÉTHODE PRINCIPALE
    # =========================================================================

    def generate_v7(
        self,
        dream_statement: str,
        character_name: str,
        character_gender: str,
        age: int,
        nb_scenes: int,
        duree_scene: int = 6,
        dream_elements: Optional[Dict] = None,
        character_analysis: Optional[Dict] = None,
        style_description: str = "classique",
        reject: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Génère le scénario complet via l'approche v7 (11 étapes).

        Args:
            dream_statement: Le rêve de l'utilisateur
            character_name: Nom du personnage
            character_gender: Genre (male/female)
            age: Age estimé
            nb_scenes: Nombre de scènes
            duree_scene: Durée par scène en secondes
            dream_elements: Éléments extraits du rêve (étape 0)
            character_analysis: Analyse du personnage (étape 1)
            style_description: Style vestimentaire déduit
            reject: Éléments exclus

        Returns:
            Dict complet du scénario v7 avec toutes les données
        """
        # Construire le contexte
        reject_text = "\n".join(f"- {r}" for r in reject) if reject else "Aucun"
        elements_json = json.dumps(dream_elements or {}, ensure_ascii=False, indent=2)

        self._context = (
            f"REVE: {dream_statement}\n"
            f"PERSONNAGE: {character_name} ({character_gender}, environ {age} ans)\n"
            f"STYLE: {style_description}\n"
            f"ELEMENTS DU REVE:\n{elements_json}\n"
            f"ELEMENTS EXCLUS:\n{reject_text}"
        )
        self._nb_scenes = nb_scenes
        self._duree_scene = duree_scene
        self._dream_statement = dream_statement
        self._character_name = character_name
        self._character_gender = character_gender
        self._age = age
        self._dream_elements = dream_elements or {}
        self._character_analysis = character_analysis or {}
        self._scenario = {}

        self.audit.section("SCENARIO AGENT v7 - GENERATION")
        self.audit.detail("Config", {
            "nb_scenes": nb_scenes,
            "duree_scene": duree_scene,
            "model": self.model,
            "validation": f"V1={self.enable_v1} V2={self.enable_v2} V3={self.enable_v3} min={self.validation_min_score}",
        })
        self.audit.detail("Reve", dream_statement)

        if self.dry_run:
            print("  [DRY RUN] Scenario v7 simule")
            return self._mock_v7(character_name, nb_scenes)

        # Exécution des 11 étapes
        self._step1_blocages_emotionnels()
        self._step2_pitch_global()
        self._step3_decoupage_scenes()
        self._step4_parametres_scenes()
        self._step5_keyframes()
        self._step6_pitchs_individuels()
        self._step7_attitudes()
        self._step8_palettes()
        self._step9_cadrage()
        self._step10_rythme()
        self._step11_prompts_finaux()

        # Métadonnées
        self._scenario["metadata"] = {
            "dream": dream_statement,
            "character": character_name,
            "nb_scenes": nb_scenes,
            "duree_scene": duree_scene,
            "duree_totale": nb_scenes * duree_scene,
            "cost_usd": self.get_real_cost(),
            "llm_calls": self.costs_real["calls"],
            "tokens_total": self.costs_real["tokens_input"] + self.costs_real["tokens_output"],
        }

        self.audit.section("COUT")
        breakdown = self.get_cost_breakdown()
        self.audit.detail("Generation", {
            "modele": breakdown["generation"]["model"],
            "appels": breakdown["generation"]["calls"],
            "tokens": f"{breakdown['generation']['tokens']:,}",
            "cout": f"${breakdown['generation']['cost_usd']:.4f}",
        })
        self.audit.detail("Validation", {
            "modele": breakdown["validation"]["model"],
            "appels": breakdown["validation"]["calls"],
            "tokens": f"{breakdown['validation']['tokens']:,}",
            "cout": f"${breakdown['validation']['cost_usd']:.4f}",
        })
        self.audit.detail("Cout total USD", f"${breakdown['total_usd']:.4f}")

        return self._scenario

    # =========================================================================
    # V7: CONVERSION VERS FORMAT PIPELINE
    # =========================================================================

    def convert_v7_to_pipeline(self, v7_scenario: Dict) -> Tuple[Dict, List[Dict], Dict]:
        """Convertit la sortie v7 vers le format attendu par pipeline.py.

        Returns:
            (global_scenario, video_scenarios, scene_palettes)
        """
        decoupage = v7_scenario.get("decoupage", [])
        params_list = v7_scenario.get("parametres_scenes", [])
        keyframes_list = v7_scenario.get("keyframes", [])
        pitchs_list = v7_scenario.get("pitchs", [])
        attitudes_list = v7_scenario.get("attitudes", [])
        palettes_list = v7_scenario.get("palettes_scenes", [])
        cadrages_list = v7_scenario.get("cadrages", [])
        rythme = v7_scenario.get("rythme", {})
        prompts_list = v7_scenario.get("prompts_video", [])

        # 1. global_scenario
        scenes = []
        for i, dec in enumerate(decoupage):
            if not isinstance(dec, dict):
                dec = {"id": i + 1, "titre": str(dec), "action": str(dec)}
            scene_id = dec.get("id", i + 1)
            params = self._get_item(params_list, i, {})
            is_last = i == len(decoupage) - 1

            has_b = bool(
                (isinstance(params, dict) and params.get("tenue_partenaire"))
                or (self._dream_elements.get("character_b", {}).get("present") and
                    self._dream_elements.get("character_b", {}).get("importance") == "high")
            )

            scenes.append({
                "id": scene_id,
                "type": "ACCOMPLISSEMENT" if is_last else "ACTION",
                "concept": dec.get("titre", ""),
                "context": dec.get("action", ""),
                "emotional_beat": dec.get("vers", ""),
                "time_of_day": self._extract_time(params),
                "indoor": False,
                "is_pov": False,
                "has_character_b": has_b,
                "allows_camera_look": is_last,
            })

        global_scenario = {
            "title": self._extract_title(v7_scenario.get("pitch_global", ""), v7_scenario.get("dream_title")),
            "same_day": True,
            "scenes": scenes,
            "character_b": {
                "present": any(s.get("has_character_b") for s in scenes),
            },
            "elements_coverage": {
                "explicit_elements_used": self._dream_elements.get("user_explicit_elements", []),
                "coverage_ratio": 1.0,
            },
            # v7 extra data
            "blocages_emotionnels": v7_scenario.get("blocages_emotionnels"),
            "pitch_global": v7_scenario.get("pitch_global"),
            "rythme": rythme,
        }

        # 2. video_scenarios
        video_scenarios = []
        for i, scene in enumerate(scenes):
            kf = self._get_item(keyframes_list, i, {})
            params = self._get_item(params_list, i, {})
            att = self._get_item(attitudes_list, i, {})
            cad = self._get_item(cadrages_list, i, {})
            pitch = self._get_item(pitchs_list, i, {})
            prompt_v = self._get_item(prompts_list, i, {})

            kf_start = kf.get("start", {}) if isinstance(kf, dict) else {}
            kf_end = kf.get("end", {}) if isinstance(kf, dict) else {}
            if not isinstance(kf_start, dict):
                kf_start = {"position_protagoniste": str(kf_start)}
            if not isinstance(kf_end, dict):
                kf_end = {"position_protagoniste": str(kf_end)}
            if not isinstance(params, dict):
                params = {}
            if not isinstance(att, dict):
                att = {}
            if not isinstance(cad, dict):
                cad = {}

            # Build rich description from pitch + keyframe data
            pitch_text = pitch.get("pitch", "") if isinstance(pitch, dict) else str(pitch)
            start_desc = self._build_kf_description(kf_start, params, pitch_text)
            end_desc = self._build_kf_description(kf_end, params, "")

            # Outfit structuré : utiliser la référence si disponible
            outfit_ref = v7_scenario.get("outfit_reference", {})
            outfit_text = params.get("tenue_protagoniste", outfit_ref.get("text", ""))
            outfit_items = params.get("outfit_items", outfit_ref.get("items", []))

            video_scenarios.append({
                "scene_id": scene["id"],
                "is_pov": False,
                "outfit_reference": outfit_ref,
                "start_keyframe": {
                    "description": start_desc,
                    "location": params.get("lieu_precis", ""),
                    "pose": kf_start.get("position_protagoniste", ""),
                    "expression": kf_start.get("emotion", ""),
                    "expression_intensity": "moderate",
                    "gaze_direction": "away",
                    "outfit": outfit_text,
                    "outfit_items": outfit_items,
                    "accessories": "",
                    "character_b_position": kf_start.get("position_partenaire", ""),
                },
                "end_keyframe": {
                    "description": end_desc,
                    "location": params.get("lieu_precis", ""),
                    "pose": kf_end.get("position_protagoniste", ""),
                    "expression": kf_end.get("emotion", ""),
                    "expression_intensity": "moderate",
                    "gaze_direction": "camera" if scene["allows_camera_look"] else "away",
                    "outfit": outfit_text,
                    "outfit_items": outfit_items,
                    "accessories": "",
                    "character_b_position": kf_end.get("position_partenaire", ""),
                },
                "action": att.get("deplacement", kf.get("action", "")) if isinstance(kf, dict) else "",
                "transition_path": kf.get("transition_path", "") if isinstance(kf, dict) else "",
                "shooting": {
                    "shot_type": self._map_shot_type(cad.get("type_plan", "plan moyen")),
                    "camera_angle": self._map_angle(cad.get("angle", "niveau des yeux")),
                    "camera_movement": self._map_camera_movement(cad.get("mouvement_camera", "fixe")),
                    "lighting_direction": "side",
                    "lighting_temperature": "warm",
                    "depth_of_field": "medium",
                    "focus_on": "full_body",
                },
                # v7 extra data
                "attitude": att,
                "prompt_video": prompt_v.get("prompt", "") if isinstance(prompt_v, dict) else str(prompt_v),
            })

        # 3. scene_palettes
        scene_palettes = {}
        palette_globale = v7_scenario.get("palette_globale", {})
        if not isinstance(palette_globale, dict):
            palette_globale = {}

        for pal in palettes_list:
            if not isinstance(pal, dict):
                continue
            sid = pal.get("scene_id", 0)
            colors = [
                pal.get("dominante", palette_globale.get("principale", "#444444")),
                pal.get("accent", palette_globale.get("accent", "#888888")),
                palette_globale.get("neutre_clair", "#CCCCCC"),
                palette_globale.get("neutre_fonce", "#222222"),
            ]
            scene_palettes[sid] = colors

        return global_scenario, video_scenarios, scene_palettes

    # =========================================================================
    # V7: PROMPTS VIDEO (déjà en EN depuis step 11)
    # =========================================================================

    def apply_video_prompts(self, video_scenarios: List[Dict]) -> List[Dict]:
        """Injecte les prompts vidéo EN (générés en step 11) dans les video_scenarios.

        Les prompts sont déjà en anglais depuis l'étape 11.
        Cette méthode associe chaque prompt_video au bon scénario de scène.
        """
        prompts_map = {}
        for pv in self._scenario.get("prompts_video", []):
            if isinstance(pv, dict):
                prompts_map[pv.get("scene_id")] = pv

        for vs in video_scenarios:
            sid = vs.get("scene_id")
            pv = prompts_map.get(sid, {})
            if pv:
                vs["prompt_video"] = pv.get("prompt", "")
                vs["prompt_video_fr"] = pv.get("prompt_fr", "")

        return video_scenarios

    # =========================================================================
    # PUB V7: MODE SCENARIO_PUB AVEC VALIDATION
    # =========================================================================

    def generate_pub_v7(
        self,
        dream_statement: str,
        character_name: str,
        character_gender: str,
        age: int,
        nb_scenes_avant: int = 1,
        nb_dream_scenes: int = 4,
        duree_scene: int = 6,
        dream_elements: Optional[Dict] = None,
        character_analysis: Optional[Dict] = None,
        style_description: str = "classique",
        reject: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Génère le scénario pub complet via l'approche v7.

        Structure: PRE_SWITCH scenes → SWITCH → DISCOVERY → DREAM scenes.
        """
        reject_text = "\n".join(f"- {r}" for r in reject) if reject else "Aucun"
        elements_json = json.dumps(dream_elements or {}, ensure_ascii=False, indent=2)
        gender_word = "woman" if character_gender == "female" else "man"
        pronoun = "her" if character_gender == "female" else "him"

        self._context = (
            f"REVE: {dream_statement}\n"
            f"PERSONNAGE: {character_name} ({character_gender}, environ {age} ans)\n"
            f"STYLE: {style_description}\n"
            f"ELEMENTS DU REVE:\n{elements_json}\n"
            f"ELEMENTS EXCLUS:\n{reject_text}\n"
            f"MODE: PUB (quotidien → switch → decouverte → reve)"
        )
        self._nb_scenes = nb_dream_scenes
        self._duree_scene = duree_scene
        self._dream_statement = dream_statement
        self._character_name = character_name
        self._character_gender = character_gender
        self._age = age
        self._dream_elements = dream_elements or {}
        self._scenario = {}

        self.audit.section("SCENARIO AGENT PUB v7 - GENERATION")
        self.audit.detail("Config", {
            "nb_scenes_avant": nb_scenes_avant,
            "nb_dream_scenes": nb_dream_scenes,
            "duree_scene": duree_scene,
            "model": self.model,
        })

        if self.dry_run:
            print("  [DRY RUN] Scenario pub v7 simule")
            return self._mock_pub_v7(character_name, nb_scenes_avant, nb_dream_scenes)

        # P.1 — Analyse du manque
        self._pub_step_manque()

        # P.2 — Pitch global pub
        self._pub_step_pitch(nb_scenes_avant, nb_dream_scenes)

        # P.3 — Scènes avant (quotidien)
        self._pub_step_scenes_avant(nb_scenes_avant)

        # P.4 — Switch décor
        self._pub_step_switch(gender_word, pronoun)

        # P.5 — Scène découverte
        self._pub_step_decouverte()

        # P.5b — Palette rêve (nécessaire pour D, E, et dream scenes)
        if not self._scenario.get("palette_globale"):
            self._pub_step_palette_reve()

        # P.6 — Dream scenes (réutilise la logique v7) — skip si 0 scènes
        if nb_dream_scenes > 0:
            self._pub_step_dream_scenes(nb_dream_scenes)
        else:
            self.audit.log("Pas de dream scenes (nb_dream_scenes=0) — After = D + E uniquement")

        # Métadonnées
        total_scenes = nb_scenes_avant + 2 + nb_dream_scenes  # avant + discovery(D) + explore(E) + dream
        self._scenario["metadata"] = {
            "dream": dream_statement,
            "character": character_name,
            "mode": "scenario_pub",
            "nb_scenes_avant": nb_scenes_avant,
            "nb_dream_scenes": nb_dream_scenes,
            "total_scenes": total_scenes,
            "duree_scene": duree_scene,
            "duree_totale": total_scenes * duree_scene,
            "cost_usd": self.get_real_cost(),
            "llm_calls": self.costs_real["calls"],
        }

        return self._scenario

    # ---- PUB P.1: Analyse du manque ----

    def _pub_step_manque(self):
        self.audit.section("PUB P.1: ANALYSE DU MANQUE")

        etat = self._ask(
            "P.1.1 Etat actuel (le MANQUE)",
            f"Cette personne a un DESIR profond. Quel est son état actuel qui crée ce désir ?\n\n"
            f"DESIR: {self._dream_statement}\n\n"
            f"Le MANQUE est ce que la personne N'A PAS dans sa vie actuelle.\n"
            f"Exemples: 'tomber amoureuse' → CELIBAT, 'voyager' → SEDENTARITE, "
            f"'réussir' → STAGNATION, 'être libre' → ENFERMEMENT\n\n"
            f"Réponds en 1-2 mots MAXIMUM.",
            "L'état décrit bien ce qui MANQUE à la personne pour réaliser son désir",
            schema={"etat": "LE MANQUE en 1-2 mots"},
            validation_level="light"
        )
        manque = etat.get("etat", "ROUTINE") if isinstance(etat, dict) else str(etat)

        emotions = self._ask(
            "P.1.2 Emotions du manque",
            f"Quels sont les INCONVENIENTS EMOTIONNELS de l'état \"{manque}\" ?\n"
            f"Liste 5 EMOTIONS/SENTIMENTS que ressent quelqu'un dans cet état.\n"
            f"PAS de situations concrètes, UNIQUEMENT des émotions.",
            "Les items sont bien des EMOTIONS pertinentes pour l'état",
            schema={"emotions": ["emotion1", "emotion2", "emotion3", "emotion4", "emotion5"]},
            validation_level="light"
        )
        emotions_list = emotions.get("emotions", ["ennui"]) if isinstance(emotions, dict) else ["ennui"]

        contextes = self._ask(
            "P.1.3 Contextes douloureux",
            f"Dans quels CONTEXTES/LIEUX ces émotions sont-elles les plus fortes ?\n"
            f"État: {manque}\n"
            f"Émotions: {', '.join(emotions_list)}\n\n"
            f"Liste 4 contextes/lieux concrets et filmables.",
            "Les contextes sont des lieux concrets où le personnage peut être filmé",
            schema={"contextes": [{"lieu": "...", "pourquoi": "..."}]},
            validation_level="light"
        )

        contexte_choisi = self._ask(
            "P.1.4 Selection du contexte",
            f"Parmi ces contextes, lequel est LE MEILLEUR pour la scène quotidien ?\n\n"
            f"Contextes: {json.dumps(contextes, ensure_ascii=False)}\n\n"
            f"Critères: UNIVERSEL (identification), INTIME (pas professionnel), "
            f"VISUELLEMENT CLAIR (facile à filmer).\n"
            f"Désir: {self._dream_statement}",
            "Le contexte choisi est un lieu intime où le manque est visible",
            schema={"contexte": "nom du lieu", "justification": "pourquoi"},
            validation_level="light"
        )
        lieu = contexte_choisi.get("contexte", "appartement") if isinstance(contexte_choisi, dict) else "appartement"

        situation = self._ask(
            "P.1.5 Situation concrete",
            f"Décris une SITUATION CONCRÈTE dans ce contexte.\n"
            f"Contexte: {lieu}\n"
            f"État: {manque}\n"
            f"Émotions: {', '.join(emotions_list)}\n\n"
            f"La situation doit: montrer l'émotion VISUELLEMENT (action + posture + expression), "
            f"être SIMPLE (une seule action), être RELATABLE, NE PAS être pathétique.",
            "La situation est simple, visuelle, montre le manque sans être pathétique",
            schema={
                "situation": "description courte (1 phrase)",
                "action": "ce que FAIT le personnage",
                "element_symbolique": "objet qui renforce le manque (ex: chaise vide)",
                "posture": "posture du personnage",
                "expression": "expression faciale (subtile)"
            },
            validation_level="light"
        )

        self._scenario["manque_analysis"] = {
            "etat": manque,
            "emotions": emotions_list,
            "contexte_choisi": lieu,
            "situation": situation if isinstance(situation, dict) else {"situation": str(situation)},
        }

    # ---- PUB P.2: Pitch global pub ----

    def _pub_step_pitch(self, nb_avant: int, nb_dream: int):
        self.audit.section("PUB P.2: PITCH GLOBAL PUB")

        manque = self._scenario.get("manque_analysis", {})
        total = nb_avant + 1 + nb_dream

        pitch = self._ask(
            "P.2.1 Pitch global pub",
            f"Ecris le PITCH GLOBAL du spot publicitaire en {total} scènes.\n\n"
            f"STRUCTURE:\n"
            f"- {nb_avant} scène(s) QUOTIDIEN: le manque ({manque.get('etat', '?')}) "
            f"dans le contexte {manque.get('contexte_choisi', '?')}\n"
            f"- 1 SWITCH: le décor change instantanément (cut cinématique)\n"
            f"- 1 scène DECOUVERTE: le personnage réalise qu'il est dans son rêve\n"
            f"- {nb_dream} scènes DE REVE: le personnage vit son rêve\n\n"
            f"Arc émotionnel: ennui/lassitude → surprise → émerveillement → joie → accomplissement.\n"
            f"Le CONTRASTE entre quotidien et rêve doit être MAXIMAL.\n"
            f"Style neutre, 3ème personne.",
            "Le pitch couvre l'arc narratif complet avec contraste quotidien/rêve",
            rules=get_rules("narratives", "format")
        )

        self._scenario["pitch_global"] = pitch
        self._generate_dream_title(pitch)

    # ---- PUB P.3: Scènes avant (quotidien) ----

    def _pub_step_scenes_avant(self, nb_avant: int):
        self.audit.section("PUB P.3: SCENES AVANT (QUOTIDIEN)")

        manque = self._scenario.get("manque_analysis", {})
        situation = manque.get("situation", {})
        lieu = manque.get("contexte_choisi", "appartement")

        scenes_avant = []

        for i in range(nb_avant):
            scene_id = f"0{chr(65 + i)}"  # 0A, 0B, 0C...
            is_last_avant = i == nb_avant - 1

            # Paramètres visuels
            params = self._ask(
                f"P.3.{i+1} Params quotidien {scene_id}",
                f"Pour la scène quotidien {scene_id} (lieu: {lieu}):\n"
                f"- Situation: {situation.get('situation', '?')}\n"
                f"- Émotion: {manque.get('emotions', ['ennui'])[0]}\n\n"
                f"Définis les éléments visuels: mobilier, objets, éclairage, arrière-plan.\n"
                f"Palette: DESATUREE, grise, froide.\n"
                f"Les éléments doivent RENFORCER l'émotion de manque.",
                "Éléments concrets, visuels, qui renforcent l'émotion de manque",
                schema={
                    "lieu_precis": "description du lieu avec détails",
                    "mobilier": ["element1", "element2"],
                    "objets": ["element1", "element2"],
                    "objet_symbolique": "objet qui symbolise le manque",
                    "eclairage": "type d'éclairage (plat, artificiel, etc.)",
                    "action": situation.get("action", "?"),
                    "tenue_protagoniste": "vêtements simples, quotidiens, neutres",
                },
                rules=RULES_PUB,
                validation_level="medium"
            )

            # Keyframe start
            kf_start = self._ask(
                f"P.3.{i+1}s Start KF quotidien {scene_id}",
                f"Décris le DEBUT de la scène quotidien {scene_id}.\n"
                f"Lieu: {lieu}\n"
                f"Situation: {situation.get('situation', '?')}\n"
                f"Action: {situation.get('action', '?')}\n"
                f"Posture: {situation.get('posture', '?')}\n"
                f"Émotion: lassitude, ennui\n\n"
                f"Le personnage est en pleine action, l'émotion commence à transparaître.",
                "Start keyframe montre l'émotion de manque, réaliste, pas exagéré",
                schema={
                    "description": "description complète de la scène",
                    "pose": "position du corps",
                    "expression": "expression faciale (subtile)",
                    "expression_intensity": "moderate",
                    "gaze_direction": "down",
                    "outfit": "vêtements quotidiens",
                },
                rules=RULES_PUB,
                validation_level="medium"
            )

            # Keyframe end — PROCHE du start pour fluidité vidéo minimax
            if is_last_avant:
                # Dernière scène avant: POSE FIGÉE reproductible + PROCHE du start
                kf_end = self._ask(
                    f"P.3.{i+1}e End KF quotidien {scene_id} (POSE FIGEE)",
                    f"Décris la FIN de la scène quotidien {scene_id}.\n"
                    f"Le personnage s'arrête dans une POSE PRECISE et REPRODUCTIBLE.\n\n"
                    f"IMPORTANT — Cette pose sera COPIEE pour le switch:\n"
                    f"- Position SIMPLE et PRECISE (assis ou debout, pas en mouvement)\n"
                    f"- Orientation du corps claire (face, 3/4, profil)\n"
                    f"- Position des bras et mains définie précisément\n"
                    f"- Direction du regard fixée (fenêtre, horizon, vide)\n"
                    f"- Expression PENSIVE (moment de pause, rêverie)\n"
                    f"- Tenue IDENTIQUE au start\n\n"
                    f"RÈGLE MINIMAX — PROXIMITÉ DES IMAGES:\n"
                    f"La pose de fin doit être TRÈS PROCHE de la pose de début:\n"
                    f"Start: {json.dumps(kf_start, ensure_ascii=False)}\n\n"
                    f"SEULES DIFFÉRENCES AUTORISÉES par rapport au start:\n"
                    f"- Légère inclinaison de la tête (de face vers légèrement de côté)\n"
                    f"- Expression qui évolue (ennui → pensif/rêveur)\n"
                    f"- Léger changement de position des mains (sur le bureau → sous le menton)\n"
                    f"- Direction du regard (de l'écran → vers le vide)\n\n"
                    f"INTERDIT: changer de position (assis→debout), de lieu, d'orientation corporelle, de tenue.",
                    "Pose PRECISE, reproductible, PROCHE du start — différences minimales",
                    schema={
                        "description": "description de la pose figée (proche du start)",
                        "orientation_corps": "face | trois_quarts_gauche | trois_quarts_droite | profil",
                        "pose": "position complète du corps (MÊME base que start)",
                        "bras_gauche": "position précise",
                        "bras_droit": "position précise",
                        "mains": "position/geste",
                        "regard": "direction et cible",
                        "expression": "pensive, rêveuse",
                        "expression_intensity": "moderate",
                        "gaze_direction": "away_right",
                        "outfit": "même tenue que start",
                        "differences_vs_start": "liste des SEULES différences par rapport au start",
                    },
                    rules=RULES_PUB
                )
            else:
                kf_end = self._ask(
                    f"P.3.{i+1}e End KF quotidien {scene_id}",
                    f"Décris la FIN de la scène quotidien {scene_id}.\n"
                    f"Progression de l'ennui, posture plus fermée ou geste las.\n\n"
                    f"RÈGLE MINIMAX — PROXIMITÉ DES IMAGES:\n"
                    f"Start: {json.dumps(kf_start, ensure_ascii=False)}\n"
                    f"La pose de fin doit être TRÈS PROCHE du start.\n"
                    f"Seules différences: expression, direction regard, petit geste.",
                    "End keyframe PROCHE du start, différences minimales",
                    schema={
                        "description": "description de la fin",
                        "pose": "position du corps (MÊME que start)",
                        "expression": "lassitude, ennui",
                        "expression_intensity": "moderate",
                        "gaze_direction": "down",
                        "outfit": "même tenue que start",
                        "differences_vs_start": "liste des SEULES différences",
                    },
                    rules=RULES_PUB,
                    validation_level="medium"
                )

            # Cadrage
            cadrage = self._ask(
                f"P.3.{i+1}c Cadrage quotidien {scene_id}",
                f"Définis le CADRAGE pour la scène quotidien {scene_id}.\n"
                f"Scène d'ennui, intérieur, ambiance morne.\n"
                f"Pas de gros plan visage. Mouvement lent ou fixe.",
                "Cadrage cohérent avec ambiance morne, pas de gros plan",
                schema={
                    "type_plan": "plan moyen | plan americain",
                    "mouvement_camera": "fixe | very_slow_zoom_in",
                    "angle": "niveau des yeux",
                },
                rules=get_rules("cadrage"),
                validation_level="light"
            )

            # Transition path (simple, pour minimax)
            transition = self._ask(
                f"P.3.{i+1}t Transition quotidien {scene_id}",
                f"Décris en UNE PHRASE COURTE EN ANGLAIS ce qui se passe pendant ce clip de 6 secondes.\n\n"
                f"Début: {kf_start.get('pose', '?')}, {kf_start.get('expression', '?')}\n"
                f"Fin: {kf_end.get('pose', '?') if isinstance(kf_end, dict) else '?'}, "
                f"{kf_end.get('expression', '?') if isinstance(kf_end, dict) else '?'}\n\n"
                f"UNE seule action principale, mouvement MINIMAL.\n"
                f"Exemple: 'Character slowly exhales and shifts gaze from screen to distance, expression turning pensive'\n"
                f"EN ANGLAIS.",
                "Une phrase courte décrivant l'action principale (mouvement minimal)",
                schema={"transition_en": "phrase en anglais"},
                validation_level="light"
            )

            # Prompt vidéo EN
            prompt_video = self._ask(
                f"P.3.{i+1}p Prompt video quotidien {scene_id}",
                f"Generate a SHORT, SIMPLE video prompt in English for daily life scene {scene_id}.\n\n"
                f"Start keyframe: {json.dumps(kf_start, ensure_ascii=False)}\n"
                f"End keyframe: {json.dumps(kf_end, ensure_ascii=False)}\n"
                f"Action: {transition.get('transition_en', '') if isinstance(transition, dict) else ''}\n"
                f"Location: {lieu}\n"
                f"Cadrage: {json.dumps(cadrage, ensure_ascii=False)}\n\n"
                f"KEEP IT SIMPLE — 2-3 sentences maximum.\n"
                f"The video model works best with short, clear prompts.\n"
                f"Atmosphere: dreary, desaturated, mundane.\n"
                f"{'End on FROZEN POSE: character stops looking away pensively.' if is_last_avant else ''}\n"
                f"Both prompt_en and resume_fr are REQUIRED.",
                "Prompt court EN (2-3 phrases), atmosphère morne",
                schema={
                    "prompt_en": "Short prompt in English (2-3 sentences)",
                    "resume_fr": "Résumé en français (1-2 phrases)"
                },
                rules=get_rules("technique", "format")
            )

            scenes_avant.append({
                "scene_id": scene_id,
                "phase": "PRE_SWITCH",
                "params": params if isinstance(params, dict) else {},
                "start_keyframe": kf_start if isinstance(kf_start, dict) else {},
                "end_keyframe": kf_end if isinstance(kf_end, dict) else {},
                "transition_path": transition.get("transition_en", "") if isinstance(transition, dict) else "",
                "cadrage": cadrage if isinstance(cadrage, dict) else {},
                "prompt_video": prompt_video if isinstance(prompt_video, dict) else {},
                "is_last_avant": is_last_avant,
            })

        self._scenario["scenes_avant"] = scenes_avant

        # Palette quotidien
        palette_quot = self._ask(
            "P.3.P Palette quotidien",
            f"Définis une palette DESATUREE pour les scènes quotidien.\n"
            f"Lieu: {lieu}\n"
            f"Ambiance: morne, grise, ennuyeuse.\n"
            f"4 couleurs en hexa: toutes froides/grises/ternes.",
            "Palette désaturée, froide, morne",
            schema={"palette": ["#hex1", "#hex2", "#hex3", "#hex4"]},
            validation_level="light"
        )
        self._scenario["palette_quotidien"] = palette_quot.get("palette", ["#9E9E9E", "#BDBDBD", "#E0E0E0", "#F5F5F5"]) if isinstance(palette_quot, dict) else ["#9E9E9E", "#BDBDBD", "#E0E0E0", "#F5F5F5"]

    # ---- PUB P.4: Switch décor ----

    def _pub_step_switch(self, gender_word: str, pronoun: str):
        self.audit.section("PUB P.4: SWITCH DECOR")

        manque = self._scenario.get("manque_analysis", {})

        # Description du décor rêve
        switch_decor = self._ask(
            "P.4.1 Decor reve (post-switch)",
            f"Décris le DECOR DU REVE qui remplacera le décor quotidien.\n\n"
            f"Le personnage sera dans EXACTEMENT la même pose que la fin du quotidien.\n"
            f"Rêve: {self._dream_statement}\n\n"
            f"Le décor doit:\n"
            f"- Correspondre au rêve\n"
            f"- Inclure 1-2 emblèmes reconnaissables du lieu (discrets, en arrière-plan)\n"
            f"- Contraster fortement avec le quotidien (lumineux vs morne)\n"
            f"- Être un lieu REEL et photographiable (pas un monde fantaisie)",
            "Décor cohérent avec le rêve, contraste fort, emblèmes discrets, réaliste",
            schema={
                "description": "description complète du décor",
                "lieu": "lieu précis du rêve",
                "emblemes_visibles": ["embleme1", "embleme2"],
                "eclairage": "type (naturel, doré, lumière du matin, etc.)",
                "arriere_plan": "ce qu'on voit derrière le personnage",
                "contraste_quotidien": "en quoi c'est l'opposé du quotidien"
            },
            rules=RULES_PUB
        )

        # Prompt Gemini pour le switch
        decor = switch_decor if isinstance(switch_decor, dict) else {}
        gemini_prompt = (
            f"Put this {gender_word} in {decor.get('lieu', 'a dream location')}. "
            f"{decor.get('description', '')}. "
            f"Keep EXACTLY the same: face, hair, clothes, pose, expression, body position. "
            f"Change ONLY the environment around {pronoun}. "
            f"Background elements: {', '.join(decor.get('emblemes_visibles', []))}. "
            f"Lighting: warm, natural, cinematic, golden tones. "
            f"No special effects, no portal, no particles, no morphing. "
            f"Photorealistic quality."
        )

        self._scenario["switch_data"] = {
            "decor": decor,
            "gemini_prompt": gemini_prompt,
            "gender": gender_word,
            "pronoun": pronoun,
        }

        self.audit.detail("Gemini prompt", gemini_prompt)

    # ---- PUB P.5: Scènes découverte (SHOCK + EXPLORE) ----

    def _pub_step_decouverte(self):
        """Génère 2 clips découverte enchaînés SANS cut :
        - Clip D (DISCOVERY): choc/surprise extrême, le personnage réalise
        - Clip E (EXPLORE): regarde autour, part explorer
        Contrainte: end_D = start_E (continuité keyframe)
        Même décor, même tenue, même éclairage.
        """
        self.audit.section("PUB P.5: SCENES DECOUVERTE (D + E)")

        switch_decor = self._scenario.get("switch_data", {}).get("decor", {})
        scenes_avant = self._scenario.get("scenes_avant", [])
        last_avant = scenes_avant[-1] if scenes_avant else {}
        last_end_kf = last_avant.get("end_keyframe", {})

        # ---- P.5.1 Proposer 3 attitudes de choc NATURELLES ----
        attitudes = self._ask(
            "P.5.1 Attitudes de choc",
            f"Cette personne est soudainement transportée de son quotidien morne vers son REVE.\n"
            f"Son environnement vient de BASCULER instantanément.\n\n"
            f"Rêve: {self._dream_statement}\n"
            f"Nouveau décor: {switch_decor.get('lieu', '?')}\n"
            f"Pose de départ (figée du quotidien): {last_end_kf.get('pose', '?')}\n\n"
            f"Propose 3 RÉACTIONS PHYSIQUES NATURELLES et CRÉDIBLES pour montrer la surprise.\n"
            f"Le personnage réalise que son environnement a changé — c'est une surprise POSITIVE.\n"
            f"Pense à ce que ferait un ACTEUR DANS UN FILM : réaction SUBTILE mais LISIBLE.\n\n"
            f"INTERDIT: gestes théâtraux, bras écartés, bouche grande ouverte, mains sur la tête.\n"
            f"PRIVILÉGIER: regard qui change, léger recul, sourcils qui se lèvent, bouche entrouverte,\n"
            f"mains qui se posent lentement, corps qui se redresse, respiration qui change.\n\n"
            f"Pour chaque option décris PRÉCISÉMENT:\n"
            f"- Position du corps (debout/assis, penché en avant/arrière)\n"
            f"- Geste des mains (subtil, naturel — PAS de geste ample)\n"
            f"- Expression faciale (naturelle — comme dans un vrai film)\n"
            f"- Direction du regard\n"
            f"- Pourquoi c'est CRÉDIBLE et cinématique\n\n"
            f"IMPORTANT: le mouvement de départ → cette pose doit être faisable en 6 secondes.\n"
            f"Le personnage part de la pose assise/figée et arrive à cette attitude.",
            "3 options distinctes, toutes naturelles et cinématiques — PAS théâtrales",
            schema={
                "options": [
                    {
                        "id": "A",
                        "nom_court": "ex: regard figé, corps redressé",
                        "corps": "position complète du corps",
                        "mains": "position des mains",
                        "visage": "expression faciale détaillée",
                        "regard": "direction du regard",
                        "credibilite": "pourquoi c'est naturel"
                    },
                ]
            },
            validation_level="medium"
        )

        # ---- P.5.2 Choix de la meilleure attitude ----
        chosen = self._ask(
            "P.5.2 Choix attitude choc",
            f"Parmi ces 3 attitudes de choc, choisis la MEILLEURE pour la vidéo.\n\n"
            f"Options: {json.dumps(attitudes, ensure_ascii=False)}\n\n"
            f"Critères:\n"
            f"1. NATURELLE et CINÉMATIQUE — comme un acteur dans un film, PAS théâtrale\n"
            f"2. MOUVEMENT FAISABLE en 6 secondes depuis la pose assise\n"
            f"3. BONNE TRANSITION — la pose doit permettre ensuite de tourner la tête et explorer\n"
            f"4. PAS de geste ample, PAS de bras écartés, PAS de bouche grande ouverte\n"
            f"5. L'émotion se lit dans le REGARD et la posture, pas dans les gestes\n\n"
            f"Réponds avec l'ID de l'option choisie et justifie.",
            "Choix justifié, option naturelle et crédible",
            schema={
                "choix": "A ou B ou C",
                "justification": "pourquoi cette option",
            },
            validation_level="light"
        )

        # Extraire l'attitude choisie
        chosen_id = chosen.get("choix", "A") if isinstance(chosen, dict) else "A"
        options = attitudes.get("options", []) if isinstance(attitudes, dict) else []
        chosen_attitude = next((o for o in options if o.get("id") == chosen_id), options[0] if options else {})

        # ---- P.5.3 Clip D: SHOCK — start = pose figée, end = attitude choc ----

        # Start KF = copie automatique (même pose, décor rêve)
        d_start_kf = {
            "description": f"IDENTIQUE à end_kf quotidien — même pose, même expression, décor changé: {switch_decor.get('lieu', '?')}",
            "pose": last_end_kf.get("pose", ""),
            "expression": last_end_kf.get("expression", "pensive"),
            "expression_intensity": "moderate",
            "gaze_direction": last_end_kf.get("gaze_direction", "away_right"),
            "outfit": last_end_kf.get("outfit", ""),
            "location": switch_decor.get("lieu", ""),
            "note": "Pose identique au end_kf quotidien. Seul le décor a changé. Le personnage n'a PAS ENCORE réagi."
        }

        # End KF = attitude de choc choisie
        d_end_kf = self._ask(
            "P.5.3 End KF clip D (choc)",
            f"Décris la POSE DE SURPRISE FINALE du clip D.\n\n"
            f"Attitude choisie: {json.dumps(chosen_attitude, ensure_ascii=False)}\n"
            f"Décor: {switch_decor.get('lieu', '?')}\n"
            f"Tenue: {last_end_kf.get('outfit', 'same as daily')}\n\n"
            f"Décris la pose EXACTE pour la keyframe:\n"
            f"- Position du corps d'après l'attitude choisie\n"
            f"- Expression faciale NATURELLE — sourcils légèrement levés, bouche entrouverte, regard intense\n"
            f"- Geste des mains SUBTIL (pas de geste ample ou théâtral)\n"
            f"- Direction du regard\n\n"
            f"INTERDIT: bras écartés, mains sur la tête, bouche grande ouverte, yeux écarquillés.\n"
            f"STYLE: comme un plan cinématique — l'émotion passe par le regard et la posture.\n\n"
            f"IMPORTANT: cette pose sera RÉUTILISÉE comme début du clip suivant (exploration).\n"
            f"Le personnage doit pouvoir naturellement passer de cette pose à regarder autour de lui.",
            "Pose de surprise naturelle et cinématique, transition possible vers exploration",
            schema={
                "description": "description complète de la pose de surprise",
                "pose": "position du corps",
                "expression": "expression faciale naturelle (surprise cinématique)",
                "expression_intensity": "moderate",
                "gaze_direction": "up ou ahead",
                "outfit": "même tenue que quotidien",
                "mains": "position des mains (geste subtil)",
            },
            rules=get_rules("personnages", "technique")
        )

        # Transition path D (simple)
        d_transition = self._ask(
            "P.5.4 Transition clip D",
            f"Décris en UNE PHRASE COURTE ce qui se passe pendant le clip D (6 secondes).\n\n"
            f"Début: {d_start_kf.get('pose', '?')}\n"
            f"Fin: {json.dumps(d_end_kf, ensure_ascii=False)}\n\n"
            f"UNE seule action principale. Exemple:\n"
            f"'Character freezes, eyes widen in shock, hands slowly rise to head'\n"
            f"EN ANGLAIS.",
            "Une phrase courte décrivant l'action principale",
            schema={"transition_en": "phrase en anglais"},
            validation_level="light"
        )

        # ---- P.5.5 Clip E: EXPLORE — start = choc figé, end = part explorer ----

        e_start_kf = {
            "description": f"IDENTIQUE à end_kf du clip D — même pose de choc, même décor",
            "pose": d_end_kf.get("pose", "") if isinstance(d_end_kf, dict) else "",
            "expression": d_end_kf.get("expression", "") if isinstance(d_end_kf, dict) else "",
            "expression_intensity": d_end_kf.get("expression_intensity", "pronounced") if isinstance(d_end_kf, dict) else "pronounced",
            "gaze_direction": d_end_kf.get("gaze_direction", "ahead") if isinstance(d_end_kf, dict) else "ahead",
            "outfit": last_end_kf.get("outfit", ""),
            "mains": d_end_kf.get("mains", "") if isinstance(d_end_kf, dict) else "",
            "location": switch_decor.get("lieu", ""),
            "note": "IDENTIQUE au end du clip D. Continuité parfaite."
        }

        e_end_kf = self._ask(
            "P.5.5 End KF clip E (exploration)",
            f"Décris la POSE FINALE du clip E (exploration).\n\n"
            f"Pose de départ (choc): {json.dumps(e_start_kf, ensure_ascii=False)}\n"
            f"Décor: {switch_decor.get('lieu', '?')}\n\n"
            f"Le personnage:\n"
            f"- A baissé les mains (plus en position de choc)\n"
            f"- S'est retourné pour regarder autour de lui\n"
            f"- Commence à sourire franchement\n"
            f"- Fait un premier pas hésitant vers son nouveau monde\n"
            f"- Vue de 3/4 dos ou de dos (il s'éloigne)\n\n"
            f"IMPORTANT: le mouvement doit être LENT (il est encore sous le choc, donc il bouge puis s'arrête, regarde, rebouge).\n"
            f"Même décor, même tenue, même éclairage.",
            "Pose finale montre le personnage partant explorer, vue de dos/3/4 dos",
            schema={
                "description": "description complète de la pose finale (exploration)",
                "pose": "position du corps, orientation (3/4 dos ou dos)",
                "expression": "sourire naissant, émerveillement",
                "expression_intensity": "moderate",
                "gaze_direction": "away (regardant le décor)",
                "outfit": "même tenue",
                "mouvement": "premier pas hésitant vers l'avant",
            },
            rules=get_rules("personnages", "technique")
        )

        # Transition path E (simple)
        e_transition = self._ask(
            "P.5.6 Transition clip E",
            f"Décris en UNE PHRASE COURTE ce qui se passe pendant le clip E (6 secondes).\n\n"
            f"Début: pose de choc figé\n"
            f"Fin: {json.dumps(e_end_kf, ensure_ascii=False)}\n\n"
            f"UNE seule action principale. Exemple:\n"
            f"'Character slowly lowers hands, turns to look around in wonder, takes first hesitant step forward'\n"
            f"EN ANGLAIS.",
            "Une phrase courte décrivant l'action principale",
            schema={"transition_en": "phrase en anglais"},
            validation_level="light"
        )

        # ---- P.5.7 Cadrage (partagé D+E) ----
        cadrage = self._ask(
            "P.5.7 Cadrage decouverte (D+E)",
            f"Définis le CADRAGE pour les 2 clips découverte.\n"
            f"Clip D: personnage passe du figé au choc\n"
            f"Clip E: personnage regarde autour et commence à explorer\n"
            f"Le cadrage doit montrer à la fois le personnage ET le décor rêve.\n"
            f"STATIQUE ou très lent — pas de mouvement brusque.",
            "Cadrage qui montre personnage + décor, stable",
            schema={
                "type_plan": "medium_full",
                "mouvement_camera": "static",
                "angle": "eye_level",
            },
            rules=get_rules("cadrage"),
            validation_level="light"
        )

        # ---- P.5.8 Prompts vidéo EN pour D et E ----
        prompt_d = self._ask(
            "P.5.8a Prompt video clip D",
            f"Generate a SHORT, SIMPLE video prompt in English for clip D (shock).\n\n"
            f"Start: {d_start_kf.get('pose', '?')} in {switch_decor.get('lieu', '?')}\n"
            f"End: {json.dumps(d_end_kf, ensure_ascii=False)}\n"
            f"Action: {d_transition.get('transition_en', '') if isinstance(d_transition, dict) else ''}\n\n"
            f"KEEP IT SIMPLE — 2-3 sentences maximum.\n"
            f"Focus on the main action, not step-by-step choreography.\n"
            f"The video model works best with short, clear prompts.\n"
            f"Both prompt_en and resume_fr are REQUIRED.",
            "Prompt court et clair, 2-3 phrases max",
            schema={
                "prompt_en": "Short prompt in English (2-3 sentences)",
                "resume_fr": "Résumé en français (1-2 phrases)"
            },
            validation_level="light"
        )

        prompt_e = self._ask(
            "P.5.8b Prompt video clip E",
            f"Generate a SHORT, SIMPLE video prompt in English for clip E (exploration).\n\n"
            f"Start: frozen in shock pose\n"
            f"End: {json.dumps(e_end_kf, ensure_ascii=False)}\n"
            f"Action: {e_transition.get('transition_en', '') if isinstance(e_transition, dict) else ''}\n\n"
            f"KEEP IT SIMPLE — 2-3 sentences maximum.\n"
            f"The character moves SLOWLY (still stunned).\n"
            f"Both prompt_en and resume_fr are REQUIRED.",
            "Prompt court et clair, 2-3 phrases max",
            schema={
                "prompt_en": "Short prompt in English (2-3 sentences)",
                "resume_fr": "Résumé en français (1-2 phrases)"
            },
            validation_level="light"
        )

        # Stocker les 2 scènes
        self._scenario["scene_decouverte"] = {
            "scene_id": "D",
            "phase": "DISCOVERY",
            "chosen_attitude": chosen_attitude,
            "start_keyframe": d_start_kf,
            "end_keyframe": d_end_kf if isinstance(d_end_kf, dict) else {},
            "transition_path": d_transition.get("transition_en", "") if isinstance(d_transition, dict) else "",
            "cadrage": cadrage if isinstance(cadrage, dict) else {},
            "prompt_video": prompt_d if isinstance(prompt_d, dict) else {},
        }

        self._scenario["scene_explore"] = {
            "scene_id": "E",
            "phase": "EXPLORE",
            "start_keyframe": e_start_kf,
            "end_keyframe": e_end_kf if isinstance(e_end_kf, dict) else {},
            "transition_path": e_transition.get("transition_en", "") if isinstance(e_transition, dict) else "",
            "cadrage": cadrage if isinstance(cadrage, dict) else {},
            "prompt_video": prompt_e if isinstance(prompt_e, dict) else {},
        }

    # ---- PUB P.5b: Palette rêve ----

    def _pub_step_palette_reve(self):
        """Génère la palette rêve (pour D, E, et dream scenes)."""
        self.audit.section("PUB P.5b: PALETTE REVE")
        palette_reve = self._ask(
            "P.5b Palette reve",
            f"Définis une palette VIVANTE et LUMINEUSE pour les scènes de rêve.\n"
            f"Rêve: {self._dream_statement}\n"
            f"Décor rêve: {self._scenario.get('switch_data', {}).get('decor', {}).get('lieu', '?')}\n"
            f"Doit CONTRASTER fortement avec la palette quotidien ({self._scenario.get('palette_quotidien', [])}).\n"
            f"5 couleurs en hexa.",
            "Palette vivante, lumineuse, contraste avec quotidien",
            schema={
                "principale": "#hex",
                "secondaire": "#hex",
                "accent": "#hex",
                "neutre_clair": "#hex",
                "neutre_fonce": "#hex"
            },
            rules=get_rules("coherence"),
            validation_level="light"
        )
        self._scenario["palette_globale"] = palette_reve

    # ---- PUB P.6: Dream scenes (réutilise v7) ----

    def _pub_step_dream_scenes(self, nb_dream: int):
        """Génère les scènes de rêve en utilisant les étapes v7 standard."""
        self.audit.section("PUB P.6: DREAM SCENES (V7)")

        # Sauvegarder le contexte, ajouter info pub
        orig_context = self._context
        self._context += (
            f"\n\nMODE PUB: Les scènes de rêve suivent le switch. "
            f"same_day = FALSE. Le personnage peut changer de tenue entre les scènes.\n"
            f"Décor rêve: {self._scenario.get('switch_data', {}).get('decor', {}).get('lieu', '?')}"
        )
        self._nb_scenes = nb_dream

        # Exécuter les étapes v7 standard pour les dream scenes
        self._step3_decoupage_scenes()
        self._step4_parametres_scenes()
        self._step5_keyframes()
        self._step6_pitchs_individuels()
        self._step7_attitudes()

        self._step8_palettes()
        self._step9_cadrage()
        self._step10_rythme()
        self._step11_prompts_finaux()

        # Restaurer contexte
        self._context = orig_context

    # ---- PUB: Conversion vers format pipeline ----

    def convert_pub_v7_to_pipeline(self, pub_scenario: Dict) -> Tuple[Dict, List[Dict], Dict]:
        """Convertit la sortie pub v7 vers le format pipeline.

        Returns:
            (global_scenario, video_scenarios, scene_palettes)
        """
        scenes_avant = pub_scenario.get("scenes_avant", [])
        scene_decouverte = pub_scenario.get("scene_decouverte", {})
        palette_quot = pub_scenario.get("palette_quotidien", ["#9E9E9E", "#BDBDBD", "#E0E0E0", "#F5F5F5"])
        palette_reve_raw = pub_scenario.get("palette_globale", {})

        # Palette rêve en liste
        if isinstance(palette_reve_raw, dict):
            palette_reve = [
                palette_reve_raw.get("principale", "#4A90D9"),
                palette_reve_raw.get("secondaire", "#F5A623"),
                palette_reve_raw.get("accent", "#7ED321"),
                palette_reve_raw.get("neutre_clair", "#F5F5F5"),
                palette_reve_raw.get("neutre_fonce", "#2C3E50"),
            ]
        else:
            palette_reve = palette_reve_raw if isinstance(palette_reve_raw, list) else ["#4A90D9", "#F5A623", "#7ED321", "#F5F5F5", "#2C3E50"]

        # 1. Construire global_scenario.scenes
        all_scenes = []
        video_scenarios = []
        scene_palettes = {}

        # Scènes avant
        for sa in scenes_avant:
            sid = sa["scene_id"]
            params = sa.get("params", {})
            cad = sa.get("cadrage", {})
            pv = sa.get("prompt_video", {})

            all_scenes.append({
                "id": sid,
                "type": "PRE_SWITCH",
                "phase": "PRE_SWITCH",
                "concept": f"Quotidien - {params.get('lieu_precis', '?')}",
                "context": params.get("action", ""),
                "emotional_beat": "ennui, lassitude",
                "time_of_day": "morning",
                "indoor": True,
                "is_pov": False,
                "allows_camera_look": False,
            })

            start_kf = sa.get("start_keyframe", {})
            end_kf = sa.get("end_keyframe", {})

            video_scenarios.append({
                "scene_id": sid,
                "phase": "PRE_SWITCH",
                "is_pov": False,
                "start_keyframe": {
                    "description": start_kf.get("description", ""),
                    "location": params.get("lieu_precis", ""),
                    "pose": start_kf.get("pose", ""),
                    "expression": start_kf.get("expression", "lassitude"),
                    "expression_intensity": start_kf.get("expression_intensity", "moderate"),
                    "gaze_direction": start_kf.get("gaze_direction", "down"),
                    "outfit": start_kf.get("outfit", params.get("tenue_protagoniste", "")),
                    "accessories": "",
                },
                "end_keyframe": {
                    "description": end_kf.get("description", ""),
                    "location": params.get("lieu_precis", ""),
                    "pose": end_kf.get("pose", ""),
                    "expression": end_kf.get("expression", "pensive"),
                    "expression_intensity": end_kf.get("expression_intensity", "moderate"),
                    "gaze_direction": end_kf.get("gaze_direction", "away_right"),
                    "outfit": end_kf.get("outfit", ""),
                    "accessories": "",
                },
                "action": params.get("action", ""),
                "transition_path": sa.get("transition_path", ""),
                "shooting": {
                    "shot_type": self._map_shot_type(cad.get("type_plan", "plan moyen")),
                    "camera_angle": self._map_angle(cad.get("angle", "niveau des yeux")),
                    "camera_movement": self._map_camera_movement(cad.get("mouvement_camera", "fixe")),
                    "lighting_direction": "front",
                    "lighting_temperature": "cool",
                    "depth_of_field": "medium",
                    "focus_on": "full_body",
                },
                "prompt_video": pv.get("prompt_en", "") if isinstance(pv, dict) else str(pv),
            })

            scene_palettes[sid] = palette_quot

        # Scène découverte D (SHOCK)
        d_start = scene_decouverte.get("start_keyframe", {})
        d_end = scene_decouverte.get("end_keyframe", {})
        d_cad = scene_decouverte.get("cadrage", {})
        d_pv = scene_decouverte.get("prompt_video", {})

        all_scenes.append({
            "id": "D",
            "type": "DISCOVERY",
            "phase": "DISCOVERY",
            "concept": "Choc — réalise que le décor a changé",
            "context": pub_scenario.get("switch_data", {}).get("decor", {}).get("lieu", ""),
            "emotional_beat": "choc → stupéfaction → incrédulité",
            "time_of_day": "morning",
            "indoor": False,
            "is_pov": False,
            "allows_camera_look": False,
        })

        video_scenarios.append({
            "scene_id": "D",
            "phase": "DISCOVERY",
            "is_pov": False,
            "start_keyframe": {
                "description": d_start.get("description", ""),
                "location": d_start.get("location", ""),
                "pose": d_start.get("pose", ""),
                "expression": d_start.get("expression", "pensive"),
                "expression_intensity": d_start.get("expression_intensity", "moderate"),
                "gaze_direction": d_start.get("gaze_direction", "away_right"),
                "outfit": d_start.get("outfit", ""),
                "accessories": "",
            },
            "end_keyframe": {
                "description": d_end.get("description", ""),
                "location": d_start.get("location", ""),
                "pose": d_end.get("pose", ""),
                "expression": d_end.get("expression", "choc, stupéfaction"),
                "expression_intensity": d_end.get("expression_intensity", "pronounced"),
                "gaze_direction": d_end.get("gaze_direction", "up"),
                "outfit": d_end.get("outfit", ""),
                "accessories": "",
            },
            "action": scene_decouverte.get("transition_path", "Character freezes in shock, realizing surroundings changed"),
            "transition_path": scene_decouverte.get("transition_path", ""),
            "shooting": {
                "shot_type": self._map_shot_type(d_cad.get("type_plan", "medium_full")),
                "camera_angle": self._map_angle(d_cad.get("angle", "eye_level")),
                "camera_movement": self._map_camera_movement(d_cad.get("mouvement_camera", "static")),
                "lighting_direction": "side",
                "lighting_temperature": "warm",
                "depth_of_field": "medium",
                "focus_on": "full_body",
            },
            "prompt_video": d_pv.get("prompt_en", "") if isinstance(d_pv, dict) else str(d_pv),
        })

        scene_palettes["D"] = palette_reve

        # Scène explore E (EXPLORE) — chaînée avec D
        scene_explore = pub_scenario.get("scene_explore", {})
        e_start = scene_explore.get("start_keyframe", {})
        e_end = scene_explore.get("end_keyframe", {})
        e_cad = scene_explore.get("cadrage", d_cad)  # Même cadrage que D par défaut
        e_pv = scene_explore.get("prompt_video", {})

        all_scenes.append({
            "id": "E",
            "type": "EXPLORE",
            "phase": "EXPLORE",
            "concept": "Exploration — regarde autour et part découvrir",
            "context": pub_scenario.get("switch_data", {}).get("decor", {}).get("lieu", ""),
            "emotional_beat": "émerveillement → joie → premier pas",
            "time_of_day": "morning",
            "indoor": False,
            "is_pov": False,
            "allows_camera_look": False,
        })

        video_scenarios.append({
            "scene_id": "E",
            "phase": "EXPLORE",
            "is_pov": False,
            "start_keyframe": {
                "description": e_start.get("description", d_end.get("description", "")),
                "location": d_start.get("location", ""),
                "pose": e_start.get("pose", d_end.get("pose", "")),
                "expression": e_start.get("expression", d_end.get("expression", "")),
                "expression_intensity": e_start.get("expression_intensity", "pronounced"),
                "gaze_direction": e_start.get("gaze_direction", d_end.get("gaze_direction", "up")),
                "outfit": e_start.get("outfit", d_start.get("outfit", "")),
                "accessories": "",
            },
            "end_keyframe": {
                "description": e_end.get("description", ""),
                "location": d_start.get("location", ""),
                "pose": e_end.get("pose", ""),
                "expression": e_end.get("expression", "sourire, émerveillement"),
                "expression_intensity": e_end.get("expression_intensity", "moderate"),
                "gaze_direction": e_end.get("gaze_direction", "away"),
                "outfit": e_end.get("outfit", d_start.get("outfit", "")),
                "accessories": "",
            },
            "action": scene_explore.get("transition_path", "Character slowly looks around in wonder, takes first steps to explore"),
            "transition_path": scene_explore.get("transition_path", ""),
            "shooting": {
                "shot_type": self._map_shot_type(e_cad.get("type_plan", "medium_full")),
                "camera_angle": self._map_angle(e_cad.get("angle", "eye_level")),
                "camera_movement": self._map_camera_movement(e_cad.get("mouvement_camera", "static")),
                "lighting_direction": "side",
                "lighting_temperature": "warm",
                "depth_of_field": "medium",
                "focus_on": "full_body",
            },
            "prompt_video": e_pv.get("prompt_en", "") if isinstance(e_pv, dict) else str(e_pv),
        })

        scene_palettes["E"] = palette_reve

        # Dream scenes (format v7 standard)
        decoupage = pub_scenario.get("decoupage", [])
        params_list = pub_scenario.get("parametres_scenes", [])
        keyframes_list = pub_scenario.get("keyframes", [])
        attitudes_list = pub_scenario.get("attitudes", [])
        palettes_list = pub_scenario.get("palettes_scenes", [])
        cadrages_list = pub_scenario.get("cadrages", [])
        prompts_list = pub_scenario.get("prompts_video", [])

        for i, dec in enumerate(decoupage):
            if not isinstance(dec, dict):
                dec = {"id": i + 1, "titre": str(dec)}
            scene_id = dec.get("id", i + 1)
            params = self._get_item(params_list, i, {})
            kf = self._get_item(keyframes_list, i, {})
            att = self._get_item(attitudes_list, i, {})
            cad = self._get_item(cadrages_list, i, {})
            prompt_v = self._get_item(prompts_list, i, {})
            is_last = i == len(decoupage) - 1

            if not isinstance(params, dict):
                params = {}
            if not isinstance(kf, dict):
                kf = {}
            if not isinstance(att, dict):
                att = {}
            if not isinstance(cad, dict):
                cad = {}

            kf_start = kf.get("start", {}) if isinstance(kf.get("start"), dict) else {}
            kf_end = kf.get("end", {}) if isinstance(kf.get("end"), dict) else {}

            all_scenes.append({
                "id": scene_id,
                "type": "ACCOMPLISSEMENT" if is_last else "ACTION",
                "phase": "DREAM",
                "concept": dec.get("titre", ""),
                "context": dec.get("action", ""),
                "emotional_beat": dec.get("vers", ""),
                "time_of_day": self._extract_time(params),
                "indoor": False,
                "is_pov": False,
                "allows_camera_look": is_last,
            })

            outfit_ref = pub_scenario.get("outfit_reference", {})
            outfit_text = params.get("tenue_protagoniste", outfit_ref.get("text", ""))
            outfit_items = params.get("outfit_items", outfit_ref.get("items", []))

            pitch_text = ""
            pitchs = pub_scenario.get("pitchs", [])
            pitch_data = self._get_item(pitchs, i, {})
            if isinstance(pitch_data, dict):
                pitch_text = pitch_data.get("pitch", "")

            start_desc = self._build_kf_description(kf_start, params, pitch_text)
            end_desc = self._build_kf_description(kf_end, params, "")

            video_scenarios.append({
                "scene_id": scene_id,
                "phase": "DREAM",
                "is_pov": False,
                "start_keyframe": {
                    "description": start_desc,
                    "location": params.get("lieu_precis", ""),
                    "pose": kf_start.get("position_protagoniste", ""),
                    "expression": kf_start.get("emotion", ""),
                    "expression_intensity": "moderate",
                    "gaze_direction": "away",
                    "outfit": outfit_text,
                    "outfit_items": outfit_items,
                    "accessories": "",
                },
                "end_keyframe": {
                    "description": end_desc,
                    "location": params.get("lieu_precis", ""),
                    "pose": kf_end.get("position_protagoniste", ""),
                    "expression": kf_end.get("emotion", ""),
                    "expression_intensity": "moderate",
                    "gaze_direction": "camera" if is_last else "away",
                    "outfit": outfit_text,
                    "outfit_items": outfit_items,
                    "accessories": "",
                },
                "action": att.get("deplacement", kf.get("action", "")),
                "transition_path": kf.get("transition_path", ""),
                "shooting": {
                    "shot_type": self._map_shot_type(cad.get("type_plan", "plan moyen")),
                    "camera_angle": self._map_angle(cad.get("angle", "niveau des yeux")),
                    "camera_movement": self._map_camera_movement(cad.get("mouvement_camera", "fixe")),
                    "lighting_direction": "side",
                    "lighting_temperature": "warm",
                    "depth_of_field": "medium",
                    "focus_on": "full_body",
                },
                "attitude": att,
                "prompt_video": prompt_v.get("prompt", "") if isinstance(prompt_v, dict) else str(prompt_v),
            })

            # Palette par scène
            pal = self._get_item(palettes_list, i, {})
            if isinstance(pal, dict):
                palette_globale = pub_scenario.get("palette_globale", {})
                if not isinstance(palette_globale, dict):
                    palette_globale = {}
                scene_palettes[scene_id] = [
                    pal.get("dominante", palette_globale.get("principale", "#444444")),
                    pal.get("accent", palette_globale.get("accent", "#888888")),
                    palette_globale.get("neutre_clair", "#CCCCCC"),
                    palette_globale.get("neutre_fonce", "#222222"),
                ]
            else:
                scene_palettes[scene_id] = palette_reve

        # Global scenario
        global_scenario = {
            "title": self._extract_title(pub_scenario.get("pitch_global", ""), pub_scenario.get("dream_title")),
            "mode": "scenario_pub",
            "same_day": False,
            "scenes": all_scenes,
            "switch_data": pub_scenario.get("switch_data", {}),
            "manque_analysis": pub_scenario.get("manque_analysis", {}),
            "palette_quotidien": palette_quot,
            "palette_reve": palette_reve,
            "pitch_global": pub_scenario.get("pitch_global"),
        }

        return global_scenario, video_scenarios, scene_palettes

    # ---- PUB: Mock (dry run) ----

    def _mock_pub_v7(self, name: str, nb_avant: int, nb_dream: int) -> Dict:
        scenes_avant = []
        for i in range(nb_avant):
            sid = f"0{chr(65 + i)}"
            scenes_avant.append({
                "scene_id": sid,
                "phase": "PRE_SWITCH",
                "params": {"lieu_precis": "Bureau morne", "action": "Travaille sans enthousiasme"},
                "start_keyframe": {"description": "Au bureau", "pose": "Assis, voûté", "expression": "Ennui", "expression_intensity": "moderate", "gaze_direction": "down", "outfit": "Chemise grise"},
                "end_keyframe": {"description": "Pose figée", "pose": "Regarde la fenêtre", "expression": "Pensive", "expression_intensity": "moderate", "gaze_direction": "away_right", "outfit": "Chemise grise", "orientation_corps": "trois_quarts_droite"},
                "cadrage": {"type_plan": "plan moyen", "mouvement_camera": "fixe", "angle": "niveau des yeux"},
                "prompt_video": {"prompt_en": f"Prompt quotidien {sid}", "resume_fr": f"Scène quotidien {sid}"},
                "is_last_avant": i == nb_avant - 1,
            })

        return {
            "manque_analysis": {"etat": "ROUTINE", "emotions": ["ennui", "lassitude"], "contexte_choisi": "bureau", "situation": {"situation": "Travaille sans enthousiasme"}},
            "pitch_global": f"Pitch pub de {name}",
            "scenes_avant": scenes_avant,
            "palette_quotidien": ["#9E9E9E", "#BDBDBD", "#E0E0E0", "#F5F5F5"],
            "switch_data": {"decor": {"lieu": "Lieu de rêve", "description": "Lieu magnifique"}, "gemini_prompt": "Put this person in a dream location...", "gender": "woman", "pronoun": "her"},
            "scene_decouverte": {
                "scene_id": "D", "phase": "DISCOVERY",
                "start_keyframe": {"description": "Même pose, décor rêve", "pose": "Regarde la fenêtre", "expression": "Pensive"},
                "end_keyframe": {"description": "Choc total", "pose": "Debout, mains sur la tête", "expression": "Stupéfaction, yeux écarquillés", "expression_intensity": "pronounced"},
                "transition_path": "Character freezes, eyes widen, hands slowly rise to head in disbelief",
                "cadrage": {"type_plan": "medium_full", "mouvement_camera": "static", "angle": "eye_level"},
                "prompt_video": {"prompt_en": "Character freezes in shock as they realize surroundings changed.", "resume_fr": "Choc de la découverte"},
            },
            "scene_explore": {
                "scene_id": "E", "phase": "EXPLORE",
                "start_keyframe": {"description": "Même pose choc que end D", "pose": "Debout, mains sur la tête", "expression": "Stupéfaction"},
                "end_keyframe": {"description": "Part explorer", "pose": "3/4 dos, premier pas", "expression": "Sourire émerveillé", "mouvement": "premier pas hésitant"},
                "transition_path": "Character slowly lowers hands, turns to look around in wonder, takes first hesitant step",
                "cadrage": {"type_plan": "medium_full", "mouvement_camera": "static", "angle": "eye_level"},
                "prompt_video": {"prompt_en": "Character slowly lowers hands and turns to explore the new world.", "resume_fr": "Exploration du nouveau monde"},
            },
            **self._mock_v7(name, nb_dream),
            "metadata": {"mode": "scenario_pub", "nb_scenes_avant": nb_avant, "nb_dream_scenes": nb_dream},
        }

    # =========================================================================
    # V7: LES 11 ÉTAPES
    # =========================================================================

    def _step1_blocages_emotionnels(self):
        self.audit.section("ETAPE 1: BLOCAGES EMOTIONNELS")

        blocages = self._ask(
            "1.1 Blocages potentiels",
            f"Quels BLOCAGES EMOTIONNELS ce reve pourrait soulever chez la personne ? "
            f"(ex: 'pas assez belle', 'je ne merite pas', 'peur de l'abandon'). "
            f"Liste 3-5 blocages typiques pour ce type de reve.",
            "Les blocages sont realistes et pertinents pour ce type de reve",
            schema={"blocages": ["blocage 1", "blocage 2", "..."]},
            rules=get_rules("format"),
            validation_level="light"
        )

        affirmations = self._ask(
            "1.2 Affirmations positives",
            f"Pour chaque blocage identifie ({blocages}), quelle est l'AFFIRMATION POSITIVE opposee ? "
            f"(ex: 'je merite l'amour', 'je suis prete')",
            "Les affirmations sont l'oppose direct des blocages",
            schema={"affirmations": ["affirmation 1", "affirmation 2", "..."]},
            rules=get_rules("format"),
            validation_level="light"
        )

        self._scenario["blocages_emotionnels"] = {
            "blocages": blocages.get("blocages", []) if isinstance(blocages, dict) else blocages,
            "affirmations": affirmations.get("affirmations", []) if isinstance(affirmations, dict) else affirmations,
        }

    def _step2_pitch_global(self):
        self.audit.section("ETAPE 2: PITCH GLOBAL")

        pitch = self._ask(
            "2.1 Pitch global",
            f"Ecris un PITCH GLOBAL detaille du scenario en {self._nb_scenes} scenes. "
            f"Description narrative complete de l'histoire, du debut a l'accomplissement. "
            f"Style neutre, 3eme personne, pas de 'vous'.",
            "Le pitch couvre l'arc narratif complet avec progression emotionnelle",
            rules=get_rules("narratives", "format")
        )

        self._scenario["pitch_global"] = pitch
        self._generate_dream_title(pitch)

    def _step3_decoupage_scenes(self):
        self.audit.section("ETAPE 3: DECOUPAGE EN SCENES")

        decoupage = self._ask(
            "3.1 Decoupage",
            f"Decoupe le scenario en exactement {self._nb_scenes} scenes. "
            f"Pour chaque scene: que se passe-t-il ? D'ou part-on, ou va-t-on emotionnellement ? "
            f"PAS de details de decor a ce stade.\n\n"
            f"REGLES DE DIVERSITE VISUELLE:\n"
            f"- Chaque scene DOIT avoir une ACTION VISUELLEMENT DISTINCTE (pas deux scenes de contemplation/meditation/marche).\n"
            f"- Varier les situations: interaction avec d'autres, travail physique, decouverte, moment d'emotion, celebration...\n"
            f"- L'emotion doit MONTER progressivement: de la decouverte vers l'accomplissement.\n"
            f"- La derniere scene est le CLIMAX emotionnel (accomplissement visible et concret).\n"
            f"- C'est une video de VISUALISATION (pas un court-metrage): chaque scene = une IMAGE FORTE, pas une narration complexe.",
            "La decoupe est coherente avec l'intention du reve, les scenes sont visuellement distinctes, l'emotion monte",
            schema={
                "scenes": [
                    {"id": 1, "titre": "...", "de": "etat initial", "vers": "etat suivant", "action": "action visible et concrete"}
                ]
            },
            rules=get_rules("narratives", "format"),
            validation_level="medium"
        )

        self._scenario["decoupage"] = decoupage.get("scenes", []) if isinstance(decoupage, dict) else decoupage

    def _step4_parametres_scenes(self):
        self.audit.section("ETAPE 4: PARAMETRES PAR SCENE")

        scenes = self._scenario.get("decoupage", [])
        iconic = self._dream_elements.get("iconic_elements", [])
        iconic_text = ", ".join(iconic) if iconic else "aucun"

        # ── SCENE 1: Définir la tenue structurée de référence (séquentiel) ──
        first_scene = scenes[0] if scenes else {}
        s1_id = first_scene.get("id", 1) if isinstance(first_scene, dict) else 1
        s1_titre = first_scene.get("titre", "Scene 1") if isinstance(first_scene, dict) else "Scene 1"

        p1 = self._ask(
            f"4.1 Parametres scene {s1_id}: {s1_titre}",
            f"Pour la scene '{s1_titre}' ({first_scene}), definis: "
            f"OU precisement ? QUAND precisement ? QUELLE ACTION ?\n"
            f"TENUE DU PROTAGONISTE: Definis CHAQUE ELEMENT de la tenue sous forme structuree "
            f"(vetement, couleur precise, motif, matiere). Ex: manteau gris anthracite uni en laine, "
            f"echarpe bleu marine unie en cachemire, pantalon noir uni en coton, bottines marron en cuir.\n"
            f"IMPORTANT: Remplis le champ 'outfit_items' avec un tableau JSON precis.\n"
            f"ELEMENTS EMBLEMATIQUES DU REVE (a integrer dans le decor si pertinent): {iconic_text}",
            "Les parametres sont coherents avec le lieu global et l'action de la scene, "
            "les elements emblematiques sont presents dans le decor si pertinent, "
            "la tenue est decrite element par element avec couleur et motif dans outfit_items",
            schema={
                "lieu_precis": "...",
                "moment": "heure et lumiere",
                "action": "description action",
                "tenue_protagoniste": "description textuelle complete de la tenue",
                "outfit_items": [
                    {"item": "nom du vetement/accessoire", "color": "couleur precise", "pattern": "uni/raye/ecossais/...", "material": "matiere"}
                ],
                "tenue_partenaire": "... (ou vide si absent)"
            },
            rules=get_rules("personnages", "coherence", "format"),
            validation_level="medium"
        )

        params_1 = {"scene_id": s1_id, **(p1 if isinstance(p1, dict) else {"data": p1})}

        # Extraire et stocker la tenue de référence
        outfit_items = params_1.get("outfit_items", [])
        outfit_text = params_1.get("tenue_protagoniste", "")
        if not outfit_items and outfit_text:
            outfit_items = [{"item": outfit_text, "color": "", "pattern": "", "material": ""}]
        self._outfit_reference = {"text": outfit_text, "items": outfit_items}
        self._scenario["outfit_reference"] = self._outfit_reference
        self.audit.detail("Tenue de reference", self._outfit_reference)

        # ── SCENES 2+: Injecter la tenue de référence (parallèle) ──
        def _process(i, scene):
            scene_id = scene.get("id", i + 1) if isinstance(scene, dict) else i + 1
            scene_titre = scene.get("titre", f"Scene {i + 1}") if isinstance(scene, dict) else f"Scene {i + 1}"
            outfit_ref_json = json.dumps(self._outfit_reference["items"], ensure_ascii=False)

            p = self._ask(
                f"4.{i + 1} Parametres scene {scene_id}: {scene_titre}",
                f"Pour la scene '{scene_titre}' ({scene}), definis: "
                f"OU precisement ? QUAND precisement ? QUELLE ACTION ?\n"
                f"TENUE: Scenario SAME_DAY — la tenue est IDENTIQUE a la scene 1.\n"
                f"TENUE DE REFERENCE (NE PAS MODIFIER, recopier tel quel):\n{outfit_ref_json}\n"
                f"Description: {self._outfit_reference['text']}\n"
                f"ELEMENTS EMBLEMATIQUES DU REVE (a integrer dans le decor si pertinent): {iconic_text}",
                "Les parametres sont coherents avec le lieu global et l'action de la scene, "
                "la tenue est STRICTEMENT IDENTIQUE a la scene 1 (memes items, couleurs, motifs)",
                schema={
                    "lieu_precis": "...",
                    "moment": "heure et lumiere",
                    "action": "description action",
                    "tenue_protagoniste": self._outfit_reference["text"],
                    "outfit_items": self._outfit_reference["items"],
                    "tenue_partenaire": "... (ou vide si absent)"
                },
                rules=get_rules("personnages", "coherence", "format"),
                validation_level="medium"
            )
            return i, {"scene_id": scene_id, **(p if isinstance(p, dict) else {"data": p})}

        params = [None] * len(scenes)
        params[0] = params_1

        if len(scenes) > 1:
            remaining = [(i, s) for i, s in enumerate(scenes) if i > 0]
            with ThreadPoolExecutor(max_workers=len(remaining)) as executor:
                futures = [executor.submit(_process, i, s) for i, s in remaining]
                for future in as_completed(futures):
                    idx, result = future.result()
                    params[idx] = result

        self._scenario["parametres_scenes"] = params

    def _step5_keyframes(self):
        self.audit.section("ETAPE 5: KEYFRAMES")

        scenes = self._scenario.get("decoupage", [])
        params_list = self._scenario.get("parametres_scenes", [])
        iconic = self._dream_elements.get("iconic_elements", [])
        iconic_text = ", ".join(iconic) if iconic else "aucun"

        def _process(i, scene):
            scene_id = scene.get("id", i + 1) if isinstance(scene, dict) else i + 1
            params = self._get_item(params_list, i, {})

            lieu = params.get('lieu_precis', '?') if isinstance(params, dict) else '?'
            action = params.get('action', '?') if isinstance(params, dict) else '?'
            tenue = params.get('tenue_protagoniste', '') if isinstance(params, dict) else ''

            # Outfit de référence structuré
            outfit_ref = getattr(self, '_outfit_reference', {})
            outfit_ref_json = json.dumps(outfit_ref.get("items", []), ensure_ascii=False) if outfit_ref else ""
            outfit_instruction = (
                f"TENUE DE REFERENCE (OBLIGATOIRE, ne pas modifier):\n{outfit_ref_json}\n"
                f"Description: {outfit_ref.get('text', tenue)}\n"
                if outfit_ref and outfit_ref.get("items") else
                f"Tenue: {tenue}\n"
            )

            kf = self._ask(
                f"5.{i + 1} Keyframes scene {scene_id}",
                f"Pour la scene {scene_id} (lieu: {lieu}, action: {action}), "
                f"decris le KEYFRAME DE DEBUT et le KEYFRAME DE FIN. "
                f"Position precise des personnages, emotion, gestes, interaction. "
                f"Style neutre, 3eme personne.\n"
                f"{outfit_instruction}"
                f"REGLE DE CONTINUITE: La tenue et les accessoires (chapeau, lunettes, bijoux, sac) "
                f"doivent etre IDENTIQUES entre start et end — rien n'apparait, rien ne disparait.\n"
                f"ELEMENTS EMBLEMATIQUES (doivent etre visibles dans le decor si pertinent): {iconic_text}\n"
                f"TRANSITION: Decris aussi le CHEMIN VISUEL de start a end. Comment le personnage "
                f"passe visuellement de la situation start a la situation end en 6 secondes ? "
                f"Ce chemin doit rendre le changement LOGIQUE et FLUIDE pour le generateur de video.",
                "Les keyframes sont photographiables, positions precises, emotions positives, "
                "elements emblematiques presents dans le decor",
                schema={
                    "start": {
                        "position_protagoniste": "...",
                        "position_partenaire": "...",
                        "emotion": "...",
                        "geste": "...",
                        "interaction": "..."
                    },
                    "end": {
                        "position_protagoniste": "...",
                        "position_partenaire": "...",
                        "emotion": "...",
                        "geste": "...",
                        "interaction": "..."
                    },
                    "transition_path": "Description du chemin visuel de start a end en 6s (ex: 'Claire traverse le marche, salue les marchands et rejoint le centre du village')"
                },
                rules=get_rules("personnages", "technique", "format")
            )
            return i, {"scene_id": scene_id, **(kf if isinstance(kf, dict) else {"data": kf})}

        keyframes = [None] * len(scenes)
        with ThreadPoolExecutor(max_workers=len(scenes)) as executor:
            futures = [executor.submit(_process, i, s) for i, s in enumerate(scenes)]
            for future in as_completed(futures):
                idx, result = future.result()
                keyframes[idx] = result

        self._scenario["keyframes"] = keyframes

    def _step6_pitchs_individuels(self):
        self.audit.section("ETAPE 6: PITCHS INDIVIDUELS")

        scenes = self._scenario.get("decoupage", [])
        params_list = self._scenario.get("parametres_scenes", [])
        iconic = self._dream_elements.get("iconic_elements", [])
        iconic_text = ", ".join(iconic) if iconic else ""

        def _process(i, scene):
            scene_id = scene.get("id", i + 1) if isinstance(scene, dict) else i + 1
            params = self._get_item(params_list, i, {})

            iconic_instruction = (
                f"\nELEMENTS EMBLEMATIQUES A MENTIONNER dans le pitch si pertinent: {iconic_text}"
                if iconic_text else ""
            )

            pitch = self._ask(
                f"6.{i + 1} Pitch scene {scene_id}",
                f"Ecris le PITCH NARRATIF de la scene {scene_id}. "
                f"Lieu: {params.get('lieu_precis', '?') if isinstance(params, dict) else '?'}. "
                f"Action: {params.get('action', '?') if isinstance(params, dict) else '?'}. "
                f"Style neutre, 3eme personne, JAMAIS de 'vous' ou 'imaginez'."
                f"{iconic_instruction}",
                "Le pitch est narratif, fluide, style professionnel, pas de 'vous', "
                "elements emblematiques integres naturellement",
                rules=get_rules("narratives", "format"),
                validation_level="medium"
            )
            return i, {"scene_id": scene_id, "pitch": pitch}

        pitchs = [None] * len(scenes)
        with ThreadPoolExecutor(max_workers=len(scenes)) as executor:
            futures = [executor.submit(_process, i, s) for i, s in enumerate(scenes)]
            for future in as_completed(futures):
                idx, result = future.result()
                pitchs[idx] = result

        self._scenario["pitchs"] = pitchs

    def _step7_attitudes(self):
        self.audit.section("ETAPE 7: ATTITUDES ET DEPLACEMENTS")

        scenes = self._scenario.get("decoupage", [])
        keyframes_list = self._scenario.get("keyframes", [])
        params_list = self._scenario.get("parametres_scenes", [])

        def _process(i, scene):
            scene_id = scene.get("id", i + 1) if isinstance(scene, dict) else i + 1
            kf = self._get_item(keyframes_list, i, {})
            params = self._get_item(params_list, i, {})
            scene_action = scene.get("action", "?") if isinstance(scene, dict) else "?"
            lieu = params.get("lieu_precis", "?") if isinstance(params, dict) else "?"

            att = self._ask(
                f"7.{i + 1} Attitude scene {scene_id}",
                f"Pour la scene {scene_id} (lieu: {lieu}, action: {scene_action}), "
                f"decris l'ATTITUDE DES PERSONNAGES PENDANT la scene "
                f"et leur DEPLACEMENT dans l'espace. Du keyframe start au keyframe end.\n"
                f"Keyframes: {json.dumps(kf, ensure_ascii=False)}\n"
                f"Mouvements lents. Pas de demi-tour. Style neutre.\n"
                f"IMPORTANT: l'attitude et le deplacement doivent etre SPECIFIQUES a cette scene et a son action, "
                f"pas generiques (eviter 'marche et contemple' si l'action est un travail physique ou une celebration).",
                "Deplacements realistes, lents, pas de demi-tour, coherent avec keyframes ET l'action specifique de la scene",
                schema={
                    "attitude_protagoniste": "...",
                    "attitude_partenaire": "...",
                    "deplacement": "description du mouvement dans l'espace",
                    "interaction_continue": "..."
                },
                rules=get_rules("personnages", "technique"),
                validation_level="light"
            )
            return i, {"scene_id": scene_id, **(att if isinstance(att, dict) else {"data": att})}

        attitudes = [None] * len(scenes)
        with ThreadPoolExecutor(max_workers=len(scenes)) as executor:
            futures = [executor.submit(_process, i, s) for i, s in enumerate(scenes)]
            for future in as_completed(futures):
                idx, result = future.result()
                attitudes[idx] = result

        self._scenario["attitudes"] = attitudes

    def _step8_palettes(self):
        self.audit.section("ETAPE 8: PALETTES COULEURS")

        # Palette globale (séquentiel — nécessaire avant les palettes par scène)
        palette_globale = self._ask(
            "8.1 Palette globale",
            f"Definis une PALETTE DE COULEURS GLOBALE pour cette video (5 couleurs principales en hexa). "
            f"Coherente avec: lieu ({self._dream_statement}), ambiance, heure de la journee.",
            "Palette coherente, harmonieuse, adaptee a l'ambiance",
            schema={
                "principale": "#hex",
                "secondaire": "#hex",
                "accent": "#hex",
                "neutre_clair": "#hex",
                "neutre_fonce": "#hex"
            },
            rules=get_rules("coherence"),
            validation_level="light"
        )

        self._scenario["palette_globale"] = palette_globale

        # Palettes par scène (parallèle)
        scenes = self._scenario.get("decoupage", [])
        params_list = self._scenario.get("parametres_scenes", [])

        def _process(i, scene):
            scene_id = scene.get("id", i + 1) if isinstance(scene, dict) else i + 1
            params = self._get_item(params_list, i, {})

            pal = self._ask(
                f"8.{i + 2} Palette scene {scene_id}",
                f"Decline la palette globale pour la scene {scene_id}. "
                f"Moment: {params.get('moment', '?') if isinstance(params, dict) else '?'}. "
                f"Lieu: {params.get('lieu_precis', '?') if isinstance(params, dict) else '?'}. "
                f"Ajustements selon lumiere et ambiance de cette scene specifique.",
                "Declinaison coherente avec palette globale, ajustee a l'heure/lieu",
                schema={
                    "dominante": "#hex",
                    "accent": "#hex",
                    "lumiere": "chaude/froide/neutre",
                    "saturation": "haute/moyenne/basse"
                },
                rules=get_rules("coherence"),
                validation_level="light"
            )
            return i, {"scene_id": scene_id, **(pal if isinstance(pal, dict) else {"data": pal})}

        palettes_scenes = [None] * len(scenes)
        with ThreadPoolExecutor(max_workers=len(scenes)) as executor:
            futures = [executor.submit(_process, i, s) for i, s in enumerate(scenes)]
            for future in as_completed(futures):
                idx, result = future.result()
                palettes_scenes[idx] = result

        self._scenario["palettes_scenes"] = palettes_scenes

    def _step9_cadrage(self):
        self.audit.section("ETAPE 9: CADRAGE")

        scenes = self._scenario.get("decoupage", [])
        cadrages = []

        # Collecter les cadrages déjà choisis pour forcer la variété
        previous_plans = []

        for i, scene in enumerate(scenes):
            scene_id = scene.get("id", i + 1) if isinstance(scene, dict) else i + 1

            variety_hint = ""
            if previous_plans:
                used = ", ".join(f"scene {p[0]}: {p[1]}+{p[2]}" for p in previous_plans)
                variety_hint = (
                    f"\nATTENTION VARIETE: les scenes precedentes utilisent deja [{used}]. "
                    f"VARIE les choix: utilise un type de plan ET/OU un mouvement camera DIFFERENT. "
                    f"Chaque scene doit avoir sa propre identite visuelle."
                )

            cad = self._ask(
                f"9.{i + 1} Cadrage scene {scene_id}",
                f"Definis le CADRAGE pour la scene {scene_id}. "
                f"Type de plan, mouvement camera, angle. "
                f"JUSTIFIE chaque choix avec des arguments cinematographiques professionnels. "
                f"Rappel: PAS de gros plan visage."
                f"{variety_hint}",
                "Choix justifies professionnellement, pas de gros plan, mouvement lent, VARIES entre scenes",
                schema={
                    "type_plan": "plan large/moyen/americain/rapproche poitrine",
                    "justification_plan": "argument cinematographique",
                    "mouvement_camera": "fixe/travelling/panoramique",
                    "justification_mouvement": "argument cinematographique",
                    "angle": "niveau yeux/plongee/contre-plongee",
                    "justification_angle": "argument cinematographique"
                },
                rules=get_rules("cadrage", "technique"),
                validation_level="medium"
            )
            cadrages.append({"scene_id": scene_id, **(cad if isinstance(cad, dict) else {"data": cad})})

            # Mémoriser pour variété
            if isinstance(cad, dict):
                previous_plans.append((
                    scene_id,
                    cad.get("type_plan", "?"),
                    cad.get("mouvement_camera", "?")
                ))

        self._scenario["cadrages"] = cadrages

    def _step10_rythme(self):
        self.audit.section("ETAPE 10: RYTHME")

        duree_totale = self._nb_scenes * self._duree_scene

        rythme = self._ask(
            "10.1 Repartition des durees",
            f"Repartis la duree totale ({duree_totale}s) entre les {self._nb_scenes} scenes. "
            f"Duree moyenne: {self._duree_scene}s. Tu peux ajuster +/-20% par scene. "
            f"JUSTIFIE la repartition avec des arguments professionnels.",
            "La somme fait exactement la duree totale, justifications professionnelles",
            schema={
                "duree_totale": duree_totale,
                "scenes": [
                    {"scene_id": 1, "duree": 0, "justification": "..."}
                ]
            },
            rules=get_rules("rythme"),
            validation_level="light"
        )

        self._scenario["rythme"] = rythme

    def _step11_prompts_finaux(self):
        self.audit.section("ETAPE 11: PROMPTS FINAUX (EN)")

        scenes = self._scenario.get("decoupage", [])
        params_list = self._scenario.get("parametres_scenes", [])
        keyframes_list = self._scenario.get("keyframes", [])
        attitudes_list = self._scenario.get("attitudes", [])
        palettes_list = self._scenario.get("palettes_scenes", [])
        cadrages_list = self._scenario.get("cadrages", [])

        def _process(i, scene):
            scene_id = scene.get("id", i + 1) if isinstance(scene, dict) else i + 1
            params = self._get_item(params_list, i, {})
            kf = self._get_item(keyframes_list, i, {})
            att = self._get_item(attitudes_list, i, {})
            pal = self._get_item(palettes_list, i, {})
            cad = self._get_item(cadrages_list, i, {})

            # Outfit de référence pour le prompt final
            outfit_ref = self._scenario.get("outfit_reference", {})
            outfit_instruction = ""
            if outfit_ref and outfit_ref.get("items"):
                outfit_instruction = (
                    f"\nOUTFIT REFERENCE (MUST appear exactly as described in the prompt):\n"
                    f"{json.dumps(outfit_ref['items'], ensure_ascii=False)}\n"
                    f"Description: {outfit_ref.get('text', '')}\n"
                    f"The character MUST wear EXACTLY these items with these colors and patterns.\n"
                )

            prompt_data = self._ask(
                f"11.{i + 1} Prompt video scene {scene_id}",
                f"""Generate the FINAL PROMPT **in English** for AI video generation of scene {scene_id}.

Parameters (FR): {json.dumps(params, ensure_ascii=False)}
Keyframes (FR): {json.dumps(kf, ensure_ascii=False)}
Attitude (FR): {json.dumps(att, ensure_ascii=False)}
Palette: {json.dumps(pal, ensure_ascii=False)}
Framing (FR): {json.dumps(cad, ensure_ascii=False)}
{outfit_instruction}
The prompt MUST be written in English.
STYLE: Write as DIRECT MODIFICATION INSTRUCTIONS, not as creative brief.
Use imperative form: "Put this person at...", "Change outfit to...", "Show them doing...".
Keep it concise: describe WHAT to show, not rules or constraints.
IMPORTANT: You MUST also provide a French summary (resume_fr) of 2-3 sentences describing the scene.
IMPORTANT: The outfit description MUST be detailed and EXACT (each item with its color and pattern).
Both fields are REQUIRED.""",
                "Prompt complet EN, precis, optimise pour generation IA video",
                schema={
                    "prompt_en": "The full detailed prompt in English for AI video generation (REQUIRED)",
                    "resume_fr": "Resume en francais de 2-3 phrases decrivant la scene (OBLIGATOIRE)"
                },
                rules=get_rules("technique", "personnages", "cadrage", "format")
            )
            if isinstance(prompt_data, dict):
                return i, {
                    "scene_id": scene_id,
                    "prompt": prompt_data.get("prompt_en", ""),
                    "prompt_fr": prompt_data.get("resume_fr", ""),
                }
            else:
                return i, {
                    "scene_id": scene_id,
                    "prompt": str(prompt_data),
                    "prompt_fr": "",
                }

        prompts_video = [None] * len(scenes)
        with ThreadPoolExecutor(max_workers=len(scenes)) as executor:
            futures = [executor.submit(_process, i, s) for i, s in enumerate(scenes)]
            for future in as_completed(futures):
                idx, result = future.result()
                prompts_video[idx] = result

        self._scenario["prompts_video"] = prompts_video

        # Prompt bande son (EN)
        prompt_audio_data = self._ask(
            "11.X Prompt bande son",
            f"""Generate the FINAL PROMPT **in English** for the soundtrack of this dream video.
Mood: {self._dream_statement[:100]}.
Total duration: {self._nb_scenes * self._duree_scene}s.
Also provide a brief French summary.""",
            "Prompt complet EN pour generation musicale IA",
            schema={
                "prompt_en": "The full prompt in English for AI music generation",
                "resume_fr": "Bref résumé en français"
            },
            rules=get_rules("format")
        )

        if isinstance(prompt_audio_data, dict):
            self._scenario["prompt_bande_son"] = {
                "prompt": prompt_audio_data.get("prompt_en", ""),
                "prompt_fr": prompt_audio_data.get("resume_fr", ""),
            }
        else:
            self._scenario["prompt_bande_son"] = str(prompt_audio_data)

    # =========================================================================
    # V7: TRIPLE VALIDATION (V1/V2/V3)
    # =========================================================================

    def _ask(
        self, step: str, question: str, criterion: str,
        schema: dict = None, rules: str = "",
        validation_level: str = "full"
    ) -> Any:
        """Pose une question au LLM avec validation graduée.

        Args:
            step: Identifiant de l'étape (ex: "4.1 Parametres scene 1")
            question: La question posée au LLM
            criterion: Critère de validation V1
            schema: Schéma JSON attendu (optionnel)
            rules: Règles sélectives (via get_rules()). Si vide, pas de règles.
            validation_level: "full" (V1+V2+V3), "medium" (V1+V3),
                              "light" (V1 seul), "none" (pas de validation)
        """
        self.audit.subsection(step)
        self.audit.log(f"? {question[:100]}...")

        # Construire le prompt avec règles sélectives
        rules_block = f"\n{rules}\n" if rules else ""

        if schema:
            schema_str = json.dumps(schema, indent=2, ensure_ascii=False)
            system = (
                f"Reponds avec un JSON structure.{rules_block}"
                f"SCHEMA ATTENDU: {schema_str}\n"
                f'JSON: {{"data": {{...}}, "reasoning": "..."}}'
            )
        else:
            system = (
                f"Reponds de facon precise et complete.{rules_block}"
                f'JSON: {{"answer": "...", "reasoning": "..."}}'
            )

        result = self._call_openai_structured(
            system, f"CONTEXTE:\n{self._context}\n\nQUESTION: {question}",
            self.temp_generation
        )

        if schema:
            answer = result.get("data")
            # Fallback: le LLM a parfois mis les données directement à la racine
            if answer is None:
                meta_keys = {"data", "reasoning", "answer"}
                filtered = {k: v for k, v in result.items() if k not in meta_keys}
                if filtered:
                    answer = filtered
        else:
            answer = result.get("answer")
        reasoning = result.get("reasoning", "")

        self.audit.detail("Reponse", answer)
        self.audit.detail("Raisonnement", reasoning)

        # Validation graduée
        if validation_level != "none":
            v1, v2, v3 = self._validate(
                str(answer), question, criterion, rules, level=validation_level
            )
            self.audit.validation(v1, v2, v3)

            if v3.get("final_pass"):
                self.audit.log("Stocke!")
            else:
                self.audit.log("Stocke avec reserve")

        return answer

    def _validate(
        self, answer: str, question: str, criterion: str,
        rules: str = "", level: str = "full"
    ) -> Tuple[dict, dict, dict]:
        """Validation graduée V1/V2/V3 avec règles sélectives.

        Levels:
            "full":   V1 + V2 + V3 (étapes critiques: keyframes, prompts, pitch)
            "medium": V1 + V3     (étapes importantes: découpage, paramètres, cadrage)
            "light":  V1 seul     (étapes simples: palettes, rythme, blocages, attitudes)
        """
        rules_block = f"\n{rules}\n" if rules else ""
        do_v1 = self.enable_v1 and level in ("full", "medium", "light")
        do_v2 = self.enable_v2 and level == "full"
        do_v3 = self.enable_v3 and level in ("full", "medium")

        # V1: Critère spécifique
        v1 = {"score": 1.0, "passed": True, "feedback": "skip"}
        if do_v1:
            system_v1 = (
                f"VALIDATEUR V1 - Critere specifique\n"
                f"{rules_block}"
                f"Score 0.0-1.0. Minimum {self.validation_min_score} pour passer.\n"
                f'JSON: {{"score": 0.0, "passed": true, "feedback": "...", "suggestion": "..."}}'
            )
            v1 = self._call_openai_structured(
                system_v1,
                f"CONTEXTE:\n{self._context}\n\nQUESTION: {question}\nREPONSE: {answer}\n\nCRITERE: {criterion}",
                self.temp_validation,
                model=self.model_validation,
                is_validation=True
            )
            v1["score"] = float(v1.get("score", 0))
            v1["passed"] = v1["score"] >= self.validation_min_score

        # V2: Méta-cohérence + règles de production (full seulement)
        v2 = {"score": 1.0, "passed": True, "feedback": "skip"}
        if do_v2:
            system_v2 = (
                f"VALIDATEUR V2 - Meta-coherence et regles de production\n"
                f"{rules_block}"
                f"Verifie la coherence globale ET le respect des regles de production.\n"
                f'JSON: {{"score": 0.0, "passed": true, "feedback": "...", "suggestion": "..."}}'
            )
            v2 = self._call_openai_structured(
                system_v2,
                f"CONTEXTE:\n{self._context}\n\nREPONSE: {answer}\n\nV1: {v1['score']:.0%}",
                self.temp_validation,
                model=self.model_validation,
                is_validation=True
            )
            v2["score"] = float(v2.get("score", 0))
            v2["passed"] = v2["score"] >= self.validation_min_score

        # V3: Arbitre final (full + medium)
        v3 = {"final_pass": True, "reasoning": "skip", "confidence": 1.0, "optimization_suggestions": []}
        if do_v3:
            system_v3 = (
                f"VALIDATEUR V3 - Arbitre final\n"
                f"OBJECTIF: Generer une VIDEO de realisation du reve, de qualite professionnelle.\n"
                f"{rules_block}"
                f'JSON: {{"final_pass": true, "reasoning": "...", "optimization_suggestions": ["..."], "confidence": 0.0}}'
            )
            v3 = self._call_openai_structured(
                system_v3,
                f"REPONSE: {answer}\n\nV1: {v1['score']:.0%}\nV2: {v2['score']:.0%}",
                self.temp_validation + 0.1,
                model=self.model_validation,
                is_validation=True
            )
            v3["final_pass"] = v3.get("final_pass", False)
            v3["confidence"] = float(v3.get("confidence", 0.5))

        return v1, v2, v3

    # =========================================================================
    # LLM CALLS
    # =========================================================================

    def _call_openai_structured(
        self, system: str, user: str, temperature: float = 0.7,
        model: str = None, is_validation: bool = False
    ) -> Dict:
        """Appelle OpenAI avec system/user separation et response_format JSON.

        Args:
            model: Modèle à utiliser (défaut: self.model)
            is_validation: Si True, comptabilise les coûts dans costs_validation
        """
        api_key = get_api_key("OPENAI_API_KEY")
        use_model = model or self.model

        payload = {
            "model": use_model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user}
            ],
            "temperature": temperature,
            "max_tokens": 4000,
            "response_format": {"type": "json_object"}
        }

        for attempt in range(self.max_retries):
            try:
                req = urllib.request.Request(
                    "https://api.openai.com/v1/chat/completions",
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
                )

                with urllib.request.urlopen(req, timeout=self.llm_timeout) as response:
                    result = json.loads(response.read().decode("utf-8"))

                usage = result.get("usage", {})
                tokens_in = usage.get("prompt_tokens", 0)
                tokens_out = usage.get("completion_tokens", 0)

                # Comptabilisation séparée (thread-safe)
                with self._costs_lock:
                    self.costs_real["tokens_input"] += tokens_in
                    self.costs_real["tokens_output"] += tokens_out
                    self.costs_real["calls"] += 1

                    if is_validation:
                        self.costs_validation["tokens_input"] += tokens_in
                        self.costs_validation["tokens_output"] += tokens_out
                        self.costs_validation["calls"] += 1
                    else:
                        self.costs_generation["tokens_input"] += tokens_in
                        self.costs_generation["tokens_output"] += tokens_out
                        self.costs_generation["calls"] += 1

                content = result["choices"][0]["message"]["content"]
                return json.loads(content)

            except Exception as e:
                if attempt < self.max_retries - 1:
                    time.sleep(2 ** attempt)
                    print(f"      [Retry {attempt + 1}] {str(e)[:60]}")
                else:
                    print(f"      [ERREUR] {str(e)[:100]}")
                    return {"answer": "", "data": {}, "reasoning": f"Error: {str(e)[:100]}"}

    def _call_openai(self, prompt: str) -> str:
        """Appelle OpenAI (mode simple, pour rétrocompatibilité pub/free_scenes)."""
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

    # =========================================================================
    # HELPERS
    # =========================================================================

    @staticmethod
    def _get_item(lst: list, idx: int, default: Any) -> Any:
        return lst[idx] if idx < len(lst) else default

    def _generate_dream_title(self, pitch: str):
        """Génère un titre évocateur pour le rêve via LLM."""
        try:
            title = self._ask(
                "Titre du rêve",
                f"Invente un TITRE COURT et ÉVOCATEUR pour ce film/rêve.\n\n"
                f"Pitch: {pitch[:500]}\n\n"
                f"Le titre doit être:\n"
                f"- 2 à 5 mots maximum\n"
                f"- Évocateur, poétique ou cinématique\n"
                f"- En rapport avec le rêve (pas générique)\n"
                f"- PAS de guillemets\n\n"
                f"Exemples de bons titres: 'Manhattan Dreams', 'L'Horizon Retrouvé', 'Skyline', 'La Promesse de l'Aube'\n\n"
                f"Réponds UNIQUEMENT avec le titre, rien d'autre.",
                "Titre court, évocateur, en lien avec le rêve",
                validation_level="none"
            )
            if title and isinstance(title, str):
                self._scenario["dream_title"] = title.strip().strip('"').strip("'")
                self.audit.log(f"Titre du rêve: {self._scenario['dream_title']}")
        except Exception as e:
            self.audit.log(f"Erreur génération titre: {e}")

    @staticmethod
    def _extract_title(pitch, dream_title: str = None) -> str:
        if dream_title:
            return dream_title
        if isinstance(pitch, str):
            first_line = pitch.strip().split("\n")[0]
            return first_line[:60] if first_line else "Reve"
        return "Reve"

    @staticmethod
    def _extract_time(params) -> str:
        if not isinstance(params, dict):
            return "afternoon"
        moment = params.get("moment", "").lower()
        if "matin" in moment or "aube" in moment:
            return "morning"
        if "midi" in moment:
            return "midday"
        if "soir" in moment or "crepuscule" in moment or "coucher" in moment:
            return "golden_hour"
        if "nuit" in moment:
            return "night"
        return "afternoon"

    @staticmethod
    def _build_kf_description(kf_data: dict, params: dict, pitch_text: str) -> str:
        parts = []
        if pitch_text:
            parts.append(pitch_text[:200])
        for key in ["position_protagoniste", "emotion", "geste", "interaction"]:
            val = kf_data.get(key, "")
            if val:
                parts.append(f"{key}: {val}")
        if isinstance(params, dict) and params.get("lieu_precis"):
            parts.append(f"Lieu: {params['lieu_precis']}")
        return ". ".join(parts) if parts else "Description de scene"

    @staticmethod
    def _map_shot_type(french_type: str) -> str:
        mapping = {
            "plan d'ensemble": "wide",
            "plan large": "wide",
            "wide": "wide",
            "plan moyen": "medium",
            "medium": "medium",
            "plan americain": "medium_full",
            "cowboy": "medium_full",
            "plan rapproche": "medium",
            "medium close-up": "medium",
            # Nouveaux types
            "profil": "profile",
            "profile": "profile",
            "trois-quarts dos": "back_three_quarter",
            "3/4 dos": "back_three_quarter",
            "back": "back_three_quarter",
            "plan éloigné": "far",
            "très large": "far",
            "extreme wide": "far",
            "far": "far",
        }
        french_lower = french_type.lower()
        for key, val in mapping.items():
            if key in french_lower:
                return val
        return "medium"

    @staticmethod
    def _map_angle(french_angle: str) -> str:
        mapping = {
            "niveau des yeux": "eye_level",
            "niveau yeux": "eye_level",
            "neutre": "eye_level",
            "plongee": "high_angle",
            "contre-plongee": "low_angle",
        }
        french_lower = french_angle.lower()
        for key, val in mapping.items():
            if key in french_lower:
                return val
        return "eye_level"

    @staticmethod
    def _map_camera_movement(french_movement: str) -> str:
        mapping = {
            "fixe": "static",
            "travelling avant": "slow_zoom_in",
            "travelling arriere": "slow_zoom_out",
            "travelling lateral": "tracking",
            "panoramique": "slow_pan_left",
            "handheld": "static",
        }
        french_lower = french_movement.lower()
        for key, val in mapping.items():
            if key in french_lower:
                return val
        return "static"

    # =========================================================================
    # MOCK (DRY RUN)
    # =========================================================================

    def _mock_v7(self, name: str, nb: int) -> Dict:
        scenes = []
        for i in range(nb):
            scenes.append({"id": i + 1, "titre": f"Scene {i + 1}", "de": "debut", "vers": "fin", "action": f"Action {i + 1}"})
        return {
            "blocages_emotionnels": {"blocages": ["blocage 1"], "affirmations": ["affirmation 1"]},
            "pitch_global": f"Pitch global du reve de {name}",
            "decoupage": scenes,
            "outfit_reference": {"text": "Tenue decontractee", "items": [{"item": "t-shirt", "color": "blanc", "pattern": "uni", "material": "coton"}, {"item": "jean", "color": "bleu", "pattern": "uni", "material": "denim"}]},
            "parametres_scenes": [{"scene_id": i + 1, "lieu_precis": f"Lieu {i + 1}", "moment": "apres-midi", "action": f"Action {i + 1}", "tenue_protagoniste": "Tenue decontractee", "outfit_items": [{"item": "t-shirt", "color": "blanc", "pattern": "uni", "material": "coton"}, {"item": "jean", "color": "bleu", "pattern": "uni", "material": "denim"}]} for i in range(nb)],
            "keyframes": [{"scene_id": i + 1, "start": {"position_protagoniste": "Debout", "emotion": "Sourire"}, "end": {"position_protagoniste": "En mouvement", "emotion": "Joie"}} for i in range(nb)],
            "pitchs": [{"scene_id": i + 1, "pitch": f"Pitch scene {i + 1}"} for i in range(nb)],
            "attitudes": [{"scene_id": i + 1, "attitude_protagoniste": "Detendu", "deplacement": "Marche lente"} for i in range(nb)],
            "palette_globale": {"principale": "#4A90D9", "secondaire": "#F5A623", "accent": "#7ED321", "neutre_clair": "#F5F5F5", "neutre_fonce": "#2C3E50"},
            "palettes_scenes": [{"scene_id": i + 1, "dominante": "#4A90D9", "accent": "#F5A623", "lumiere": "chaude", "saturation": "moyenne"} for i in range(nb)],
            "cadrages": [{"scene_id": i + 1, "type_plan": "plan moyen", "mouvement_camera": "fixe", "angle": "niveau des yeux"} for i in range(nb)],
            "rythme": {"duree_totale": nb * 6, "scenes": [{"scene_id": i + 1, "duree": 6} for i in range(nb)]},
            "prompts_video": [{"scene_id": i + 1, "prompt": f"Prompt video scene {i + 1}"} for i in range(nb)],
            "prompt_bande_son": "Musique ambiance douce et inspirante",
            "metadata": {"dream": f"Reve de {name}", "nb_scenes": nb, "duree_scene": 6, "duree_totale": nb * 6},
        }

    # =========================================================================
    # MÉTHODES HÉRITÉES (pub / free_scenes / ancien mode scenario)
    # =========================================================================

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
        """Génère le scénario global structuré (ancien mode)."""
        print("\n" + "=" * 60)
        print("ETAPE 3: SCENARIO GLOBAL (legacy)")
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
            print("  [DRY RUN] Scenario simule")
            return self._mock_global(character_name, nb_scenes, nb_pov_scenes)

        response = self._call_openai(prompt)
        scenario = self._parse_json(response)

        print(f"  > Titre: {scenario.get('title', 'N/A')}")
        print(f"  > {len(scenario.get('scenes', []))} scenes")
        print(f"  > Same day: {scenario.get('same_day', True)}")

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
        print("ETAPE 3: SCENES LIBRES")
        print("=" * 60)

        imposed_str = "Aucune"
        if imposed_scenes:
            lines = []
            for i, s in enumerate(imposed_scenes):
                if s:
                    lines.append(f"Scene {i+1}: " + ", ".join(f"{k}={v}" for k, v in s.items()))
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
            print("  [DRY RUN] Scenes simulees")
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
        """Génère le scénario pub (transition quotidien -> reve + scenes de reve)."""
        print("\n" + "=" * 60)
        print("ETAPE 3: SCENARIO PUB")
        print("=" * 60)

        reject_text = "\n".join(f"- {r}" for r in reject) if reject else "Aucun"
        total_scenes = nb_dream_scenes + 2
        last_scene_id = nb_dream_scenes + 1

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
            print("  [DRY RUN] Scenario pub simule")
            return self._mock_pub_scenario(character_name, nb_dream_scenes)

        response = self._call_openai(prompt)
        scenario = self._parse_json(response)

        print(f"  > Titre: {scenario.get('title', 'N/A')}")
        print(f"  > {len(scenario.get('scenes', []))} scenes (dont 1A + 1B)")

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
        """Génère les descriptions vidéo pour le mode pub."""
        print("\n" + "=" * 60)
        print("ETAPE 4: SCENARIOS VIDEO PUB")
        print("=" * 60)

        scenes = pub_scenario.get("scenes", [])
        title = pub_scenario.get("title", "Spot pub")
        daily_palette = pub_scenario.get("daily_palette", [])
        dream_palette = pub_scenario.get("dream_palette", [])

        video_scenarios = []

        for scene in scenes:
            scene_id = scene["id"]
            scene_type = scene.get("type", "")

            print(f"\n  [Scene {scene_id}] {scene_type} - {scene.get('concept', '')[:40]}")

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
                    age, character_features, False, palette
                )

            vs["scene_id"] = scene_id
            vs["is_pov"] = scene.get("is_pov", False)
            vs["scene_type"] = scene_type
            video_scenarios.append(vs)

            print(f"    > Start: {vs.get('start_keyframe', {}).get('description', '')[:50]}...")

        return video_scenarios

    def generate_video_scenarios(
        self,
        global_scenario: Dict,
        character_name: str,
        character_gender: str,
        age: int,
        character_features: str,
        scene_palettes: Dict[int, List[str]]
    ) -> List[Dict[str, Any]]:
        """Génère les descriptions détaillées par scène (ancien mode)."""
        print("\n" + "=" * 60)
        print("ETAPE 4: SCENARIOS VIDEO (legacy)")
        print("=" * 60)

        scenes = global_scenario.get("scenes", [])
        same_day = global_scenario.get("same_day", True)
        title = global_scenario.get("title", "Reve")

        video_scenarios = []

        for scene in scenes:
            scene_id = scene["id"]
            is_pov = scene.get("is_pov", False)

            print(f"\n  [Scene {scene_id}] {scene.get('phase', scene.get('concept', ''))} {'(POV)' if is_pov else ''}")

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

            print(f"    > Start: {vs.get('start_keyframe', {}).get('description', '')[:50]}...")

        return video_scenarios

    def _generate_standard_scenario(self, scene, title, total, name, gender, age, features, same_day, palette):
        outfit_instruction = "TENUE IDENTIQUE a la scene 1" if same_day else "Tenue peut etre differente"

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
            scene_palette=", ".join(palette) if palette else "non definie",
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
            indoor_outdoor="interieur" if scene.get("indoor") else "exterieur",
            scene_palette=", ".join(palette) if palette else "non definie",
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

    def _generate_pub_1a_scenario(self, scene, title, name, gender, age, features, daily_palette, dream_palette):
        prompt = PROMPT_SCENARIO_PUB_VIDEO_1A.format(
            strict_prefix=self.strict_prefix,
            dream_title=title,
            character_name=name,
            character_gender=gender,
            age=age,
            character_features=features,
            daily_environment=scene.get("daily_environment", "Bureau morne"),
            dream_environment=scene.get("dream_environment", "Lieu de reve"),
            emotional_arc=scene.get("emotional_arc", "lassitude -> emerveillement"),
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
        prompt = PROMPT_SCENARIO_PUB_VIDEO_1B.format(
            strict_prefix=self.strict_prefix,
            dream_title=title,
            character_name=name,
            character_gender=gender,
            age=age,
            character_features=features,
            dream_environment=scene.get("context", "Monde de reve"),
            emotional_beat=scene.get("emotional_beat", "joie, curiosite"),
            dream_palette=", ".join(dream_palette) if dream_palette else "couleurs vives",
            strict_suffix=self.strict_suffix
        )

        if self.verbose:
            print(f"\n--- PROMPT PUB 1B ---\n{prompt}\n---")

        if self.dry_run:
            return self._mock_pub_1b()

        response = self._call_openai(prompt)
        return self._parse_json(response)

    # =========================================================================
    # MOCK (rétrocompatibilité)
    # =========================================================================

    def _mock_global(self, name, nb, nb_pov):
        phases = ["PREPARATION", "DEPART", "DECOUVERTE", "ACTION", "CONNEXION", "ACCOMPLISSEMENT"]
        scenes = []
        pov_assigned = 0
        for i in range(nb):
            is_pov = pov_assigned < nb_pov and i >= nb - nb_pov
            if is_pov:
                pov_assigned += 1
            scenes.append({
                "id": i + 1,
                "phase": phases[i % len(phases)],
                "context": f"Scene {i + 1}",
                "emotional_beat": "Progression",
                "time_of_day": ["morning", "midday", "golden_hour", "sunset"][i % 4],
                "indoor": i % 2 == 0,
                "is_pov": is_pov
            })
        return {"title": f"Reve de {name}", "same_day": True, "scenes": scenes}

    def _mock_video_scenario(self, scene):
        return {
            "start_keyframe": {
                "description": f"Debut scene {scene.get('id', 1)}",
                "location": "Lieu",
                "pose": "Pose initiale",
                "expression": "Expression naturelle",
                "expression_intensity": "moderate",
                "gaze_direction": "away_left",
                "outfit": "Tenue",
                "accessories": ""
            },
            "end_keyframe": {
                "description": "Fin scene",
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
                "foreground": "Main tenant cafe",
                "midground": "Horizon mer",
                "background": "Ciel",
                "lighting": "Lumiere doree"
            },
            "end_keyframe": {
                "description": "Vue legerement changee",
                "change": "Lumiere plus chaude"
            },
            "action": "Leger mouvement",
            "shooting": {"depth_of_field": "shallow", "lighting_temperature": "warm"}
        }

    def _mock_pub_scenario(self, name, nb_dream):
        scenes = [
            {
                "id": "1A", "type": "TRANSITION_AWAKENING",
                "concept": "Du bureau au reve",
                "daily_environment": "Bureau gris et morne",
                "dream_environment": "Atelier lumineux",
                "emotional_arc": "lassitude -> emerveillement",
                "time_of_day": "morning", "indoor": True, "is_pov": False,
                "allows_camera_look": False
            },
            {
                "id": "1B", "type": "TRANSITION_ACTION",
                "concept": "Premiers pas dans le reve",
                "context": "Exploration de l'atelier",
                "emotional_beat": "joie, curiosite",
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
                "concept": f"Scene de reve {i + 2}",
                "context": f"Contexte scene {i + 2}",
                "emotional_beat": "Joie",
                "time_of_day": ["morning", "afternoon", "golden_hour", "sunset"][i % 4],
                "indoor": i % 2 == 0,
                "is_pov": False,
                "has_character_b": False,
                "allows_camera_look": is_last
            })
        return {
            "title": f"Pub reve de {name}",
            "daily_context_description": "Bureau morne",
            "daily_palette": ["#9E9E9E", "#BDBDBD", "#E0E0E0", "#F5F5F5"],
            "dream_palette": ["#FF6B35", "#F7C59F", "#1A535C", "#4ECDC4"],
            "character_b": {"present": False},
            "scenes": scenes
        }

    def _mock_pub_1a(self):
        return {
            "start_keyframe": {
                "description": "Personnage dans bureau gris, face a droite, posture voutee",
                "location": "Bureau open space terne",
                "pose": "Face a droite, legerement voute, bras le long du corps",
                "expression": "Lassitude, ennui",
                "expression_intensity": "moderate",
                "gaze_direction": "down",
                "outfit": "Chemise grise, pantalon sombre",
                "accessories": ""
            },
            "end_keyframe": {
                "description": "Meme personnage dans atelier lumineux, tete relevee",
                "location": "Atelier creatif lumineux",
                "pose": "Tete relevee, corps redresse",
                "expression": "Emerveillement, surprise joyeuse",
                "expression_intensity": "moderate",
                "gaze_direction": "up",
                "outfit": "Meme chemise grise",
                "accessories": ""
            },
            "action": "L'environnement se transforme du bureau gris a l'atelier lumineux",
            "shooting": {
                "shot_type": "medium_full", "camera_angle": "eye_level",
                "camera_movement": "static", "lighting_direction": "front",
                "lighting_temperature": "cool_to_warm", "depth_of_field": "medium",
                "focus_on": "face"
            }
        }

    def _mock_pub_1b(self):
        return {
            "start_keyframe": {
                "description": "Personnage emerveille dans atelier lumineux (= end 1A)",
                "location": "Atelier creatif lumineux",
                "pose": "Tete relevee, corps redresse",
                "expression": "Emerveillement",
                "expression_intensity": "moderate",
                "gaze_direction": "up"
            },
            "end_keyframe": {
                "description": "Personnage explorant l'atelier, tourne vers la gauche",
                "location": "Atelier creatif lumineux",
                "pose": "En mouvement, premier pas, orientation vers la gauche",
                "expression": "Joie, curiosite",
                "expression_intensity": "moderate",
                "gaze_direction": "away_left"
            },
            "action": "Le personnage fait ses premiers pas dans le monde de reve",
            "shooting": {
                "shot_type": "medium_full", "camera_angle": "eye_level",
                "camera_movement": "slow_pan_left", "lighting_direction": "side",
                "lighting_temperature": "warm", "depth_of_field": "medium",
                "focus_on": "full_body"
            }
        }

    # =========================================================================
    # COÛT
    # =========================================================================

    def get_real_cost(self) -> float:
        costs = self.config.get("costs", {})
        # Coût génération (GPT-4o)
        gen_in = (self.costs_generation["tokens_input"] / 1000) * costs.get("scenario_input_per_1k", 0.005)
        gen_out = (self.costs_generation["tokens_output"] / 1000) * costs.get("scenario_output_per_1k", 0.015)
        # Coût validation (GPT-4o-mini)
        val_in = (self.costs_validation["tokens_input"] / 1000) * costs.get("validation_input_per_1k", 0.00015)
        val_out = (self.costs_validation["tokens_output"] / 1000) * costs.get("validation_output_per_1k", 0.0006)
        return gen_in + gen_out + val_in + val_out

    def get_cost_breakdown(self) -> Dict:
        """Détail des coûts génération vs validation."""
        costs = self.config.get("costs", {})
        gen_in = (self.costs_generation["tokens_input"] / 1000) * costs.get("scenario_input_per_1k", 0.005)
        gen_out = (self.costs_generation["tokens_output"] / 1000) * costs.get("scenario_output_per_1k", 0.015)
        val_in = (self.costs_validation["tokens_input"] / 1000) * costs.get("validation_input_per_1k", 0.00015)
        val_out = (self.costs_validation["tokens_output"] / 1000) * costs.get("validation_output_per_1k", 0.0006)
        return {
            "generation": {
                "model": self.model,
                "calls": self.costs_generation["calls"],
                "tokens": self.costs_generation["tokens_input"] + self.costs_generation["tokens_output"],
                "cost_usd": gen_in + gen_out,
            },
            "validation": {
                "model": self.model_validation,
                "calls": self.costs_validation["calls"],
                "tokens": self.costs_validation["tokens_input"] + self.costs_validation["tokens_output"],
                "cost_usd": val_in + val_out,
            },
            "total_usd": gen_in + gen_out + val_in + val_out,
        }
