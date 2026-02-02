"""
Sublym v4 - Dream Pipeline
VERSION CORRIGÉE - Février 2026
- Retry sur échec vidéo (max 4 tentatives)
- Validation de complétude avant montage
- Échec global si vidéos manquantes
- Nommage répertoire avec titre du rêve
- Pas de création de répertoire vide si erreur précoce
- Nouvelle étape 0: extraction éléments du rêve
"""

import json
import shutil
import uuid
from typing import Dict, List, Any, Optional
from pathlib import Path
from datetime import datetime

from services import (
    CharacterAnalyzer, PaletteGenerator, ScenarioGenerator,
    ImageGenerator, ImageValidator, VideoGenerator, VideoMontage,
    DreamAnalyzer  # NOUVEAU
)


class DreamPipeline:
    """Pipeline modulaire."""

    MAX_VIDEO_ATTEMPTS = 4

    def __init__(self, output_dir: str, dry_run: bool = False, verbose: bool = False, config: Dict = None,
                 on_progress: Any = None):
        self.output_dir = Path(output_dir)
        self.dry_run = dry_run
        self.verbose = verbose
        self.config = config or {}
        self.on_progress = on_progress  # Callback: (progress_pct, step_name, message)
        
        self.dream_analyzer = DreamAnalyzer(config, dry_run, verbose)  # NOUVEAU
        self.analyzer = CharacterAnalyzer(config, dry_run, verbose)
        self.palette_gen = PaletteGenerator(config, dry_run, verbose)
        self.scenario_gen = ScenarioGenerator(config, dry_run, verbose)
        self.image_gen = ImageGenerator(config, dry_run, verbose)
        self.validator = ImageValidator(config, dry_run, verbose)
        self.video_gen = VideoGenerator(config, str(self.output_dir / "videos_temp"), dry_run, verbose)
        self.montage = VideoMontage(verbose)
        
        self.run_id = None
        self.run_dir = None
        self._dirs_created = False  # Pour éviter les répertoires vides

    def _emit_progress(self, progress: int, step: str, message: str):
        """Emit progress if callback is set."""
        if self.on_progress:
            self.on_progress(progress, step, message)
    
    def run(self, steps: Dict[str, bool], dream_statement: str = "", user_photos: List[str] = None,
            character_name: str = "Character", character_gender: str = "female",
            keyframes_dir: str = None, videos_dir: str = None, scenario_json: str = None,
            reject: List[str] = None, daily_context: str = "") -> Dict:
        
        # Génération de l'ID de run
        self.run_id = str(uuid.uuid4())[:8]
        dream_slug = self._slugify(dream_statement[:40]) if dream_statement else "dream"
        char_slug = self._slugify(character_name)
        self.run_dir = self.output_dir / f"{char_slug}_{dream_slug}_{self.run_id}"
        
        # NE PAS créer les répertoires tout de suite - attendre la première opération réussie
        
        print("=" * 70)
        print("SUBLYM v4 - DREAM PIPELINE")
        print("=" * 70)
        print(f"👤 {character_name} | 📁 {self.run_dir}")
        print(f"🧪 Dry: {self.dry_run} | 📝 Verbose: {self.verbose}")
        print("=" * 70)
        
        results = {
            "run_id": self.run_id,
            "steps_executed": [],
            "success": False,
            "costs_real": {},
            "errors": [],
            "warnings": []
        }
        
        try:
            state = {
                "user_photos": user_photos or [],
                "character_analysis": None,
                "style_description": "classique",  # NOUVEAU
                "dream_elements": None,  # NOUVEAU
                "main_palette": self.config.get("custom_palette"),
                "palette_mood": "",
                "global_scenario": None,
                "video_scenarios": None,
                "scene_palettes": {},
                "keyframe_paths": {},
                "video_paths": [],
                "failed_videos": [],
            }
            
            # Load existing data
            if scenario_json and Path(scenario_json).exists():
                with open(scenario_json) as f:
                    state["global_scenario"] = json.load(f)
            if keyframes_dir:
                state["keyframe_paths"] = self._load_keyframes(keyframes_dir)
            if videos_dir:
                state["video_paths"] = [str(p) for p in sorted(Path(videos_dir).glob("scene_*.mp4"))]
            
            nb_scenes = self.config.get("nb_scenes", 6)
            nb_pov = self.config.get("nb_pov_scenes", 1)
            mode = self.config.get("mode", "scenario")
            max_attempts = self.config.get("max_attempts", 7)
            
            # ================================================================
            # ÉTAPE 1: ANALYSE PERSONNAGE
            # ================================================================
            self._emit_progress(10, "analyze_character", "Analyse du personnage...")
            if steps.get("analyze_character") and state["user_photos"]:
                state["character_analysis"] = self.analyzer.analyze(state["user_photos"])
                
                # Déduire le style vestimentaire
                state["style_description"] = self._deduce_style(state["character_analysis"])
                
                results["steps_executed"].append("analyze_character")
                self._ensure_dirs()
                self._save_json("character_analysis.json", state["character_analysis"])
                
                # Initialiser le FaceValidator avec le run_dir
                self.validator.set_run_dir(str(self.run_dir))
            
            age = state.get("character_analysis", {}).get("age_estimate", 40)
            
            # ================================================================
            # ÉTAPE 0 (NOUVELLE): EXTRACTION DES ÉLÉMENTS DU RÊVE
            # ================================================================
            self._emit_progress(15, "extract_dream_elements", "Extraction des éléments du rêve...")
            if steps.get("extract_dream_elements"):
                state["dream_elements"] = self.dream_analyzer.extract_elements(
                    dream_statement=dream_statement,
                    character_name=character_name,
                    character_gender=character_gender,
                    age=age,
                    style_description=state["style_description"]
                )
                results["steps_executed"].append("extract_dream_elements")
                self._ensure_dirs()
                self._save_json("dream_elements.json", state["dream_elements"])
                
                # Afficher les éléments extraits
                print(f"\n  📋 Éléments explicites: {state['dream_elements'].get('user_explicit_elements', [])}")
                print(f"  💭 Désirs implicites: {state['dream_elements'].get('user_implicit_desires', [])}")
                if state['dream_elements'].get('character_b', {}).get('present'):
                    print(f"  👥 Character B: {state['dream_elements']['character_b'].get('role', 'présent')}")
            
            # ================================================================
            # ÉTAPE 2: PALETTE
            # ================================================================
            self._emit_progress(20, "generate_palette", "Génération de la palette de couleurs...")
            if steps.get("generate_palette"):
                mood_keywords = state.get("dream_elements", {}).get("mood_keywords", [])
                
                palette_result = self.palette_gen.generate_main_palette(
                    dream_statement=dream_statement,
                    style_description=state["style_description"],
                    mood_keywords=mood_keywords,
                    custom_palette=self.config.get("custom_palette")
                )
                state["main_palette"] = palette_result.get("main_palette", [])
                state["palette_mood"] = palette_result.get("mood", "")
                results["steps_executed"].append("generate_palette")
                self._ensure_dirs()
                self._save_json("palette.json", palette_result)
            
            # ================================================================
            # ÉTAPE 3: SCÉNARIO GLOBAL
            # ================================================================
            self._emit_progress(25, "generate_scenario", "Création du scénario...")
            if steps.get("generate_scenario"):
                dream_elements_json = json.dumps(state.get("dream_elements", {}), ensure_ascii=False)

                if mode == "scenario_pub":
                    state["global_scenario"] = self.scenario_gen.generate_pub_scenario(
                        dream_statement=dream_statement,
                        daily_context=daily_context or self.config.get("daily_context", ""),
                        character_name=character_name,
                        character_gender=character_gender,
                        age=age,
                        nb_dream_scenes=nb_scenes,  # nb_scenes = scènes de rêve (hors 1A/1B)
                        dream_elements_json=dream_elements_json,
                        reject=reject
                    )
                elif mode == "free_scenes":
                    result = self.scenario_gen.generate_free_scenes(
                        dream_statement=dream_statement,
                        character_name=character_name,
                        character_gender=character_gender,
                        age=age,
                        nb_scenes=nb_scenes,
                        nb_pov_scenes=nb_pov,
                        dream_elements_json=dream_elements_json,
                        imposed_scenes=self.config.get("imposed_scenes"),
                        reject=reject
                    )
                    state["global_scenario"] = {
                        "title": result.get("title", "Scènes libres"),
                        "same_day": True,
                        "scenes": result.get("scenes", []),
                        "character_b": result.get("character_b", {})
                    }
                else:
                    state["global_scenario"] = self.scenario_gen.generate_global_scenario(
                        dream_statement=dream_statement,
                        character_name=character_name,
                        character_gender=character_gender,
                        age=age,
                        nb_scenes=nb_scenes,
                        nb_pov_scenes=nb_pov,
                        dream_elements_json=dream_elements_json,
                        reject=reject
                    )

                results["steps_executed"].append("generate_scenario")
                self._ensure_dirs()
                self._save_json("scenario_global.json", state["global_scenario"])

                # Validation de couverture des éléments
                if state.get("dream_elements"):
                    coverage = self._validate_elements_coverage(
                        state["dream_elements"],
                        state["global_scenario"]
                    )
                    if coverage["coverage_ratio"] < 0.6:
                        results["warnings"].append(
                            f"Couverture éléments du rêve: {coverage['coverage_ratio']:.0%} (< 60%)"
                        )
                        print(f"\n  ⚠️ Couverture éléments: {coverage['coverage_ratio']:.0%}")
                        print(f"     Manquants: {coverage.get('missing', [])}")
            
            # ================================================================
            # ÉTAPE 4: SCÈNES VIDÉO
            # ================================================================
            self._emit_progress(35, "generate_scenes", "Élaboration des scènes vidéo...")
            if steps.get("generate_scenes") and state["global_scenario"]:
                # Générer palettes par scène (sauf pour les scènes de transition pub
                # qui utilisent daily_palette / dream_palette du scénario)
                for scene in state["global_scenario"].get("scenes", []):
                    sid = scene.get("id", 1)
                    scene_type = scene.get("type", "")
                    # Les scènes de transition pub ont leur propre palette
                    if scene_type in ("TRANSITION_AWAKENING", "TRANSITION_ACTION"):
                        continue
                    if state["main_palette"]:
                        sp = self.palette_gen.generate_scene_palette(
                            state["main_palette"], state["palette_mood"],
                            scene.get("time_of_day", "afternoon"), scene.get("indoor", False),
                            scene.get("atmosphere", "")
                        )
                        state["scene_palettes"][sid] = sp.get("scene_palette", state["main_palette"])

                features = self.analyzer.format_for_prompt(state["character_analysis"]) if state.get("character_analysis") else ""

                if mode == "scenario_pub":
                    state["video_scenarios"] = self.scenario_gen.generate_pub_video_scenarios(
                        pub_scenario=state["global_scenario"],
                        character_name=character_name,
                        character_gender=character_gender,
                        age=age,
                        character_features=features,
                        scene_palettes=state["scene_palettes"]
                    )
                else:
                    state["video_scenarios"] = self.scenario_gen.generate_video_scenarios(
                        global_scenario=state["global_scenario"],
                        character_name=character_name,
                        character_gender=character_gender,
                        age=age,
                        character_features=features,
                        scene_palettes=state["scene_palettes"]
                    )
                results["steps_executed"].append("generate_scenes")
                self._save_json("scenarios_video.json", state["video_scenarios"])
            
            # ================================================================
            # ÉTAPES 5-6: KEYFRAMES
            # ================================================================
            self._emit_progress(40, "generate_keyframes", "Génération des images clés...")
            if steps.get("generate_keyframes") and state["video_scenarios"]:
                same_day = state["global_scenario"].get("same_day", True)
                is_pub_mode = mode == "scenario_pub"
                total_kf_scenes = len(state["video_scenarios"])

                for idx, vs in enumerate(state["video_scenarios"]):
                    scene_id = vs["scene_id"]
                    sid = self._sid(scene_id)
                    is_pov = vs.get("is_pov", False)
                    is_first = idx == 0
                    is_last = idx == total_kf_scenes - 1
                    scene_type = vs.get("scene_type", "")

                    # Palette : en mode pub, les scènes de transition utilisent
                    # la dream_palette du scénario ; les scènes standard, leur palette dérivée
                    if is_pub_mode and scene_type in ("TRANSITION_AWAKENING", "TRANSITION_ACTION"):
                        palette = state["global_scenario"].get("dream_palette", state["main_palette"] or [])
                    else:
                        palette = state["scene_palettes"].get(scene_id, state["main_palette"] or [])

                    shooting = vs.get("shooting", {})

                    # same_day : en mode pub, False pour les scènes de rêve (2+)
                    scene_same_day = False if is_pub_mode else same_day

                    # Progress: 40-65% for keyframes
                    kf_pct = 40 + int(25 * idx / max(total_kf_scenes, 1))
                    self._emit_progress(kf_pct, "generate_keyframes", f"Images clés scène {scene_id}/{total_kf_scenes}...")
                    print(f"\n{'='*70}\nSCÈNE {scene_id} {'(POV)' if is_pov else ''} {scene_type}\n{'='*70}")

                    for kf_type in ["start", "end"]:
                        kf_desc = vs.get(f"{kf_type}_keyframe", {})
                        path = self.run_dir / "keyframes" / f"{kf_type}_keyframe_{sid}.png"

                        # Mode pub : le start de 1B = le end de 1A (copie du fichier)
                        if is_pub_mode and scene_type == "TRANSITION_ACTION" and kf_type == "start":
                            end_1a_path = state["keyframe_paths"].get("end_1A")
                            if end_1a_path and Path(end_1a_path).exists():
                                shutil.copy2(end_1a_path, str(path))
                                state["keyframe_paths"][f"start_{sid}"] = str(path)
                                print(f"  [START] Copié depuis end_1A (keyframe partagé)")
                                continue

                        # Refs pour génération - TOUTES les photos user
                        gen_refs = []
                        if not is_pov and state["user_photos"]:
                            gen_refs.extend(state["user_photos"][:3])
                        if kf_type == "end":
                            start_ref = state["keyframe_paths"].get(f"start_{sid}")
                            if start_ref:
                                gen_refs.append(start_ref)
                        elif not is_first and scene_same_day:
                            # Référence à la première scène pour cohérence same_day
                            first_sid = self._sid(state["video_scenarios"][0]["scene_id"])
                            prev_ref = state["keyframe_paths"].get(f"start_{first_sid}")
                            if prev_ref:
                                gen_refs.append(prev_ref)

                        # Génération avec retry
                        success = False
                        for attempt in range(max_attempts):
                            print(f"\n  [{kf_type.upper()}] Tentative {attempt + 1}/{max_attempts}")

                            gen_result = self.image_gen.generate_keyframe(
                                kf_desc, shooting, gen_refs, palette, scene_same_day, is_pov, str(path),
                                allows_camera_look=(is_last and kf_type == "end")
                            )

                            if not gen_result.get("success"):
                                continue

                            # Validation
                            if steps.get("validate_keyframes") and not is_pov:
                                first_sid = self._sid(state["video_scenarios"][0]["scene_id"])
                                val_refs = {
                                    "user_photo": state["user_photos"][0] if state["user_photos"] else None,
                                    "previous": state["keyframe_paths"].get(f"start_{first_sid}"),
                                    "start_current": state["keyframe_paths"].get(f"start_{sid}"),
                                }
                                # Construire description complète pour le validateur
                                val_desc_parts = [kf_desc.get("description", "")]
                                if kf_desc.get("outfit"):
                                    val_desc_parts.append(f"Outfit: {kf_desc['outfit']}")
                                if kf_desc.get("accessories"):
                                    val_desc_parts.append(f"Accessories: {kf_desc['accessories']}")
                                if kf_desc.get("pose"):
                                    val_desc_parts.append(f"Pose: {kf_desc['pose']}")
                                if kf_desc.get("expression"):
                                    val_desc_parts.append(f"Expression: {kf_desc['expression']}")
                                if kf_desc.get("gaze_direction"):
                                    val_desc_parts.append(f"Gaze: {kf_desc['gaze_direction']}")
                                if vs.get("action"):
                                    val_desc_parts.append(f"Action: {vs['action']}")
                                if shooting.get("shot_type"):
                                    val_desc_parts.append(f"Shot: {shooting['shot_type']}, Angle: {shooting.get('camera_angle','')}, Light: {shooting.get('lighting_direction','')}/{shooting.get('lighting_temperature','')}, DoF: {shooting.get('depth_of_field','')}")

                                # Critères additionnels pour les scènes de transition pub
                                extra_criteria = None
                                if is_pub_mode and scene_type in ("TRANSITION_AWAKENING", "TRANSITION_ACTION"):
                                    extra_criteria = self.config.get("validation_config_pub_transition", {})

                                val_result = self.validator.validate(
                                    image_path=str(path),
                                    references=val_refs,
                                    scene_id=scene_id,
                                    kf_type=kf_type,
                                    palette=palette,
                                    description="\n".join(val_desc_parts),
                                    attempt=attempt + 1,
                                    extra_criteria=extra_criteria
                                )

                                if val_result.get("passed"):
                                    print(f"      ✅ OK (score: {val_result.get('global_score', 0):.2f})")
                                    success = True
                                    break
                                else:
                                    print(f"      ❌ {val_result.get('failures', [])[:3]}")
                            else:
                                success = True
                                break

                        if success or attempt == max_attempts - 1:
                            state["keyframe_paths"][f"{kf_type}_{sid}"] = str(path)
                            if is_first and kf_type == "start":
                                first_sid = self._sid(scene_id)
                                state["keyframe_paths"][f"start_{first_sid}"] = str(path)

                results["steps_executed"].append("generate_keyframes")
                if steps.get("validate_keyframes"):
                    results["steps_executed"].append("validate_keyframes")
            
            # ================================================================
            # ÉTAPE 7: VIDÉOS AVEC RETRY
            # ================================================================
            self._emit_progress(65, "generate_videos", "Génération des vidéos...")
            if steps.get("generate_videos"):
                state["video_paths"] = []
                state["failed_videos"] = []

                total_scenes = len(state.get("video_scenarios") or [])

                for idx, vs in enumerate(state.get("video_scenarios") or []):
                    scene_id = vs.get("scene_id", 1)
                    sid = self._sid(scene_id)
                    start_p = state["keyframe_paths"].get(f"start_{sid}")
                    end_p = state["keyframe_paths"].get(f"end_{sid}")

                    if not start_p or not end_p:
                        print(f"\n⚠️ Scène {scene_id}: Keyframes manquants, skip")
                        state["failed_videos"].append(scene_id)
                        results["warnings"].append(f"Scene {scene_id}: missing keyframes")
                        continue

                    video_path = self.run_dir / "videos" / f"scene_{sid}.mp4"
                    shooting = vs.get("shooting", {})

                    # Progress: 65-92% for videos
                    vid_pct = 65 + int(27 * idx / max(total_scenes, 1))
                    self._emit_progress(vid_pct, "generate_videos", f"Vidéo scène {scene_id}/{total_scenes}...")

                    # RETRY LOOP
                    video_success = False
                    for attempt in range(self.MAX_VIDEO_ATTEMPTS):
                        print(f"\n--- VIDÉO SCÈNE {scene_id} - Tentative {attempt + 1}/{self.MAX_VIDEO_ATTEMPTS} ---")
                        
                        result = self.video_gen.generate(
                            start_p, end_p, vs.get("action", ""),
                            shooting.get("camera_movement", "static"),
                            vs.get("is_pov", False), 6, str(video_path))
                        
                        if result.get("success"):
                            print(f"   ✅ Vidéo scène {scene_id} générée")
                            state["video_paths"].append(str(video_path))
                            video_success = True
                            break
                        else:
                            error_msg = result.get("error", "Unknown error")
                            print(f"   ❌ Échec: {error_msg}")
                            if attempt < self.MAX_VIDEO_ATTEMPTS - 1:
                                print(f"   🔄 Nouvelle tentative...")
                    
                    if not video_success:
                        print(f"\n❌ ÉCHEC DÉFINITIF: Scène {scene_id} après {self.MAX_VIDEO_ATTEMPTS} tentatives")
                        state["failed_videos"].append(scene_id)
                        results["errors"].append(f"Scene {scene_id}: video generation failed")
                
                results["steps_executed"].append("generate_videos")
                
                # Validation de complétude
                videos_generated = len(state["video_paths"])
                videos_failed = len(state["failed_videos"])
                
                print(f"\n{'='*70}")
                print(f"BILAN VIDÉOS: {videos_generated}/{total_scenes} générées")
                if videos_failed > 0:
                    print(f"⚠️ Scènes en échec: {state['failed_videos']}")
                print("=" * 70)
                
                if videos_failed > 0:
                    results["errors"].append(f"{videos_failed} video(s) failed")
                    results["success"] = False
                    steps["generate_montage"] = False
            
            # ================================================================
            # ÉTAPE 8: MONTAGE
            # ================================================================
            self._emit_progress(93, "generate_montage", "Montage final de la vidéo...")
            if steps.get("generate_montage"):
                if not state["video_paths"]:
                    print("\n❌ Aucune vidéo à monter!")
                    results["errors"].append("No videos to concatenate")
                    results["success"] = False
                elif state.get("failed_videos"):
                    print(f"\n❌ Montage annulé: {len(state['failed_videos'])} vidéo(s) manquante(s)")
                    results["success"] = False
                elif self.dry_run:
                    final_path = self.run_dir / "final.mp4"
                    print(f"\n[DRY RUN] Montage simulé: {final_path}")
                    results["final_video"] = str(final_path)
                    results["success"] = True
                    results["steps_executed"].append("generate_montage")
                else:
                    final_path = self.run_dir / "final.mp4"
                    result = self.montage.concat(state["video_paths"], str(final_path))
                    if result.get("success"):
                        results["final_video"] = str(final_path)
                        results["success"] = True
                        print(f"\n✅ Montage final: {final_path}")
                    else:
                        results["errors"].append("Montage failed")
                        results["success"] = False
                    results["steps_executed"].append("generate_montage")
            
            # Succès si pas de montage demandé et pas d'erreurs
            if (not steps.get("generate_montage") or self.dry_run) and not results["errors"]:
                results["success"] = True
            
            # Metadata pour le backend
            results["scenario_name"] = state.get("global_scenario", {}).get("title", "")
            results["scenes_count"] = len(state.get("video_scenarios") or state.get("global_scenario", {}).get("scenes", []))
            results["total_duration"] = len(state.get("video_paths", [])) * 6

            # Coûts réels
            results["costs_real"] = {
                "dream_analyzer": self.dream_analyzer.get_real_cost(),
                "character_analyzer": self.analyzer.get_real_cost(),
                "palette_generator": self.palette_gen.get_real_cost(),
                "scenario_generator": self.scenario_gen.get_real_cost(),
                "image_generator": self.image_gen.get_real_cost(),
                "image_validator": self.validator.get_real_cost(),
                "video_generator": self.video_gen.get_real_cost(),
                "video_montage": self.montage.get_real_cost(),
            }
            
        except Exception as e:
            print(f"\n❌ ERREUR: {e}")
            results["error"] = str(e)
            results["errors"].append(str(e))
            import traceback
            traceback.print_exc()
        
        # Sauvegarder seulement si des répertoires ont été créés
        if self._dirs_created:
            self._save_json("results.json", results)
        
        self._print_summary(results)
        
        return results
    
    @staticmethod
    def _sid(scene_id) -> str:
        """Formate un scene_id pour les noms de fichiers et clés dict.
        Gère les IDs string ('1A', '1B') et int (2, 3, ...)."""
        if isinstance(scene_id, str):
            return scene_id
        return f"{scene_id:02d}"

    def _ensure_dirs(self):
        """Crée les répertoires seulement quand nécessaire."""
        if not self._dirs_created:
            for d in ["keyframes", "videos", "json"]:
                (self.run_dir / d).mkdir(parents=True, exist_ok=True)
            self._dirs_created = True
    
    def _deduce_style(self, analysis: Dict) -> str:
        """Déduit le style vestimentaire de l'analyse."""
        if not analysis:
            return "classique"
        
        accessories = analysis.get("accessories", [])
        hair = analysis.get("hair", {})
        
        # Logique simple pour déduire le style
        if len(accessories) > 2:
            return "créatif/excentrique"
        if hair.get("color_name") in ["red", "white", "gray"]:
            return "affirmé"
        return "classique/sobre"
    
    def _validate_elements_coverage(self, dream_elements: Dict, scenario: Dict) -> Dict:
        """Valide que les éléments du rêve sont couverts par le scénario."""
        explicit = dream_elements.get("user_explicit_elements", [])
        scenes_text = " ".join([
            f"{s.get('concept', '')} {s.get('action', '')} {s.get('location', '')}"
            for s in scenario.get("scenes", [])
        ]).lower()
        
        covered = []
        missing = []
        
        for elem in explicit:
            # Recherche simple - peut être améliorée
            if any(word in scenes_text for word in elem.lower().split()):
                covered.append(elem)
            else:
                missing.append(elem)
        
        ratio = len(covered) / len(explicit) if explicit else 1.0
        
        return {
            "covered": covered,
            "missing": missing,
            "coverage_ratio": ratio
        }
    
    def _load_keyframes(self, kf_dir):
        paths = {}
        for f in Path(kf_dir).glob("start_keyframe_*.png"):
            num = f.stem.replace("start_keyframe_", "")
            paths[f"start_{num}"] = str(f)
            if num == "01":
                paths["start_01"] = str(f)
        for f in Path(kf_dir).glob("end_keyframe_*.png"):
            num = f.stem.replace("end_keyframe_", "")
            paths[f"end_{num}"] = str(f)
        return paths
    
    def _save_json(self, filename, data):
        self._ensure_dirs()
        with open(self.run_dir / "json" / filename, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False, default=str)
    
    def _slugify(self, text):
        import re
        text = re.sub(r'[^a-zA-Z0-9\s]', '', text.lower())
        text = re.sub(r'\s+', '_', text.strip())
        return text[:30] if text else "untitled"
    
    def _print_summary(self, results):
        print(f"\n{'='*70}\nRÉSUMÉ\n{'='*70}")
        print(f"📋 Étapes: {', '.join(results.get('steps_executed', []))}")
        print(f"📁 Output: {self.run_dir}")
        
        if results.get("final_video"):
            print(f"🎬 Vidéo: {results['final_video']}")
        
        if results.get("warnings"):
            print(f"\n⚠️ WARNINGS:")
            for w in results["warnings"]:
                print(f"   - {w}")
        
        if results.get("errors"):
            print(f"\n❌ ERREURS:")
            for e in results["errors"]:
                print(f"   - {e}")
        
        if results.get("costs_real"):
            total = sum(results["costs_real"].values())
            print(f"\n💰 Coût réel total: {total:.4f}€")
        
        if results.get("success"):
            print("\n✅ Succès!")
        else:
            print("\n❌ ÉCHEC - Voir les erreurs ci-dessus")
        
        report = self.validator.get_failure_report()
        if "Aucune" not in report:
            print(report)
